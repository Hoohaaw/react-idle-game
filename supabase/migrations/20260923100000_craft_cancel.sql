-- Cancel/abandon craft, with FULL reagent refund (ADR-0052). Also closes the exploit flagged as
-- an open risk in ADR-0052: craft-claim previously seeded its rarity roll from started_at, which
-- is client-readable under RLS, and the roll algorithm is client-bundled — so a full refund on
-- cancel would let a player compute the outcome client-side before committing, cancel bad rolls,
-- and restart for a fresh (predictable) roll at zero net cost. Fixed by (b) below: a new
-- server-only roll_seed column, hidden from the client via column-level GRANT, replaces
-- started_at as the claim-time rng seed (see craft-claim/index.ts).

-- a) Reagents (what was spent, so cancel can refund the exact amounts later — correct even if the
-- recipe changed in Sanity since the run started) and a server-only roll seed.
alter table public.craft_runs
  add column resource_reagents jsonb not null default '[]'::jsonb,
  add column item_reagents     jsonb not null default '[]'::jsonb,
  add column roll_seed         uuid  not null default gen_random_uuid();

comment on column public.craft_runs.resource_reagents is
  'Resource reagents spent by start_craft for this run ([{code, quantity}]), kept so cancel_craft can refund exactly what was charged.';
comment on column public.craft_runs.item_reagents is
  'Item reagents spent by start_craft for this run ([{item_def_id, rarity, quantity}]), kept so cancel_craft can refund exactly what was charged.';
comment on column public.craft_runs.roll_seed is
  'Server-generated randomness for the claim-time rarity roll. Deliberately not client-readable (see column-level GRANT below) — started_at is readable under RLS and was previously used as the seed, which made the roll predictable client-side and enabled a cancel/restart re-roll exploit.';

-- b) Close the exploit: restrict client SELECT to the safe columns only, hiding roll_seed.
-- resource_reagents/item_reagents are safe to expose — the player already knows what they spent
-- from the recipe UI, no new info leak. The existing craft_runs_select_own RLS policy still
-- applies on top of this (row-level + column-level combine).
revoke select on public.craft_runs from authenticated;
grant select (player_id, recipe_def_id, started_at, ends_at, resource_reagents, item_reagents)
  on public.craft_runs to authenticated;

-- ---------------------------------------------------------------------------------------------
-- start_craft: unchanged signature (create or replace), now also persists the spent reagents so
-- cancel_craft can refund them later. Every other line is byte-identical to
-- 20260910110000_craft_runs.sql.
-- ---------------------------------------------------------------------------------------------
create or replace function public.start_craft(
  p_player             uuid,
  p_recipe_def_id      text,
  p_resource_reagents  jsonb,
  p_item_reagents      jsonb,
  p_duration_seconds   integer
) returns public.craft_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line      jsonb;
  v_code      text;
  v_need      integer;
  v_have      numeric;
  v_item      text;
  v_rarity    text;
  v_run       public.craft_runs;
begin
  if p_recipe_def_id is null or length(p_recipe_def_id) = 0 then
    raise exception 'start_craft: recipe required';
  end if;
  if p_duration_seconds is null or p_duration_seconds < 1 then
    raise exception 'start_craft: invalid duration';
  end if;

  -- One craft at a time: the primary key is the mutex. A concurrent second start conflicts
  -- here and raises before anything is spent; craft_runs is touched by no other RPC, so this
  -- introduces no lock-order dependency.
  insert into public.craft_runs (player_id, recipe_def_id, started_at, ends_at, resource_reagents, item_reagents)
  values (p_player, p_recipe_def_id, now(), now() + make_interval(secs => p_duration_seconds),
          coalesce(p_resource_reagents, '[]'::jsonb), coalesce(p_item_reagents, '[]'::jsonb))
  on conflict (player_id) do nothing
  returning * into v_run;
  if v_run.player_id is null then
    raise exception 'start_craft: a craft is already in progress';
  end if;

  -- Item reagents: lock each chosen (item, rarity) stack, verify, deduct (delete at zero) —
  -- the same consume idiom upgrade_items uses (20260709000000_upgrade_items_rpc.sql).
  for v_line in select * from jsonb_array_elements(coalesce(p_item_reagents, '[]'::jsonb))
  loop
    v_item   := v_line->>'item_def_id';
    v_rarity := v_line->>'rarity';
    v_need   := (v_line->>'quantity')::integer;
    if v_item is null or v_rarity is null or v_need is null or v_need < 1 then
      raise exception 'start_craft: invalid item reagent';
    end if;
    select quantity into v_have
      from public.player_inventory
     where player_id = p_player and item_def_id = v_item and rarity = v_rarity
     for update;
    if not found or v_have < v_need then
      raise exception 'start_craft: not enough % (%) — have %, need %', v_item, v_rarity, coalesce(v_have, 0), v_need;
    end if;
    if v_have = v_need then
      delete from public.player_inventory
       where player_id = p_player and item_def_id = v_item and rarity = v_rarity;
    else
      update public.player_inventory
         set quantity = quantity - v_need
       where player_id = p_player and item_def_id = v_item and rarity = v_rarity;
    end if;
  end loop;

  -- Lock the wallet (inventory was locked above — same inventory-before-profiles order as
  -- claim_mission / claim_group_stage). A missing profile must fail loudly, not skip the charge.
  perform 1 from public.profiles where player_id = p_player for update;
  if not found then
    raise exception 'start_craft: no profile';
  end if;

  -- Resource reagents: verify then deduct each from the JSONB wallet.
  for v_line in select * from jsonb_array_elements(coalesce(p_resource_reagents, '[]'::jsonb))
  loop
    v_code := v_line->>'code';
    v_need := (v_line->>'quantity')::integer;
    if v_code is null or v_need is null or v_need < 1 then
      raise exception 'start_craft: invalid resource reagent';
    end if;
    select coalesce((resources->>v_code)::numeric, 0) into v_have
      from public.profiles where player_id = p_player;
    if v_have < v_need then
      raise exception 'start_craft: not enough % (have %, need %)', v_code, v_have, v_need;
    end if;
    update public.profiles
       set resources = jsonb_set(resources, array[v_code], to_jsonb(v_have - v_need))
     where player_id = p_player;
  end loop;

  return v_run;
end;
$$;

revoke all on function public.start_craft(uuid, text, jsonb, jsonb, integer) from public, anon, authenticated;
grant execute on function public.start_craft(uuid, text, jsonb, jsonb, integer) to service_role;

-- ---------------------------------------------------------------------------------------------
-- cancel_craft: abandon the in-progress (or finished-but-unclaimed) craft and refund exactly what
-- THIS run's start_craft call stored in resource_reagents/item_reagents — correct even if the
-- recipe has since changed in Sanity. No time restriction: abandoning a finished-but-unclaimed
-- craft is allowed too, same as claim. Mirrors claim_craft's atomic DELETE...RETURNING guard (so
-- a concurrent claim/cancel race loses cleanly — only one caller can match the row), the
-- item-refund upsert idiom from claim_craft's own item-grant insert (unique (player_id,
-- item_def_id, rarity) per 20260612180000_player_inventory.sql), and the resource-refund loop
-- from start_craft's own resource-deduction loop, reversed (add instead of subtract). Per this
-- repo's award/credit-locking rule, profiles is locked with `for update` before the resource
-- read-modify-write loop, exactly like start_craft already does before its resource loop.
-- ---------------------------------------------------------------------------------------------
create or replace function public.cancel_craft(
  p_player        uuid,
  p_recipe_def_id text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run    public.craft_runs;
  v_line   jsonb;
  v_item   text;
  v_rarity text;
  v_qty    integer;
  v_code   text;
  v_have   numeric;
begin
  delete from public.craft_runs
   where player_id = p_player and recipe_def_id = p_recipe_def_id
   returning * into v_run;
  if v_run.player_id is null then
    raise exception 'cancel_craft: no such craft in progress';
  end if;

  for v_line in select * from jsonb_array_elements(coalesce(v_run.item_reagents, '[]'::jsonb))
  loop
    v_item   := v_line->>'item_def_id';
    v_rarity := v_line->>'rarity';
    v_qty    := (v_line->>'quantity')::integer;
    insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
    values (p_player, v_item, v_rarity, v_qty)
    on conflict (player_id, item_def_id, rarity)
      do update set quantity = public.player_inventory.quantity + excluded.quantity;
  end loop;

  perform 1 from public.profiles where player_id = p_player for update;
  if not found then
    raise exception 'cancel_craft: no profile';
  end if;

  for v_line in select * from jsonb_array_elements(coalesce(v_run.resource_reagents, '[]'::jsonb))
  loop
    v_code := v_line->>'code';
    v_qty  := (v_line->>'quantity')::integer;
    select coalesce((resources->>v_code)::numeric, 0) into v_have
      from public.profiles where player_id = p_player;
    update public.profiles
       set resources = jsonb_set(resources, array[v_code], to_jsonb(v_have + v_qty))
     where player_id = p_player;
  end loop;
end;
$$;

revoke all on function public.cancel_craft(uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_craft(uuid, text) to service_role;
