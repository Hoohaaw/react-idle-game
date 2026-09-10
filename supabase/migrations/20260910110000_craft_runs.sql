-- Crafting (create recipes): craft_runs + the two atomic RPCs (docs/superpowers/specs/
-- 2026-09-09-crafting-create-recipes-design.md §4c/§5). Crafting is player-level (no character
-- is dispatched), so unlike mission_runs there is no party and no cross-table busy check — the
-- only concurrency rule is "one craft at a time", made structural by keying the table on
-- player_id. The Edge Functions decide the numbers (which reagents, which rolled rarity); these
-- functions own atomicity, same split as start_mission/claim_mission (ADR-0016).

create table public.craft_runs (
  player_id     uuid primary key references auth.users(id) on delete cascade,
  recipe_def_id text not null,
  started_at    timestamptz not null default now(),
  ends_at       timestamptz not null
);

comment on table public.craft_runs is
  'The player''s single in-progress craft (recipe_def_id = Sanity recipeKey). Reagents are already spent; claim after ends_at grants the result. One row per player, by primary key.';

alter table public.craft_runs enable row level security;

create policy "craft_runs_select_own"
  on public.craft_runs
  for select
  to authenticated
  using (player_id = (select auth.uid()));

-- Writes go through the RPCs below (service_role) only.
grant select on public.craft_runs to authenticated;
grant select, insert, update, delete on public.craft_runs to service_role;

-- ---------------------------------------------------------------------------------------------
-- start_craft: spend every reagent and open the run, atomically. p_resource_reagents and
-- p_item_reagents are already resolved by the Edge Function from the authored recipeDef (the
-- client is never trusted for costs); this function only verifies the player can pay and pays.
--   p_resource_reagents : [{ code, quantity }]                 -- deducted from profiles.resources
--   p_item_reagents     : [{ item_def_id, rarity, quantity }]  -- deducted from player_inventory
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

  -- One craft at a time. Lock the profile row first so two concurrent starts serialize here
  -- (and so the resource deductions below can't race a claim_mission payout).
  perform 1 from public.profiles where player_id = p_player for update;
  if exists (select 1 from public.craft_runs where player_id = p_player) then
    raise exception 'start_craft: a craft is already in progress';
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

  insert into public.craft_runs (player_id, recipe_def_id, started_at, ends_at)
  values (p_player, p_recipe_def_id, now(), now() + make_interval(secs => p_duration_seconds))
  returning * into v_run;

  return v_run;
end;
$$;

revoke all on function public.start_craft(uuid, text, jsonb, jsonb, integer) from public, anon, authenticated;
grant execute on function public.start_craft(uuid, text, jsonb, jsonb, integer) to service_role;

-- ---------------------------------------------------------------------------------------------
-- claim_craft: grant the rolled result and close the run. The atomic conditional DELETE is the
-- double-claim guard (same shape as claim_mission): only one caller can match the row, and only
-- once now() >= ends_at; everyone else gets NOT FOUND and the transaction aborts.
-- ---------------------------------------------------------------------------------------------
create or replace function public.claim_craft(
  p_player             uuid,
  p_recipe_def_id      text,
  p_result_item_def_id text,
  p_result_rarity      text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_result_rarity not in ('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary') then
    raise exception 'claim_craft: invalid rarity';
  end if;

  delete from public.craft_runs
   where player_id = p_player and recipe_def_id = p_recipe_def_id and now() >= ends_at;
  if not found then
    raise exception 'claim_craft: not claimable (no craft, wrong recipe, not finished, or already claimed)';
  end if;

  insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
  values (p_player, p_result_item_def_id, p_result_rarity, 1)
  on conflict (player_id, item_def_id, rarity)
    do update set quantity = public.player_inventory.quantity + excluded.quantity;

  return jsonb_build_object('item_def_id', p_result_item_def_id, 'rarity', p_result_rarity);
end;
$$;

revoke all on function public.claim_craft(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_craft(uuid, text, text, text) to service_role;
