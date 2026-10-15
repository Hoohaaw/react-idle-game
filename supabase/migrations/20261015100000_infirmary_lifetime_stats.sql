-- goldSpent lifetime-stat tracking for upgrade_infirmary (TODO.md "Expand lifetime stats
-- tracking" queue). Drop + recreate for the new 6th param — the live function has 5 params, so
-- `create or replace` alone would create a new overload rather than replacing it (same
-- precedent as 20260916140000_upgrade_items_lifetime_stats.sql).
drop function if exists public.upgrade_infirmary(uuid, int, jsonb, jsonb, jsonb);

create or replace function public.upgrade_infirmary(
  p_player           uuid,
  p_new_level        int,
  p_cost_currencies  jsonb,
  p_cost_resources   jsonb,
  p_settlements      jsonb,  -- may be '[]'
  p_lifetime_stats   jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key        text;
  v_val        numeric;
  v_cost       numeric;
  v_balance    numeric;
  v_settlement jsonb;
  v_char_id    uuid;
  v_new_hp     int;
begin
  -- Lock the profile row to prevent races (e.g. concurrent upgrade calls).
  perform 1 from public.profiles
   where player_id = p_player
   for update;

  -- Assert sequential upgrade (must be exactly one level above current).
  if not exists (
    select 1 from public.profiles
     where player_id = p_player and infirmary_level = p_new_level - 1
  ) then
    raise exception 'upgrade_infirmary: infirmary_level is not at level %', p_new_level - 1;
  end if;

  -- Verify currency funds.
  for v_key, v_cost in
    select key, value::numeric from jsonb_each_text(coalesce(p_cost_currencies, '{}'::jsonb))
  loop
    select coalesce((currencies->>v_key)::numeric, 0) into v_balance
      from public.profiles where player_id = p_player;
    if v_balance < v_cost then
      raise exception 'upgrade_infirmary: insufficient funds (currency: %)', v_key;
    end if;
  end loop;

  -- Verify resource funds.
  for v_key, v_cost in
    select key, value::numeric from jsonb_each_text(coalesce(p_cost_resources, '{}'::jsonb))
  loop
    select coalesce((resources->>v_key)::numeric, 0) into v_balance
      from public.profiles where player_id = p_player;
    if v_balance < v_cost then
      raise exception 'upgrade_infirmary: insufficient funds (resource: %)', v_key;
    end if;
  end loop;

  -- Deduct currencies.
  for v_key, v_cost in
    select key, value::numeric from jsonb_each_text(coalesce(p_cost_currencies, '{}'::jsonb))
  loop
    update public.profiles
       set currencies = jsonb_set(currencies, array[v_key],
             to_jsonb(coalesce((currencies->>v_key)::numeric, 0) - v_cost))
     where player_id = p_player;
  end loop;

  -- Deduct resources.
  for v_key, v_cost in
    select key, value::numeric from jsonb_each_text(coalesce(p_cost_resources, '{}'::jsonb))
  loop
    update public.profiles
       set resources = jsonb_set(resources, array[v_key],
             to_jsonb(coalesce((resources->>v_key)::numeric, 0) - v_cost))
     where player_id = p_player;
  end loop;

  -- Lifetime stats: atomic increments (same pattern as claim_mission/recruit_character).
  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_lifetime_stats, '{}'::jsonb))
  loop
    update public.profiles
       set lifetime_stats = jsonb_set(lifetime_stats, array[v_key],
             to_jsonb(coalesce((lifetime_stats->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;

  -- Increment infirmary_level.
  update public.profiles
     set infirmary_level = p_new_level
   where player_id = p_player;

  -- Apply settlement adjustments for in-flight admissions.
  -- current_hp in the jsonb may be JSON null (= SQL NULL, fully healed) or an integer.
  for v_settlement in
    select * from jsonb_array_elements(coalesce(p_settlements, '[]'::jsonb))
  loop
    v_char_id := (v_settlement->>'character_id')::uuid;

    -- Distinguish JSON null from a numeric value.
    v_new_hp := case
      when jsonb_typeof(v_settlement->'current_hp') = 'null' then null
      else (v_settlement->>'current_hp')::int
    end;

    update public.player_characters
       set current_hp = v_new_hp
     where id = v_char_id and player_id = p_player;

    update public.infirmary_admissions
       set admitted_at     = (v_settlement->>'admitted_at')::timestamptz,
           hp_at_admission = (v_settlement->>'hp_at_admission')::int
     where player_character_id = v_char_id and player_id = p_player;
  end loop;

  return jsonb_build_object('upgraded', true, 'infirmary_level', p_new_level);
end;
$$;

revoke all on function public.upgrade_infirmary(uuid, int, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.upgrade_infirmary(uuid, int, jsonb, jsonb, jsonb, jsonb) to service_role;

-- goldSpent lifetime-stat tracking for respec_blessings. Drop + recreate for the new 4th param —
-- the live function has 3 params.
drop function if exists public.respec_blessings(uuid, uuid, numeric);

create or replace function public.respec_blessings(
  p_player         uuid,
  p_char           uuid,
  p_cost           numeric,
  p_lifetime_stats jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_blessings jsonb;
  v_gold      numeric;
  v_key       text;
  v_val       numeric;
begin
  -- 1. Lock the character row and capture blessings; fail if not owned.
  select blessings into v_blessings
    from public.player_characters
   where id = p_char and player_id = p_player
   for update;
  if not found then
    raise exception 'respec_blessings: character not found or not owned';
  end if;
  v_blessings := coalesce(v_blessings, '{}'::jsonb);

  -- 2. Nothing to respec — don't charge for a no-op.
  if v_blessings = '{}'::jsonb then
    raise exception 'respec_blessings: no blessings to respec';
  end if;

  -- 3. Busy checks (verbatim from choose_blessing — respeccing mid-mission is nonsensical).
  if exists (
    select 1 from public.mission_runs
     where player_id = p_player and party && array[p_char]
  ) then
    raise exception 'respec_blessings: character is on a mission';
  end if;
  if exists (
    select 1 from public.gather_assignments
     where player_character_id = p_char
  ) then
    raise exception 'respec_blessings: character is gathering';
  end if;
  if exists (
    select 1 from public.infirmary_admissions
     where player_character_id = p_char
  ) then
    raise exception 'respec_blessings: character is in the infirmary';
  end if;
  if exists (
    select 1 from public.group_runs
     where player_id = p_player and party && array[p_char]
  ) then
    raise exception 'respec_blessings: character is in a dungeon or raid';
  end if;

  -- 4. Lock the profile and verify gold funds (single fixed key, unlike upgrade_infirmary's
  --    generic currencies+resources loop — right-sized for a game with exactly one currency).
  select coalesce((currencies->>'gold')::numeric, 0) into v_gold
    from public.profiles
   where player_id = p_player
   for update;
  if v_gold < p_cost then
    raise exception 'respec_blessings: insufficient gold (needs %, has %)', p_cost, v_gold;
  end if;

  -- 5. Deduct gold.
  update public.profiles
     set currencies = jsonb_set(currencies, array['gold'], to_jsonb(v_gold - p_cost))
   where player_id = p_player;

  -- 5b. Lifetime stats: atomic increments (same pattern as claim_mission/recruit_character).
  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_lifetime_stats, '{}'::jsonb))
  loop
    update public.profiles
       set lifetime_stats = jsonb_set(lifetime_stats, array[v_key],
             to_jsonb(coalesce((lifetime_stats->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;

  -- 6. Wipe the tree.
  update public.player_characters
     set blessings = '{}'::jsonb
   where id = p_char and player_id = p_player
  returning blessings into v_blessings;

  return jsonb_build_object('blessings', v_blessings);
end;
$$;

revoke all on function public.respec_blessings(uuid, uuid, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.respec_blessings(uuid, uuid, numeric, jsonb) to service_role;
