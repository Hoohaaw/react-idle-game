# Activity Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the player a `/history` page showing a lightweight event feed ("+342 gold, +50 XP — Mission Cleared, 14:32"), backed by a new `activity_log` table fed automatically by every RPC that already writes lifetime stats.

**Architecture:** A new Postgres table (`activity_log`, capped at 200 rows/player via trigger) is written by a new shared SQL function (`apply_lifetime_stats`) that consolidates a currently-duplicated update loop across 7 existing RPCs. Each RPC is refactored to call the shared function instead of looping inline — Edge Functions are unchanged. A new `src/features/activity/` page reads the table directly (RLS owner-scoped SELECT, no Edge Function needed) and renders it using a small formatting registry that reuses `/statistics`'s existing stat labels.

**Tech Stack:** Postgres/plpgsql (Supabase), pgTAP (`supabase/tests/database/`), React + TanStack Query, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-24-activity-log-design.md`

## Global Constraints

- No client write access to `activity_log` — RLS owner-read only, all writes via `service_role` (ADR-0003).
- `character_id` FK is `on delete set null`, never cascade — a Transcend/Reset wipe of `player_characters` must not erase history.
- `apply_lifetime_stats` skips the `activity_log` insert entirely when `p_deltas` is `'{}'::jsonb` — no noise rows for "nothing happened."
- Every RPC migration must preserve all other lines of its function body verbatim except where this plan explicitly calls out a reorder/addition (recruit_character's insert-before-log reorder; collect_gather's added character_id lookup).
- No emoji as UI icons — any icon slot uses `IconSlot` (`src/components/atoms/IconSlot`).
- Do NOT regenerate `src/types/database.types.ts` via `generate_typescript_types` as part of this plan — hand-add only the `activity_log` table entry, matching the exact codegen format already used for `craft_runs`/`group_runs`. A full regeneration risks the `CompositeTypes<>` regression CLAUDE.md warns about and is out of scope here.
- Components target ~200 lines; presentation and logic stay separate (repo-wide rule).

---

## Pre-flight dependency scan

- **Task 2** depends on **Task 1** (the table must exist before the function can insert into it).
- **Tasks 3–9** each depend only on **Task 2** (the function must exist to call). They touch 7 *different* migration files, share no file with each other, and each has a fixed pre-assigned filename timestamp that already encodes the correct apply order for `supabase db reset` — **this is a real parallelizable cluster**: dispatch all 7 together once Task 2 is done.
- **Tasks 10 and 11** depend on nothing above — both only need the *shape* the spec already defines (known up front), not the live migrations. They can run **in parallel with the entire backend cluster (Tasks 1–9)**.
- **Task 12** has a real dependency on **Task 10** (imports `activityTitle`/`formatDeltas`/`formatMapKey`) and **Task 11** (imports `fetchActivityLog`/`useActivityLog`) — sequential after both.
- **Task 13** has a real dependency on **Task 12** (imports `HistoryPage` from the feature barrel) — sequential after it.

Suggested dispatch order: Task 1 → Task 2 → {Tasks 3–9 in parallel} while {Tasks 10, 11 in parallel} run alongside → Task 12 → Task 13.

---

### Task 1: `activity_log` table

**Files:**
- Create: `supabase/migrations/20260924100000_activity_log.sql`

**Interfaces:**
- Produces: table `public.activity_log(id, player_id, source, deltas, character_id, party, map_key, created_at)`, RLS owner-select policy, trigger `trim_activity_log_after_insert`.

- [ ] **Step 1: Write the migration**

```sql
-- activity_log: the version-B lightweight event ledger (docs/superpowers/specs/2026-09-24-
-- activity-log-design.md). One row per RPC call that produced a nonzero p_lifetime_stats delta —
-- written by the shared apply_lifetime_stats() function (next migration), not by this migration.
-- Capped at the newest 200 rows per player via the trigger below, so storage never grows
-- unbounded regardless of play volume.

create table public.activity_log (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references auth.users(id) on delete cascade,
  source       text not null,
  deltas       jsonb not null,
  character_id uuid references public.player_characters(id) on delete set null,
  party        uuid[],
  map_key      text,
  created_at   timestamptz not null default now()
);

comment on table public.activity_log is
  'Lightweight event ledger (version B, docs/superpowers/specs/2026-09-24-activity-log-design.md). One row per apply_lifetime_stats() call with a nonzero delta. character_id is ON DELETE SET NULL (not cascade) so a Transcend/Reset wipe of player_characters does not erase history, only orphans the reference.';

alter table public.activity_log enable row level security;

create policy "activity_log_select_own"
  on public.activity_log for select to authenticated
  using (player_id = (select auth.uid()));

grant select on public.activity_log to authenticated;
grant select, insert, update, delete on public.activity_log to service_role;

-- Trim trigger: keeps each player's activity_log to their newest 200 rows. `id desc` is a
-- secondary sort key only for determinism when multiple rows share the same created_at (every
-- insert inside one transaction sees the same now() in Postgres) — which specific row survives a
-- tie is never asserted by tests, only that the COUNT stays capped at 200.
create function public.trim_activity_log() returns trigger
language plpgsql
as $$
begin
  delete from public.activity_log
   where player_id = new.player_id
     and id not in (
       select id from public.activity_log
        where player_id = new.player_id
        order by created_at desc, id desc
        limit 200
     );
  return null;
end;
$$;

create trigger trim_activity_log_after_insert
  after insert on public.activity_log
  for each row execute function public.trim_activity_log();
```

- [ ] **Step 2: Apply it locally**

Run: `npx supabase db reset`
Expected: rebuilds the local database from every migration in `supabase/migrations/`, including this one, with no errors.

- [ ] **Step 3: Verify the table + policy exist**

Run:
```bash
npx supabase test db 2>&1 | tail -5
```
Expected: existing suites (e.g. `claim_group_stage.sql`) still pass — this step has no new SQL assertions of its own yet (those arrive in Task 2), it's only confirming the reset didn't break anything.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260924100000_activity_log.sql
git commit -m "feat: add activity_log table with 200-row trim trigger"
```

---

### Task 2: `apply_lifetime_stats` shared function

**Files:**
- Create: `supabase/migrations/20260924100100_apply_lifetime_stats.sql`
- Create: `supabase/tests/database/apply_lifetime_stats.sql`

**Interfaces:**
- Consumes: table `public.activity_log` (Task 1).
- Produces: function `public.apply_lifetime_stats(p_player uuid, p_deltas jsonb, p_source text, p_character_id uuid default null, p_party uuid[] default null, p_map_key text default null) returns void` — every RPC refactored in Tasks 3–9 calls this by exactly this signature.

- [ ] **Step 1: Write the migration**

```sql
-- apply_lifetime_stats: consolidates the p_lifetime_stats update loop that was duplicated
-- verbatim across 7 RPCs (recruit_character, claim_craft, upgrade_items, admit_infirmary,
-- claim_mission, collect_gather, claim_group_stage — see migration-policy.test.ts's own
-- complaint about this exact drift risk). Each of those RPCs is refactored in its own follow-up
-- migration to call this once instead of looping inline. Also writes the activity_log row
-- (docs/superpowers/specs/2026-09-24-activity-log-design.md) — logging piggybacks on a refactor
-- that was already overdue.
--
-- security invoker (not definer): this function is only ever called from inside another
-- already-security-definer RPC in the same transaction, so it simply continues running with
-- that RPC's already-elevated context. It is never called directly by a client — the explicit
-- revoke/grant below is defense in depth, matching every other function in this codebase.
create function public.apply_lifetime_stats(
  p_player       uuid,
  p_deltas       jsonb,
  p_source       text,
  p_character_id uuid default null,
  p_party        uuid[] default null,
  p_map_key      text default null
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_key    text;
  v_val    numeric;
  v_logged boolean := false;
begin
  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_deltas, '{}'::jsonb))
  loop
    update public.profiles
       set lifetime_stats = jsonb_set(lifetime_stats, array[v_key],
             to_jsonb(coalesce((lifetime_stats->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
    v_logged := true;
  end loop;

  if v_logged then
    insert into public.activity_log (player_id, source, deltas, character_id, party, map_key)
    values (p_player, p_source, p_deltas, p_character_id, p_party, p_map_key);
  end if;
end;
$$;

revoke all on function public.apply_lifetime_stats(uuid, jsonb, text, uuid, uuid[], text) from public, anon, authenticated;
grant execute on function public.apply_lifetime_stats(uuid, jsonb, text, uuid, uuid[], text) to service_role;
```

- [ ] **Step 2: Apply it locally**

Run: `npx supabase db reset`
Expected: no errors.

- [ ] **Step 3: Write the pgTAP test**

Create `supabase/tests/database/apply_lifetime_stats.sql`:

```sql
-- apply_lifetime_stats: lifetime_stats increments (fresh + existing key), the activity_log write
-- (including the empty-deltas no-op case), character_id's ON DELETE SET NULL behavior, and the
-- 200-row trim trigger. Fixture convention: one player+character per scenario (docs/TESTING.md).
begin;
select plan(6);

-- 1. Fresh key: lifetime_stats starts at '{}' (handle_new_user's default), so goldEarned should
-- land at exactly the delta.
insert into auth.users (id, email, raw_user_meta_data)
values ('80000000-0000-0000-0000-000000000001', 'als-1@test.local', jsonb_build_object('username', 'als_1'));

select public.apply_lifetime_stats(
  '80000000-0000-0000-0000-000000000001'::uuid,
  jsonb_build_object('goldEarned', 342),
  'mission-claim'
);

select results_eq(
  $$ select (lifetime_stats->>'goldEarned')::numeric from public.profiles where player_id = '80000000-0000-0000-0000-000000000001' $$,
  $$ values (342::numeric) $$,
  'a fresh lifetime_stats key lands at exactly the delta'
);

-- 2. Existing key: a second call adds on top, it does not overwrite.
select public.apply_lifetime_stats(
  '80000000-0000-0000-0000-000000000001'::uuid,
  jsonb_build_object('goldEarned', 8),
  'mission-claim'
);

select results_eq(
  $$ select (lifetime_stats->>'goldEarned')::numeric from public.profiles where player_id = '80000000-0000-0000-0000-000000000001' $$,
  $$ values (350::numeric) $$,
  'an existing lifetime_stats key increments instead of being overwritten'
);

-- 3. Empty deltas produce no activity_log row (e.g. admit_infirmary admitting a wounded-not-
-- downed character passes '{}').
insert into auth.users (id, email, raw_user_meta_data)
values ('80000000-0000-0000-0000-000000000011', 'als-2@test.local', jsonb_build_object('username', 'als_2'));

select public.apply_lifetime_stats('80000000-0000-0000-0000-000000000011'::uuid, '{}'::jsonb, 'infirmary-admit');

select is(
  (select count(*)::int from public.activity_log where player_id = '80000000-0000-0000-0000-000000000011'),
  0,
  'empty deltas produce zero activity_log rows'
);

-- 4. Non-empty deltas produce exactly one activity_log row with the source/character_id/party/
-- map_key passed through.
insert into auth.users (id, email, raw_user_meta_data)
values ('80000000-0000-0000-0000-000000000021', 'als-3@test.local', jsonb_build_object('username', 'als_3'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('80000000-0000-0000-0000-000000000022', '80000000-0000-0000-0000-000000000021', 'test_char', 15);

select public.apply_lifetime_stats(
  '80000000-0000-0000-0000-000000000021'::uuid,
  jsonb_build_object('missionsCleared', 1),
  'mission-claim',
  '80000000-0000-0000-0000-000000000022'::uuid,
  array['80000000-0000-0000-0000-000000000022'::uuid],
  'gravemarch'
);

select results_eq(
  $$ select source, deltas, character_id, party, map_key from public.activity_log where player_id = '80000000-0000-0000-0000-000000000021' $$,
  $$ values ('mission-claim'::text, jsonb_build_object('missionsCleared', 1), '80000000-0000-0000-0000-000000000022'::uuid, array['80000000-0000-0000-0000-000000000022'::uuid], 'gravemarch'::text) $$,
  'a non-empty delta writes exactly one activity_log row with source/character_id/party/map_key passed through'
);

-- 5. character_id is ON DELETE SET NULL: deleting the referenced character orphans the
-- reference instead of deleting the history row (a Transcend/Reset wipe must not erase history).
delete from public.player_characters where id = '80000000-0000-0000-0000-000000000022';

select results_eq(
  $$ select (character_id is null), source from public.activity_log where player_id = '80000000-0000-0000-0000-000000000021' $$,
  $$ values (true, 'mission-claim'::text) $$,
  'deleting the referenced character nulls activity_log.character_id but keeps the row'
);

-- 6. Trim trigger: a 201st insert for the same player leaves exactly 200 rows.
insert into auth.users (id, email, raw_user_meta_data)
values ('80000000-0000-0000-0000-000000000031', 'als-4@test.local', jsonb_build_object('username', 'als_4'));

do $$
declare v_i int;
begin
  for v_i in 1..201 loop
    perform public.apply_lifetime_stats(
      '80000000-0000-0000-0000-000000000031'::uuid,
      jsonb_build_object('gatherSecondsSpent', 1),
      'gather-collect'
    );
  end loop;
end $$;

select is(
  (select count(*)::int from public.activity_log where player_id = '80000000-0000-0000-0000-000000000031'),
  200,
  'the trim trigger caps a player at 200 activity_log rows after the 201st insert'
);

select * from finish();
rollback;
```

- [ ] **Step 4: Run the test**

Run: `npx supabase test db`
Expected: `apply_lifetime_stats.sql` reports `1..6` all passing (`ok 1` through `ok 6`), and every other existing `.sql` file under `supabase/tests/database/` still passes.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260924100100_apply_lifetime_stats.sql supabase/tests/database/apply_lifetime_stats.sql
git commit -m "feat: add apply_lifetime_stats shared function + pgTAP coverage"
```

---

### Task 3: Refactor `recruit_character`

**Files:**
- Create: `supabase/migrations/20260924100200_recruit_character_activity_log.sql`

**Interfaces:**
- Consumes: `public.apply_lifetime_stats(...)` (Task 2).
- Produces: `recruit_character` still returns `public.player_characters`, same 6-arg signature — Edge Function `supabase/functions/recruit/index.ts` is unchanged.

**Note:** the `apply_lifetime_stats` call moves to AFTER the `insert` (was before it in the original loop's position) — this is the one deliberate reorder in this task, needed so `v_row.id` (the newly-recruited character's id) exists to pass as `p_character_id`. Every other line is preserved verbatim.

- [ ] **Step 1: Write the migration**

```sql
-- recruit_character: replaces its inline p_lifetime_stats loop with a single
-- apply_lifetime_stats() call (docs/superpowers/specs/2026-09-24-activity-log-design.md), now
-- also passing the newly-recruited character's id as character_id for the activity log. The call
-- moves to AFTER the insert (the loop was BEFORE it) so v_row.id exists to pass — the only
-- reorder in this migration; every other line is preserved verbatim from
-- 20260916120000_recruit_character_lifetime_stats.sql. Same 6-arg signature.
create or replace function public.recruit_character(
  p_player           uuid,
  p_character_def_id text,
  p_char_key         text,
  p_gold_cost        numeric,
  p_condition_exists boolean,
  p_lifetime_stats   jsonb default '{}'::jsonb
) returns public.player_characters
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unlocked boolean;
  v_gold     numeric;
  v_row      public.player_characters;
begin
  if p_condition_exists then
    select (unlocked_characters ? p_char_key) into v_unlocked
      from public.profiles
     where player_id = p_player;
    if not coalesce(v_unlocked, false) then
      raise exception 'recruit_character: not unlocked yet';
    end if;
  end if;

  select coalesce((currencies->>'gold')::numeric, 0) into v_gold
    from public.profiles
   where player_id = p_player
   for update;
  if coalesce(v_gold, 0) < p_gold_cost then
    raise exception 'recruit_character: insufficient gold';
  end if;

  update public.profiles
     set currencies = jsonb_set(currencies, array['gold'], to_jsonb(v_gold - p_gold_cost))
   where player_id = p_player;

  insert into public.player_characters (player_id, character_def_id)
  values (p_player, p_character_def_id)
  returning * into v_row;

  perform public.apply_lifetime_stats(p_player, p_lifetime_stats, 'recruit', v_row.id);

  return v_row;
end;
$$;

revoke all on function public.recruit_character(uuid, text, text, numeric, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.recruit_character(uuid, text, text, numeric, boolean, jsonb) to service_role;
```

- [ ] **Step 2: Apply and run the full suite**

Run: `npx supabase db reset && npx supabase test db`
Expected: no errors; `apply_lifetime_stats.sql` and every other existing suite still passes (no dedicated pgTAP suite exists for `recruit_character` yet — that's a separate, smaller follow-up per `docs/TESTING.md`, not part of this task).

- [ ] **Step 3: Run the Vitest migration-policy check**

Run: `npm test -- migration-policy`
Expected: passes — `recruit_character`'s revoke/grant lines are unchanged and still present.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260924100200_recruit_character_activity_log.sql
git commit -m "refactor: recruit_character uses apply_lifetime_stats"
```

---

### Task 4: Refactor `claim_craft`

**Files:**
- Create: `supabase/migrations/20260924100300_claim_craft_activity_log.sql`

**Interfaces:**
- Consumes: `public.apply_lifetime_stats(...)` (Task 2).
- Produces: `claim_craft` still returns `jsonb`, same 5-arg signature — `supabase/functions/craft-claim/index.ts` is unchanged.

- [ ] **Step 1: Write the migration**

```sql
-- claim_craft: replaces its inline p_lifetime_stats loop with a single apply_lifetime_stats()
-- call (docs/superpowers/specs/2026-09-24-activity-log-design.md) — no character_id/party/map_key
-- for this source (crafting isn't character- or map-scoped). Every other line preserved verbatim
-- from 20260916130000_claim_craft_lifetime_stats.sql. Same 5-arg signature.
create or replace function public.claim_craft(
  p_player             uuid,
  p_recipe_def_id      text,
  p_result_item_def_id text,
  p_result_rarity      text,
  p_lifetime_stats     jsonb default '{}'::jsonb
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

  perform public.apply_lifetime_stats(p_player, p_lifetime_stats, 'craft-claim');

  return jsonb_build_object('item_def_id', p_result_item_def_id, 'rarity', p_result_rarity);
end;
$$;

revoke all on function public.claim_craft(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.claim_craft(uuid, text, text, text, jsonb) to service_role;
```

- [ ] **Step 2: Apply and run the full suite**

Run: `npx supabase db reset && npx supabase test db`
Expected: no errors; all existing suites still pass (no dedicated pgTAP suite exists for `claim_craft` yet).

- [ ] **Step 3: Run the Vitest migration-policy check**

Run: `npm test -- migration-policy`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260924100300_claim_craft_activity_log.sql
git commit -m "refactor: claim_craft uses apply_lifetime_stats"
```

---

### Task 5: Refactor `upgrade_items`

**Files:**
- Create: `supabase/migrations/20260924100400_upgrade_items_activity_log.sql`

**Interfaces:**
- Consumes: `public.apply_lifetime_stats(...)` (Task 2).
- Produces: `upgrade_items` still returns `void`, same 3-arg signature — `supabase/functions/item-upgrade/index.ts` is unchanged.

- [ ] **Step 1: Write the migration**

```sql
-- upgrade_items: replaces its inline p_lifetime_stats loop with a single apply_lifetime_stats()
-- call (docs/superpowers/specs/2026-09-24-activity-log-design.md) — no character_id/party/map_key
-- (upgrading isn't character- or map-scoped). The batch loop above it is preserved VERBATIM from
-- 20260916140000_upgrade_items_lifetime_stats.sql; only the trailing lifetime-stats loop is
-- replaced. Same 3-arg signature.
create or replace function public.upgrade_items(
  p_player          uuid,
  p_ops             jsonb,  -- [{ item_def_id, from_rarity, consume_count }, ...]
  p_lifetime_stats  jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_op           jsonb;
  v_item_def_id  text;
  v_from_rarity  text;
  v_consume      integer;
  v_to_rarity    text;
  v_have         integer;
begin
  for v_op in select * from jsonb_array_elements(p_ops)
  loop
    v_item_def_id := v_op->>'item_def_id';
    v_from_rarity := v_op->>'from_rarity';
    v_consume     := (v_op->>'consume_count')::integer;

    v_to_rarity := case v_from_rarity
      when 'Common'   then 'Uncommon'
      when 'Uncommon' then 'Rare'
      when 'Rare'     then 'Epic'
      when 'Epic'     then 'Legendary'
      else null
    end;
    if v_to_rarity is null then
      raise exception 'upgrade_items: cannot upgrade from %', v_from_rarity;
    end if;

    if v_consume <= 0 or v_consume % 5 != 0 then
      raise exception 'upgrade_items: consume_count must be a positive multiple of 5';
    end if;
    if v_consume > 10000 then
      raise exception 'upgrade_items: consume_count exceeds maximum (10000)';
    end if;

    select quantity into v_have
      from public.player_inventory
     where player_id    = p_player
       and item_def_id  = v_item_def_id
       and rarity       = v_from_rarity
     for update;

    if not found or v_have < v_consume then
      raise exception 'upgrade_items: insufficient quantity of % (%) — have %, need %',
        v_item_def_id, v_from_rarity, coalesce(v_have, 0), v_consume;
    end if;

    if v_have = v_consume then
      delete from public.player_inventory
       where player_id   = p_player
         and item_def_id = v_item_def_id
         and rarity      = v_from_rarity;
    else
      update public.player_inventory
         set quantity = quantity - v_consume
       where player_id   = p_player
         and item_def_id = v_item_def_id
         and rarity      = v_from_rarity;
    end if;

    insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
    values (p_player, v_item_def_id, v_to_rarity, v_consume / 5)
    on conflict (player_id, item_def_id, rarity)
      do update set quantity = player_inventory.quantity + excluded.quantity;
  end loop;

  perform public.apply_lifetime_stats(p_player, p_lifetime_stats, 'item-upgrade');
end;
$$;

revoke all on function public.upgrade_items(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.upgrade_items(uuid, jsonb, jsonb) to service_role;
```

- [ ] **Step 2: Apply and run the full suite**

Run: `npx supabase db reset && npx supabase test db`
Expected: no errors; all existing suites still pass (no dedicated pgTAP suite exists for `upgrade_items` yet).

- [ ] **Step 3: Run the Vitest migration-policy check**

Run: `npm test -- migration-policy`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260924100400_upgrade_items_activity_log.sql
git commit -m "refactor: upgrade_items uses apply_lifetime_stats"
```

---

### Task 6: Refactor `admit_infirmary`

**Files:**
- Create: `supabase/migrations/20260924100500_admit_infirmary_activity_log.sql`

**Interfaces:**
- Consumes: `public.apply_lifetime_stats(...)` (Task 2).
- Produces: `admit_infirmary` still returns `public.infirmary_admissions`, same 4-arg signature — `supabase/functions/infirmary-admit/index.ts` is unchanged.

- [ ] **Step 1: Write the migration**

```sql
-- admit_infirmary: replaces its inline p_lifetime_stats loop with a single apply_lifetime_stats()
-- call (docs/superpowers/specs/2026-09-24-activity-log-design.md), passing p_char as
-- character_id (no party/map_key — this is a single-character event). Every other line
-- preserved verbatim from 20260916150000_admit_infirmary_lifetime_stats.sql. Same 4-arg
-- signature.
create or replace function public.admit_infirmary(
  p_player uuid,
  p_char   uuid,
  p_max_beds int,
  p_lifetime_stats jsonb default '{}'::jsonb
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

  perform public.apply_lifetime_stats(p_player, p_lifetime_stats, 'infirmary-admit', p_char);

  return v_admission;
end;
$$;

revoke all on function public.admit_infirmary(uuid, uuid, int, jsonb) from public, anon, authenticated;
grant execute on function public.admit_infirmary(uuid, uuid, int, jsonb) to service_role;
```

- [ ] **Step 2: Apply and run the full suite**

Run: `npx supabase db reset && npx supabase test db`
Expected: no errors; all existing suites still pass (no dedicated pgTAP suite exists for `admit_infirmary` yet).

- [ ] **Step 3: Run the Vitest migration-policy check**

Run: `npm test -- migration-policy`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260924100500_admit_infirmary_activity_log.sql
git commit -m "refactor: admit_infirmary uses apply_lifetime_stats"
```

---

### Task 7: Refactor `claim_mission`

**Files:**
- Create: `supabase/migrations/20260924100600_claim_mission_activity_log.sql`

**Interfaces:**
- Consumes: `public.apply_lifetime_stats(...)` (Task 2).
- Produces: `claim_mission` still returns `jsonb`, same 11-arg signature — `supabase/functions/mission-claim/index.ts` is unchanged.

- [ ] **Step 1: Write the migration**

```sql
-- claim_mission: replaces its inline p_lifetime_stats loop with a single apply_lifetime_stats()
-- call (docs/superpowers/specs/2026-09-24-activity-log-design.md), passing v_party (captured
-- from the delete...returning at the top, before it's used) as party, and p_map_key as map_key.
-- Every other line preserved verbatim from 20260914100100_claim_mission_collect_gather_
-- achievements.sql. Same 11-arg signature.
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

  perform public.apply_lifetime_stats(p_player, p_lifetime_stats, 'mission-claim', null, v_party, p_map_key);

  foreach v_key in array coalesce(p_newly_unlocked, '{}')
  loop
    update public.profiles
       set unlocked_characters = jsonb_set(unlocked_characters, array[v_key], to_jsonb(now()))
     where player_id = p_player and not (unlocked_characters ? v_key);
    if found then
      v_actually_unlocked := array_append(v_actually_unlocked, v_key);
    end if;
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

  return jsonb_build_object('claimed', true, 'party', v_party, 'actually_unlocked', v_actually_unlocked);
end;
$$;

revoke all on function public.claim_mission(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, int, boolean, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.claim_mission(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, int, boolean, jsonb, text[]) to service_role;
```

- [ ] **Step 2: Apply and run the full suite**

Run: `npx supabase db reset && npx supabase test db`
Expected: no errors; all existing suites still pass (no dedicated pgTAP suite exists for `claim_mission` yet).

- [ ] **Step 3: Run the Vitest migration-policy check**

Run: `npm test -- migration-policy`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260924100600_claim_mission_activity_log.sql
git commit -m "refactor: claim_mission uses apply_lifetime_stats"
```

---

### Task 8: Refactor `collect_gather`

**Files:**
- Create: `supabase/migrations/20260924100700_collect_gather_activity_log.sql`

**Interfaces:**
- Consumes: `public.apply_lifetime_stats(...)` (Task 2).
- Produces: `collect_gather` still returns `jsonb`, same 8-arg signature — `supabase/functions/gather-collect/index.ts` is unchanged.

**Note:** one line is added (not just a loop replacement): a `select player_character_id into v_char_id ...` right after the ownership check, BEFORE the possible `delete` (when `p_stop` is true) removes the row — otherwise the gatherer's character id would be unavailable by the time the log entry is written. Every other line is otherwise preserved verbatim.

- [ ] **Step 1: Write the migration**

```sql
-- collect_gather: replaces its inline p_lifetime_stats loop with a single apply_lifetime_stats()
-- call (docs/superpowers/specs/2026-09-24-activity-log-design.md), passing the gatherer's
-- character id as character_id. One line is ADDED (not just the loop replaced): a lookup of
-- player_character_id right after the ownership check, BEFORE the p_stop branch's delete could
-- remove the row — otherwise the character id wouldn't be available by the time the log entry is
-- written. Every other line preserved verbatim from 20260914100100_claim_mission_collect_gather_
-- achievements.sql. Same 8-arg signature.
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
  v_char_id uuid;
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

  select player_character_id into v_char_id
    from public.gather_assignments
   where id = p_assignment_id and player_id = p_player;

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

  perform public.apply_lifetime_stats(p_player, p_lifetime_stats, 'gather-collect', v_char_id);

  foreach v_key in array coalesce(p_newly_unlocked, '{}')
  loop
    update public.profiles
       set unlocked_characters = jsonb_set(unlocked_characters, array[v_key], to_jsonb(now()))
     where player_id = p_player and not (unlocked_characters ? v_key);
    if found then
      v_actually_unlocked := array_append(v_actually_unlocked, v_key);
    end if;
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

- [ ] **Step 2: Apply and run the full suite**

Run: `npx supabase db reset && npx supabase test db`
Expected: no errors; all existing suites still pass (no dedicated pgTAP suite exists for `collect_gather` yet).

- [ ] **Step 3: Run the Vitest migration-policy check**

Run: `npm test -- migration-policy`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260924100700_collect_gather_activity_log.sql
git commit -m "refactor: collect_gather uses apply_lifetime_stats"
```

---

### Task 9: Refactor `claim_group_stage`

**Files:**
- Create: `supabase/migrations/20260924100800_claim_group_stage_activity_log.sql`

**Interfaces:**
- Consumes: `public.apply_lifetime_stats(...)` (Task 2).
- Produces: `claim_group_stage` still returns `jsonb`, same 10-arg signature — `supabase/functions/group-claim-stage/index.ts` is unchanged.

**Note:** `v_run.party` (captured at the top via `select * into v_run ... for update`, BEFORE later statements clear it to `'{}'`) is passed as `party`; `p_def_key` is passed as `map_key` (reused for the dungeon/raid's own content key, per the spec). This is the one RPC in this cluster with an EXISTING pgTAP suite (`supabase/tests/database/claim_group_stage.sql`, 14 assertions) — this task's job is to keep every one of those 14 passing unchanged.

- [ ] **Step 1: Write the migration**

```sql
-- claim_group_stage: replaces its inline p_lifetime_stats loop with a single
-- apply_lifetime_stats() call (docs/superpowers/specs/2026-09-24-activity-log-design.md),
-- passing v_run.party (captured at the top, before it's cleared) as party and p_def_key as
-- map_key (reused for the dungeon/raid's own content key). Every other line preserved verbatim
-- from 20260914100200_claim_group_stage_achievements.sql. Same 10-arg signature — this RPC has
-- an existing pgTAP suite (supabase/tests/database/claim_group_stage.sql) that must still pass
-- unchanged after this refactor.
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

  perform public.apply_lifetime_stats(p_player, p_lifetime_stats, 'group-claim-stage', null, v_run.party, p_def_key);

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

- [ ] **Step 2: Apply it locally**

Run: `npx supabase db reset`
Expected: no errors.

- [ ] **Step 3: Run the existing pgTAP suite for this RPC**

Run: `npx supabase test db 2>&1 | grep -A 20 "claim_group_stage"`
Expected: all 14 assertions in `claim_group_stage.sql` still report `ok` — this refactor must not change any of its behavior (locking, busy-checks, win/loss transitions, loot/currency application, level-cap achievement counter).

- [ ] **Step 4: Run the full suite + Vitest migration-policy check**

Run: `npx supabase test db && npm test -- migration-policy`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260924100800_claim_group_stage_activity_log.sql
git commit -m "refactor: claim_group_stage uses apply_lifetime_stats"
```

---

### Task 10: `src/lib/activityLog.ts` formatting registry

**Files:**
- Create: `src/lib/activityLog.ts`
- Create: `src/lib/activityLog.test.ts`

**Interfaces:**
- Consumes: `LIFETIME_STAT_LABELS` (`src/lib/lifetimeStats.ts`), `formatRemaining` (`src/lib/time.ts`) — both already exist.
- Produces: `activityTitle(source: string, deltas: Record<string, number>): string`, `formatDeltas(deltas: Record<string, number>): DeltaChip[]` (where `DeltaChip = { key: string; label: string; text: string }`), `formatMapKey(mapKey: string): string` — all consumed by Task 12.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/activityLog.test.ts
import { describe, it, expect } from 'vitest'
import { activityTitle, formatDeltas, formatMapKey } from './activityLog'

describe('activityTitle', () => {
  it('returns the default title for a source with no outcome override', () => {
    expect(activityTitle('recruit', { charactersRecruited: 1 })).toBe('Character Recruited')
  })

  it('returns the win title for mission-claim when missionsCleared is present', () => {
    expect(activityTitle('mission-claim', { missionsCleared: 1, goldEarned: 50 })).toBe('Mission Cleared')
  })

  it('returns the loss title for mission-claim when missionsFailed is present instead', () => {
    expect(activityTitle('mission-claim', { missionsFailed: 1 })).toBe('Mission Failed')
  })

  it('falls back to the raw source string for an unregistered source', () => {
    expect(activityTitle('some-future-rpc', {})).toBe('some-future-rpc')
  })
})

describe('formatDeltas', () => {
  it('formats a count stat using the shared LIFETIME_STAT_LABELS label and a + prefix', () => {
    expect(formatDeltas({ goldEarned: 342 })).toEqual([
      { key: 'goldEarned', label: 'Gold earned', text: '+342' },
    ])
  })

  it('formats a duration stat (missionSecondsSent) as a duration, not a raw number', () => {
    expect(formatDeltas({ missionSecondsSent: 90 })).toEqual([
      { key: 'missionSecondsSent', label: 'Time spent on missions', text: '01:30' },
    ])
  })

  it('falls back to the raw key as the label for an unregistered delta key', () => {
    expect(formatDeltas({ someFutureStat: 5 })).toEqual([
      { key: 'someFutureStat', label: 'someFutureStat', text: '+5' },
    ])
  })
})

describe('formatMapKey', () => {
  it('title-cases a raw map key', () => {
    expect(formatMapKey('gravemarch')).toBe('Gravemarch')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- activityLog`
Expected: FAIL — `Cannot find module './activityLog'` (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/activityLog.ts
import { LIFETIME_STAT_LABELS } from './lifetimeStats'
import { formatRemaining } from './time'

// Formatting for the /history activity log (docs/superpowers/specs/2026-09-24-activity-log-
// design.md). Reuses LIFETIME_STAT_LABELS rather than reinventing labels — every key that can
// appear in an activity_log row's `deltas` is already labeled there for /statistics, so the two
// pages can never drift apart on wording.

const DURATION_KEYS = new Set(['missionSecondsSent', 'gatherSecondsSpent'])

/** Default title per `source`. */
const SOURCE_TITLES: Record<string, string> = {
  recruit: 'Character Recruited',
  'craft-claim': 'Item Crafted',
  'item-upgrade': 'Item Upgraded',
  'infirmary-admit': 'Character Admitted',
  'mission-claim': 'Mission Cleared',
  'gather-collect': 'Resources Gathered',
  'group-claim-stage': 'Stage Cleared',
}

// win/loss title overrides, keyed by the delta key whose PRESENCE flips the title away from
// SOURCE_TITLES' default. Only mission-claim needs one today: group-claim-stage's Edge Function
// sends an EMPTY deltas object on a loss (no dungeonsCleared/raidsCleared key at all), which
// apply_lifetime_stats already skips logging entirely — a lost dungeon/raid stage never produces
// a row here, so no loss-title override is needed for that source.
const OUTCOME_OVERRIDES: { source: string; key: string; title: string }[] = [
  { source: 'mission-claim', key: 'missionsFailed', title: 'Mission Failed' },
]

export function activityTitle(source: string, deltas: Record<string, number>): string {
  const override = OUTCOME_OVERRIDES.find((o) => o.source === source && deltas[o.key] !== undefined)
  return override?.title ?? SOURCE_TITLES[source] ?? source
}

export type DeltaChip = { key: string; label: string; text: string }

/** Turns one activity_log row's `deltas` into display-ready chips. An unknown key (a future stat
 *  not yet in LIFETIME_STAT_LABELS) falls back to the raw key so it still renders instead of
 *  silently disappearing. */
export function formatDeltas(deltas: Record<string, number>): DeltaChip[] {
  return Object.entries(deltas).map(([key, value]) => {
    const label = LIFETIME_STAT_LABELS[key] ?? key
    const text = DURATION_KEYS.has(key) ? formatRemaining(value * 1000) : `+${value.toLocaleString()}`
    return { key, label, text }
  })
}

/** Title-cases a raw map/dungeon/raid key for display (e.g. 'gravemarch' → 'Gravemarch') — no
 *  dedicated map-label registry exists in code today (maps are purely Sanity-authored content).
 *  Good enough for v1; revisit if it reads oddly in practice. */
export function formatMapKey(mapKey: string): string {
  return mapKey.charAt(0).toUpperCase() + mapKey.slice(1)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- activityLog`
Expected: PASS, all 8 assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/activityLog.ts src/lib/activityLog.test.ts
git commit -m "feat: add activity log formatting registry"
```

---

### Task 11: `database.types.ts` entry + `src/features/activity/data.ts` + `hooks.ts`

**Files:**
- Modify: `src/types/database.types.ts` (hand-add one table entry — do NOT regenerate the whole file)
- Create: `src/features/activity/data.ts`
- Create: `src/features/activity/hooks.ts`

**Interfaces:**
- Consumes: `supabase` client (`@/lib/supabase`).
- Produces: `fetchActivityLog(): Promise<ActivityLogRow[]>`, `useActivityLog()` (a TanStack Query hook) — both consumed by Task 12.

- [ ] **Step 1: Hand-add the `activity_log` Row type**

Open `src/types/database.types.ts`. Tables are listed alphabetically inside `Tables: { ... }` (the first entry today is `craft_runs`). Insert a new entry immediately BEFORE `craft_runs` (line 17):

```ts
      activity_log: {
        Row: {
          character_id: string | null
          created_at: string
          deltas: Json
          id: string
          map_key: string | null
          party: string[] | null
          player_id: string
          source: string
        }
        Insert: never // all writes go through apply_lifetime_stats() inside other RPCs (ADR-0003)
        Update: never
        Relationships: [
          {
            foreignKeyName: "activity_log_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "player_characters"
            referencedColumns: ["id"]
          },
        ]
      }
```

This mirrors `craft_runs`'s own `Insert: never`/`Update: never` pattern exactly (both tables grant the client SELECT only — see the comment on `craft_runs` a few lines below for the precedent). Do not run `generate_typescript_types` / the Supabase MCP regeneration tool for this task — it would touch every other table in the file and risk the `CompositeTypes<>` regression CLAUDE.md warns about, for a change this small.

- [ ] **Step 2: Verify the project still typechecks**

Run: `npm run build`
Expected: no new TypeScript errors (the hand-added entry is additive only).

- [ ] **Step 3: Write `data.ts`**

```ts
// src/features/activity/data.ts
import { supabase } from '@/lib/supabase'

// The Activity Log data layer (docs/superpowers/specs/2026-09-24-activity-log-design.md).
// RLS owner-scoped SELECT-only — no Edge Function needed, the row is read straight from the
// table the same way mission_runs/gather_assignments already are elsewhere in this codebase.

export type ActivityLogRow = {
  id: string
  source: string
  deltas: Record<string, number>
  character_id: string | null
  party: string[] | null
  map_key: string | null
  created_at: string
}

export async function fetchActivityLog(): Promise<ActivityLogRow[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as ActivityLogRow[]
}
```

- [ ] **Step 4: Write `hooks.ts`**

```ts
// src/features/activity/hooks.ts
import { useQuery } from '@tanstack/react-query'
import { fetchActivityLog } from './data'

// A single fetch of up to 200 rows is enough — the server-side trim trigger already caps
// storage per player, so no "load more" / offset pagination is needed (see the design spec).
export function useActivityLog() {
  return useQuery({ queryKey: ['activityLog'], queryFn: fetchActivityLog })
}
```

- [ ] **Step 5: Verify the project still typechecks and lints**

Run: `npm run build && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/types/database.types.ts src/features/activity/data.ts src/features/activity/hooks.ts
git commit -m "feat: add activity log data layer"
```

---

### Task 12: `src/features/activity/` page + components

**Files:**
- Create: `src/features/activity/components/ActivityRow.tsx`
- Create: `src/features/activity/HistoryPage.tsx`
- Create: `src/features/activity/HistoryPage.test.tsx`
- Create: `src/features/activity/index.ts`

**Interfaces:**
- Consumes: `useActivityLog` (Task 11), `activityTitle`/`formatDeltas`/`formatMapKey` (Task 10), `useRoster` (`@/hooks/useRoster`, already exists — for resolving `character_id`/`party` to display names).
- Produces: default export `HistoryPage`, re-exported from `index.ts` as `HistoryPage` — consumed by Task 13.

- [ ] **Step 1: Write `ActivityRow.tsx`**

```tsx
// src/features/activity/components/ActivityRow.tsx
import { activityTitle, formatDeltas, formatMapKey } from '@/lib/activityLog'
import type { ActivityLogRow } from '../data'
import type { RosterMember } from '@/hooks/useRoster'

type Props = {
  row: ActivityLogRow
  /** id → roster member, for resolving character_id/party to display names. A missing id (an
   *  orphaned reference after a Transcend/Reset wipe, or a character outside the current roster)
   *  falls back to a generic label rather than disappearing. */
  rosterById: Map<string, RosterMember>
}

function characterNames(row: ActivityLogRow, rosterById: Map<string, RosterMember>): string | null {
  const ids = row.character_id ? [row.character_id] : row.party ?? []
  if (ids.length === 0) return null
  return ids.map((id) => rosterById.get(id)?.name ?? 'a character').join(', ')
}

export function ActivityRow({ row, rosterById }: Props) {
  const title = activityTitle(row.source, row.deltas)
  const chips = formatDeltas(row.deltas)
  const names = characterNames(row, rosterById)
  const when = new Date(row.created_at).toLocaleString()

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 14px',
      borderBottom: '1px solid rgba(200,145,42,0.15)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong style={{ color: 'var(--color-text-primary)' }}>{title}</strong>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{when}</span>
      </div>
      {(names || row.map_key) && (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
          {names}
          {names && row.map_key ? ' — ' : ''}
          {row.map_key ? formatMapKey(row.map_key) : ''}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {chips.map((chip) => (
          <span key={chip.key} style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
            {chip.label} {chip.text}
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `HistoryPage.tsx`**

```tsx
// src/features/activity/HistoryPage.tsx
import { useMemo } from 'react'
import { useActivityLog } from './hooks'
import { useRoster } from '@/hooks/useRoster'
import { ActivityRow } from './components/ActivityRow'

export default function HistoryPage() {
  const activity = useActivityLog()
  const { roster } = useRoster()
  const rosterById = useMemo(() => new Map(roster.map((c) => [c.id, c])), [roster])

  if (activity.isLoading) {
    return <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
  }

  const rows = activity.data ?? []

  return (
    <div>
      <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 16 }}>History</h2>
      {rows.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Nothing here yet — go clear a mission.</p>
      ) : (
        <div>
          {rows.map((row) => (
            <ActivityRow key={row.id} row={row} rosterById={rosterById} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Write the failing test**

```tsx
// src/features/activity/HistoryPage.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import type { ActivityLogRow } from './data'

vi.mock('./data', () => ({
  fetchActivityLog: vi.fn(),
}))
vi.mock('@/hooks/useRoster', () => ({
  useRoster: () => ({ roster: [], isLoading: false, error: null }),
}))

import { fetchActivityLog } from './data'
import HistoryPage from './HistoryPage'

function renderWithClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    React.createElement(QueryClientProvider, { client }, React.createElement(HistoryPage)),
  )
}

function makeRow(overrides: Partial<ActivityLogRow> = {}): ActivityLogRow {
  return {
    id: 'row-1',
    source: 'mission-claim',
    deltas: { missionsCleared: 1, goldEarned: 342 },
    character_id: null,
    party: null,
    map_key: null,
    created_at: new Date('2026-09-24T14:32:00Z').toISOString(),
    ...overrides,
  }
}

describe('HistoryPage', () => {
  it('renders "Loading…" while the activity log query is pending', () => {
    vi.mocked(fetchActivityLog).mockReturnValue(new Promise(() => {}))

    renderWithClient()

    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders the empty state when there are zero rows', async () => {
    vi.mocked(fetchActivityLog).mockResolvedValue([])

    renderWithClient()

    await waitFor(() => expect(screen.getByText('Nothing here yet — go clear a mission.')).toBeInTheDocument())
  })

  it('renders a row\'s title and gold delta chip', async () => {
    vi.mocked(fetchActivityLog).mockResolvedValue([makeRow()])

    renderWithClient()

    await waitFor(() => expect(screen.getByText('Mission Cleared')).toBeInTheDocument())
    expect(screen.getByText('Gold earned +342')).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -- HistoryPage`
Expected: FAIL — module `./HistoryPage` resolves (it exists from Step 2), but this test file's mocks import from `./data`, which is fine; the actual failure mode to watch for here is any typo in the mock/import — if the test instead PASSES immediately, double check the assertions are meaningful (this step exists to catch a broken test harness, not to force artificial red).

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- HistoryPage`
Expected: PASS, all 3 assertions green.

- [ ] **Step 6: Write `index.ts`**

```ts
// src/features/activity/index.ts
// Public API of the Activity Log feature.
// Import from '@/features/activity' — never reach into the feature's internals
// (./components/*, ./data, ./hooks) from outside the feature.

export { default as HistoryPage } from './HistoryPage'
```

- [ ] **Step 7: Verify lint + full test suite**

Run: `npm run lint && npm test`
Expected: no errors, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/features/activity/
git commit -m "feat: add History page"
```

---

### Task 13: Wire `/history` into routing + nav

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/organisms/GameHeader.tsx`

**Interfaces:**
- Consumes: `HistoryPage` (`@/features/activity`, Task 12).

- [ ] **Step 1: Add the lazy route in `App.tsx`**

In `src/App.tsx`, add a new lazy import alongside the other feature pages (after line 32, the `AchievementsPage` import):

```tsx
const HistoryPage = lazy(() => import('@/features/activity').then((m) => ({ default: m.HistoryPage })))
```

Add the route inside `<Route element={<GameLayout />}>`, after the `/achievements` route (line 83):

```tsx
              <Route path="/history" element={<HistoryPage />} />
```

- [ ] **Step 2: Add the nav link in `GameHeader.tsx`**

In `src/components/organisms/GameHeader.tsx`, add to the `NAV` array after `{ label: 'Achievements', to: '/achievements' }` (line 32):

```tsx
  { label: 'History', to: '/history' },
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual browser check**

Run: `npm run dev`, sign in, navigate to `/history` via the new nav link. Expected: page loads, shows the empty state (or real rows if lifetime stats already exist on this account from earlier testing/dev use).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/organisms/GameHeader.tsx
git commit -m "feat: wire /history route and nav link"
```

---

## Deploy (after all tasks, on the appropriate branch(es))

Per this repo's existing hosted-deploy pattern (see `TODO.md`'s prior lifetime-stats deploy entries):

1. Apply the 9 new migrations to the hosted Supabase project, IN ORDER (each depends on the
   previous existing): `20260924100000` → `20260924100100` → `20260924100200` → ... →
   `20260924100800`.
2. Run `mcp__supabase__get_advisors` (security + performance) after — confirm no new findings
   beyond the pre-existing ones already tracked.
3. Redeploy the 7 touched Edge Functions — actually, **none need redeploying**: their signatures
   and request/response shapes are unchanged (only the RPC bodies changed). Skip this step;
   confirm by re-reading each Edge Function's `index.ts` and noting no `p_source`/
   `p_character_id`/`p_party`/`p_map_key` params were added to any `.rpc(...)` call.
4. Manually exercise at least one of each of the 7 event types and confirm a row appears under
   `/history`: recruit a character, craft an item, upgrade an item, get a character downed and
   admitted, clear a mission, lose a mission, gather, clear a dungeon/raid stage.

## Self-review notes

- **Spec coverage:** every section of the spec (data model, shared function, 7 call sites,
  frontend, testing, migration order) maps to a task above. The spec's "out of scope" section
  (version A, non-lifetime-stats RPCs) has no task, as intended.
- **Placeholder scan:** no TBD/TODO markers; every step has real code or a real command.
- **Type consistency:** `ActivityLogRow` (Task 11) matches the hand-added `database.types.ts`
  Row shape (Task 11) and the migration's columns (Task 1) field-for-field. `apply_lifetime_stats`'s
  signature (Task 2) matches every call site in Tasks 3–9 exactly (same param names, same order).
  `activityTitle`/`formatDeltas`/`formatMapKey` (Task 10) match their usage in `ActivityRow.tsx`
  (Task 12) exactly.
