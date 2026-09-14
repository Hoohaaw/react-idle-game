-- Achievements (docs/superpowers/specs/2026-09-13-achievements-design.md) — a purely cosmetic
-- badge system, architecturally mirroring the Ascendant Milestone pattern (check_ascendant_
-- milestones) but WITHOUT reward payout or its double-award-race locking: achievements grant
-- nothing, so a race here is a harmless idempotent collision (setting a claimed-map key `true`
-- twice), not a bug (spec §4b — a deliberate, documented exception to this repo's CLAUDE.md
-- row-locking rule, which exists specifically to stop a race from double-granting a reward).

alter table public.profiles
  add column achievements jsonb not null default '{}'::jsonb;
alter table public.profiles
  add column achievement_counters jsonb not null default '{}'::jsonb;
alter table public.profiles
  add column ascendant_shards_earned_total integer not null default 0
    check (ascendant_shards_earned_total >= 0);
alter table public.profiles
  add column days_played integer not null default 0 check (days_played >= 0);
alter table public.profiles
  add column last_login_date date;

comment on column public.profiles.achievements is
  '{ "<achievementKey>.<tierIndex>": true } — permanent record of claimed achievement badges. Cosmetic only, never wiped by reset_player or transcend_player.';
comment on column public.profiles.achievement_counters is
  '{ "legendaryItemsEquipped": n, "capstonesEarned": n, "charactersReachedLevelCap": n } — one-off achievement trigger counters, incremented at their single trigger RPC each. Never wiped.';
comment on column public.profiles.ascendant_shards_earned_total is
  'Cumulative Ascendant Shards ever earned — distinct from ascendant_shards (the spendable balance, which decreases on purchases). Feeds the "Shard Hoarder" achievement ladder. Never wiped.';
comment on column public.profiles.days_played is
  'Count of distinct UTC calendar days record_login has been called on. Never wiped.';
comment on column public.profiles.last_login_date is
  'UTC date of the last day days_played was incremented — makes record_login idempotent per day.';

-- ---------------------------------------------------------------------------------------------
-- check_achievements: shared by every RPC that can move a tracked value (claim_mission,
-- collect_gather, claim_group_stage, transcend_player, record_login). Mirrors
-- check_ascendant_milestones's shape and calling convention exactly: takes the CALLING RPC's own
-- already-fetched/locked state as plain arguments and never queries the database itself, so it
-- inherits whatever lock (if any) its caller already holds — same reason check_ascendant_
-- milestones needs no lock of its own. Generic over the registry below: adding a future
-- lifetime_stats-backed ladder means adding one row to the `values (...)` list, nothing else.
-- Mirrors src/lib/achievements.ts's ACHIEVEMENT_DEFS — when a ladder is added/changed there, add
-- it here too, in the same commit (same accepted SQL/TS duplication as check_ascendant_
-- milestones/ascendantMilestones.ts — Postgres can't import TypeScript).
-- ---------------------------------------------------------------------------------------------
create or replace function public.check_achievements(
  p_lifetime_stats            jsonb,
  p_unlocked_character_count  integer,
  p_reset_count               integer,
  p_transcend_count           integer,
  p_shards_earned_total       integer,
  p_days_played               integer,
  p_achievement_counters      jsonb,
  p_claimed                   jsonb
) returns jsonb
language plpgsql
as $$
declare
  v_new_keys jsonb := '{}'::jsonb;
  v_ladder   record;
  v_key      text;
  v_value    numeric;
  i          integer;
begin
  -- Threshold ladders over lifetime_stats (Combat + Economy).
  for v_ladder in
    select * from (values
      ('missionsCleared',           array[50,500,5000]),
      ('dungeonsCleared',           array[10,100,1000]),
      ('raidsCleared',              array[5,50,500]),
      ('goldEarned',                array[1000,10000,100000,1000000,10000000]),
      ('resourceGathered.Wood',     array[500,5000,50000,500000]),
      ('resourceGathered.Copper',   array[500,5000,50000,500000]),
      ('resourceGathered.Stone',    array[500,5000,50000,500000]),
      ('resourceGathered.Coal',     array[500,5000,50000,500000]),
      ('resourceGathered.Iron',     array[500,5000,50000,500000]),
      ('resourceGathered.Silver',   array[500,5000,50000,500000]),
      ('resourceGathered.Bronze',   array[500,5000,50000,500000]),
      ('resourceGathered.Gold',     array[500,5000,50000,500000]),
      ('resourceGathered.Platinum', array[500,5000,50000,500000])
    ) as t(metric_key, thresholds)
  loop
    v_value := coalesce((p_lifetime_stats ->> v_ladder.metric_key)::numeric, 0);
    for i in 1..array_length(v_ladder.thresholds, 1) loop
      v_key := v_ladder.metric_key || '.' || (i - 1);
      if v_value >= v_ladder.thresholds[i] and not coalesce(p_claimed ? v_key, false) then
        v_new_keys := v_new_keys || jsonb_build_object(v_key, true);
      end if;
    end loop;
  end loop;

  -- Shard Hoarder ladder (Prestige).
  for i in 1..array_length(array[50,500,5000], 1) loop
    v_key := 'shardHoarder.' || (i - 1);
    if p_shards_earned_total >= (array[50,500,5000])[i] and not coalesce(p_claimed ? v_key, false) then
      v_new_keys := v_new_keys || jsonb_build_object(v_key, true);
    end if;
  end loop;

  -- Days Played ladder (Dedication).
  for i in 1..array_length(array[1,7,30,100], 1) loop
    v_key := 'daysPlayed.' || (i - 1);
    if p_days_played >= (array[1,7,30,100])[i] and not coalesce(p_claimed ? v_key, false) then
      v_new_keys := v_new_keys || jsonb_build_object(v_key, true);
    end if;
  end loop;

  -- Single-threshold-of-1 "moment" achievements (Collection + Prestige + Dedication).
  if p_unlocked_character_count >= 19 and not coalesce(p_claimed ? 'fullRoster.0', false) then
    v_new_keys := v_new_keys || jsonb_build_object('fullRoster.0', true);
  end if;
  if p_reset_count >= 1 and not coalesce(p_claimed ? 'echoesOfThePast.0', false) then
    v_new_keys := v_new_keys || jsonb_build_object('echoesOfThePast.0', true);
  end if;
  if p_transcend_count >= 1 and not coalesce(p_claimed ? 'ascendant.0', false) then
    v_new_keys := v_new_keys || jsonb_build_object('ascendant.0', true);
  end if;
  if coalesce((p_achievement_counters ->> 'legendaryItemsEquipped')::numeric, 0) >= 1
     and not coalesce(p_claimed ? 'legendaryCollector.0', false) then
    v_new_keys := v_new_keys || jsonb_build_object('legendaryCollector.0', true);
  end if;
  if coalesce((p_achievement_counters ->> 'capstonesEarned')::numeric, 0) >= 1
     and not coalesce(p_claimed ? 'blessed.0', false) then
    v_new_keys := v_new_keys || jsonb_build_object('blessed.0', true);
  end if;
  if coalesce((p_achievement_counters ->> 'charactersReachedLevelCap')::numeric, 0) >= 1
     and not coalesce(p_claimed ? 'maxLevel.0', false) then
    v_new_keys := v_new_keys || jsonb_build_object('maxLevel.0', true);
  end if;

  return jsonb_build_object('newKeys', v_new_keys);
end;
$$;

revoke all on function public.check_achievements(jsonb, integer, integer, integer, integer, integer, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.check_achievements(jsonb, integer, integer, integer, integer, integer, jsonb, jsonb) to service_role;
