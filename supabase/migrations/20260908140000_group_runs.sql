-- Dungeons & raids: group_runs table + the two group-stage RPCs (docs/superpowers/specs/
-- 2026-09-08-dungeons-and-raids-design.md). A character may be in at most one activity — that
-- rule already spans mission_runs/gather_assignments/infirmary_admissions; this migration adds
-- group_runs as a fourth table in the same mutual-exclusion set.

create table public.group_runs (
  player_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('dungeon', 'raid')),
  def_key text not null,
  current_stage_index int not null default 0,
  status text not null default 'in_progress' check (status in ('in_progress', 'complete')),
  party uuid[] not null default '{}',
  stage_started_at timestamptz,
  stage_ends_at timestamptz,
  last_cleared_at timestamptz,
  primary key (player_id, kind, def_key)
);

alter table public.group_runs enable row level security;

create policy "owner can read own group runs"
  on public.group_runs for select
  using (auth.uid() = player_id);
-- No insert/update/delete policies: all writes go through the SECURITY DEFINER RPCs below
-- (ADR-0003) — RLS with no write policy means clients cannot write at all.

-- ---------------------------------------------------------------------------------------------
-- Extend the existing busy checks: a character mid-dungeon/raid-stage must not be dispatchable
-- to a mission, a mine, or the infirmary. Each function below is redefined with its full existing
-- body (from supabase/migrations/20260713090000_map_progression.sql and
-- 20260707150000_infirmary.sql respectively) plus one new `group_runs` exists-check.
-- ---------------------------------------------------------------------------------------------

create or replace function public.start_mission(
  p_player           uuid,
  p_mission_def_id   text,
  p_party            uuid[],
  p_duration_seconds integer,
  p_map_key          text    default null,
  p_stage            int     default null,
  p_prev_map_key     text    default null
) returns public.mission_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_size        int := cardinality(p_party);
  v_owned_alive int;
  v_run         public.mission_runs;
  v_map_prog    jsonb;
  v_cleared     int;
  v_prev_cleared int;
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

  perform 1 from public.player_characters
   where id = any(p_party) and player_id = p_player
   for update;

  select count(*) into v_owned_alive
    from public.player_characters
   where id = any(p_party)
     and player_id = p_player
     and (current_hp is null or current_hp > 0);
  if v_owned_alive <> v_size then
    raise exception 'start_mission: a character is not owned or is downed';
  end if;

  if exists (select 1 from public.gather_assignments where player_character_id = any(p_party)) then
    raise exception 'start_mission: a character is gathering';
  end if;
  if exists (select 1 from public.mission_runs where player_id = p_player and party && p_party) then
    raise exception 'start_mission: a character is already on a mission';
  end if;
  if exists (select 1 from public.infirmary_admissions where player_character_id = any(p_party)) then
    raise exception 'start_mission: a character is in the infirmary';
  end if;
  if exists (select 1 from public.group_runs where player_id = p_player and party && p_party) then
    raise exception 'start_mission: a character is in a dungeon or raid';
  end if;

  if p_map_key is not null and p_stage is not null then
    select map_progress into v_map_prog from public.profiles where player_id = p_player;
    v_cleared := coalesce((v_map_prog->>p_map_key)::int, 0);
    if p_stage > v_cleared + 1 then
      raise exception 'start_mission: stage not yet unlocked';
    end if;
    if p_prev_map_key is not null then
      v_prev_cleared := coalesce((v_map_prog->>p_prev_map_key)::int, 0);
      if v_prev_cleared < 7 then
        raise exception 'start_mission: previous map not cleared';
      end if;
    end if;
  end if;

  insert into public.mission_runs (player_id, mission_def_id, party, started_at, ends_at)
  values (p_player, p_mission_def_id, p_party, now(), now() + make_interval(secs => p_duration_seconds))
  returning * into v_run;

  return v_run;
end;
$$;

revoke all on function public.start_mission(uuid, text, uuid[], integer, text, int, text) from public, anon, authenticated;
grant execute on function public.start_mission(uuid, text, uuid[], integer, text, int, text) to service_role;

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

  perform 1 from public.player_characters
   where id = p_char and player_id = p_player
   for update;

  select count(*) into v_alive
    from public.player_characters
   where id = p_char and player_id = p_player
     and (current_hp is null or current_hp > 0);
  if v_alive <> 1 then
    raise exception 'start_gather: character is not owned or is downed';
  end if;

  if exists (select 1 from public.gather_assignments where player_character_id = p_char) then
    raise exception 'start_gather: character is already gathering';
  end if;
  if exists (select 1 from public.mission_runs where player_id = p_player and party && array[p_char]) then
    raise exception 'start_gather: character is on a mission';
  end if;
  if exists (select 1 from public.infirmary_admissions where player_character_id = p_char) then
    raise exception 'start_gather: a character is in the infirmary';
  end if;
  if exists (select 1 from public.group_runs where player_id = p_player and party && array[p_char]) then
    raise exception 'start_gather: a character is in a dungeon or raid';
  end if;

  if exists (select 1 from public.gather_assignments where player_id = p_player and resource_id = p_resource_id) then
    raise exception 'start_gather: that mine already has a gatherer';
  end if;

  insert into public.gather_assignments (player_id, player_character_id, resource_id, started_at)
  values (p_player, p_char, p_resource_id, now())
  returning * into v_assignment;

  return v_assignment;
end;
$$;

revoke all on function public.start_gather(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.start_gather(uuid, uuid, text) to service_role;

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
  perform 1 from public.player_characters
   where id = p_char and player_id = p_player
   for update;

  select current_hp into v_current_hp
    from public.player_characters
   where id = p_char and player_id = p_player;
  if not found then
    raise exception 'admit_infirmary: character not found or not owned';
  end if;

  if v_current_hp is null then
    raise exception 'admit_infirmary: character is at full health (current_hp is null)';
  end if;

  if exists (select 1 from public.mission_runs where player_id = p_player and party && array[p_char]) then
    raise exception 'admit_infirmary: character is on a mission';
  end if;
  if exists (select 1 from public.gather_assignments where player_character_id = p_char) then
    raise exception 'admit_infirmary: character is gathering';
  end if;
  if exists (select 1 from public.group_runs where player_id = p_player and party && array[p_char]) then
    raise exception 'admit_infirmary: character is in a dungeon or raid';
  end if;

  if exists (select 1 from public.infirmary_admissions where player_character_id = p_char) then
    raise exception 'admit_infirmary: character is already admitted';
  end if;

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

-- ---------------------------------------------------------------------------------------------
-- start_group_stage: validate + dispatch the CURRENT stage of a dungeon/raid run. p_lockout is
-- 'daily' or 'weekly' (src/lib/groupContent.ts's GROUP_LOCKOUT, passed in by the Edge Function —
-- this RPC does calendar math but doesn't hardcode which kind maps to which cadence).
-- ---------------------------------------------------------------------------------------------
create or replace function public.start_group_stage(
  p_player           uuid,
  p_kind             text,
  p_def_key          text,
  p_party            uuid[],
  p_stage_index      int,
  p_total_stages     int,
  p_duration_seconds int,
  p_lockout          text -- 'daily' | 'weekly'
) returns public.group_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_size        int := cardinality(p_party);
  v_owned_alive int;
  v_run         public.group_runs;
  v_next_reset  timestamptz;
begin
  if p_kind not in ('dungeon', 'raid') then
    raise exception 'start_group_stage: invalid kind';
  end if;
  if v_size < 1 then
    raise exception 'start_group_stage: party required';
  end if;
  if v_size <> (select count(distinct e) from unnest(p_party) e) then
    raise exception 'start_group_stage: duplicate character in party';
  end if;
  if p_duration_seconds is null or p_duration_seconds < 1 then
    raise exception 'start_group_stage: invalid duration';
  end if;

  perform 1 from public.player_characters
   where id = any(p_party) and player_id = p_player
   for update;

  select count(*) into v_owned_alive
    from public.player_characters
   where id = any(p_party)
     and player_id = p_player
     and (current_hp is null or current_hp > 0);
  if v_owned_alive <> v_size then
    raise exception 'start_group_stage: a character is not owned or is downed';
  end if;

  if exists (select 1 from public.mission_runs where player_id = p_player and party && p_party) then
    raise exception 'start_group_stage: a character is on a mission';
  end if;
  if exists (select 1 from public.gather_assignments where player_character_id = any(p_party)) then
    raise exception 'start_group_stage: a character is gathering';
  end if;
  if exists (select 1 from public.infirmary_admissions where player_character_id = any(p_party)) then
    raise exception 'start_group_stage: a character is in the infirmary';
  end if;
  -- A character mid-stage on a DIFFERENT dungeon/raid run is also busy (party is only ever
  -- non-empty while a stage is in flight — cleared on every claim, see claim_group_stage below).
  if exists (
    select 1 from public.group_runs
     where player_id = p_player and party && p_party
       and not (kind = p_kind and def_key = p_def_key)
  ) then
    raise exception 'start_group_stage: a character is in another dungeon or raid';
  end if;

  -- Load or create the run row, locking it against concurrent starts of the same run.
  select * into v_run from public.group_runs
   where player_id = p_player and kind = p_kind and def_key = p_def_key
   for update;

  if not found then
    if p_stage_index <> 0 then
      raise exception 'start_group_stage: no run in progress';
    end if;
    insert into public.group_runs (player_id, kind, def_key, current_stage_index, status, party, stage_started_at, stage_ends_at)
    values (p_player, p_kind, p_def_key, 0, 'in_progress', p_party, now(), now() + make_interval(secs => p_duration_seconds))
    returning * into v_run;
    return v_run;
  end if;

  if v_run.stage_ends_at is not null then
    raise exception 'start_group_stage: a stage is already in flight';
  end if;

  if v_run.status = 'complete' then
    v_next_reset := case p_lockout
      when 'daily' then date_trunc('day', v_run.last_cleared_at) + interval '1 day'
      when 'weekly' then date_trunc('week', v_run.last_cleared_at) + interval '1 week' -- Postgres weeks start Monday; 'week 00:00 Sunday' = trunc('week') + 6 days, see below
      else null
    end;
    if p_lockout = 'weekly' then
      v_next_reset := date_trunc('week', v_run.last_cleared_at) + interval '6 days';
    end if;
    if v_next_reset is null or now() < v_next_reset then
      raise exception 'start_group_stage: still locked out until %', v_next_reset;
    end if;
    if p_stage_index <> 0 then
      raise exception 'start_group_stage: a fresh run must start at stage 0';
    end if;
    update public.group_runs
       set current_stage_index = 0, status = 'in_progress', party = p_party,
           stage_started_at = now(), stage_ends_at = now() + make_interval(secs => p_duration_seconds),
           last_cleared_at = null
     where player_id = p_player and kind = p_kind and def_key = p_def_key
     returning * into v_run;
    return v_run;
  end if;

  if p_stage_index <> v_run.current_stage_index then
    raise exception 'start_group_stage: wrong stage index for this run';
  end if;

  update public.group_runs
     set party = p_party, stage_started_at = now(),
         stage_ends_at = now() + make_interval(secs => p_duration_seconds)
   where player_id = p_player and kind = p_kind and def_key = p_def_key
   returning * into v_run;

  return v_run;
end;
$$;

revoke all on function public.start_group_stage(uuid, text, text, uuid[], int, int, int, text) from public, anon, authenticated;
grant execute on function public.start_group_stage(uuid, text, text, uuid[], int, int, int, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- claim_group_stage: apply a resolved stage's outcome atomically. Mirrors claim_mission's shape
-- (char_updates/loot/currencies/resources) but advances a stage cursor instead of deleting a row,
-- and never advances on a loss (spec §5 step 3: retry the same stage, no progress lost).
-- ---------------------------------------------------------------------------------------------
create or replace function public.claim_group_stage(
  p_player        uuid,
  p_kind          text,
  p_def_key       text,
  p_won           boolean,
  p_char_updates  jsonb,
  p_loot          jsonb,
  p_currencies    jsonb,
  p_resources     jsonb,
  p_is_last_stage boolean
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run   public.group_runs;
  v_char  jsonb;
  v_loot  jsonb;
  v_key   text;
  v_val   numeric;
begin
  select * into v_run from public.group_runs
   where player_id = p_player and kind = p_kind and def_key = p_def_key
     and now() >= stage_ends_at
   for update;
  if not found then
    raise exception 'claim_group_stage: not claimable (no run, not finished, or already claimed)';
  end if;

  for v_char in select * from jsonb_array_elements(coalesce(p_char_updates, '[]'::jsonb))
  loop
    update public.player_characters
       set level = (v_char->>'level')::int,
           xp = (v_char->>'xp')::int,
           current_hp = (v_char->>'current_hp')::int
     where id = (v_char->>'id')::uuid and player_id = p_player;
  end loop;

  if p_won then
    for v_loot in select * from jsonb_array_elements(coalesce(p_loot, '[]'::jsonb))
    loop
      insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
      values (p_player, v_loot->>'item_def_id', v_loot->>'rarity', (v_loot->>'quantity')::int)
      on conflict (player_id, item_def_id, rarity)
        do update set quantity = public.player_inventory.quantity + excluded.quantity;
    end loop;

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
  end if;

  if p_won and p_is_last_stage then
    update public.group_runs
       set status = 'complete', party = '{}', stage_started_at = null, stage_ends_at = null,
           last_cleared_at = now()
     where player_id = p_player and kind = p_kind and def_key = p_def_key;
  elsif p_won then
    update public.group_runs
       set current_stage_index = current_stage_index + 1, party = '{}',
           stage_started_at = null, stage_ends_at = null
     where player_id = p_player and kind = p_kind and def_key = p_def_key;
  else
    -- Loss: same stage, party freed to redispatch (reshuffled or not).
    update public.group_runs
       set party = '{}', stage_started_at = null, stage_ends_at = null
     where player_id = p_player and kind = p_kind and def_key = p_def_key;
  end if;

  return jsonb_build_object('won', p_won, 'party', v_run.party);
end;
$$;

revoke all on function public.claim_group_stage(uuid, text, text, boolean, jsonb, jsonb, jsonb, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.claim_group_stage(uuid, text, text, boolean, jsonb, jsonb, jsonb, jsonb, boolean) to service_role;
