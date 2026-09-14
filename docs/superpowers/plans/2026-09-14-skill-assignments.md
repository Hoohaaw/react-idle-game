# Indefinite Skill Assignments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a player send a character to train a skill indefinitely (first instance: Religion at Church) — XP accrues continuously while assigned, the player collects or stops (cashes out) whenever they choose, banking the accrued XP into a per-character, per-skill level independent of the character's own level.

**Architecture:** A new `skill_assignments` table (mirrors `gather_assignments`) + a `player_characters.skills` jsonb map hold state. Two new SECURITY DEFINER RPCs (`start_skill`, `collect_skill`) own the write boundary, called from two new Edge Functions that reuse the existing `accrue()` (gather) and `applyXp()` (leveling) pure functions — no new accrual or leveling math. A new `src/features/skills/` page renders a registry (`SKILL_DEFS`) generically so a second skill is a data-only addition.

**Tech Stack:** React 19 + TypeScript (strict) + Vite, Zustand/TanStack Query, Supabase Postgres + Edge Functions (Deno), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-14-skill-assignments-design.md`

## Global Constraints

- **Server-authoritative writes (ADR-0003):** the client never writes `player_characters.skills` or `skill_assignments` directly — only through the two new Edge Functions, which call the two new RPCs. Both RPCs are `security definer` with a pinned `search_path`, revoked from `public`/`anon`/`authenticated`, granted to `service_role` only.
- **Compute-on-read stats (ADR-0002):** `skills` jsonb stores banked intent (`{level, xp}`), never a derived stat value.
- **Registry-driven extensibility (ADR-0004):** adding skill #2 must be exactly one entry in `SKILL_DEFS` (`src/lib/skills.ts`) plus a UI destination that already renders generically off the registry — never a code change to `start_skill`/`collect_skill`/the Edge Functions/`SkillsPage`.
- **Deno-safety:** `src/lib/skills.ts` has no browser/node-only APIs — it is imported by both the Vite client bundle and the Deno Edge Functions (same constraint as `src/lib/gather.ts`/`src/lib/combat.ts`, ADR-0016/ADR-0019).
- **Busy-slot mutual exclusion is now a FIVE-table set:** `mission_runs`, `gather_assignments`, `infirmary_admissions`, `group_runs`, `skill_assignments`. Every RPC that starts a new exclusive activity (`start_mission`, `start_gather`, `start_group_stage`, `admit_infirmary`, and the new `start_skill`) busy-checks the character against all four OTHER tables in that set. **Not extended in this plan:** `equip_item`/`unequip_item`/`choose_blessing`/`respec_blessings` — those check the set for a different reason (preventing mid-combat gear/blessing exploits during a dungeon/raid stage, ADR from `20260908140000_group_runs.sql`'s own header comment); skill training has no stat effect (see spec §3), so there is no analogous exploit and no reason to block gear/blessing changes for a character who is off training. This is a deliberate scope boundary, not an oversight — do not "complete the sweep" into those four functions.
- **No emoji as UI icons** — this plan doesn't add any icon slots, so this is a non-issue, but don't introduce any if a step tempts you.
- **Zero pgTAP/Deno test infrastructure exists in this repo.** Every SQL migration and Edge Function change in this plan is verified by applying it to the hosted Supabase project and calling it manually (via MCP tools), then byte-diffing any deployed bundle against local disk — never by writing new SQL/Deno automated tests. **The Supabase MCP tools (`apply_migration`, `execute_sql`, `deploy_edge_function`, `get_edge_function`) are only available to the controller session, not to a dispatched implementer subagent.** Every task below that touches `supabase/migrations/` or `supabase/functions/` says explicitly: the implementer writes and commits the file only; the controller applies/deploys/verifies it live after the task report comes back. A task is not "done" until that live verification happens — an implementer subagent claiming success from a written-but-unapplied migration is not sufficient.
- **Starting balance numbers** (`intervalSec: 30`, `xpPerTick: 15` for Religion) are a deliberate starting point, not a tuned value — do not treat them as needing a `docs/BALANCE.md` playbook pass before shipping; that pass applies to *changing* them later; it does not block shipping a first value now (see spec §4b).

---

### Task 1: Schema — `player_characters.skills` + `skill_assignments` table

**Files:**
- Create: `supabase/migrations/20260914110000_skill_assignments.sql`

**Interfaces:**
- Produces: `player_characters.skills jsonb not null default '{}'` (shape: `{ "<skillKey>": { "level": number, "xp": number } }`); table `public.skill_assignments(id, player_id, player_character_id, skill_key, last_collected_at)` with `unique (player_character_id)`.

**This task is SQL-only. Write and commit the migration file. Do NOT call any Supabase MCP tool (`apply_migration`, `execute_sql`, etc.) — you do not have access to them. The controller applies and verifies this migration live after your report.**

- [ ] **Step 1: Write the migration**

```sql
-- Indefinite skill assignments (docs/superpowers/specs/2026-09-14-skill-assignments-design.md).
-- Adds per-character skill level/XP storage + the skill_assignments activity table. Mirrors
-- gather_assignments (20260612180001_activities.sql) — same shape, same RLS/grant pattern — but
-- with NO per-skill-node scarcity: any number of characters can train the same skill at once,
-- since skill XP is per-character, not a shared pool (unlike a mine's one-gatherer-per-node rule).

alter table public.player_characters
  add column skills jsonb not null default '{}';

comment on column public.player_characters.skills is
  'Per-character skill level/XP map, e.g. {"religion": {"level": 1, "xp": 0}}. Independent of the
   character''s own level/xp (leveling.ts) — a level-50 character can still train skills. Written
   only by collect_skill (ADR-0003); a missing key means untrained, treated client/server-side as
   {level: 1, xp: 0}.';

create table public.skill_assignments (
  id                  uuid primary key default gen_random_uuid(),
  player_id           uuid not null references auth.users (id) on delete cascade,
  player_character_id uuid not null references public.player_characters (id) on delete cascade,
  skill_key           text not null,
  last_collected_at   timestamptz not null default now(),

  unique (player_character_id) -- a character trains at most one skill at a time
);

comment on table public.skill_assignments is
  'A character continuously training a skill (docs/superpowers/specs/2026-09-14-skill-assignments-design.md).
   Accrual computed server-side from elapsed ticks (src/lib/skills.ts), same shape as
   gather_assignments. No per-skill_key uniqueness — many characters may train the same skill at once.';

alter table public.skill_assignments enable row level security;

create policy "skill_assignments_select_own"
  on public.skill_assignments for select to authenticated
  using (player_id = (select auth.uid()));

grant select on public.skill_assignments to authenticated;
grant select, insert, update, delete on public.skill_assignments to service_role;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260914110000_skill_assignments.sql
git commit -m "feat: add skill_assignments table + player_characters.skills column"
```

**Controller verification (after the report, not part of the implementer's task):** apply via `mcp__supabase__apply_migration`; confirm via `mcp__supabase__list_tables` that `skill_assignments` exists with the expected columns and that `player_characters` now has a `skills` column defaulting to `{}`.

---

### Task 2: `start_skill` + `collect_skill` RPCs

**Files:**
- Create: `supabase/migrations/20260914110100_skill_rpcs.sql`

**Interfaces:**
- Consumes: `public.skill_assignments` (Task 1).
- Produces: `start_skill(p_player uuid, p_char uuid, p_skill_key text) returns public.skill_assignments`; `collect_skill(p_player uuid, p_assignment_id uuid, p_skill_key text, p_new_level int, p_new_xp int, p_new_last_collected_at timestamptz, p_stop boolean) returns jsonb` returning `{level, xp, skillKey, stopped}`.

**This task is SQL-only. Write and commit the migration file. Do NOT call any Supabase MCP tool — the controller applies and verifies it live after your report.**

- [ ] **Step 1: Write the migration**

```sql
-- start_skill / collect_skill: the write boundary for indefinite skill assignments (see
-- 20260914110000_skill_assignments.sql). Mirrors start_gather/collect_gather
-- (supabase/migrations/20260707120000_gather_rpcs.sql) — same SECURITY DEFINER / pinned
-- search_path / service_role-only lockdown, same TS-computes-SQL-persists division of labor: the
-- skill-collect Edge Function calls src/lib/gather.ts's accrue() and src/lib/leveling.ts's
-- applyXp() and passes the result in here — this migration never recomputes either curve.

create or replace function public.start_skill(
  p_player    uuid,
  p_char      uuid,
  p_skill_key text
) returns public.skill_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alive int;
  v_assignment public.skill_assignments;
begin
  if p_char is null then
    raise exception 'start_skill: character required';
  end if;
  if p_skill_key is null or length(p_skill_key) = 0 then
    raise exception 'start_skill: skill required';
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
    raise exception 'start_skill: character is not owned or is downed';
  end if;

  -- Busy elsewhere? Five-table mutual-exclusion set (see this plan's Global Constraints).
  if exists (select 1 from public.skill_assignments where player_character_id = p_char) then
    raise exception 'start_skill: character is already training a skill';
  end if;
  if exists (select 1 from public.mission_runs where player_id = p_player and party && array[p_char]) then
    raise exception 'start_skill: character is on a mission';
  end if;
  if exists (select 1 from public.gather_assignments where player_character_id = p_char) then
    raise exception 'start_skill: character is gathering';
  end if;
  if exists (select 1 from public.infirmary_admissions where player_character_id = p_char) then
    raise exception 'start_skill: character is in the infirmary';
  end if;
  if exists (select 1 from public.group_runs where player_id = p_player and party && array[p_char]) then
    raise exception 'start_skill: character is in a dungeon or raid';
  end if;

  insert into public.skill_assignments (player_id, player_character_id, skill_key)
  values (p_player, p_char, p_skill_key)
  returning * into v_assignment;

  return v_assignment;
end;
$$;

revoke all on function public.start_skill(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.start_skill(uuid, uuid, text) to service_role;

create or replace function public.collect_skill(
  p_player                 uuid,
  p_assignment_id          uuid,
  p_skill_key              text,
  p_new_level              int,
  p_new_xp                 int,
  p_new_last_collected_at  timestamptz,
  p_stop                   boolean
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_char uuid;
begin
  -- Guard: the assignment exists + is owned. Also gives us which character to credit.
  select player_character_id into v_char
    from public.skill_assignments
   where id = p_assignment_id and player_id = p_player;
  if not found then
    raise exception 'collect_skill: assignment not found or not owned';
  end if;

  update public.player_characters
     set skills = jsonb_set(
           coalesce(skills, '{}'::jsonb),
           array[p_skill_key],
           jsonb_build_object('level', p_new_level, 'xp', p_new_xp)
         )
   where id = v_char and player_id = p_player;

  if p_stop then
    -- Stop = collect the remainder, then free the character.
    delete from public.skill_assignments where id = p_assignment_id and player_id = p_player;
  else
    update public.skill_assignments
       set last_collected_at = p_new_last_collected_at
     where id = p_assignment_id and player_id = p_player;
  end if;

  return jsonb_build_object('level', p_new_level, 'xp', p_new_xp, 'skillKey', p_skill_key, 'stopped', p_stop);
end;
$$;

revoke all on function public.collect_skill(uuid, uuid, text, int, int, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.collect_skill(uuid, uuid, text, int, int, timestamptz, boolean) to service_role;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260914110100_skill_rpcs.sql
git commit -m "feat: add start_skill/collect_skill RPCs"
```

**Controller verification:** apply via `mcp__supabase__apply_migration`. Manually verify with `mcp__supabase__execute_sql` against a real test player row: (a) `start_skill` on an idle character succeeds and returns a row; (b) `start_skill` on the same character again fails with `character is already training a skill`; (c) `collect_skill` with `p_stop = true` deletes the assignment and writes the expected `skills` jsonb; (d) `collect_skill` with `p_stop = false` advances `last_collected_at` and leaves the assignment in place.

---

### Task 3: Busy-check sweep — `start_mission`, `start_gather`, `start_group_stage`, `admit_infirmary`

**Files:**
- Create: `supabase/migrations/20260914110200_skill_busy_checks.sql`

**Interfaces:**
- Consumes: `public.skill_assignments` (Task 1).
- Produces: no new functions — redefines four existing ones, each with exactly one added busy-check clause.

**This task is SQL-only. Write and commit the migration file. Do NOT call any Supabase MCP tool — the controller applies and verifies it live after your report.**

Each function below is redefined with its CURRENT full body (as of `supabase/migrations/20260908140000_group_runs.sql`, the most recent file that defines each of these four) plus exactly one new `if exists (...)` clause checking `skill_assignments`. Do not alter anything else in these bodies — copy them verbatim except for the one marked addition in each.

- [ ] **Step 1: Write the migration**

```sql
-- Skill training joins the busy-slot mutual-exclusion set as its fifth member (see
-- 20260914110000_skill_assignments.sql and this plan's Global Constraints). Each of the four
-- existing "start a new exclusive activity" RPCs below is redefined with its current full body
-- (from 20260908140000_group_runs.sql) plus one new `skill_assignments` busy-check, in the same
-- style group_runs.sql itself used when IT joined this set. equip_item/unequip_item/
-- choose_blessing/respec_blessings are deliberately NOT touched here — see this plan's Global
-- Constraints for why.

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
  -- New: also busy if training a skill (2026-09-14, skill assignments).
  if exists (select 1 from public.skill_assignments where player_character_id = any(p_party)) then
    raise exception 'start_mission: a character is training a skill';
  end if;

  if p_map_key is not null and p_stage is not null then
    select map_progress into v_map_prog from public.profiles where player_id = p_player;
    v_cleared := coalesce((v_map_prog->>p_map_key)::int, 0);
    if p_stage > v_cleared + 1 then
      raise exception 'start_mission: stage locked (cleared %, requested %)', v_cleared, p_stage;
    end if;
    if p_prev_map_key is not null then
      v_prev_cleared := coalesce((v_map_prog->>p_prev_map_key)::int, 0);
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
  -- New: also busy if training a skill (2026-09-14, skill assignments).
  if exists (select 1 from public.skill_assignments where player_character_id = p_char) then
    raise exception 'start_gather: character is training a skill';
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

create or replace function public.start_group_stage(
  p_player           uuid,
  p_kind             text,
  p_def_key          text,
  p_party            uuid[],
  p_stage_index      int,
  p_total_stages     int,
  p_duration_seconds int,
  p_lockout          text,   -- 'daily' | 'weekly'
  p_map_gate         text    default null
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
  v_map_prog    jsonb;
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
  -- New: also busy if training a skill (2026-09-14, skill assignments).
  if exists (select 1 from public.skill_assignments where player_character_id = any(p_party)) then
    raise exception 'start_group_stage: a character is training a skill';
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

  if p_map_gate is not null then
    select map_progress into v_map_prog from public.profiles where player_id = p_player;
    if coalesce((v_map_prog->>p_map_gate)::int, 0) < 7 then
      raise exception 'start_group_stage: map not cleared';
    end if;
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
    v_next_reset := date_trunc('day', v_run.last_cleared_at at time zone 'UTC') at time zone 'UTC' + interval '1 day';
    if p_lockout = 'weekly' then
      v_next_reset := v_next_reset + (((7 - extract(dow from v_next_reset at time zone 'UTC')::int) % 7) * interval '1 day');
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

revoke all on function public.start_group_stage(uuid, text, text, uuid[], int, int, int, text, text) from public, anon, authenticated;
grant execute on function public.start_group_stage(uuid, text, text, uuid[], int, int, int, text, text) to service_role;

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
  -- New: also busy if training a skill (2026-09-14, skill assignments).
  if exists (select 1 from public.skill_assignments where player_character_id = p_char) then
    raise exception 'admit_infirmary: character is training a skill';
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260914110200_skill_busy_checks.sql
git commit -m "fix: block mission/gather/dungeon/infirmary start while a character is training a skill"
```

**Controller verification:** apply via `mcp__supabase__apply_migration`. Manually verify with `mcp__supabase__execute_sql`: create a `skill_assignments` row for a test character, then confirm `start_mission`, `start_gather`, `start_group_stage`, and `admit_infirmary` each raise the new `... character is training a skill` / `... is training a skill` exception for that character, and each still succeeds for a different, idle character.

---

### Task 4: `src/lib/skills.ts` — the skill registry

**Files:**
- Create: `src/lib/skills.ts`
- Test: `src/lib/skills.test.ts`

**Interfaces:**
- Produces: `SkillDef { skillKey, label, destination, intervalSec, xpPerTick }`; `SKILL_DEFS: SkillDef[]`; `SKILL_BY_KEY: Record<string, SkillDef>`. No new accrual or leveling function — this task's tests confirm `src/lib/gather.ts`'s `accrue()` and `src/lib/leveling.ts`'s `applyXp()`/`xpToNext()`/`LEVEL_CAP` work correctly when called with this registry's values.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/skills.test.ts
import { describe, it, expect } from 'vitest'
import { SKILL_DEFS, SKILL_BY_KEY } from './skills'
import { accrue } from './gather'
import { applyXp, LEVEL_CAP } from './leveling'

describe('SKILL_DEFS', () => {
  it('every skill has a positive interval and xp rate', () => {
    for (const s of SKILL_DEFS) {
      expect(s.intervalSec).toBeGreaterThan(0)
      expect(s.xpPerTick).toBeGreaterThan(0)
    }
  })

  it('skill keys are unique', () => {
    const keys = SKILL_DEFS.map((s) => s.skillKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('SKILL_BY_KEY maps every skill key to its def', () => {
    for (const s of SKILL_DEFS) {
      expect(SKILL_BY_KEY[s.skillKey]).toBe(s)
    }
  })

  it('includes religion, trained at Church', () => {
    expect(SKILL_BY_KEY.religion).toEqual({
      skillKey: 'religion', label: 'Religion', destination: 'Church', intervalSec: 30, xpPerTick: 15,
    })
  })
})

describe('accrue() + applyXp() reused for skill training', () => {
  const religion = SKILL_BY_KEY.religion

  it('banks nothing before the first tick completes', () => {
    expect(accrue(29_000, religion.intervalSec, religion.xpPerTick)).toEqual({ gained: 0, consumedSec: 0 })
  })

  it('banks whole ticks and the gained xp rolls into applyXp from a fresh level 1/0 character', () => {
    // 60s = 2 ticks of 15 xp = 30 gained. leveling.ts: xpToNext(1) = round(50 * 1^1.5) = 50.
    const { gained, consumedSec } = accrue(60_000, religion.intervalSec, religion.xpPerTick)
    expect(gained).toBe(30)
    expect(consumedSec).toBe(60)
    expect(applyXp(1, 0, gained)).toEqual({ level: 1, xp: 30 })
  })

  it('rolls a level up once accumulated xp crosses xpToNext(1) = 50', () => {
    // 4 ticks = 60 gained xp: crosses the 50 xp needed for level 1 -> 2, 10 xp left over.
    const { gained } = accrue(120_000, religion.intervalSec, religion.xpPerTick)
    expect(gained).toBe(60)
    expect(applyXp(1, 0, gained)).toEqual({ level: 2, xp: 10 })
  })

  it('never exceeds LEVEL_CAP, discarding xp earned at the cap same as character leveling', () => {
    expect(applyXp(LEVEL_CAP, 0, 999_999)).toEqual({ level: LEVEL_CAP, xp: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/skills.test.ts`
Expected: FAIL — `Cannot find module './skills'`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/skills.ts
// The skill registry + reused accrual/leveling math for indefinite skill assignments (docs/
// superpowers/specs/2026-09-14-skill-assignments-design.md). Like gather.ts and combat.ts, this
// module MUST stay Deno-safe: pure data + pure functions, no browser/node deps — imported by both
// the client (Skills page) and the skill Edge Functions (server-authoritative accrual).
//
// No new accrual function: skill-collect calls gather.ts's existing accrue() directly with
// speedPct/yieldPct = 0 (no character-stat modifiers in this pass — see spec §3, deferred). No new
// leveling curve: skill levels reuse leveling.ts's applyXp/xpToNext/LEVEL_CAP verbatim — the
// identical capped-at-50 curve character levels use, so a skill and a character level up
// identically and there is only one curve to ever tune.

export type SkillDef = {
  skillKey: string
  label: string
  destination: string
  intervalSec: number
  xpPerTick: number
}

export const SKILL_DEFS: SkillDef[] = [
  { skillKey: 'religion', label: 'Religion', destination: 'Church', intervalSec: 30, xpPerTick: 15 },
]

export const SKILL_BY_KEY: Record<string, SkillDef> = Object.fromEntries(
  SKILL_DEFS.map((s) => [s.skillKey, s]),
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/skills.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/skills.ts src/lib/skills.test.ts
git commit -m "feat: add the skill registry (src/lib/skills.ts)"
```

---

### Task 5: `src/types/database.types.ts` — hand-add the new types

**Files:**
- Modify: `src/types/database.types.ts`

**Interfaces:**
- Consumes: the exact shapes from Tasks 1-2.
- Produces: `Tables<'skill_assignments'>`, updated `Tables<'player_characters'>` (adds `skills`), `Database['public']['Functions']['start_skill']`, `Database['public']['Functions']['collect_skill']`.

**Do this by hand — do NOT run the `generate_typescript_types` MCP tool for this task.** This repo's own CLAUDE.md documents that tool silently dropping the hand-maintained `Insert: never`/`Update: never` guards on `craft_runs`/`group_runs` when it regenerates the whole file (it has happened at least twice). This change is small and fully known ahead of time, so making the exact additions by hand avoids that risk entirely rather than triggering a regeneration and then having to diff/restore. A future change that genuinely needs a full regeneration still has to do that diff-and-restore dance — this task just isn't that.

- [ ] **Step 1: Add the `skill_assignments` table.** In the `Tables` object, tables are alphabetically ordered (`craft_runs`, `gather_assignments`, `group_runs`, `infirmary_admissions`, `mission_runs`, `player_characters`, `player_inventory`, `profiles`). Add this new entry immediately after the `profiles` block closes (alphabetically last):

```ts
      skill_assignments: {
        Row: {
          id: string
          last_collected_at: string
          player_character_id: string
          player_id: string
          skill_key: string
        }
        Insert: {
          id?: string
          last_collected_at?: string
          player_character_id: string
          player_id: string
          skill_key: string
        }
        Update: {
          id?: string
          last_collected_at?: string
          player_character_id?: string
          player_id?: string
          skill_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_assignments_player_character_id_fkey"
            columns: ["player_character_id"]
            isOneToOne: true
            referencedRelation: "player_characters"
            referencedColumns: ["id"]
          },
        ]
      }
```

- [ ] **Step 2: Add `skills` to `player_characters`.** Its `Row`/`Insert`/`Update` blocks currently list fields alphabetically ending `..., player_id, xp`. Insert `skills` between `player_id` and `xp` in all three blocks — for example `Row` becomes:

```ts
        Row: {
          acquired_at: string
          blessings: Json
          character_def_id: string
          current_hp: number | null
          equipped: Json
          id: string
          level: number
          player_id: string
          skills: Json
          xp: number
        }
```

Do the same insertion (`skills?: Json` between `player_id` and `xp`) in the `Insert` and `Update` blocks of `player_characters`. Do not touch its `Relationships` array.

- [ ] **Step 3: Add the two new Functions entries.** The `Functions` object is alphabetically ordered too. Insert `collect_skill` immediately after the existing `collect_gather` entry (before `discharge_infirmary`):

```ts
      collect_skill: {
        Args: {
          p_assignment_id: string
          p_new_last_collected_at: string
          p_new_level: number
          p_new_xp: number
          p_player: string
          p_skill_key: string
          p_stop: boolean
        }
        Returns: Json
      }
```

Insert `start_skill` immediately after the existing `start_mission` entry (before `transcend_player`):

```ts
      start_skill: {
        Args: { p_char: string; p_player: string; p_skill_key: string }
        Returns: {
          id: string
          last_collected_at: string
          player_character_id: string
          player_id: string
          skill_key: string
        }
        SetofOptions: {
          from: "*"
          to: "skill_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
```

- [ ] **Step 4: Verify the project still typechecks**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/types/database.types.ts
git commit -m "chore: add skill_assignments + player_characters.skills types"
```

---

### Task 6: Edge Functions — `skill-start` + `skill-collect`

**Files:**
- Create: `supabase/functions/skill-start/index.ts`
- Create: `supabase/functions/skill-collect/index.ts`

**Interfaces:**
- Consumes: `SKILL_BY_KEY` (Task 4), `accrue` (`src/lib/gather.ts`), `applyXp` (`src/lib/leveling.ts`), `start_skill`/`collect_skill` RPCs (Task 2).
- Produces (HTTP): `skill-start` body `{ characterId, skillKey }` → `{ assignment }` (201) or `{ error }` (400/401/404/409); `skill-collect` body `{ assignmentId, stop? }` → `{ gainedXp, skillKey, newLevel, newXp, stopped }` (200) or `{ error }`.

**This task is Deno-only. Write and commit both files. Do NOT call `mcp__supabase__deploy_edge_function` or `mcp__supabase__get_edge_function` — you do not have access to them. The controller deploys and byte-verifies both after your report.**

- [ ] **Step 1: Write `skill-start`**

```ts
// supabase/functions/skill-start/index.ts
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { SKILL_BY_KEY } from '../../../src/lib/skills.ts'

// skill-start: assign a character to train a skill (ADR-0003 server-authoritative write). Validates
// the caller + that the skill is known (config is code — src/lib/skills.ts), then hands off to the
// atomic `start_skill` RPC which owns character validation (owned / not-downed / not-busy) + the
// insert under a row lock.

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

  let body: { characterId?: unknown; skillKey?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const characterId = body.characterId
  const skillKey = body.skillKey
  if (typeof characterId !== 'string' || characterId.length === 0) {
    return json({ error: 'characterId is required' }, 400)
  }
  if (typeof skillKey !== 'string' || !SKILL_BY_KEY[skillKey]) {
    return json({ error: 'Unknown skill' }, 404)
  }

  const { data: assignment, error: rpcErr } = await admin.rpc('start_skill', {
    p_player: playerId,
    p_char: characterId,
    p_skill_key: skillKey,
  })

  if (rpcErr) {
    // The RPC raises 'start_skill: <reason>' for every validation failure.
    const reason = rpcErr.message.replace(/^.*start_skill:\s*/, '')
    return json({ error: reason || 'Could not start training' }, 409)
  }

  return json({ assignment }, 201)
})
```

- [ ] **Step 2: Write `skill-collect`**

```ts
// supabase/functions/skill-collect/index.ts
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { SKILL_BY_KEY } from '../../../src/lib/skills.ts'
import { accrue } from '../../../src/lib/gather.ts'
import { applyXp } from '../../../src/lib/leveling.ts'

// skill-collect: bank a trainee's accrued skill XP, optionally stopping (unassigning). Computes the
// gained XP from elapsed ticks (accrue(), src/lib/gather.ts — reused as-is, same math) then rolls it
// into the character's current skill level/xp (applyXp(), src/lib/leveling.ts — the identical
// capped-at-50 curve character levels use), then applies both via the atomic `collect_skill` RPC.
// No stat modifiers (no speed/yield equivalent — spec §3, deferred) and no lifetime-stats/
// acquisition tie-in (unlike gather-collect): skill training has no mechanical effect yet.

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

  let body: { assignmentId?: unknown; stop?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const assignmentId = body.assignmentId
  const stop = body.stop === true
  if (typeof assignmentId !== 'string' || assignmentId.length === 0) {
    return json({ error: 'assignmentId is required' }, 400)
  }

  const { data: assignment, error: loadErr } = await admin
    .from('skill_assignments')
    .select('id, skill_key, last_collected_at, player_character_id')
    .eq('id', assignmentId)
    .eq('player_id', playerId)
    .maybeSingle()
  if (loadErr) {
    console.error('assignment lookup failed', loadErr)
    return json({ error: 'Could not load assignment' }, 500)
  }
  if (!assignment) return json({ error: 'Assignment not found' }, 404)

  const skill = SKILL_BY_KEY[assignment.skill_key]
  if (!skill) return json({ error: 'Unknown skill' }, 500)

  const { data: charRow } = await admin
    .from('player_characters')
    .select('skills')
    .eq('id', assignment.player_character_id)
    .eq('player_id', playerId)
    .maybeSingle()
  const skills = (charRow?.skills ?? {}) as Record<string, { level: number; xp: number }>
  const current = skills[assignment.skill_key] ?? { level: 1, xp: 0 }

  const lastMs = new Date(assignment.last_collected_at).getTime()
  const { gained, consumedSec } = accrue(Date.now() - lastMs, skill.intervalSec, skill.xpPerTick)
  const { level: newLevel, xp: newXp } = applyXp(current.level, current.xp, gained)
  const newLastCollectedAt = new Date(lastMs + consumedSec * 1000).toISOString()

  const { error: rpcErr } = await admin.rpc('collect_skill', {
    p_player: playerId,
    p_assignment_id: assignment.id,
    p_skill_key: assignment.skill_key,
    p_new_level: newLevel,
    p_new_xp: newXp,
    p_new_last_collected_at: newLastCollectedAt,
    p_stop: stop,
  })
  if (rpcErr) {
    console.error('collect_skill failed', rpcErr)
    const reason = rpcErr.message.replace(/^.*collect_skill:\s*/, '')
    return json({ error: reason || 'Could not collect' }, 409)
  }

  return json({ gainedXp: gained, skillKey: assignment.skill_key, newLevel, newXp, stopped: stop }, 200)
})
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/skill-start/index.ts supabase/functions/skill-collect/index.ts
git commit -m "feat: add skill-start/skill-collect Edge Functions"
```

**Controller verification:** deploy both via `mcp__supabase__deploy_edge_function`, then `mcp__supabase__get_edge_function` each and byte-diff against local disk. Manually exercise both against a real signed-in test session if one is available; otherwise verify via the underlying RPC calls (Task 2's verification already covers the RPC layer) plus a code read confirming the request/response shapes match this task's Interfaces line.

---

### Task 7: `src/services/playerCharacters.ts` extension + new `src/services/skills.ts`

**Files:**
- Modify: `src/services/playerCharacters.ts`
- Create: `src/services/skills.ts`

**Interfaces:**
- Consumes: `Tables<'skill_assignments'>` (Task 5).
- Produces: `SkillProgress = { level: number; xp: number }`; `OwnedCharacter.skills: Record<string, SkillProgress>`; `fetchSkillCharacterIds(): Promise<string[]>`; `SkillAssignment = Tables<'skill_assignments'>`; `fetchSkillAssignments(): Promise<SkillAssignment[]>`; `startSkillTraining(characterId: string, skillKey: string): Promise<SkillAssignment>`; `CollectSkillResult = { gainedXp: number; skillKey: string; newLevel: number; newXp: number; stopped: boolean }`; `collectSkillTraining(assignmentId: string, stop?: boolean): Promise<CollectSkillResult>`.

No new tests in this task: `fetchOwnedCharacters`/`fetchGatherCharacterIds` (the existing functions this task extends/mirrors) have no test coverage today either — `src/services/playerCharacters.test.ts` only covers `fetchRecruitedDefIds`. This task follows that existing convention rather than introducing new coverage the sibling functions don't have.

- [ ] **Step 1: Extend `src/services/playerCharacters.ts`**

Replace the `OwnedCharacter` type and `fetchOwnedCharacters` function (currently the block starting `export type EquippedItem = ...` through the end of `fetchOwnedCharacters`) with:

```ts
export type EquippedItem = { itemDefId: string; rarity: string }
export type SkillProgress = { level: number; xp: number }
export type OwnedCharacter = {
  id: string
  characterDefId: string
  level: number
  xp: number
  blessings: BlessingPicks
  equipped: Record<string, EquippedItem>
  currentHp: number | null
  skills: Record<string, SkillProgress>
}

export async function fetchOwnedCharacters(): Promise<OwnedCharacter[]> {
  const { data, error } = await supabase
    .from('player_characters')
    .select('id, character_def_id, level, xp, blessings, equipped, current_hp, skills')
  if (error) throw error
  return data.map((row) => ({
    id: row.id,
    characterDefId: row.character_def_id,
    level: row.level,
    xp: row.xp,
    blessings: (row.blessings ?? {}) as BlessingPicks,
    equipped: (row.equipped ?? {}) as Record<string, EquippedItem>,
    currentHp: row.current_hp,
    skills: (row.skills ?? {}) as Record<string, SkillProgress>,
  }))
}
```

Then, after the existing `fetchGatherCharacterIds` function, add:

```ts
// Character ids currently training a skill (busy, can't be dispatched) — same "busy roster" role
// as fetchGatherCharacterIds.
export async function fetchSkillCharacterIds(): Promise<string[]> {
  const { data, error } = await supabase.from('skill_assignments').select('player_character_id')
  if (error) throw error
  return data.map((row) => row.player_character_id)
}
```

- [ ] **Step 2: Create `src/services/skills.ts`**

```ts
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'
import { invokeError } from './_invoke'

// The Skill-training data layer:
//  - Skill CONFIG (interval/xp per skill) is code — src/lib/skills.ts (shared with the Edge Functions).
//  - RUNTIME state (active skill_assignments) is read from Supabase (RLS owner-scoped, SELECT-only).
//  - WRITES (start / collect / stop) go through the server-authoritative Edge Functions (ADR-0003).

export type SkillAssignment = Tables<'skill_assignments'>

export async function fetchSkillAssignments(): Promise<SkillAssignment[]> {
  const { data, error } = await supabase
    .from('skill_assignments')
    .select('*')
    .order('last_collected_at', { ascending: true })
  if (error) throw error
  return data
}

export async function startSkillTraining(characterId: string, skillKey: string): Promise<SkillAssignment> {
  const { data, error } = await supabase.functions.invoke('skill-start', {
    body: { characterId, skillKey },
  })
  if (error) await invokeError(error, 'Could not start training')
  return data.assignment as SkillAssignment
}

export type CollectSkillResult = {
  gainedXp: number
  skillKey: string
  newLevel: number
  newXp: number
  stopped: boolean
}

export async function collectSkillTraining(assignmentId: string, stop = false): Promise<CollectSkillResult> {
  const { data, error } = await supabase.functions.invoke('skill-collect', {
    body: { assignmentId, stop },
  })
  if (error) await invokeError(error, 'Could not collect')
  return data as CollectSkillResult
}
```

- [ ] **Step 3: Verify the project builds and existing tests still pass**

Run: `npx tsc --noEmit && npm test`
Expected: no errors, all existing tests pass (this task adds no new test file).

- [ ] **Step 4: Commit**

```bash
git add src/services/playerCharacters.ts src/services/skills.ts
git commit -m "feat: add skills service layer + OwnedCharacter.skills"
```

---

### Task 8: Busy-slot consistency sweep — `useRoster`, `PartyRoster`, and every consumer of `RosterMember.busy`

**Files:**
- Modify: `src/hooks/useRoster.ts`
- Modify: `src/components/organisms/PartyRoster.tsx`
- Modify: `src/features/gather/GatherPage.tsx`
- Modify: `src/features/missions/MissionsPage.tsx`
- Modify: `src/features/infirmary/components/WardCard.tsx`

**Interfaces:**
- Consumes: `fetchSkillCharacterIds`, `SkillProgress` (Task 7).
- Produces: `RosterMember.busy` gains `'skillTraining'`; `RosterMember.skills: Record<string, SkillProgress>`; `RosterCharacter.activity` (PartyRoster) gains `'skill'`.

`RosterMember.busy` is a union type consumed by five files across the codebase (`useRoster.ts` itself, `PartyRoster.tsx`, `GatherPage.tsx`, `MissionsPage.tsx`, `WardCard.tsx`) — every one of them currently enumerates the union's members explicitly (a ternary chain or an `||` chain), so adding a member without updating all five leaves some of them treating a skill-training character as idle/available in their OWN UI, even though the RPCs (Task 3) will correctly reject the resulting request server-side. This task is exactly the set of edits needed to keep that union consistent everywhere it's matched exhaustively. (`src/features/groupContent/components/GroupPartyPicker.tsx` uses `Boolean(c.busy)` — already exhaustive by construction, needs no change.)

- [ ] **Step 1: `src/hooks/useRoster.ts`** — add the import, the query hook, extend the type, wire it into the roster computation.

Change the import on line 4 from:
```ts
import { fetchOwnedCharacters, fetchGatherCharacterIds, type EquippedItem } from '@/services/playerCharacters'
```
to:
```ts
import { fetchOwnedCharacters, fetchGatherCharacterIds, fetchSkillCharacterIds, type EquippedItem, type SkillProgress } from '@/services/playerCharacters'
```

Add a new query hook after `useGatherCharacterIds` (currently lines 41-43):
```ts
function useSkillCharacterIds() {
  return useQuery({ queryKey: ['skillCharacterIds'], queryFn: fetchSkillCharacterIds })
}
```

In the `RosterMember` type, add a `skills` field and extend `busy`'s union — change:
```ts
  equipped: Record<string, EquippedItem>
  blessings: BlessingPicks
```
to:
```ts
  equipped: Record<string, EquippedItem>
  blessings: BlessingPicks
  /** Per-skill level/XP (docs/superpowers/specs/2026-09-14-skill-assignments-design.md) — a
   *  missing key means untrained ({level: 1, xp: 0}), same default the server uses. */
  skills: Record<string, SkillProgress>
```
and change:
```ts
  busy: 'mission' | 'gathering' | 'infirmary' | 'group' | null
```
to:
```ts
  busy: 'mission' | 'gathering' | 'infirmary' | 'group' | 'skillTraining' | null
```

In `useRoster()`, add the query call alongside the others (after `const groupBusy = useGroupBusyCharacterIds()`):
```ts
  const skillBusy = useSkillCharacterIds()
```

Inside the `useMemo`, add a `training` set alongside the other busy sets (after `const inGroupContent = new Set(groupBusy.data ?? [])`):
```ts
    const training = new Set(skillBusy.data ?? [])
```

In the returned object literal inside `flatMap`, add `skills: c.skills,` alongside the other passthrough fields (next to `blessings: c.blessings,`), and extend the `busy` ternary from:
```ts
        busy: gathering.has(c.id)
          ? 'gathering'
          : onMission.has(c.id)
            ? 'mission'
            : admitted.has(c.id)
              ? 'infirmary'
              : inGroupContent.has(c.id)
                ? 'group'
                : null,
```
to:
```ts
        busy: gathering.has(c.id)
          ? 'gathering'
          : onMission.has(c.id)
            ? 'mission'
            : admitted.has(c.id)
              ? 'infirmary'
              : inGroupContent.has(c.id)
                ? 'group'
                : training.has(c.id)
                  ? 'skillTraining'
                  : null,
```

Finally, add `skillBusy.data` to the `useMemo`'s dependency array (alongside `groupBusy.data`):
```ts
  }, [owned.data, defs.data, items.data, runs.data, gather.data, admissions.data, groupBusy.data, skillBusy.data, profile.data])
```

- [ ] **Step 2: `src/components/organisms/PartyRoster.tsx`** — add `'skill'` to the `activity` union and a status label branch.

Change:
```ts
  activity: 'idle' | 'mission' | 'gather' | 'infirmary' | 'downed' | 'group'
```
to:
```ts
  activity: 'idle' | 'mission' | 'gather' | 'infirmary' | 'downed' | 'group' | 'skill'
```

Change the `status` ternary from:
```ts
  const status = free
    ? 'Available'
    : char.activity === 'mission'
      ? 'On Mission'
      : char.activity === 'gather'
        ? 'Gathering'
        : char.activity === 'downed'
          ? 'Downed'
          : char.activity === 'group'
            ? 'In dungeon/raid'
            : 'In Infirmary'
```
to:
```ts
  const status = free
    ? 'Available'
    : char.activity === 'mission'
      ? 'On Mission'
      : char.activity === 'gather'
        ? 'Gathering'
        : char.activity === 'downed'
          ? 'Downed'
          : char.activity === 'group'
            ? 'In dungeon/raid'
            : char.activity === 'skill'
              ? 'Training'
              : 'In Infirmary'
```

- [ ] **Step 3: `src/features/gather/GatherPage.tsx`** — map the new busy value so a skill-training character shows correctly (and stays unselectable) in the mine-assignment picker.

Change:
```ts
    const activity = downed ? 'downed'
      : m.busy === 'gathering' ? 'gather'
      : m.busy === 'mission' ? 'mission'
      : m.busy === 'infirmary' ? 'infirmary'
      : m.busy === 'group' ? 'group'
      : 'idle'
```
to:
```ts
    const activity = downed ? 'downed'
      : m.busy === 'gathering' ? 'gather'
      : m.busy === 'mission' ? 'mission'
      : m.busy === 'infirmary' ? 'infirmary'
      : m.busy === 'group' ? 'group'
      : m.busy === 'skillTraining' ? 'skill'
      : 'idle'
```

- [ ] **Step 4: `src/features/missions/MissionsPage.tsx`** — same fix for the mission dispatch picker.

Change line 152 from:
```ts
    busy: m.busy === 'mission' ? 'On mission' : m.busy === 'gathering' ? 'Gathering' : m.busy === 'infirmary' ? 'In Infirmary' : m.busy === 'group' ? 'In dungeon/raid' : undefined,
```
to:
```ts
    busy: m.busy === 'mission' ? 'On mission' : m.busy === 'gathering' ? 'Gathering' : m.busy === 'infirmary' ? 'In Infirmary' : m.busy === 'group' ? 'In dungeon/raid' : m.busy === 'skillTraining' ? 'Training' : undefined,
```

- [ ] **Step 5: `src/features/infirmary/components/WardCard.tsx`** — a skill-training character must not be admittable, and must show the right label.

Change line 24 from:
```ts
  const busyElsewhere = member.busy === 'mission' || member.busy === 'gathering' || member.busy === 'group'
```
to:
```ts
  const busyElsewhere = member.busy === 'mission' || member.busy === 'gathering' || member.busy === 'group' || member.busy === 'skillTraining'
```

Change line 48 from:
```ts
        ? member.busy === 'mission' ? 'On Mission' : member.busy === 'gathering' ? 'Gathering' : 'In dungeon/raid'
```
to:
```ts
        ? member.busy === 'mission' ? 'On Mission' : member.busy === 'gathering' ? 'Gathering' : member.busy === 'skillTraining' ? 'Training' : 'In dungeon/raid'
```

- [ ] **Step 6: Verify the project builds and existing tests still pass**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: no errors, no lint failures, all existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useRoster.ts src/components/organisms/PartyRoster.tsx src/features/gather/GatherPage.tsx src/features/missions/MissionsPage.tsx src/features/infirmary/components/WardCard.tsx
git commit -m "feat: recognize skill-training as a busy state across the roster"
```

---

### Task 9: `src/features/skills/hooks.ts`

**Files:**
- Create: `src/features/skills/hooks.ts`

**Interfaces:**
- Consumes: `fetchSkillAssignments`, `startSkillTraining`, `collectSkillTraining` (Task 7).
- Produces: `useSkillAssignments()`, `useStartSkill()`, `useCollectSkill()`.

- [ ] **Step 1: Write the hooks**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchSkillAssignments, startSkillTraining, collectSkillTraining } from '@/services/skills'

// Skills feature hooks. The shared roster (who's free to assign, and each character's skill
// levels) comes from @/hooks/useRoster.

export function useSkillAssignments() {
  return useQuery({ queryKey: ['skillAssignments'], queryFn: fetchSkillAssignments })
}

// Assign/collect/stop change who's busy and their skill level, so invalidate the roster's
// skill-busy query and the owned-characters query (skills live on player_characters, not the
// wallet — unlike gather, there's no ['profile'] invalidation needed here).
function invalidateSkills(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['skillAssignments'] })
  void qc.invalidateQueries({ queryKey: ['skillCharacterIds'] })
  void qc.invalidateQueries({ queryKey: ['ownedCharacters'] })
}

export function useStartSkill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ characterId, skillKey }: { characterId: string; skillKey: string }) =>
      startSkillTraining(characterId, skillKey),
    onSuccess: () => invalidateSkills(qc),
  })
}

export function useCollectSkill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ assignmentId, stop }: { assignmentId: string; stop?: boolean }) =>
      collectSkillTraining(assignmentId, stop),
    onSuccess: () => invalidateSkills(qc),
  })
}
```

- [ ] **Step 2: Verify the project builds**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/skills/hooks.ts
git commit -m "feat: add skills feature hooks"
```

---

### Task 10: `SkillTrainingCard` molecule

**Files:**
- Create: `src/components/molecules/SkillTrainingCard.tsx`

**Interfaces:**
- Consumes: `useNow` (`src/hooks/useNow.ts`), `formatRemaining` (`src/lib/time.ts`), `xpToNext` (`src/lib/leveling.ts`), `ProgressBar`/`Avatar`/`PrimaryButton`/`DangerButton` (atoms).
- Produces: `SkillTrainingCard({ trainee, level, xp, intervalSec, xpPerTick, lastCollectedAt, onCollect?, onStop? })` — a presentational card for one character's active skill assignment.

- [ ] **Step 1: Write the component**

```tsx
import { useState } from 'react'
import { Avatar } from '../atoms/Avatar'
import { ProgressBar } from '../atoms/ProgressBar'
import { PrimaryButton, DangerButton } from '../atoms/Button'
import { useNow } from '../../hooks/useNow'
import { formatRemaining } from '../../lib/time'
import { xpToNext } from '../../lib/leveling'

// One character's active skill-training assignment (docs/superpowers/specs/
// 2026-09-14-skill-assignments-design.md) — same visual language + live-recompute mechanism as
// ActiveGatherCard, but banks XP toward a level/xp bar (leveling.ts's curve) instead of a wallet
// resource. `level`/`xp` are the server-committed values as of the last collect; the "+N xp" badge
// is the live-accruing amount not yet banked (same accrual math as gather, just not yet applied).
export function SkillTrainingCard({
  trainee, level, xp, intervalSec, xpPerTick, lastCollectedAt, onCollect, onStop,
}: {
  trainee: string
  level: number
  xp: number
  intervalSec: number
  xpPerTick: number
  lastCollectedAt: string
  onCollect?: () => void
  onStop?: () => void
}) {
  const [assignedAt] = useState(() => new Date(lastCollectedAt).getTime())
  const now = useNow()

  const intervalMs = intervalSec * 1000
  const elapsed = Math.max(0, now - assignedAt)
  const pending = Math.floor(elapsed / intervalMs) * xpPerTick
  const into = elapsed % intervalMs
  const tickPct = (into / intervalMs) * 100
  const remainingMs = intervalMs - into

  const needed = xpToNext(level)
  const levelPct = needed === Infinity ? 100 : (xp / needed) * 100

  return (
    <div style={{
      width: 230, borderRadius: 8,
      border: '2px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', '0 6px 18px rgba(0,0,0,0.75)'].join(', '),
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', borderBottom: '1px solid var(--color-gold-dark)' }}>
        <Avatar size={26} />
        <span style={{ flex: 1, minWidth: 0, color: 'var(--color-gold-light)', fontSize: 13, fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{trainee}</span>
        <span style={{
          whiteSpace: 'nowrap', padding: '1px 7px', borderRadius: 4,
          border: '1px solid rgba(74,140,63,0.6)',
          background: 'linear-gradient(180deg, rgba(74,140,63,0.18) 0%, rgba(74,140,63,0.06) 100%)',
          color: 'var(--color-success)', fontSize: 12, fontWeight: 'bold',
        }}>+{pending} xp</span>
      </div>

      <div style={{ padding: '9px 11px' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 11, marginBottom: 6 }}>
          Level {level}{needed === Infinity ? ' (MAX)' : ''}
        </p>
        <div style={{ marginBottom: 8 }}>
          <ProgressBar value={levelPct} label="" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ flex: 1, color: 'var(--color-text-muted)', fontSize: 11 }}>Next tick</span>
          <span style={{
            fontFamily: '"Consolas", ui-monospace, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 12,
            color: 'var(--color-text-gold)',
          }}>{formatRemaining(remainingMs)}</span>
        </div>
        <ProgressBar value={tickPct} label="" color="#8c2020" />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          {onCollect && <PrimaryButton onClick={onCollect}>Collect</PrimaryButton>}
          {onStop && <DangerButton onClick={onStop}>Stop & Cash Out</DangerButton>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the project builds**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/molecules/SkillTrainingCard.tsx
git commit -m "feat: add SkillTrainingCard molecule"
```

---

### Task 11: `src/features/skills/` page + routing + nav

**Files:**
- Create: `src/features/skills/SkillsPage.tsx`
- Create: `src/features/skills/index.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/organisms/GameHeader.tsx`

**Interfaces:**
- Consumes: `SKILL_DEFS` (Task 4), `useRoster` (Task 8), `useSkillAssignments`/`useStartSkill`/`useCollectSkill` (Task 9), `SkillTrainingCard` (Task 10), `PartyRoster`/`Modal`/`PrimaryButton`/`SecondaryButton` (existing shared components).
- Produces: routed page at `/skills`, exported as `SkillsPage` from the feature's barrel.

**Plan decision (resolves spec §7's open question):** this page renders `SKILL_DEFS` generically — one section per registry entry — rather than a bespoke component per skill. This is required by the extensibility goal (spec §5): adding skill #2 must not require a UI code change. **Plan decision (resolves an inconsistency between spec §4a and §4e):** spec §4a correctly says there is no per-skill scarcity (many characters can train the same skill at once), so each skill's section lists ALL currently-assigned trainees (zero or more), each with their own `SkillTrainingCard`, plus one "Assign a Character" action — not a single-slot card like a mine.

- [ ] **Step 1: Write `SkillsPage.tsx`**

```tsx
import { useState } from 'react'
import { Modal } from '@/components/organisms/Modal'
import { PartyRoster, type RosterCharacter } from '@/components/organisms/PartyRoster'
import { PrimaryButton, SecondaryButton } from '@/components/atoms/Button'
import { SkillTrainingCard } from '@/components/molecules/SkillTrainingCard'
import { SKILL_DEFS } from '@/lib/skills'
import { useRoster } from '@/hooks/useRoster'
import { useSkillAssignments, useStartSkill, useCollectSkill } from './hooks'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      color: 'var(--color-gold-mid)', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase',
      marginBottom: '14px', paddingBottom: '6px', borderBottom: '1px solid var(--color-gold-dark)',
    }}>{children}</h2>
  )
}

const NOTE: React.CSSProperties = { color: 'var(--color-text-muted)', fontSize: '12px', fontStyle: 'italic' }

export default function SkillsPage() {
  const assignmentsQ = useSkillAssignments()
  const { roster } = useRoster()
  const startS = useStartSkill()
  const collectS = useCollectSkill()

  const [assigningSkill, setAssigningSkill] = useState<string | null>(null)
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null)

  const assignments = assignmentsQ.data ?? []

  const closeAssign = () => { setAssigningSkill(null); setSelectedCharId(null); startS.reset() }

  const confirmAssign = () => {
    if (!selectedCharId || !assigningSkill) return
    startS.mutate(
      { characterId: selectedCharId, skillKey: assigningSkill },
      { onSuccess: closeAssign },
    )
  }

  // Every character + what they're doing (busy ones show in the picker but aren't selectable).
  const rosterChars: RosterCharacter[] = roster.map((m) => ({
    id: m.id,
    name: m.name,
    charClass: m.charClass,
    level: m.level,
    role: m.role,
    damageSchool: m.damageSchool,
    activity: m.currentHp === 0
      ? 'downed'
      : m.busy === 'skillTraining' ? 'skill'
      : m.busy === 'gathering' ? 'gather'
      : m.busy === 'mission' ? 'mission'
      : m.busy === 'infirmary' ? 'infirmary'
      : m.busy === 'group' ? 'group'
      : 'idle',
  }))

  return (
    <div>
      {SKILL_DEFS.map((skill) => {
        const trainees = assignments.filter((a) => a.skill_key === skill.skillKey)
        return (
          <section key={skill.skillKey} style={{ marginBottom: '36px' }}>
            <SectionTitle>{skill.destination} — {skill.label}</SectionTitle>

            {trainees.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginBottom: '14px' }}>
                {trainees.map((a) => {
                  const char = roster.find((m) => m.id === a.player_character_id)
                  const progress = char?.skills[skill.skillKey] ?? { level: 1, xp: 0 }
                  return (
                    <SkillTrainingCard
                      key={a.id}
                      trainee={char?.name ?? 'Trainee'}
                      level={progress.level}
                      xp={progress.xp}
                      intervalSec={skill.intervalSec}
                      xpPerTick={skill.xpPerTick}
                      lastCollectedAt={a.last_collected_at}
                      onCollect={() => collectS.mutate({ assignmentId: a.id })}
                      onStop={() => collectS.mutate({ assignmentId: a.id, stop: true })}
                    />
                  )
                })}
              </div>
            ) : (
              <p style={NOTE}>No one is currently training here.</p>
            )}

            <PrimaryButton onClick={() => setAssigningSkill(skill.skillKey)}>Assign a Character</PrimaryButton>
          </section>
        )
      })}

      <Modal open={assigningSkill !== null} onClose={closeAssign}>
        <div style={{
          width: 360, maxWidth: '90vw', borderRadius: 8, overflow: 'hidden',
          border: '3px solid var(--color-gold-mid)',
          background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '2px solid var(--color-gold-dark)' }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>Assign Trainee</p>
            <p style={{ color: 'var(--color-gold-light)', fontSize: 16, fontWeight: 'bold' }}>
              {SKILL_DEFS.find((s) => s.skillKey === assigningSkill)?.destination}
            </p>
          </div>

          <div style={{ padding: 16, maxHeight: '52vh', overflowY: 'auto' }}>
            <PartyRoster characters={rosterChars} selectedId={selectedCharId} onSelect={setSelectedCharId} />
          </div>

          {startS.error && (
            <p style={{ color: '#e0635c', fontSize: 12, padding: '0 16px 4px' }}>{(startS.error as Error).message}</p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--color-gold-dark)' }}>
            <SecondaryButton onClick={closeAssign}>Cancel</SecondaryButton>
            <PrimaryButton disabled={!selectedCharId || startS.isPending} onClick={confirmAssign}>Send to Train</PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 2: Write the barrel**

```ts
// src/features/skills/index.ts
// Public API of the Skills feature.
// Import from '@/features/skills' — never reach into the feature's internals.
export { default as SkillsPage } from './SkillsPage'
```

- [ ] **Step 3: Route it in `src/App.tsx`**

Add a lazy import near the other feature imports (alongside the `GatherPage` import):
```ts
const SkillsPage = lazy(() => import('@/features/skills').then((m) => ({ default: m.SkillsPage })))
```

Add the route near the `/mines` route:
```tsx
            <Route path="/skills" element={<SkillsPage />} />
```

- [ ] **Step 4: Add the nav entry in `src/components/organisms/GameHeader.tsx`**

Add to the `NAV` array, near the `Mines` entry:
```ts
  { label: 'Skills', to: '/skills' },
```

- [ ] **Step 5: Verify the project builds, lints, and tests pass**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: no errors, no lint failures, all tests pass, build succeeds. Check the build output for an `INEFFECTIVE_DYNAMIC_IMPORT` warning on the skills chunk — if one appears, something outside `src/features/skills/` is statically importing from the feature's barrel or internals (see `docs/DECISIONS.md` ADR-0055 / this session's known Vite code-splitting hazard) and needs to be traced down and fixed the same way `useRecordLogin` was relocated to `src/hooks/` during the achievements feature.

- [ ] **Step 6: Manually verify in the dev server**

Run: `npm run dev`, sign in, navigate to `/skills`. Confirm: the Religion/Church section renders with an "Assign a Character" button; assigning an idle character opens the modal with them selectable and busy characters shown-but-disabled; after assigning, a `SkillTrainingCard` appears showing Level 1, a 0% level bar, and a live-ticking "+N xp"/next-tick countdown; Collect updates the level/xp bar without removing the card; Stop & Cash Out removes the card and frees the character (verify via the Missions or Gather page that the character is selectable again).

- [ ] **Step 7: Commit**

```bash
git add src/features/skills/SkillsPage.tsx src/features/skills/index.ts src/App.tsx src/components/organisms/GameHeader.tsx
git commit -m "feat: add the Skills page, routed at /skills"
```
