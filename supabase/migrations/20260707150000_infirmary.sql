-- Infirmary: recovery mechanic for downed characters (ADR-0021).
--
-- A downed character (current_hp = 0) cannot be dispatched until healed. The infirmary is
-- an upgradeable facility (levels 1–5) that admits downed characters and heals them over
-- time. Capacity = infirmary_level (1 bed at level 1, up to 5 at level 5). All mutations
-- are server-authoritative (Edge Functions call the RPCs below; clients remain SELECT-only).
--
-- This migration:
--   1. Adds infirmary_level to profiles.
--   2. Creates infirmary_admissions table + RLS + grants.
--   3. RPCs: admit_infirmary, discharge_infirmary, upgrade_infirmary.
--   4. Replaces start_mission + start_gather with infirmary-aware versions (one extra
--      busy-check each; everything else is verbatim from the originals).

-- ---------------------------------------------------------------------------
-- 1. profiles.infirmary_level
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column infirmary_level int not null default 1
    check (infirmary_level between 1 and 5);

comment on column public.profiles.infirmary_level is
  'Current infirmary upgrade level (1–5). Determines max concurrent admissions. Written only by the upgrade_infirmary RPC.';

-- ---------------------------------------------------------------------------
-- 2. infirmary_admissions
-- ---------------------------------------------------------------------------
create table public.infirmary_admissions (
  id                  uuid primary key default gen_random_uuid(),
  player_id           uuid not null references auth.users (id) on delete cascade,
  player_character_id uuid not null unique references public.player_characters (id) on delete cascade,
  admitted_at         timestamptz not null default now(),
  hp_at_admission     int not null check (hp_at_admission >= 0)
);

comment on table public.infirmary_admissions is
  'A downed character currently recovering in the infirmary. One row per admitted character (UNIQUE on player_character_id). Capacity enforced by admit_infirmary against profiles.infirmary_level. All writes via Edge Functions (service role).';

-- Fast player-scoped queries (list all of a player's admitted characters).
create index infirmary_admissions_player_id_idx
  on public.infirmary_admissions (player_id);

-- Row Level Security + grants (owner reads; Edge Functions write).
alter table public.infirmary_admissions enable row level security;

create policy "infirmary_admissions_select_own"
  on public.infirmary_admissions for select to authenticated
  using (player_id = (select auth.uid()));

-- Intentionally NO client insert/update/delete policy (ADR-0003).

grant select on public.infirmary_admissions to authenticated;
grant select, insert, update, delete on public.infirmary_admissions to service_role;

-- ---------------------------------------------------------------------------
-- 3a. RPC: admit_infirmary
-- ---------------------------------------------------------------------------
-- Validates that the character is owned, has a non-NULL current_hp (NULL = full health,
-- nothing to heal), is not busy elsewhere, and that a bed is free; then inserts the
-- admission row. A FOR UPDATE lock on the character row serializes concurrent calls
-- (mirrors start_mission's approach).
create or replace function public.admit_infirmary(
  p_player uuid,
  p_char   uuid,
  p_max_beds int
) returns public.infirmary_admissions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_hp int;
  v_admission  public.infirmary_admissions;
begin
  -- Serialize concurrent admits for the same character.
  perform 1 from public.player_characters
   where id = p_char and player_id = p_player
   for update;

  -- Ownership check + read current_hp in one query.
  select current_hp into v_current_hp
    from public.player_characters
   where id = p_char and player_id = p_player;
  if not found then
    raise exception 'admit_infirmary: character not found or not owned';
  end if;

  -- NULL current_hp means full health — nothing to heal.
  if v_current_hp is null then
    raise exception 'admit_infirmary: character is at full health (current_hp is null)';
  end if;

  -- Busy elsewhere?
  if exists (select 1 from public.mission_runs where player_id = p_player and party && array[p_char]) then
    raise exception 'admit_infirmary: character is on a mission';
  end if;
  if exists (select 1 from public.gather_assignments where player_character_id = p_char) then
    raise exception 'admit_infirmary: character is gathering';
  end if;

  -- Already in the infirmary?
  if exists (select 1 from public.infirmary_admissions where player_character_id = p_char) then
    raise exception 'admit_infirmary: character is already admitted';
  end if;

  -- Bed capacity.
  if (select count(*) from public.infirmary_admissions where player_id = p_player) >= p_max_beds then
    raise exception 'admit_infirmary: infirmary is full';
  end if;

  insert into public.infirmary_admissions (player_id, player_character_id, hp_at_admission)
  values (p_player, p_char, v_current_hp)
  returning * into v_admission;

  return v_admission;
end;
$$;

revoke all on function public.admit_infirmary(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.admit_infirmary(uuid, uuid, int) to service_role;

-- ---------------------------------------------------------------------------
-- 3b. RPC: discharge_infirmary
-- ---------------------------------------------------------------------------
-- Removes the admission and updates current_hp. p_new_current_hp = NULL means fully
-- healed (Edge Function sets current_hp back to NULL = "full" per the data model).
create or replace function public.discharge_infirmary(
  p_player       uuid,
  p_char         uuid,
  p_new_current_hp int  -- NULL = fully healed
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.infirmary_admissions
   where player_character_id = p_char and player_id = p_player;
  if not found then
    raise exception 'discharge_infirmary: admission not found';
  end if;

  update public.player_characters
     set current_hp = p_new_current_hp
   where id = p_char and player_id = p_player;

  return jsonb_build_object('discharged', true, 'current_hp', p_new_current_hp);
end;
$$;

revoke all on function public.discharge_infirmary(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.discharge_infirmary(uuid, uuid, int) to service_role;

-- ---------------------------------------------------------------------------
-- 3c. RPC: upgrade_infirmary
-- ---------------------------------------------------------------------------
-- Deducts upgrade costs, increments infirmary_level, and applies any in-flight
-- settlement adjustments (e.g. beds becoming available mid-heal re-anchor admitted_at).
--
-- p_settlements: jsonb array of objects —
--   { "character_id": "<uuid>",
--     "current_hp":   <int|null>,    -- JSON null allowed (= SQL NULL = fully healed)
--     "admitted_at":  "<timestamptz>",
--     "hp_at_admission": <int> }
create or replace function public.upgrade_infirmary(
  p_player           uuid,
  p_new_level        int,
  p_cost_currencies  jsonb,
  p_cost_resources   jsonb,
  p_settlements      jsonb   -- may be '[]'
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key        text;
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

revoke all on function public.upgrade_infirmary(uuid, int, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.upgrade_infirmary(uuid, int, jsonb, jsonb, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 4a. start_mission (infirmary-aware replacement)
-- ---------------------------------------------------------------------------
-- Verbatim copy of the definition from 20260705140000_mission_rpcs.sql with one
-- additional busy-check: raises if any party member is currently admitted.
create or replace function public.start_mission(
  p_player          uuid,
  p_mission_def_id  text,
  p_party           uuid[],
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
  if exists (select 1 from public.infirmary_admissions where player_character_id = any(p_party)) then
    raise exception 'start_mission: a character is in the infirmary';
  end if;

  insert into public.mission_runs (player_id, mission_def_id, party, started_at, ends_at)
  values (p_player, p_mission_def_id, p_party, now(), now() + make_interval(secs => p_duration_seconds))
  returning * into v_run;

  return v_run;
end;
$$;

revoke all on function public.start_mission(uuid, text, uuid[], integer) from public, anon, authenticated;
grant execute on function public.start_mission(uuid, text, uuid[], integer) to service_role;

-- ---------------------------------------------------------------------------
-- 4b. start_gather (infirmary-aware replacement)
-- ---------------------------------------------------------------------------
-- Verbatim copy of the definition from 20260707120000_gather_rpcs.sql with one
-- additional busy-check: raises if the character is currently admitted.
create or replace function public.start_gather(
  p_player      uuid,
  p_char        uuid,
  p_resource_id text
) returns public.gather_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alive int;
  v_assignment public.gather_assignments;
begin
  if p_char is null then
    raise exception 'start_gather: character required';
  end if;
  if p_resource_id is null or length(p_resource_id) = 0 then
    raise exception 'start_gather: resource required';
  end if;

  -- Serialize concurrent assignment of the same character (busy-check + insert must not race).
  perform 1 from public.player_characters
   where id = p_char and player_id = p_player
   for update;

  -- Ownership + not-downed (current_hp null = full, 0 = downed).
  select count(*) into v_alive
    from public.player_characters
   where id = p_char and player_id = p_player
     and (current_hp is null or current_hp > 0);
  if v_alive <> 1 then
    raise exception 'start_gather: character is not owned or is downed';
  end if;

  -- Busy elsewhere?
  if exists (select 1 from public.gather_assignments where player_character_id = p_char) then
    raise exception 'start_gather: character is already gathering';
  end if;
  if exists (select 1 from public.mission_runs where player_id = p_player and party && array[p_char]) then
    raise exception 'start_gather: character is on a mission';
  end if;
  if exists (select 1 from public.infirmary_admissions where player_character_id = p_char) then
    raise exception 'start_gather: a character is in the infirmary';
  end if;

  -- One gatherer per resource node (v1) — matches the UI's single-slot mine.
  if exists (select 1 from public.gather_assignments where player_id = p_player and resource_id = p_resource_id) then
    raise exception 'start_gather: that mine already has a gatherer';
  end if;

  insert into public.gather_assignments (player_id, player_character_id, resource_id)
  values (p_player, p_char, p_resource_id)
  returning * into v_assignment;

  return v_assignment;
end;
$$;

revoke all on function public.start_gather(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.start_gather(uuid, uuid, text) to service_role;
