-- Map progression: per-player world-map stage tracking (ADR-0034).
--
-- Unlock rules (ADR-0034):
--   - A player may attempt stage N on a given map only if they have cleared stage N-1
--     (i.e. stage <= cleared + 1). Stage 1 is always available (cleared starts at 0).
--   - A map is locked until the player has cleared stage 7 on the preceding map
--     (p_prev_map_key must have highestStageCleared >= 7 before the first stage of
--     a new map can be started).
--
-- Null-safe legacy behaviour:
--   - p_map_key and p_stage are nullable with default null on both RPCs.
--   - When either is null (legacy missionDef drafts with no map assigned yet), gating is
--     skipped entirely in start_mission and map_progress is not updated in claim_mission.
--   - p_prev_map_key is also nullable (null = first map, no predecessor check).
--
-- Implementation:
--   1. profiles.map_progress jsonb column   — { mapKey: highestStageCleared }
--   2. start_mission gains p_map_key, p_stage, p_prev_map_key (all nullable); gates
--      dispatch on above rules only when p_map_key and p_stage are both non-null.
--   3. claim_mission gains p_map_key, p_stage (nullable), p_won; advances map_progress
--      on win only when p_map_key and p_stage are both non-null.
--
-- Both RPCs are drop-and-recreate (new signatures are incompatible with CREATE OR REPLACE
-- over the old parameter lists). All existing behaviour, checks, grants, and security
-- settings are preserved verbatim — only the map-gating / map-progress logic is added.

-- ---------------------------------------------------------------------------
-- 1. profiles.map_progress
-- ---------------------------------------------------------------------------
-- Registry-JSONB column (ADR-0004): { "<mapKey>": <highestStageCleared> }.
-- A missing key means no stage has been cleared on that map (treated as 0).
-- Adding a new map needs no migration — just a new key in the code registry.
-- No RLS change required: the existing "profiles_select_own" owner-read policy
-- already covers this column. There is no client write policy for profiles
-- (intentionally — all mutations are server-authoritative via Edge Functions,
-- ADR-0003), so clients cannot self-award progression.
alter table public.profiles
  add column map_progress jsonb not null default '{}'::jsonb;

comment on column public.profiles.map_progress is
  'Per-map highest stage cleared by this player (ADR-0034, ADR-0004). Format: { "<mapKey>": highestStageCleared }. A missing key is treated as 0. Written only by the claim_mission RPC (service role) on a WIN outcome.';

-- ---------------------------------------------------------------------------
-- 2. start_mission (map-gating replacement)
-- ---------------------------------------------------------------------------
-- Drop the old signature first — parameter list has changed so CREATE OR REPLACE
-- would create a NEW overload instead of replacing the existing function.
-- Old signature (from 20260707150000_infirmary.sql, the latest definition):
--   start_mission(uuid, text, uuid[], integer)
drop function public.start_mission(uuid, text, uuid[], integer);

-- New signature adds three parameters (all nullable, default null):
--   p_map_key      text    — which world map this mission belongs to;
--                            null = legacy missionDef with no map assigned (gating skipped)
--   p_stage        int     — which stage on that map (1-based);
--                            null = legacy missionDef with no map assigned (gating skipped)
--   p_prev_map_key text    — null = first map (no predecessor check); also null when
--                            p_map_key itself is null
--
-- All prior validation is preserved exactly:
--   - Party size 1..3 (party-cap-3 law, ADR-0032)
--   - No duplicate characters
--   - Valid duration
--   - FOR UPDATE lock on party characters (serializes concurrent dispatches)
--   - Ownership + not-downed check (current_hp null = full, 0 = downed)
--   - Busy checks: gathering / already on mission / in infirmary
-- Map gating is appended after the party checks and before the INSERT, inside
-- the same transaction, reading profiles under a consistent snapshot (no
-- separate lock needed — the player_characters FOR UPDATE already provides
-- transaction-level isolation against races on the same player).
-- Gating block is skipped entirely when p_map_key IS NULL OR p_stage IS NULL.
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
  -- Party size (ADR: party max 3).
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

  -- Map progression gating (ADR-0034). Skipped entirely for legacy missions that have no
  -- map/stage authored yet (the Edge Function passes null for all three in that case).
  if p_map_key is not null and p_stage is not null then
    -- Read the caller's map_progress once; the transaction snapshot makes this consistent.
    select map_progress into v_map_prog
      from public.profiles
     where player_id = p_player;

    -- How many stages has this player cleared on p_map_key?
    v_cleared := coalesce((v_map_prog ->> p_map_key)::int, 0);

    -- Stage must be <= cleared + 1 (sequential unlock; stage 1 always open when cleared = 0).
    if p_stage > v_cleared + 1 then
      raise exception 'start_mission: stage locked (cleared %, requested %)', v_cleared, p_stage;
    end if;

    -- If a predecessor map is specified, it must have at least stage 7 cleared.
    if p_prev_map_key is not null then
      v_prev_cleared := coalesce((v_map_prog ->> p_prev_map_key)::int, 0);
      if v_prev_cleared < 7 then
        raise exception 'start_mission: map locked — defeat the previous boss (% cleared % of 7)', p_prev_map_key, v_prev_cleared;
      end if;
    end if;
  end if;

  insert into public.mission_runs (player_id, mission_def_id, party, started_at, ends_at)
  values (p_player, p_mission_def_id, p_party, now(), now() + make_interval(secs => p_duration_seconds))
  returning * into v_run;

  return v_run;
end;
$$;

-- Re-issue grants (same policy as the original: service_role only; revoke from everyone else).
revoke all on function public.start_mission(uuid, text, uuid[], integer, text, int, text) from public, anon, authenticated;
grant execute on function public.start_mission(uuid, text, uuid[], integer, text, int, text) to service_role;

-- ---------------------------------------------------------------------------
-- 3. claim_mission (map-progress advancement replacement)
-- ---------------------------------------------------------------------------
-- Drop the old signature first.
-- Old signature (from 20260705140000_mission_rpcs.sql, the latest definition):
--   claim_mission(uuid, uuid, jsonb, jsonb, jsonb, jsonb)
drop function public.claim_mission(uuid, uuid, jsonb, jsonb, jsonb, jsonb);

-- New signature adds three parameters:
--   p_map_key  text    — which world map this run was on;
--                        null = legacy missionDef with no map assigned (update skipped)
--   p_stage    int     — which stage on that map;
--                        null = legacy missionDef with no map assigned (update skipped)
--   p_won      boolean — true = the combat sim returned a win; false = loss
--
-- On a WIN (p_won = true) AND both p_map_key and p_stage are non-null,
-- map_progress[p_map_key] is advanced to max(current_cleared, p_stage), so replaying
-- a cleared stage is a no-op. Any other combination leaves map_progress untouched.
--
-- All prior behaviour is preserved exactly:
--   - Double-claim guard (conditional DELETE on mission_runs, now() >= ends_at)
--   - Per-character level / xp / current_hp updates
--   - Loot upsert into player_inventory
--   - Currency + resource JSONB wallet increments on profiles
--   - Return shape: { claimed: true, party: uuid[] }
-- Win-gating of rewards (empty loot/currencies/resources on loss) continues to live
-- in the calling Edge Function, not in this RPC — the RPC applies whatever payload
-- the Edge Function passes in, unconditionally for those fields.
create or replace function public.claim_mission(
  p_player       uuid,
  p_run_id       uuid,
  p_char_updates jsonb,
  p_loot         jsonb,
  p_currencies   jsonb,
  p_resources    jsonb,
  p_map_key      text    default null,
  p_stage        int     default null,
  p_won          boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_party uuid[];
  v_char  jsonb;
  v_loot  jsonb;
  v_key   text;
  v_val   numeric;
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
       set level      = (v_char->>'level')::int,
           xp         = (v_char->>'xp')::int,
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

  -- Map progression: advance highestStageCleared on win only (ADR-0034).
  -- greatest() ensures replaying a cleared stage never regresses progress.
  -- Skipped for legacy missions without a map/stage (null-guarded — jsonb_set
  -- with a null path element would raise).
  if p_won and p_map_key is not null and p_stage is not null then
    update public.profiles
       set map_progress = jsonb_set(
             map_progress,
             array[p_map_key],
             to_jsonb(greatest(coalesce((map_progress ->> p_map_key)::int, 0), p_stage))
           )
     where player_id = p_player;
  end if;

  return jsonb_build_object('claimed', true, 'party', v_party);
end;
$$;

-- Re-issue grants (same policy as the original: service_role only; revoke from everyone else).
revoke all on function public.claim_mission(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, int, boolean) from public, anon, authenticated;
grant execute on function public.claim_mission(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, int, boolean) to service_role;
