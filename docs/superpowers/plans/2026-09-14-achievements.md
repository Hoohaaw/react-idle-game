# Achievements System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the achievements system from `docs/superpowers/specs/2026-09-13-achievements-design.md`: a cosmetic-only badge system with threshold ladders (missions/dungeons/raids/gold/resources/shards/days-played) and one-off "moment" badges (full roster, legendary equip, blessing capstone, level cap), architecturally mirroring the Ascendant Milestone pattern (shared SQL check function, permanent claimed-map) but without reward payout or lock discipline, since nothing is granted.

**Architecture:** A new `check_achievements` SQL function, generic over a registry, called from inside every RPC that can move a tracked value (`claim_mission`, `collect_gather`, `claim_group_stage`, `transcend_player`) plus two RPCs extended with one-off counter bumps (`equip_item`, `choose_blessing`) and one new RPC (`record_login`). A parallel TS registry (`src/lib/achievements.ts`) drives a new `/achievements` page.

**Tech Stack:** PostgreSQL/PL-pgSQL (Supabase), Deno Edge Functions, React 19 + TypeScript + Vitest, TanStack Query.

**Spec:** `docs/superpowers/specs/2026-09-13-achievements-design.md`

## Global Constraints

- **Server-authoritative writes** (ADR-0003): the client never writes `achievements`/`achievement_counters`/`ascendant_shards_earned_total`/`days_played`/`last_login_date` directly — every write goes through a SECURITY DEFINER RPC, granted to `service_role` only.
- **Registry-driven extensibility** (ADR-0004): adding a future achievement must be "one line in `ACHIEVEMENT_DEFS`" on the TS side and one line in `check_achievements`'s `values (...)` list (or one new `if` for a non-ladder metric) on the SQL side — never a change to `check_achievements`'s calling convention or any RPC signature.
- **No `for update` locking added specifically for achievements.** `check_achievements` is called immediately after (or as part of) the same `select ... for update` each caller RPC already performs for its own reasons (Shard awards via `check_ascendant_milestones`, or a fresh lock in `record_login`) — it never issues its own lock. This is a deliberate, spec-approved exception (spec §4b) to this repo's CLAUDE.md row-locking rule: that rule exists to stop a race from double-granting a reward, and achievements grant nothing, so a race here is a harmless idempotent collision (setting a claimed-map key `true` twice), not a bug. Do not add a lock to "fix" this.
- **No emoji as UI icons**: the achievement grid renders `IconSlot` (`src/components/atoms/IconSlot`) for every badge icon, never an emoji glyph.
- **No pgTAP/Deno test infrastructure exists in this repo** (a standing, accepted gap — see `TODO.md`). SQL/Edge Function tasks in this plan are verified by manual RPC calls via the Supabase MCP tools and the existing "deploy then byte-diff the live bundle against local disk" discipline, not by new automated tests. Only the pure TypeScript registry (`src/lib/achievements.ts`) gets Vitest tests.
- Every new/modified RPC keeps the exact signature it has today unless a task explicitly says otherwise — no task in this plan changes an RPC's parameter list; all new inputs are read from the profile row itself, already locked by each RPC's own existing logic.

---

### Task 1: Migration — new profile columns + `check_achievements`

**Files:**
- Create: `supabase/migrations/20260914100000_achievements.sql`

**Interfaces:**
- Produces: `public.check_achievements(p_lifetime_stats jsonb, p_unlocked_character_count integer, p_reset_count integer, p_transcend_count integer, p_shards_earned_total integer, p_days_played integer, p_achievement_counters jsonb, p_claimed jsonb) returns jsonb` — returns `{ "newKeys": { "<achievementKey>.<tierIndex>": true, ... } }`. Every later task calls this exact function with these exact 8 positional arguments, in this order.
- Produces new columns on `public.profiles`: `achievements jsonb`, `achievement_counters jsonb`, `ascendant_shards_earned_total integer`, `days_played integer`, `last_login_date date`.

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP `apply_migration` tool with `name: "20260914100000_achievements"` and the SQL above as `query`. Confirm it succeeds with no errors.

- [ ] **Step 3: Manually verify `check_achievements` in isolation**

Via the Supabase MCP `execute_sql` tool, run:

```sql
select public.check_achievements(
  '{"missionsCleared": 60, "goldEarned": 500}'::jsonb,
  19,   -- unlocked_character_count
  1,    -- reset_count
  0,    -- transcend_count
  0,    -- shards_earned_total
  0,    -- days_played
  '{}'::jsonb,
  '{}'::jsonb
);
```

Expected: the returned `newKeys` object contains `"missionsCleared.0": true`, `"fullRoster.0": true`, and `"echoesOfThePast.0": true` — and nothing else (goldEarned=500 is below its first threshold of 1000, so no `goldEarned.*` key).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260914100000_achievements.sql
git commit -m "feat: add achievements schema + check_achievements SQL function"
```

---

### Task 2: Wire `check_achievements` into `claim_mission` + `collect_gather`

**Files:**
- Create: `supabase/migrations/20260914100100_claim_mission_collect_gather_achievements.sql`

**Interfaces:**
- Consumes: `public.check_achievements(...)` from Task 1 (exact 8-arg signature above).
- Produces: no new interfaces — `claim_mission`/`collect_gather` keep their existing signatures and return shapes unchanged.

Both functions are redefined in full below, preserving every existing line VERBATIM (from `20260912100200_claim_mission_collect_gather_milestones.sql`, their current definitions) and adding only the new achievement-checking block. `claim_mission` additionally detects, inside its existing per-character update loop, whether any character just reached level 50 (`charactersReachedLevelCap`) or just had its capstone become earned (`capstonesEarned` — level 50 AND row4 already picked; row4 can be picked as early as level 40, so a later level-up alone can newly satisfy the capstone condition even though `choose_blessing`, Task 6, is the other place this can trigger).

- [ ] **Step 1: Write the migration**

```sql
-- claim_mission and collect_gather gain the achievements check (spec 2026-09-13 §4b), same
-- calling shape as their existing check_ascendant_milestones call, computed from each RPC's own
-- already-locked state. claim_mission additionally detects two one-off "moment" achievements
-- (level cap reached, blessing capstone newly earned) inside its existing per-character update
-- loop — collect_gather never changes level, so it has no equivalent. Every other line of both
-- functions is preserved VERBATIM from 20260912100200_claim_mission_collect_gather_milestones.sql
-- — only the new blocks are added. Same signatures as today.

create or replace function public.claim_mission(
  p_player          uuid,
  p_run_id          uuid,
  p_char_updates    jsonb,
  p_loot            jsonb,
  p_currencies      jsonb,
  p_resources       jsonb,
  p_map_key         text    default null,
  p_stage           int     default null,
  p_won             boolean default false,
  p_lifetime_stats  jsonb   default '{}'::jsonb,
  p_newly_unlocked  text[]  default '{}'
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
  v_actually_unlocked text[] := '{}';
  v_lifetime_stats jsonb;
  v_transcend_count integer;
  v_ascendant_milestones jsonb;
  v_milestones jsonb;
  v_new_level    integer;
  v_new_blessings jsonb;
  v_reached_cap      boolean := false;
  v_reached_capstone boolean := false;
  v_reset_count integer;
  v_shards_earned_total integer;
  v_days_played integer;
  v_achievement_counters jsonb;
  v_achievements jsonb;
  v_unlocked_characters jsonb;
  v_achievement_result jsonb;
begin
  delete from public.mission_runs
   where id = p_run_id and player_id = p_player and now() >= ends_at
   returning party into v_party;
  if not found then
    raise exception 'claim_mission: not claimable (already claimed, not owned, or not finished)';
  end if;

  for v_char in select * from jsonb_array_elements(coalesce(p_char_updates, '[]'::jsonb))
  loop
    update public.player_characters
       set level      = (v_char->>'level')::int,
           xp         = (v_char->>'xp')::int,
           current_hp = (v_char->>'current_hp')::int
     where id = (v_char->>'id')::uuid and player_id = p_player
    returning level, blessings into v_new_level, v_new_blessings;

    if v_new_level >= 50 then
      v_reached_cap := true;
      if coalesce(v_new_blessings, '{}'::jsonb) ? 'row4' then
        v_reached_capstone := true;
      end if;
    end if;
  end loop;

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

  if p_won and p_map_key is not null and p_stage is not null then
    update public.profiles
       set map_progress = jsonb_set(
             map_progress,
             array[p_map_key],
             to_jsonb(greatest(coalesce((map_progress ->> p_map_key)::int, 0), p_stage))
           )
     where player_id = p_player;
  end if;

  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_lifetime_stats, '{}'::jsonb))
  loop
    update public.profiles
       set lifetime_stats = jsonb_set(lifetime_stats, array[v_key],
             to_jsonb(coalesce((lifetime_stats->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;

  foreach v_key in array coalesce(p_newly_unlocked, '{}')
  loop
    update public.profiles
       set unlocked_characters = jsonb_set(unlocked_characters, array[v_key], to_jsonb(now()))
     where player_id = p_player and not (unlocked_characters ? v_key);
    if found then
      v_actually_unlocked := array_append(v_actually_unlocked, v_key);
    end if;
  end loop;

  -- Ascendant Milestones (ADR-0023): computed from the row's own state, AFTER every delta above
  -- has already been applied to it, so this sees the true post-claim lifetime_stats. `for update`
  -- is required here (not just incidentally covered by an earlier UPDATE in this function) so two
  -- concurrent claims for the same player always serialize on this row before computing/awarding
  -- shards — otherwise both could read the same pre-award state and double-award ascendant_shards.
  select lifetime_stats, transcend_count, ascendant_milestones, reset_count,
         ascendant_shards_earned_total, days_played, achievement_counters, achievements,
         unlocked_characters
    into v_lifetime_stats, v_transcend_count, v_ascendant_milestones, v_reset_count,
         v_shards_earned_total, v_days_played, v_achievement_counters, v_achievements,
         v_unlocked_characters
    from public.profiles where player_id = p_player
    for update;
  v_milestones := check_ascendant_milestones(v_lifetime_stats, v_transcend_count, v_ascendant_milestones);

  if v_reached_cap then
    v_achievement_counters := jsonb_set(v_achievement_counters, array['charactersReachedLevelCap'],
      to_jsonb(coalesce((v_achievement_counters->>'charactersReachedLevelCap')::int, 0) + 1));
  end if;
  if v_reached_capstone then
    v_achievement_counters := jsonb_set(v_achievement_counters, array['capstonesEarned'],
      to_jsonb(coalesce((v_achievement_counters->>'capstonesEarned')::int, 0) + 1));
  end if;

  v_achievement_result := check_achievements(
    v_lifetime_stats,
    (select count(*) from jsonb_object_keys(v_unlocked_characters))::int,
    v_reset_count, v_transcend_count, v_shards_earned_total, v_days_played,
    v_achievement_counters, v_achievements
  );

  update public.profiles
     set ascendant_shards = ascendant_shards + (v_milestones->>'shards')::int,
         ascendant_shards_earned_total = ascendant_shards_earned_total + (v_milestones->>'shards')::int,
         ascendant_milestones = ascendant_milestones || (v_milestones->'newKeys'),
         achievement_counters = v_achievement_counters,
         achievements = achievements || (v_achievement_result -> 'newKeys')
   where player_id = p_player;

  return jsonb_build_object('claimed', true, 'party', v_party, 'actually_unlocked', v_actually_unlocked);
end;
$$;

revoke all on function public.claim_mission(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, int, boolean, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.claim_mission(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, int, boolean, jsonb, text[]) to service_role;

create or replace function public.collect_gather(
  p_player                uuid,
  p_assignment_id         uuid,
  p_resource              text,
  p_gained                int,
  p_new_last_collected_at timestamptz,
  p_stop                  boolean,
  p_lifetime_stats        jsonb  default '{}'::jsonb,
  p_newly_unlocked        text[] default '{}'
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owned int;
  v_key   text;
  v_val   numeric;
  v_actually_unlocked text[] := '{}';
  v_lifetime_stats jsonb;
  v_transcend_count integer;
  v_ascendant_milestones jsonb;
  v_milestones jsonb;
  v_reset_count integer;
  v_shards_earned_total integer;
  v_days_played integer;
  v_achievement_counters jsonb;
  v_achievements jsonb;
  v_unlocked_characters jsonb;
  v_achievement_result jsonb;
begin
  select count(*) into v_owned
    from public.gather_assignments
   where id = p_assignment_id and player_id = p_player;
  if v_owned <> 1 then
    raise exception 'collect_gather: assignment not found or not owned';
  end if;

  if p_gained > 0 then
    update public.profiles
       set resources = jsonb_set(resources, array[p_resource],
             to_jsonb(coalesce((resources->>p_resource)::numeric, 0) + p_gained))
     where player_id = p_player;
  end if;

  if p_stop then
    delete from public.gather_assignments where id = p_assignment_id and player_id = p_player;
  else
    update public.gather_assignments
       set last_collected_at = p_new_last_collected_at
     where id = p_assignment_id and player_id = p_player;
  end if;

  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_lifetime_stats, '{}'::jsonb))
  loop
    update public.profiles
       set lifetime_stats = jsonb_set(lifetime_stats, array[v_key],
             to_jsonb(coalesce((lifetime_stats->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;

  foreach v_key in array coalesce(p_newly_unlocked, '{}')
  loop
    update public.profiles
       set unlocked_characters = jsonb_set(unlocked_characters, array[v_key], to_jsonb(now()))
     where player_id = p_player and not (unlocked_characters ? v_key);
    if found then
      v_actually_unlocked := array_append(v_actually_unlocked, v_key);
    end if;
  end loop;

  -- `for update` is required here: gather-collect's caller can call this with p_gained = 0 (a
  -- routine zero-gain collect), in which case NO earlier statement in this function has touched
  -- the profiles row yet — without an explicit lock here, two concurrent zero-gain calls would
  -- both read the same pre-award state and double-award ascendant_shards.
  select lifetime_stats, transcend_count, ascendant_milestones, reset_count,
         ascendant_shards_earned_total, days_played, achievement_counters, achievements,
         unlocked_characters
    into v_lifetime_stats, v_transcend_count, v_ascendant_milestones, v_reset_count,
         v_shards_earned_total, v_days_played, v_achievement_counters, v_achievements,
         v_unlocked_characters
    from public.profiles where player_id = p_player
    for update;
  v_milestones := check_ascendant_milestones(v_lifetime_stats, v_transcend_count, v_ascendant_milestones);

  v_achievement_result := check_achievements(
    v_lifetime_stats,
    (select count(*) from jsonb_object_keys(v_unlocked_characters))::int,
    v_reset_count, v_transcend_count, v_shards_earned_total, v_days_played,
    v_achievement_counters, v_achievements
  );

  update public.profiles
     set ascendant_shards = ascendant_shards + (v_milestones->>'shards')::int,
         ascendant_shards_earned_total = ascendant_shards_earned_total + (v_milestones->>'shards')::int,
         ascendant_milestones = ascendant_milestones || (v_milestones->'newKeys'),
         achievements = achievements || (v_achievement_result -> 'newKeys')
   where player_id = p_player;

  return jsonb_build_object('gained', p_gained, 'resource', p_resource, 'stopped', p_stop, 'actually_unlocked', v_actually_unlocked);
end;
$$;

revoke all on function public.collect_gather(uuid, uuid, text, int, timestamptz, boolean, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.collect_gather(uuid, uuid, text, int, timestamptz, boolean, jsonb, text[]) to service_role;
```

- [ ] **Step 2: Apply the migration**

Supabase MCP `apply_migration`, `name: "20260914100100_claim_mission_collect_gather_achievements"`.

- [ ] **Step 3: Manually verify**

Via `execute_sql`, pick a real test player row (or a scratch row you insert and delete after), and confirm: after calling `claim_mission` with a `p_char_updates` entry whose `level` is `50`, the row's `achievement_counters->>'charactersReachedLevelCap'` becomes `1` and `achievements` gains `"maxLevel.0": true`. Also confirm a normal claim with no level-50 update leaves `achievement_counters` untouched (still `{}` or unchanged).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260914100100_claim_mission_collect_gather_achievements.sql
git commit -m "feat: wire achievements check into claim_mission and collect_gather"
```

---

### Task 3: Wire `check_achievements` into `claim_group_stage`

**Files:**
- Create: `supabase/migrations/20260914100200_claim_group_stage_achievements.sql`

**Interfaces:**
- Consumes: `public.check_achievements(...)` (Task 1).
- Produces: no signature change — `claim_group_stage` keeps its current 10-arg signature (`uuid, text, text, boolean, jsonb, jsonb, jsonb, jsonb, boolean, jsonb`) from `20260912100300_claim_group_stage_lifetime_stats.sql`.

Same level-cap/capstone detection as Task 2's `claim_mission`, since `claim_group_stage` also writes `level`/`blessings`... actually it does NOT update `blessings`, only `level`/`xp`/`current_hp` — read `blessings` in a separate lookup per updated character to check for `row4`.

- [ ] **Step 1: Write the migration**

```sql
-- claim_group_stage gains the achievements check (spec 2026-09-13 §4b) plus the same level-cap/
-- capstone-earned one-off detection claim_mission (Task 2) has. Every other line preserved
-- VERBATIM from 20260912100300_claim_group_stage_lifetime_stats.sql. Same 10-arg signature.

create or replace function public.claim_group_stage(
  p_player         uuid,
  p_kind           text,
  p_def_key        text,
  p_won            boolean,
  p_char_updates   jsonb,
  p_loot           jsonb,
  p_currencies     jsonb,
  p_resources      jsonb,
  p_is_last_stage  boolean,
  p_lifetime_stats jsonb default '{}'::jsonb
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
  v_lifetime_stats jsonb;
  v_transcend_count integer;
  v_ascendant_milestones jsonb;
  v_milestones jsonb;
  v_new_level      integer;
  v_char_blessings jsonb;
  v_reached_cap      boolean := false;
  v_reached_capstone boolean := false;
  v_reset_count integer;
  v_shards_earned_total integer;
  v_days_played integer;
  v_achievement_counters jsonb;
  v_achievements jsonb;
  v_unlocked_characters jsonb;
  v_achievement_result jsonb;
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
     where id = (v_char->>'id')::uuid and player_id = p_player
    returning level, blessings into v_new_level, v_char_blessings;

    if v_new_level >= 50 then
      v_reached_cap := true;
      if coalesce(v_char_blessings, '{}'::jsonb) ? 'row4' then
        v_reached_capstone := true;
      end if;
    end if;
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
    update public.group_runs
       set party = '{}', stage_started_at = null, stage_ends_at = null
     where player_id = p_player and kind = p_kind and def_key = p_def_key;
  end if;

  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_lifetime_stats, '{}'::jsonb))
  loop
    update public.profiles
       set lifetime_stats = jsonb_set(lifetime_stats, array[v_key],
             to_jsonb(coalesce((lifetime_stats->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;

  select lifetime_stats, transcend_count, ascendant_milestones, reset_count,
         ascendant_shards_earned_total, days_played, achievement_counters, achievements,
         unlocked_characters
    into v_lifetime_stats, v_transcend_count, v_ascendant_milestones, v_reset_count,
         v_shards_earned_total, v_days_played, v_achievement_counters, v_achievements,
         v_unlocked_characters
    from public.profiles where player_id = p_player
    for update;
  v_milestones := check_ascendant_milestones(v_lifetime_stats, v_transcend_count, v_ascendant_milestones);

  if v_reached_cap then
    v_achievement_counters := jsonb_set(v_achievement_counters, array['charactersReachedLevelCap'],
      to_jsonb(coalesce((v_achievement_counters->>'charactersReachedLevelCap')::int, 0) + 1));
  end if;
  if v_reached_capstone then
    v_achievement_counters := jsonb_set(v_achievement_counters, array['capstonesEarned'],
      to_jsonb(coalesce((v_achievement_counters->>'capstonesEarned')::int, 0) + 1));
  end if;

  v_achievement_result := check_achievements(
    v_lifetime_stats,
    (select count(*) from jsonb_object_keys(v_unlocked_characters))::int,
    v_reset_count, v_transcend_count, v_shards_earned_total, v_days_played,
    v_achievement_counters, v_achievements
  );

  update public.profiles
     set ascendant_shards = ascendant_shards + (v_milestones->>'shards')::int,
         ascendant_shards_earned_total = ascendant_shards_earned_total + (v_milestones->>'shards')::int,
         ascendant_milestones = ascendant_milestones || (v_milestones->'newKeys'),
         achievement_counters = v_achievement_counters,
         achievements = achievements || (v_achievement_result -> 'newKeys')
   where player_id = p_player;

  return jsonb_build_object('won', p_won, 'party', v_run.party);
end;
$$;

revoke all on function public.claim_group_stage(uuid, text, text, boolean, jsonb, jsonb, jsonb, jsonb, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.claim_group_stage(uuid, text, text, boolean, jsonb, jsonb, jsonb, jsonb, boolean, jsonb) to service_role;
```

- [ ] **Step 2: Apply the migration** — Supabase MCP `apply_migration`, `name: "20260914100200_claim_group_stage_achievements"`.

- [ ] **Step 3: Manually verify** — same style of check as Task 2 Step 3, but via `claim_group_stage` (needs a real or scratch `group_runs` row with `stage_ends_at` in the past to satisfy the claimability check).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260914100200_claim_group_stage_achievements.sql
git commit -m "feat: wire achievements check into claim_group_stage"
```

---

### Task 4: Wire `check_achievements` into `transcend_player`

**Files:**
- Create: `supabase/migrations/20260914100300_transcend_player_achievements.sql`

**Interfaces:**
- Consumes: `public.check_achievements(...)` (Task 1).
- Produces: no signature change — `transcend_player(p_player uuid, p_protected_ids uuid[])` unchanged.

`transcend_player` already selects everything `check_achievements` needs except `unlocked_character_count`/`ascendant_shards_earned_total`/`days_played`/`achievement_counters`/`achievements` — extend its existing `for update` SELECT to also pull those, same pattern as Tasks 2-3. `unlocked_characters` here must be read from the SAME row **before** the function's own UPDATE trims it down to protected-only — read the count in the same initial SELECT (already `for update`), before the wipe.

- [ ] **Step 1: Write the migration**

```sql
-- transcend_player gains the achievements check (spec 2026-09-13 §4b) — computed from the row's
-- pre-wipe state (unlocked_character_count is read BEFORE this function's own trim-to-protected
-- update, matching "Full Roster" checking the count the player actually had at Transcend time,
-- not the post-wipe remainder). Every other line preserved VERBATIM from
-- 20260912100000_transcendence_ascendant_shards.sql's transcend_player. Same 2-arg signature.

create or replace function public.transcend_player(
  p_player uuid,
  p_protected_ids uuid[]
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_protected_slots integer;
  v_transcend_count integer;
  v_ascendant_milestones jsonb;
  v_lifetime_stats jsonb;
  v_milestones jsonb;
  v_awarded integer;
  v_reset_count integer;
  v_shards_earned_total integer;
  v_days_played integer;
  v_achievement_counters jsonb;
  v_achievements jsonb;
  v_unlocked_characters jsonb;
  v_achievement_result jsonb;
begin
  select coalesce((echo_shop ->> 'protectedSlots')::int, 0), transcend_count, ascendant_milestones,
         lifetime_stats, reset_count, ascendant_shards_earned_total, days_played,
         achievement_counters, achievements, unlocked_characters
    into v_protected_slots, v_transcend_count, v_ascendant_milestones,
         v_lifetime_stats, v_reset_count, v_shards_earned_total, v_days_played,
         v_achievement_counters, v_achievements, v_unlocked_characters
    from public.profiles
   where player_id = p_player
   for update;

  if not found then
    raise exception 'transcend_player: player not found';
  end if;

  if cardinality(p_protected_ids) > v_protected_slots then
    raise exception 'transcend_player: too many protected characters (have % slots, chose %)', v_protected_slots, cardinality(p_protected_ids);
  end if;
  if exists (
    select 1 from unnest(p_protected_ids) as pid
    where not exists (select 1 from public.player_characters where id = pid and player_id = p_player)
  ) then
    raise exception 'transcend_player: a protected character does not belong to this player';
  end if;

  if exists (select 1 from public.mission_runs where player_id = p_player)
    or exists (
      select 1 from public.gather_assignments ga
        join public.player_characters pc on pc.id = ga.player_character_id
       where pc.player_id = p_player
    )
    or exists (select 1 from public.group_runs where player_id = p_player and cardinality(party) > 0)
    or exists (
      select 1 from public.infirmary_admissions ia
        join public.player_characters pc on pc.id = ia.player_character_id
       where pc.player_id = p_player
    )
    or exists (select 1 from public.craft_runs where player_id = p_player)
  then
    raise exception 'transcend_player: a character is busy';
  end if;

  v_transcend_count := v_transcend_count + 1;
  v_milestones := check_ascendant_milestones(v_lifetime_stats, v_transcend_count, v_ascendant_milestones);
  v_awarded := (v_milestones ->> 'shards')::int;

  v_achievement_result := check_achievements(
    v_lifetime_stats,
    (select count(*) from jsonb_object_keys(v_unlocked_characters))::int,
    v_reset_count, v_transcend_count, v_shards_earned_total + v_awarded, v_days_played,
    v_achievement_counters, v_achievements
  );

  update public.profiles
     set currencies           = '{}'::jsonb,
         resources            = '{}'::jsonb,
         map_progress         = '{}'::jsonb,
         infirmary_level      = 1,
         echoes               = 0,
         echo_shop            = '{}'::jsonb,
         unlocked_characters  = (
           select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
           from jsonb_each(unlocked_characters)
           where key in (select character_def_id from public.player_characters
                         where id = any(p_protected_ids))
         ),
         transcend_count      = v_transcend_count,
         ascendant_shards     = ascendant_shards + v_awarded,
         ascendant_shards_earned_total = ascendant_shards_earned_total + v_awarded,
         ascendant_milestones = ascendant_milestones || (v_milestones -> 'newKeys'),
         achievements         = achievements || (v_achievement_result -> 'newKeys')
   where player_id = p_player;

  insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
  select p_player, item.value ->> 'itemDefId', item.value ->> 'rarity', count(*)::int
    from public.player_characters pc,
         jsonb_each(pc.equipped) as item
   where pc.player_id = p_player and not (pc.id = any(p_protected_ids))
   group by item.value ->> 'itemDefId', item.value ->> 'rarity'
  on conflict (player_id, item_def_id, rarity)
  do update set quantity = public.player_inventory.quantity + excluded.quantity;

  delete from public.group_runs where player_id = p_player;
  delete from public.player_characters where player_id = p_player and not (id = any(p_protected_ids));

  return jsonb_build_object('shardsAwarded', v_awarded, 'transcendCount', v_transcend_count);
end;
$$;

revoke all on function public.transcend_player(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.transcend_player(uuid, uuid[]) to service_role;
```

- [ ] **Step 2: Apply the migration** — Supabase MCP `apply_migration`, `name: "20260914100300_transcend_player_achievements"`.

- [ ] **Step 3: Manually verify** — via `execute_sql` on a scratch profile row with `reset_count >= 1` and `transcend_count = 0` before the call: after `select public.transcend_player(<player_id>, '{}'::uuid[])`, confirm `achievements` gained `"ascendant.0": true` (and `"echoesOfThePast.0": true` if not already claimed).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260914100300_transcend_player_achievements.sql
git commit -m "feat: wire achievements check into transcend_player"
```

---

### Task 5: Legendary-equip counter in `equip_item`

**Files:**
- Create: `supabase/migrations/20260914100400_equip_item_legendary_counter.sql`

**Interfaces:**
- Produces: no signature change — `equip_item(p_player uuid, p_char uuid, p_slot_key text, p_item_def_id text, p_rarity text, p_required_level integer default 0)` unchanged (current 6-arg signature from `20260908140000_group_runs.sql`).
- This task does NOT call `check_achievements` — the "Legendary Collector" badge is only granted the next time `check_achievements` runs from `claim_mission`/`collect_gather`/`claim_group_stage`/`transcend_player`/`record_login`, same as every other counter-backed achievement. `equip_item` only bumps the counter.

- [ ] **Step 1: Write the migration**

```sql
-- equip_item bumps achievement_counters.legendaryItemsEquipped whenever the equipped item's
-- rarity is 'Legendary' (spec 2026-09-13 §4e "Legendary Collector" — counts equip EVENTS, not
-- distinct legendary item defs, a deliberate simplification). The actual achievement claim
-- happens later, next time check_achievements runs from any of its callers — equip_item never
-- calls it directly, since equipping never touches lifetime_stats/reset_count/transcend_count/
-- shards/days_played, so there is nothing else for check_achievements to re-evaluate here. Every
-- other line preserved VERBATIM from 20260908140000_group_runs.sql's equip_item. Same signature.

create or replace function public.equip_item(
  p_player          uuid,
  p_char            uuid,
  p_slot_key        text,
  p_item_def_id     text,
  p_rarity          text,
  p_required_level  integer default 0
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_equipped     jsonb;
  v_new_equipped jsonb;
  v_prev         jsonb;
  v_qty          integer;
  v_level        integer;
begin
  -- 1. Validate slot key.
  if p_slot_key not in (
    'head', 'shoulders', 'chest', 'hands', 'legs', 'feet',
    'weapon', 'offhand',
    'ring1', 'ring2', 'ring3', 'ring4',
    'trinket1', 'trinket2'
  ) then
    raise exception 'equip_item: invalid slot key';
  end if;

  -- 2. Validate rarity.
  if p_rarity not in ('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary') then
    raise exception 'equip_item: invalid rarity';
  end if;

  -- 3. Lock the character row and capture equipped + level; fail if not owned.
  select equipped, level into v_equipped, v_level
    from public.player_characters
   where id = p_char and player_id = p_player
   for update;
  if not found then
    raise exception 'equip_item: character not found or not owned';
  end if;

  -- 3b. Level-requirement gate (ADR-0043).
  if v_level < p_required_level then
    raise exception 'equip_item: character level too low (needs %, has %)', p_required_level, v_level;
  end if;

  -- 4. Busy checks.
  if exists (
    select 1 from public.mission_runs
     where player_id = p_player and party && array[p_char]
  ) then
    raise exception 'equip_item: character is on a mission';
  end if;
  if exists (
    select 1 from public.gather_assignments
     where player_character_id = p_char
  ) then
    raise exception 'equip_item: character is gathering';
  end if;
  if exists (
    select 1 from public.infirmary_admissions
     where player_character_id = p_char
  ) then
    raise exception 'equip_item: character is in the infirmary';
  end if;
  if exists (
    select 1 from public.group_runs
     where player_id = p_player and party && array[p_char]
  ) then
    raise exception 'equip_item: character is in a dungeon or raid';
  end if;

  -- 5. Lock the incoming inventory stack; fail if not present.
  select quantity into v_qty
    from public.player_inventory
   where player_id = p_player
     and item_def_id = p_item_def_id
     and rarity = p_rarity
   for update;
  if not found then
    raise exception 'equip_item: item not in inventory';
  end if;

  -- 6. Capture the item currently in the target slot (may be null / SQL NULL).
  v_prev := v_equipped -> p_slot_key;

  -- 7. Consume the incoming stack.
  if v_qty = 1 then
    delete from public.player_inventory
     where player_id = p_player
       and item_def_id = p_item_def_id
       and rarity = p_rarity;
  else
    update public.player_inventory
       set quantity = quantity - 1
     where player_id = p_player
       and item_def_id = p_item_def_id
       and rarity = p_rarity;
  end if;

  -- 8. Return displaced item to inventory (if there was one).
  --    Equipping the same item+rarity that is already in the slot is a harmless net-zero:
  --    step 7 decremented the stack, this upsert brings it back to the same count.
  if v_prev is not null then
    insert into public.player_inventory (player_id, item_def_id, rarity)
    values (p_player, v_prev->>'itemDefId', v_prev->>'rarity')
    on conflict (player_id, item_def_id, rarity)
    do update set quantity = player_inventory.quantity + 1;
  end if;

  -- 9. Write the new item into the slot, capturing the resulting equipped map.
  update public.player_characters
     set equipped = jsonb_set(
           coalesce(equipped, '{}'::jsonb),
           array[p_slot_key],
           jsonb_build_object('itemDefId', p_item_def_id, 'rarity', p_rarity)
         )
   where id = p_char and player_id = p_player
  returning equipped into v_new_equipped;

  -- 10. "Legendary Collector" counter (spec §4e) — an equip event, not a distinct-items set.
  if p_rarity = 'Legendary' then
    update public.profiles
       set achievement_counters = jsonb_set(
             coalesce(achievement_counters, '{}'::jsonb),
             array['legendaryItemsEquipped'],
             to_jsonb(coalesce((achievement_counters->>'legendaryItemsEquipped')::int, 0) + 1)
           )
     where player_id = p_player;
  end if;

  return jsonb_build_object(
    'equipped', v_new_equipped,
    'returned', coalesce(v_prev, 'null'::jsonb)
  );
end;
$$;

revoke all on function public.equip_item(uuid, uuid, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.equip_item(uuid, uuid, text, text, text, integer) to service_role;
```

- [ ] **Step 2: Apply the migration** — Supabase MCP `apply_migration`, `name: "20260914100400_equip_item_legendary_counter"`.

- [ ] **Step 3: Manually verify** — call `equip_item` (via `execute_sql`, using a scratch player/character/inventory row) with `p_rarity = 'Legendary'`, then `select achievement_counters from public.profiles where player_id = ...` and confirm `legendaryItemsEquipped` is `1`. Call again with `p_rarity = 'Common'` and confirm it stays `1` (unchanged).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260914100400_equip_item_legendary_counter.sql
git commit -m "feat: count Legendary equip events for the Legendary Collector achievement"
```

---

### Task 6: Capstone-earned counter in `choose_blessing`

**Files:**
- Create: `supabase/migrations/20260914100500_choose_blessing_capstone_counter.sql`

**Interfaces:**
- Produces: no signature change — `choose_blessing(p_player uuid, p_char uuid, p_row text, p_choice text)` unchanged (current signature from `20260908140000_group_runs.sql`).

Capstone becomes earned the moment `row4` is picked **at a character already at level ≥ 50** (row4 itself only requires level ≥ 40) — this is the other of the two trigger points (Task 2/3's level-up path is the first).

- [ ] **Step 1: Write the migration**

```sql
-- choose_blessing bumps achievement_counters.capstonesEarned when picking row4 immediately makes
-- the capstone earned (level already >= 50 at pick time — src/lib/blessings.ts's capstoneEarned:
-- level >= 50 && row4 picked). This is the SECOND of two trigger points for this counter — the
-- other is a later level-up while row4 is already picked, handled in claim_mission/
-- claim_group_stage (Tasks 2-3), since row4 can be picked as early as level 40. Every other line
-- preserved VERBATIM from 20260908140000_group_runs.sql's choose_blessing. Same signature.

create or replace function public.choose_blessing(
  p_player uuid,
  p_char   uuid,
  p_row    text,
  p_choice text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_blessings jsonb;
  v_level     integer;
  v_required  integer;
begin
  -- 1. Validate row + choice.
  if p_row not in ('row1', 'row2', 'row3', 'row4') then
    raise exception 'choose_blessing: invalid row';
  end if;
  if p_choice not in ('a', 'b') then
    raise exception 'choose_blessing: invalid choice';
  end if;

  -- 2. Required level per row — fixed engine constants (src/lib/blessings.ts
  --    BLESSING_ROW_LEVELS), not Sanity content, so hardcoded here like gear's slot-key enum.
  v_required := case p_row
    when 'row1' then 10
    when 'row2' then 20
    when 'row3' then 30
    when 'row4' then 40
  end;

  -- 3. Lock the character row and capture blessings + level; fail if not owned.
  select blessings, level into v_blessings, v_level
    from public.player_characters
   where id = p_char and player_id = p_player
   for update;
  if not found then
    raise exception 'choose_blessing: character not found or not owned';
  end if;
  v_blessings := coalesce(v_blessings, '{}'::jsonb);

  -- 3b. Level gate.
  if v_level < v_required then
    raise exception 'choose_blessing: character level too low (needs %, has %)', v_required, v_level;
  end if;

  -- 3c. Immutability guard — permanence is enforced here, not just a UI convention (ADR-0003).
  if v_blessings ? p_row then
    raise exception 'choose_blessing: row already chosen';
  end if;

  -- 3d. Strict sequence — row N requires row N-1 already picked.
  if p_row = 'row2' and not (v_blessings ? 'row1') then
    raise exception 'choose_blessing: row1 must be chosen first';
  end if;
  if p_row = 'row3' and not (v_blessings ? 'row2') then
    raise exception 'choose_blessing: row2 must be chosen first';
  end if;
  if p_row = 'row4' and not (v_blessings ? 'row3') then
    raise exception 'choose_blessing: row3 must be chosen first';
  end if;

  -- 4. Busy checks (mirrors equip_item — picking mid-mission could otherwise buff an in-flight claim).
  if exists (
    select 1 from public.mission_runs
     where player_id = p_player and party && array[p_char]
  ) then
    raise exception 'choose_blessing: character is on a mission';
  end if;
  if exists (
    select 1 from public.gather_assignments
     where player_character_id = p_char
  ) then
    raise exception 'choose_blessing: character is gathering';
  end if;
  if exists (
    select 1 from public.infirmary_admissions
     where player_character_id = p_char
  ) then
    raise exception 'choose_blessing: character is in the infirmary';
  end if;
  if exists (
    select 1 from public.group_runs
     where player_id = p_player and party && array[p_char]
  ) then
    raise exception 'choose_blessing: character is in a dungeon or raid';
  end if;

  -- 5. Write the pick.
  update public.player_characters
     set blessings = jsonb_set(v_blessings, array[p_row], to_jsonb(p_choice))
   where id = p_char and player_id = p_player
  returning blessings into v_blessings;

  -- 6. "Blessed" counter (spec §4e) — capstone becomes earned the instant row4 is picked at a
  --    character already >= level 50 (row4 itself only requires level >= 40).
  if p_row = 'row4' and v_level >= 50 then
    update public.profiles
       set achievement_counters = jsonb_set(
             coalesce(achievement_counters, '{}'::jsonb),
             array['capstonesEarned'],
             to_jsonb(coalesce((achievement_counters->>'capstonesEarned')::int, 0) + 1)
           )
     where player_id = p_player;
  end if;

  return jsonb_build_object('blessings', v_blessings);
end;
$$;

revoke all on function public.choose_blessing(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.choose_blessing(uuid, uuid, text, text) to service_role;
```

- [ ] **Step 2: Apply the migration** — Supabase MCP `apply_migration`, `name: "20260914100500_choose_blessing_capstone_counter"`.

- [ ] **Step 3: Manually verify** — via `execute_sql` on a scratch character at level 50 with rows 1-3 already picked, call `choose_blessing(..., 'row4', 'a')`, then confirm `achievement_counters->>'capstonesEarned'` is `1`. Separately confirm picking row4 at level 40-49 does NOT bump the counter (`achievement_counters` unchanged).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260914100500_choose_blessing_capstone_counter.sql
git commit -m "feat: count capstone-earned-on-pick for the Blessed achievement"
```

---

### Task 7: `record_login` RPC

**Files:**
- Create: `supabase/migrations/20260914100600_record_login.sql`

**Interfaces:**
- Consumes: `public.check_achievements(...)` (Task 1).
- Produces: `public.record_login(p_player uuid) returns jsonb` — `{ "daysPlayed": <int>, "newlyClaimed": <text[]> }`. The Edge Function in Task 10 calls this exact signature.

- [ ] **Step 1: Write the migration**

```sql
-- record_login: the one genuinely new write path in the achievements system (spec 2026-09-13
-- §4c) — nothing today tracks player sessions. Idempotent per UTC calendar day via
-- last_login_date, so the client (Task 12) can call this every session-start without needing its
-- own perfectly-reliable throttle; a second call the same day is a harmless no-op.

create or replace function public.record_login(
  p_player uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_last_login_date date;
  v_days_played integer;
  v_lifetime_stats jsonb;
  v_transcend_count integer;
  v_reset_count integer;
  v_shards_earned_total integer;
  v_achievement_counters jsonb;
  v_achievements jsonb;
  v_unlocked_characters jsonb;
  v_achievement_result jsonb;
begin
  select last_login_date, days_played, lifetime_stats, transcend_count, reset_count,
         ascendant_shards_earned_total, achievement_counters, achievements, unlocked_characters
    into v_last_login_date, v_days_played, v_lifetime_stats, v_transcend_count, v_reset_count,
         v_shards_earned_total, v_achievement_counters, v_achievements, v_unlocked_characters
    from public.profiles
   where player_id = p_player
   for update;

  if not found then
    raise exception 'record_login: player not found';
  end if;

  if v_last_login_date is not distinct from current_date then
    -- Already recorded today (UTC) — clean no-op, no re-check needed (days_played hasn't moved).
    return jsonb_build_object('daysPlayed', v_days_played, 'newlyClaimed', '[]'::jsonb);
  end if;

  v_days_played := v_days_played + 1;

  v_achievement_result := check_achievements(
    v_lifetime_stats,
    (select count(*) from jsonb_object_keys(v_unlocked_characters))::int,
    v_reset_count, v_transcend_count, v_shards_earned_total, v_days_played,
    v_achievement_counters, v_achievements
  );

  update public.profiles
     set last_login_date = current_date,
         days_played     = v_days_played,
         achievements    = achievements || (v_achievement_result -> 'newKeys')
   where player_id = p_player;

  return jsonb_build_object(
    'daysPlayed', v_days_played,
    'newlyClaimed', coalesce((select jsonb_agg(k) from jsonb_object_keys(v_achievement_result -> 'newKeys') as k), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.record_login(uuid) from public, anon, authenticated;
grant execute on function public.record_login(uuid) to service_role;
```

- [ ] **Step 2: Apply the migration** — Supabase MCP `apply_migration`, `name: "20260914100600_record_login"`.

- [ ] **Step 3: Manually verify** — via `execute_sql` on a scratch profile with `last_login_date` null and `days_played = 0`: first call returns `daysPlayed: 1` and `newlyClaimed` containing `"daysPlayed.0"`; a second call the same session returns `daysPlayed: 1` again with `newlyClaimed: []` (no-op).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260914100600_record_login.sql
git commit -m "feat: add record_login RPC for the Days Played achievement ladder"
```

---

### Task 8: `src/lib/achievements.ts` registry + Vitest tests

**Files:**
- Create: `src/lib/achievements.ts`
- Create: `src/lib/achievements.test.ts`

**Interfaces:**
- Consumes: `RESOURCE_SOURCE` from `@/lib/resources` (existing).
- Produces: `AchievementCategory`, `AchievementLadder`, `ACHIEVEMENT_DEFS: AchievementLadder[]`, `checkAchievements(input: CheckAchievementsInput, claimed: Record<string, boolean>): string[]` (returns newly-crossed keys — a client-preview mirror, same non-authoritative relationship `ascendantMilestones.ts`'s `checkAscendantMilestones` has to its SQL counterpart). Later tasks (11, 12) import `ACHIEVEMENT_DEFS` and `checkAchievements` from here.

`ACHIEVEMENT_DEFS` must reuse `ASCENDANT_MILESTONES`'s own threshold arrays for the Combat/Economy ladders (spec §4e — "reusing `ASCENDANT_MILESTONES`'s own thresholds... guaranteeing they can never drift"). Import them directly from `src/lib/ascendantMilestones.ts` rather than retyping the numbers.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/achievements.test.ts
import { describe, it, expect } from 'vitest'
import { ACHIEVEMENT_DEFS, checkAchievements } from './achievements'
import { RESOURCE_SOURCE } from './resources'

describe('ACHIEVEMENT_DEFS', () => {
  it('has one ladder per achievement across all 5 categories', () => {
    const keys = ACHIEVEMENT_DEFS.map((l) => l.metricKey)
    expect(keys).toContain('missionsCleared')
    expect(keys).toContain('dungeonsCleared')
    expect(keys).toContain('raidsCleared')
    expect(keys).toContain('goldEarned')
    expect(keys).toContain('resourceGathered.Wood')
    expect(keys).toContain('resourceGathered.Platinum')
    expect(keys).toContain('fullRoster')
    expect(keys).toContain('legendaryCollector')
    expect(keys).toContain('blessed')
    expect(keys).toContain('echoesOfThePast')
    expect(keys).toContain('ascendant')
    expect(keys).toContain('shardHoarder')
    expect(keys).toContain('daysPlayed')
    expect(keys).toContain('maxLevel')
    // 3 combat + 1 gold + 9 resources + 3 collection + 3 prestige + 2 dedication
    expect(keys).toHaveLength(3 + 1 + Object.keys(RESOURCE_SOURCE).length + 3 + 3 + 2)
  })

  it('every one-off "moment" achievement has a single threshold of 1 (except fullRoster: 19)', () => {
    const fullRoster = ACHIEVEMENT_DEFS.find((l) => l.metricKey === 'fullRoster')!
    expect(fullRoster.thresholds).toEqual([19])
    for (const key of ['legendaryCollector', 'blessed', 'echoesOfThePast', 'ascendant', 'maxLevel']) {
      const ladder = ACHIEVEMENT_DEFS.find((l) => l.metricKey === key)!
      expect(ladder.thresholds).toEqual([1])
    }
  })

  it('reuses resourceGathered thresholds identical to ASCENDANT_MILESTONES, not retyped numbers', () => {
    const ladder = ACHIEVEMENT_DEFS.find((l) => l.metricKey === 'resourceGathered.Wood')!
    expect(ladder.thresholds).toEqual([500, 5000, 50000, 500000])
  })
})

describe('checkAchievements', () => {
  it('claims nothing when every value is at its floor and nothing was previously claimed', () => {
    const result = checkAchievements({
      lifetimeStats: {}, unlockedCharacterCount: 0, resetCount: 0, transcendCount: 0,
      shardsEarnedTotal: 0, daysPlayed: 0,
    }, {})
    expect(result).toEqual([])
  })

  it('claims every lifetime_stats threshold newly crossed', () => {
    const result = checkAchievements({
      lifetimeStats: { goldEarned: 15000 }, unlockedCharacterCount: 0, resetCount: 0,
      transcendCount: 0, shardsEarnedTotal: 0, daysPlayed: 0,
    }, {})
    expect(result).toEqual(expect.arrayContaining(['goldEarned.0', 'goldEarned.1']))
  })

  it('never re-claims an already-claimed threshold', () => {
    const result = checkAchievements({
      lifetimeStats: { goldEarned: 15000 }, unlockedCharacterCount: 0, resetCount: 0,
      transcendCount: 0, shardsEarnedTotal: 0, daysPlayed: 0,
    }, { 'goldEarned.0': true, 'goldEarned.1': true })
    expect(result).toEqual([])
  })

  it('claims fullRoster at exactly 19 unlocked characters', () => {
    const result = checkAchievements({
      lifetimeStats: {}, unlockedCharacterCount: 19, resetCount: 0, transcendCount: 0,
      shardsEarnedTotal: 0, daysPlayed: 0,
    }, {})
    expect(result).toEqual(['fullRoster.0'])
  })

  it('claims echoesOfThePast/ascendant off resetCount/transcendCount, not lifetimeStats', () => {
    const result = checkAchievements({
      lifetimeStats: {}, unlockedCharacterCount: 0, resetCount: 1, transcendCount: 1,
      shardsEarnedTotal: 0, daysPlayed: 0,
    }, {})
    expect(result).toEqual(expect.arrayContaining(['echoesOfThePast.0', 'ascendant.0']))
  })

  it('claims shardHoarder and daysPlayed ladders off their own counters', () => {
    const result = checkAchievements({
      lifetimeStats: {}, unlockedCharacterCount: 0, resetCount: 0, transcendCount: 0,
      shardsEarnedTotal: 60, daysPlayed: 8,
    }, {})
    expect(result).toEqual(expect.arrayContaining(['shardHoarder.0', 'daysPlayed.0', 'daysPlayed.1']))
  })

  it('never evaluates counter-backed one-offs (legendaryCollector/blessed/maxLevel) — those are SQL-only', () => {
    // No counter fields exist on CheckAchievementsInput at all — this is a type-level guarantee
    // as much as a runtime one; the input shape below is exhaustive and compiles.
    const result = checkAchievements({
      lifetimeStats: {}, unlockedCharacterCount: 0, resetCount: 0, transcendCount: 0,
      shardsEarnedTotal: 0, daysPlayed: 0,
    }, {})
    expect(result).not.toContain('legendaryCollector.0')
    expect(result).not.toContain('blessed.0')
    expect(result).not.toContain('maxLevel.0')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/achievements.test.ts`
Expected: FAIL — `Cannot find module './achievements'` (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/achievements.ts
// The achievements registry (spec docs/superpowers/specs/2026-09-13-achievements-design.md) — a
// purely cosmetic badge system, architecturally mirroring src/lib/ascendantMilestones.ts's
// pattern (threshold ladders, permanent-claim tracking) but with no reward payout.
//
// checkAchievements here is a CLIENT-PREVIEW MIRROR ONLY (same relationship
// ascendantMilestones.ts's checkAscendantMilestones has to its SQL counterpart) — never call this
// to compute an actual claim. The authoritative check is public.check_achievements (SQL, same
// migration family as record_login/claim_mission/etc.), computed inside the RPC that already
// holds whatever lock its own logic requires. See the design spec §4b for why the split is
// load-bearing, not incidental.
//
// Three of the "moment" achievements — Legendary Collector, Blessed, Max Level — are backed by
// server-only counters (profiles.achievement_counters) never exposed to the client, so this
// module cannot preview whether they've newly been crossed; it only knows whether they're already
// in the `achievements` claimed-map (fetched via useProfile()). checkAchievements below simply
// never evaluates them — there is nothing in CheckAchievementsInput to evaluate them against.

import { ASCENDANT_MILESTONES } from './ascendantMilestones'
import { RESOURCE_SOURCE } from './resources'

export type AchievementCategory = 'combat' | 'economy' | 'collection' | 'prestige' | 'dedication'

export type AchievementLadder = {
  metricKey: string
  category: AchievementCategory
  label: string
  thresholds: number[]
}

function milestoneThresholds(metricKey: string): number[] {
  return ASCENDANT_MILESTONES.find((l) => l.metricKey === metricKey)!.thresholds
}

export const ACHIEVEMENT_DEFS: AchievementLadder[] = [
  // Combat — reuses ASCENDANT_MILESTONES's own thresholds so the two can never drift apart.
  { metricKey: 'missionsCleared', category: 'combat', label: 'Missions Cleared', thresholds: milestoneThresholds('missionsCleared') },
  { metricKey: 'dungeonsCleared', category: 'combat', label: 'Dungeons Cleared', thresholds: milestoneThresholds('dungeonsCleared') },
  { metricKey: 'raidsCleared', category: 'combat', label: 'Raids Cleared', thresholds: milestoneThresholds('raidsCleared') },

  // Economy — gold + one ladder per resource, all reusing ASCENDANT_MILESTONES's thresholds.
  { metricKey: 'goldEarned', category: 'economy', label: 'Gold Earned', thresholds: milestoneThresholds('goldEarned') },
  ...Object.keys(RESOURCE_SOURCE).map((resource) => ({
    metricKey: `resourceGathered.${resource}`,
    category: 'economy' as const,
    label: `${resource} Gathered`,
    thresholds: milestoneThresholds(`resourceGathered.${resource}`),
  })),

  // Collection
  { metricKey: 'fullRoster', category: 'collection', label: 'Full Roster', thresholds: [19] },
  { metricKey: 'legendaryCollector', category: 'collection', label: 'Legendary Collector', thresholds: [1] },
  { metricKey: 'blessed', category: 'collection', label: 'Blessed', thresholds: [1] },

  // Prestige
  { metricKey: 'echoesOfThePast', category: 'prestige', label: 'Echoes of the Past', thresholds: [1] },
  { metricKey: 'ascendant', category: 'prestige', label: 'Ascendant', thresholds: [1] },
  { metricKey: 'shardHoarder', category: 'prestige', label: 'Shard Hoarder', thresholds: [50, 500, 5000] },

  // Dedication
  { metricKey: 'daysPlayed', category: 'dedication', label: 'Days Played', thresholds: [1, 7, 30, 100] },
  { metricKey: 'maxLevel', category: 'dedication', label: 'Max Level', thresholds: [1] },
]

export type CheckAchievementsInput = {
  lifetimeStats: Record<string, number>
  unlockedCharacterCount: number
  resetCount: number
  transcendCount: number
  shardsEarnedTotal: number
  daysPlayed: number
}

const COUNTER_BACKED_KEYS = new Set(['legendaryCollector', 'blessed', 'maxLevel'])

export function checkAchievements(input: CheckAchievementsInput, claimed: Record<string, boolean>): string[] {
  const newlyClaimedKeys: string[] = []
  for (const ladder of ACHIEVEMENT_DEFS) {
    if (COUNTER_BACKED_KEYS.has(ladder.metricKey)) continue
    const value =
      ladder.metricKey === 'fullRoster' ? input.unlockedCharacterCount :
      ladder.metricKey === 'echoesOfThePast' ? input.resetCount :
      ladder.metricKey === 'ascendant' ? input.transcendCount :
      ladder.metricKey === 'shardHoarder' ? input.shardsEarnedTotal :
      ladder.metricKey === 'daysPlayed' ? input.daysPlayed :
      (input.lifetimeStats[ladder.metricKey] ?? 0)
    ladder.thresholds.forEach((threshold, i) => {
      const key = `${ladder.metricKey}.${i}`
      if (value >= threshold && !claimed[key]) {
        newlyClaimedKeys.push(key)
      }
    })
  }
  return newlyClaimedKeys
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/achievements.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/achievements.ts src/lib/achievements.test.ts
git commit -m "feat: add the achievements registry and client-preview checker"
```

---

### Task 9: `PlayerProfile` type + `record-login` client service + hooks

**Files:**
- Modify: `src/services/profile.ts`
- Create: `src/services/achievements.ts`
- Create: `src/features/achievements/hooks.ts`

**Interfaces:**
- Consumes: `PlayerProfile` (extended below), `invokeError` from `@/services/_invoke`.
- Produces: `PlayerProfile.achievements: Record<string, boolean>`, `.ascendantShardsEarnedTotal: number`, `.daysPlayed: number`; `recordLogin(): Promise<{ daysPlayed: number; newlyClaimed: string[] }>`; `useRecordLogin()` mutation hook (consumed by Task 12's `GameLayout` wiring).

- [ ] **Step 1: Extend `PlayerProfile`**

In `src/services/profile.ts`, add to the type and the select/return:

```typescript
export type PlayerProfile = {
  currencies: Record<string, number>
  resources: Record<string, number>
  /** How many times the player has done a soft Reset (ADR-0053). Display-only counter. */
  resetCount: number
  infirmaryLevel: number
  /** Highest stage cleared per map, keyed by mapKey (ADR-0034). Absent key = nothing cleared. */
  mapProgress: Record<string, number>
  /** charKey -> ISO timestamp first unlocked (spec §5c). Absent key = still locked — and per the
   *  full-blind-surprise rule, the client never asks which keys are missing. */
  unlockedCharacters: Record<string, string>
  /** Spendable Echo Shop currency (ADR-0053), earned by Resetting. */
  echoes: number
  /** nodeKey -> level purchased (ADR-0053, src/lib/echoShop.ts). Never wiped by a Reset. */
  echoShop: Record<string, number>
  /** Cumulative "ever earned" ledger (docs/superpowers/specs/2026-08-20-character-acquisition-
   *  design.md) — goldEarned, missionSecondsSent, resourceGathered.<key>. Never wiped by a Reset. */
  lifetimeStats: Record<string, number>
  /** Ascendant Shards currency (ADR-0023), earned via lifetime-stat milestones. Never wiped. */
  ascendantShards: number
  /** nodeKey -> level (ADR-0023, src/lib/ascendantShop.ts). Never wiped. */
  ascendantShop: Record<string, number>
  /** "<metricKey>.<i>" -> true for every permanently-claimed milestone. Never wiped. */
  ascendantMilestones: Record<string, boolean>
  /** How many times the player has Transcended. Never wiped. */
  transcendCount: number
  /** "<achievementKey>.<i>" -> true for every permanently-claimed achievement badge (spec
   *  2026-09-13). Cosmetic only — never wiped. */
  achievements: Record<string, boolean>
  /** Cumulative Ascendant Shards ever earned, distinct from ascendantShards (the spendable
   *  balance, which decreases on purchases). Feeds the "Shard Hoarder" achievement. Never wiped. */
  ascendantShardsEarnedTotal: number
  /** Count of distinct UTC calendar days record_login has run. Feeds "Days Played". Never wiped. */
  daysPlayed: number
}

export async function fetchProfile(): Promise<PlayerProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'currencies, resources, reset_count, infirmary_level, map_progress, unlocked_characters, echoes, echo_shop, lifetime_stats, ascendant_shards, ascendant_shop, ascendant_milestones, transcend_count, achievements, ascendant_shards_earned_total, days_played',
    )
    .maybeSingle()
  if (error) throw error
  return {
    currencies: (data?.currencies ?? {}) as Record<string, number>,
    resources: (data?.resources ?? {}) as Record<string, number>,
    resetCount: data?.reset_count ?? 0,
    infirmaryLevel: data?.infirmary_level ?? 1,
    mapProgress: (data?.map_progress ?? {}) as Record<string, number>,
    unlockedCharacters: (data?.unlocked_characters ?? {}) as Record<string, string>,
    echoes: data?.echoes ?? 0,
    echoShop: (data?.echo_shop ?? {}) as Record<string, number>,
    lifetimeStats: (data?.lifetime_stats ?? {}) as Record<string, number>,
    ascendantShards: data?.ascendant_shards ?? 0,
    ascendantShop: (data?.ascendant_shop ?? {}) as Record<string, number>,
    ascendantMilestones: (data?.ascendant_milestones ?? {}) as Record<string, boolean>,
    transcendCount: data?.transcend_count ?? 0,
    achievements: (data?.achievements ?? {}) as Record<string, boolean>,
    ascendantShardsEarnedTotal: data?.ascendant_shards_earned_total ?? 0,
    daysPlayed: data?.days_played ?? 0,
  }
}
```

- [ ] **Step 2: Write `src/services/achievements.ts`**

```typescript
import { supabase } from '@/lib/supabase'
import { invokeError } from './_invoke'

// Achievements data layer (spec 2026-09-13) — the one Edge Function call this feature needs.
// Everything else (the registry, the claimed-map, the counters) is read via useProfile().

export async function recordLogin(): Promise<{ daysPlayed: number; newlyClaimed: string[] }> {
  const { data, error } = await supabase.functions.invoke('record-login', { body: {} })
  if (error) await invokeError(error, 'Could not record login')
  return data as { daysPlayed: number; newlyClaimed: string[] }
}
```

- [ ] **Step 3: Write `src/features/achievements/hooks.ts`**

```typescript
// src/features/achievements/hooks.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recordLogin } from '@/services/achievements'

export function useRecordLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: recordLogin,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
```

- [ ] **Step 4: Verify the project still typechecks and lints**

Run: `npm run build && npm run lint`
Expected: both succeed with no errors (this task only adds fields/files consumed by later tasks; nothing yet calls `useRecordLogin` or reads the new `PlayerProfile` fields, so there's nothing to break).

- [ ] **Step 5: Commit**

```bash
git add src/services/profile.ts src/services/achievements.ts src/features/achievements/hooks.ts
git commit -m "feat: fetch achievements/ascendantShardsEarnedTotal/daysPlayed on PlayerProfile, add recordLogin service"
```

---

### Task 10: `record-login` Edge Function — deploy + verify

**Files:**
- Create: `supabase/functions/record-login/index.ts`

**Interfaces:**
- Consumes: `public.record_login(p_player uuid)` (Task 7).
- Produces: the `record-login` Edge Function, invoked by `src/services/achievements.ts`'s `recordLogin()` (Task 9) as `supabase.functions.invoke('record-login', { body: {} })`.

- [ ] **Step 1: Write the Edge Function**

```typescript
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'

// record-login: bumps days_played once per UTC calendar day and runs the achievements check
// (spec 2026-09-13 §4c) — the one genuinely new write path in the achievements system, since
// nothing else in this codebase tracks player sessions. Idempotent server-side via
// profiles.last_login_date, so the client can call this on every app mount without needing a
// perfectly reliable throttle of its own (Task 12 still throttles client-side too, to avoid an
// unnecessary network call on every mount).

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  const admin = createAdminClient()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
  const playerId = userData.user.id

  const { data, error } = await admin.rpc('record_login', { p_player: playerId })
  if (error) {
    console.error('record_login failed', error)
    return json({ error: 'Could not record login' }, 500)
  }

  return json(data, 200)
})
```

- [ ] **Step 2: Deploy**

Use the Supabase MCP `deploy_edge_function` tool with `name: "record-login"`, `entrypoint_path: "supabase/functions/record-login/index.ts"`, `verify_jwt: true`, and a `files` array containing that file's content plus the two shared files it imports (`supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/supabaseAdmin.ts` — read their current content from disk and include verbatim; both already exist and are used unmodified by every other Edge Function in this repo).

- [ ] **Step 3: Byte-verify the deploy**

Fetch the live bundle via the Supabase MCP `get_edge_function` tool (`function_slug: "record-login"`) and diff every returned file's content against the local disk copy, character-for-character. All three files (`index.ts`, `cors.ts`, `supabaseAdmin.ts`) must MATCH exactly — these are short, uncommented-in-transit files with no known reason to mismatch (unlike the disclosed comment-stripped files elsewhere in this codebase's deploy history).

- [ ] **Step 4: Manually verify end-to-end**

Call the deployed function with a real player's JWT (e.g. via `supabase.functions.invoke` from a browser console while signed into the running app, or via `curl` with a valid access token) and confirm a `{ daysPlayed, newlyClaimed }` response, then confirm via `execute_sql` that the player's `last_login_date` is today's UTC date.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/record-login/index.ts
git commit -m "feat: add record-login Edge Function"
```

---

### Task 11: `/achievements` page

**Files:**
- Create: `src/features/achievements/AchievementsPage.tsx`
- Create: `src/features/achievements/components/AchievementBadge.tsx`
- Create: `src/features/achievements/components/AchievementCategorySection.tsx`
- Create: `src/features/achievements/index.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/organisms/GameHeader.tsx`

**Interfaces:**
- Consumes: `ACHIEVEMENT_DEFS`, `AchievementLadder` (Task 8); `useProfile()` (existing, `@/hooks/useProfile`).
- Produces: `AchievementsPage` (default export via barrel), routed at `/achievements`.

- [ ] **Step 1: Write `AchievementBadge.tsx`**

```typescript
// src/features/achievements/components/AchievementBadge.tsx
import { IconSlot } from '@/components/atoms/IconSlot'
import type { AchievementLadder } from '@/lib/achievements'

// One badge: earned (icon + name + description, filled state), or locked — with a progress bar
// for a threshold ladder still in progress, or a plain locked state for a one-off "moment" badge
// (nothing partial to show for a boolean, spec §4f).
export function AchievementBadge({ ladder, value, earnedTiers }: {
  ladder: AchievementLadder
  /** Current raw value driving this ladder (e.g. lifetimeStats.missionsCleared) — null when this
   *  ladder's value isn't available client-side (the three counter-backed one-offs). */
  value: number | null
  /** How many of this ladder's thresholds are already claimed, read from profile.achievements. */
  earnedTiers: number
}) {
  const totalTiers = ladder.thresholds.length
  const isFullyEarned = earnedTiers >= totalTiers
  const nextThreshold = earnedTiers < totalTiers ? ladder.thresholds[earnedTiers] : null

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 12,
      border: `1px solid ${isFullyEarned ? 'var(--color-gold-dark)' : 'var(--color-border)'}`,
      borderRadius: 8,
      opacity: earnedTiers > 0 || isFullyEarned ? 1 : 0.55,
      minWidth: 120,
    }}>
      <IconSlot size={40} />
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', textAlign: 'center' }}>
        {ladder.label}
      </span>
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
        {isFullyEarned
          ? 'Maxed'
          : totalTiers > 1
            ? `Tier ${earnedTiers + 1} / ${totalTiers}`
            : earnedTiers > 0 ? 'Earned' : 'Locked'}
      </span>
      {!isFullyEarned && nextThreshold !== null && value !== null && (
        <div style={{ width: '100%', height: 4, background: 'var(--color-bg-deep)', borderRadius: 2 }}>
          <div style={{
            width: `${Math.min(100, (value / nextThreshold) * 100)}%`, height: '100%',
            background: 'var(--color-gold-dark)', borderRadius: 2,
          }} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write `AchievementCategorySection.tsx`**

```typescript
// src/features/achievements/components/AchievementCategorySection.tsx
import type { AchievementCategory, AchievementLadder } from '@/lib/achievements'
import { AchievementBadge } from './AchievementBadge'

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  combat: 'Combat',
  economy: 'Economy',
  collection: 'Collection',
  prestige: 'Prestige',
  dedication: 'Dedication',
}

export function AchievementCategorySection({ category, ladders, valueFor, earnedTiersFor }: {
  category: AchievementCategory
  ladders: AchievementLadder[]
  valueFor: (ladder: AchievementLadder) => number | null
  earnedTiersFor: (ladder: AchievementLadder) => number
}) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h3 style={{ color: 'var(--color-text-primary)', fontSize: 15, marginBottom: 8 }}>
        {CATEGORY_LABELS[category]}
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {ladders.map((ladder) => (
          <AchievementBadge
            key={ladder.metricKey}
            ladder={ladder}
            value={valueFor(ladder)}
            earnedTiers={earnedTiersFor(ladder)}
          />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Write `AchievementsPage.tsx`**

```typescript
// src/features/achievements/AchievementsPage.tsx
import { useProfile } from '@/hooks/useProfile'
import { ACHIEVEMENT_DEFS, type AchievementCategory, type AchievementLadder } from '@/lib/achievements'
import { AchievementCategorySection } from './components/AchievementCategorySection'

const CATEGORIES: AchievementCategory[] = ['combat', 'economy', 'collection', 'prestige', 'dedication']

// The three "moment" achievements backed by server-only counters (spec §4e) — value is never
// available client-side for these; the badge falls back to its earned/locked state alone with no
// progress bar (AchievementBadge already handles value === null this way).
const COUNTER_BACKED_KEYS = new Set(['legendaryCollector', 'blessed', 'maxLevel'])

export default function AchievementsPage() {
  const profile = useProfile()

  if (profile.isLoading || !profile.data) {
    return <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
  }

  const { lifetimeStats, unlockedCharacters, resetCount, transcendCount, ascendantShardsEarnedTotal, daysPlayed, achievements } = profile.data

  function valueFor(ladder: AchievementLadder): number | null {
    if (COUNTER_BACKED_KEYS.has(ladder.metricKey)) return null
    if (ladder.metricKey === 'fullRoster') return Object.keys(unlockedCharacters).length
    if (ladder.metricKey === 'echoesOfThePast') return resetCount
    if (ladder.metricKey === 'ascendant') return transcendCount
    if (ladder.metricKey === 'shardHoarder') return ascendantShardsEarnedTotal
    if (ladder.metricKey === 'daysPlayed') return daysPlayed
    return lifetimeStats[ladder.metricKey] ?? 0
  }

  function earnedTiersFor(ladder: AchievementLadder): number {
    let count = 0
    for (let i = 0; i < ladder.thresholds.length; i++) {
      if (achievements[`${ladder.metricKey}.${i}`]) count++
      else break
    }
    return count
  }

  return (
    <div>
      <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 16 }}>Achievements</h2>
      {CATEGORIES.map((category) => (
        <AchievementCategorySection
          key={category}
          category={category}
          ladders={ACHIEVEMENT_DEFS.filter((l) => l.category === category)}
          valueFor={valueFor}
          earnedTiersFor={earnedTiersFor}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Write the barrel**

```typescript
// src/features/achievements/index.ts
// Public API of the Achievements feature.
// Import from '@/features/achievements' — never reach into the feature's internals from outside.

export { default as AchievementsPage } from './AchievementsPage'
```

- [ ] **Step 5: Route it — modify `src/App.tsx`**

Add the lazy import after the `GameStatsPage` line (line 26):

```typescript
const AchievementsPage = lazy(() => import('@/features/achievements').then((m) => ({ default: m.AchievementsPage })))
```

Add the route after `/game-stats` (line 63):

```typescript
            <Route path="/achievements" element={<AchievementsPage />} />
```

- [ ] **Step 6: Add the nav entry — modify `src/components/organisms/GameHeader.tsx`**

In the `NAV` array (line 15-34), add after the `Statistics` entry:

```typescript
  { label: 'Achievements', to: '/achievements' },
```

- [ ] **Step 7: Verify build/lint**

Run: `npm run build && npm run lint`
Expected: both succeed with no errors.

- [ ] **Step 8: Manually verify in the browser**

Run the dev server (`npm run dev`), sign in, navigate to `/achievements` via the new nav link, and confirm the page renders five category sections with badges, no console errors, and (for a fresh/low-progress account) mostly-locked badges with visible progress bars on the threshold ladders.

- [ ] **Step 9: Commit**

```bash
git add src/features/achievements/ src/App.tsx src/components/organisms/GameHeader.tsx
git commit -m "feat: add the /achievements page"
```

---

### Task 12: Client login-recording wiring + final verification

**Files:**
- Modify: `src/components/templates/GameLayout.tsx`

**Interfaces:**
- Consumes: `useRecordLogin` (Task 9).

- [ ] **Step 1: Wire the once-per-session call**

```typescript
// src/components/templates/GameLayout.tsx
import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { GameHeader } from '../organisms/GameHeader'
import { useRecordLogin } from '@/features/achievements/hooks'

const LAST_RECORDED_KEY = 'achievements:lastRecordedLoginDate'

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

// Shared layout for all game pages: sticky header + routed content area. Mounts once per signed-
// in session (nested routes swap only the Outlet), so this is the natural place to record a
// login once per UTC day (spec 2026-09-13 §4c) — a client-side localStorage check on top of the
// server's own idempotent last_login_date, purely to avoid a network call on every mount.
export function GameLayout() {
  const recordLogin = useRecordLogin()

  useEffect(() => {
    const today = todayUtc()
    if (localStorage.getItem(LAST_RECORDED_KEY) === today) return
    recordLogin.mutate(undefined, {
      onSuccess: () => localStorage.setItem(LAST_RECORDED_KEY, today),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'var(--color-bg-deep)', fontFamily: 'Georgia, serif' }}>
      <GameHeader />
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Verify build/lint**

Run: `npm run build && npm run lint`
Expected: both succeed with no errors. If the `react-hooks/exhaustive-deps` disable comment isn't needed (check this repo's actual ESLint config for that rule first — it may not be configured, in which case omit the comment and the empty dependency array alone is fine), remove it rather than leaving an unnecessary suppression.

- [ ] **Step 3: Manually verify in the browser**

Sign in fresh (clear `localStorage`'s `achievements:lastRecordedLoginDate` key first, or use a private window), confirm the network tab shows one `record-login` call, and that `profiles.days_played`/`last_login_date` update accordingly (via `execute_sql`). Reload the page and confirm no second call fires (localStorage throttle holds).

- [ ] **Step 4: Run the full verification suite**

Run: `npm run build && npm run lint && npx vitest run`
Expected: build succeeds, lint is clean, and the full Vitest suite passes (463 baseline + the new `achievements.test.ts` cases from Task 8).

- [ ] **Step 5: Commit**

```bash
git add src/components/templates/GameLayout.tsx
git commit -m "feat: record a login once per UTC day from GameLayout"
```

---

## Self-Review Notes

**Spec coverage:** §4a (columns) → Task 1. §4b (`check_achievements`, no-lock rationale) → Task 1 + Global Constraints. §4c (`record_login`) → Tasks 7, 10, 12. §4d (registry shape, client-preview-only) → Task 8. §4e (the full achievement list) → Tasks 1 (SQL side) and 8 (TS side), with per-item wiring in Tasks 2-6. §4f (UI) → Task 11. §4g (extensibility) → Global Constraints + Task 1's header comment. §5 (testing) → Global Constraints + Task 8 (the only automated tests this plan adds).

**Placeholder scan:** every SQL/TS code block above is complete, runnable content — no `TBD`, no "add error handling here", no elided function bodies (every `create or replace function` is reproduced in full, since Postgres requires the whole body on any redefinition regardless).

**Type consistency:** `check_achievements`'s 8-parameter order (`p_lifetime_stats, p_unlocked_character_count, p_reset_count, p_transcend_count, p_shards_earned_total, p_days_played, p_achievement_counters, p_claimed`) is identical across Tasks 1-4 and 7. `AchievementLadder { metricKey, category, label, thresholds }` (Task 8) is used identically in Task 11's components. `PlayerProfile`'s three new fields (`achievements`, `ascendantShardsEarnedTotal`, `daysPlayed`) are named and typed identically in Task 9's edit and Task 11's `AchievementsPage` usage.
