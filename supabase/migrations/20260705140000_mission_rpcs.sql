-- Mission RPCs: atomic dispatch (start_mission) + atomic claim (claim_mission). ADR-0016.
--
-- The combat SIM runs in TypeScript (the Edge Functions), so these RPCs are the *write* boundary:
-- each does all of its mutations in one transaction (the function body). Both are SECURITY DEFINER
-- with a pinned search_path, execute-granted to service_role ONLY (the Edge Functions call them;
-- clients cannot — ADR-0003). The pure logic (which character leveled, what loot rolled) is decided
-- upstream in TS and passed in; these functions own atomicity + concurrency, not game rules.

-- start_mission: validate a party and create the mission_runs row, atomically. A character may be in
-- at most one activity (mission or gather) — a rule that spans tables, so it's enforced here under a
-- row lock on the party (FOR UPDATE serializes two concurrent dispatches of the same character).
create or replace function public.start_mission(
  p_player uuid,
  p_mission_def_id text,
  p_party uuid[],
  p_duration_seconds integer
) returns public.mission_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_size int := cardinality(p_party);
  v_owned_alive int;
  v_run public.mission_runs;
begin
  if v_size is null or v_size < 1 or v_size > 3 then
    raise exception 'start_mission: party size must be 1..3';
  end if;
  if v_size <> (select count(distinct e) from unnest(p_party) e) then
    raise exception 'start_mission: duplicate character in party';
  end if;
  if p_duration_seconds is null or p_duration_seconds < 1 then
    raise exception 'start_mission: invalid duration';
  end if;

  -- Serialize concurrent dispatch of the same characters (busy-check + insert must not race).
  perform 1 from public.player_characters
   where id = any(p_party) and player_id = p_player
   for update;

  -- Ownership + not-downed (current_hp null = full, 0 = downed).
  select count(*) into v_owned_alive
    from public.player_characters
   where id = any(p_party)
     and player_id = p_player
     and (current_hp is null or current_hp > 0);
  if v_owned_alive <> v_size then
    raise exception 'start_mission: a character is not owned or is downed';
  end if;

  -- Busy elsewhere?
  if exists (select 1 from public.gather_assignments where player_character_id = any(p_party)) then
    raise exception 'start_mission: a character is gathering';
  end if;
  if exists (select 1 from public.mission_runs where player_id = p_player and party && p_party) then
    raise exception 'start_mission: a character is already on a mission';
  end if;

  insert into public.mission_runs (player_id, mission_def_id, party, started_at, ends_at)
  values (p_player, p_mission_def_id, p_party, now(), now() + make_interval(secs => p_duration_seconds))
  returning * into v_run;

  return v_run;
end;
$$;

-- Lock down: Supabase's default privileges auto-grant EXECUTE on new public functions to anon +
-- authenticated, so revoking from PUBLIC alone is NOT enough — a signed-in user could otherwise call
-- this via /rest/v1/rpc with an arbitrary p_player and mint state (ADR-0003). Revoke from them too.
revoke all on function public.start_mission(uuid, text, uuid[], integer) from public, anon, authenticated;
grant execute on function public.start_mission(uuid, text, uuid[], integer) to service_role;

-- claim_mission: apply a resolved mission's outcome atomically. The Edge Function has already run the
-- sim and computed everything; this function applies the payload in one transaction and owns the
-- double-claim guard. Outcome-agnostic: a LOSS calls it with empty rewards and char_updates that only
-- set current_hp (no level/xp change) — win-gating lives in the Edge Function, not here.
--   p_char_updates : [{ id, level, xp, current_hp }]  (one per party member; current_hp always set)
--   p_loot         : [{ item_def_id, rarity, quantity }]
--   p_currencies   : { "<code>": amount, ... }   amounts to ADD to the wallet
--   p_resources    : { "<code>": amount, ... }
create or replace function public.claim_mission(
  p_player uuid,
  p_run_id uuid,
  p_char_updates jsonb,
  p_loot jsonb,
  p_currencies jsonb,
  p_resources jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_party uuid[];
  v_char jsonb;
  v_loot jsonb;
  v_key text;
  v_val numeric;
begin
  -- Double-claim guard + free the party: an atomic conditional delete. Only one concurrent caller can
  -- match the row, and only once now() >= ends_at. Anyone else gets NOT FOUND -> the whole tx aborts.
  delete from public.mission_runs
   where id = p_run_id and player_id = p_player and now() >= ends_at
   returning party into v_party;
  if not found then
    raise exception 'claim_mission: not claimable (already claimed, not owned, or not finished)';
  end if;

  -- Per-character level / xp / current_hp (Edge Function computed these).
  for v_char in select * from jsonb_array_elements(coalesce(p_char_updates, '[]'::jsonb))
  loop
    update public.player_characters
       set level = (v_char->>'level')::int,
           xp = (v_char->>'xp')::int,
           current_hp = (v_char->>'current_hp')::int
     where id = (v_char->>'id')::uuid and player_id = p_player;
  end loop;

  -- Loot -> stack into inventory (one stack per item+rarity).
  for v_loot in select * from jsonb_array_elements(coalesce(p_loot, '[]'::jsonb))
  loop
    insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
    values (p_player, v_loot->>'item_def_id', v_loot->>'rarity', (v_loot->>'quantity')::int)
    on conflict (player_id, item_def_id, rarity)
      do update set quantity = public.player_inventory.quantity + excluded.quantity;
  end loop;

  -- Currencies + resources: add each amount into the JSONB wallet on profiles.
  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_currencies, '{}'::jsonb))
  loop
    update public.profiles
       set currencies = jsonb_set(currencies, array[v_key],
             to_jsonb(coalesce((currencies->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;
  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_resources, '{}'::jsonb))
  loop
    update public.profiles
       set resources = jsonb_set(resources, array[v_key],
             to_jsonb(coalesce((resources->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;

  return jsonb_build_object('claimed', true, 'party', v_party);
end;
$$;

revoke all on function public.claim_mission(uuid, uuid, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.claim_mission(uuid, uuid, jsonb, jsonb, jsonb, jsonb) to service_role;
