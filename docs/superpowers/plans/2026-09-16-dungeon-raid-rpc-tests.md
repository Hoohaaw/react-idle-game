# Dungeon/raid RPC test coverage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Status note:** this plan was executed inline in the same session it was written, with a live
> local Supabase/pgTAP stack available — every task below is already implemented, verified
> (actually run, not just written), and checked off. It's kept as a record of what was built and
> why, and as the reference for extending this infra to other RPCs later (ADR-0048's
> `recruit_character` gap, `check_ascendant_milestones`, `check_achievements`).

**Goal:** Build this repo's first real SQL/RPC test infra (pgTAP) and use it to cover the 6
dungeon/raid-related RPCs that had zero automated test coverage.

**Architecture:** pgTAP test files under `supabase/tests/database/`, one per RPC plus one shared
file for a busy-check pattern repeated across four RPCs, run via `npx supabase test db` against a
local Supabase CLI dev stack. Not CI-gated. One companion static check added to the existing
`src/test/migration-policy.test.ts`.

**Tech Stack:** Supabase CLI (project `devDependency`), pgTAP (preinstalled in Supabase's local
Postgres image), Docker Desktop (local stack).

**Spec:** `docs/superpowers/specs/2026-09-16-dungeon-raid-rpc-tests-design.md`

## Global Constraints

- Not CI-gated — local/on-demand only, matching how the existing Vitest suite already runs here.
- Scope is exactly 6 RPCs: `start_group_stage`, `claim_group_stage`, `equip_item`, `unequip_item`,
  `choose_blessing`, `respec_blessings`. No others.
- Sequential re-invocation proves the "reads fresh locked state" property; true multi-connection
  concurrency is not tested (a pgTAP file is one transaction) — `for update` presence itself is
  checked statically instead (Task 8).
- **Fixture isolation rule**: every independent test scenario gets its own fresh player+character.
  Reusing one across scenarios risks an earlier scenario's successful call leaving that character
  "busy," causing a later scenario to fail with an unrelated busy-check exception instead of
  testing what it meant to.
- Fixture pattern: `insert into auth.users (id, email, raw_user_meta_data) values (..., ...,
  jsonb_build_object('username', '...'))` — the `handle_new_user()` trigger then auto-creates the
  `profiles` row (required: `username` is `NOT NULL`). Customize the row afterward with `update`.
- `throws_ok($$ sql $$)` (1-arg) asserts any exception; `throws_ok($$ sql $$, 'exact message')`
  (3-arg, no separate description slot) asserts an exact message match. There is no 2-arg
  "any exception + custom description" overload — the 2nd argument is always treated as an
  expected message/errcode.

---

### Task 0: Bootstrap the pgTAP toolchain

**Files:**
- Modify: `package.json` (`supabase` was already a `devDependency` on `master` — `^2.106.0` — this
  bumps and exact-pins it to the version actually used and verified: `2.117.0`)
- Create: `supabase/tests/database/` (directory)

**Interfaces:** none — pure tooling setup.

- [x] **Step 1: Update the Supabase CLI dev dependency to an exact, verified version**

```bash
npm install supabase --save-dev --save-exact
```

- [x] **Step 2: Confirm Docker is running, start the local Supabase stack**

```bash
docker info
npx supabase start
```

Expected: prints local `API_URL`/`DB_URL`/keys once ready. (If the project was already
initialized with a stale Docker volume from an earlier point in its history, the schema won't
match current migrations — `npx supabase db reset` rebuilds it from every migration in
`supabase/migrations/` from scratch. This happened during implementation; it's not hypothetical.)

- [x] **Step 3: Smoke-test the toolchain**

Create a throwaway `supabase/tests/database/000_smoke.sql`:
```sql
begin;
select plan(1);
select pass('pgTAP toolchain works');
select * from finish();
rollback;
```
Run: `npx supabase test db` — expected `Result: PASS`. Delete the smoke file once confirmed (it's
not part of the real suite).

- [x] **Step 4: Verify the fixture pattern against the real schema**

Confirmed `auth.users` insert with `raw_user_meta_data->>'username'` auto-creates a valid
`profiles` row via `handle_new_user()`, that the row can be updated afterward, and that
`player_characters` rows insert cleanly against it — all three via a throwaway scratch file, run,
confirmed passing, then deleted. This de-risked every subsequent task's fixtures.

---

### Task 1: `group_runs_busy_check.sql` — shared busy-check pattern

**Files:**
- Create: `supabase/tests/database/group_runs_busy_check.sql`

**Interfaces:**
- Consumes: `equip_item(p_player uuid, p_char uuid, p_slot_key text, p_item_def_id text, p_rarity text, p_required_level integer default 0)`, `unequip_item(p_player uuid, p_char uuid, p_slot_key text)`, `choose_blessing(p_player uuid, p_char uuid, p_row text, p_choice text)`, `respec_blessings(p_player uuid, p_char uuid, p_cost numeric)` — all four already defined in `supabase/migrations/20260908140000_group_runs.sql` and later migrations.

- [x] **Step 1: Write the test file**

4 scenarios, one per RPC, each giving its fixture character an active `group_runs` row (`party`
containing that character) and asserting the call throws `'<fn>: character is in a dungeon or
raid'`. Full content: `supabase/tests/database/group_runs_busy_check.sql`.

- [x] **Step 2: Run and verify**

```bash
npx supabase test db
```
Result: `4/4` pass.

- [x] **Step 3: Commit**

(Committed together with the rest of the suite — see Task 9.)

---

### Task 2: `equip_item.sql`

**Files:**
- Create: `supabase/tests/database/equip_item.sql`

**Interfaces:**
- Consumes: `equip_item(...)` as above; `public.profiles.achievement_counters` (jsonb).

- [x] **Step 1: Write the test file** — 13 assertions: invalid slot key, invalid rarity, character
  not found/not owned, level-requirement gate, mission/gather/infirmary busy-checks, item not in
  inventory, happy-path equip (slot written, stack of 1 deleted), displaced item returned to
  inventory, same-item re-equip net-zero path, and the Legendary-equip achievement counter bump.
  Full content: `supabase/tests/database/equip_item.sql`.

- [x] **Step 2: Run and verify** — `npx supabase test db` → `13/13` pass.

- [x] **Step 3: Commit** (Task 9.)

---

### Task 3: `unequip_item.sql`

**Files:**
- Create: `supabase/tests/database/unequip_item.sql`

**Interfaces:**
- Consumes: `unequip_item(p_player uuid, p_char uuid, p_slot_key text)`.

- [x] **Step 1: Write the test file** — 8 assertions: invalid slot key, character not found/not
  owned, mission/gather/infirmary busy-checks, empty-slot rejection, happy-path unequip (slot
  cleared, fresh inventory stack created for the returned item). Full content:
  `supabase/tests/database/unequip_item.sql`.

- [x] **Step 2: Run and verify** — `npx supabase test db` → `8/8` pass.

- [x] **Step 3: Commit** (Task 9.)

---

### Task 4: `choose_blessing.sql`

**Files:**
- Create: `supabase/tests/database/choose_blessing.sql`

**Interfaces:**
- Consumes: `choose_blessing(p_player uuid, p_char uuid, p_row text, p_choice text)`.

- [x] **Step 1: Write the test file** — 11 assertions: invalid row, invalid choice, character not
  found/not owned, level gate, immutability guard (row already chosen), strict-sequence guard
  (row2 before row1), mission busy-check, happy-path row1 pick, row4 pick at level ≥50 bumps
  `achievement_counters.capstonesEarned`, row4 pick below level 50 does NOT bump it. Full content:
  `supabase/tests/database/choose_blessing.sql`.

- [x] **Step 2: Run and verify** — `npx supabase test db` → `11/11` pass.

- [x] **Step 3: Commit** (Task 9.)

---

### Task 5: `respec_blessings.sql`

**Files:**
- Create: `supabase/tests/database/respec_blessings.sql`

**Interfaces:**
- Consumes: `respec_blessings(p_player uuid, p_char uuid, p_cost numeric)`.

- [x] **Step 1: Write the test file** — 8 assertions: character not found/not owned, no-op
  rejection, mission/gather/infirmary busy-checks, insufficient gold, happy-path respec (tree
  wiped, gold deducted). Full content: `supabase/tests/database/respec_blessings.sql`.

- [x] **Step 2: Run and verify** — `npx supabase test db` → `8/8` pass.

- [x] **Step 3: Commit** (Task 9.)

---

### Task 6: `start_group_stage.sql`

**Files:**
- Create: `supabase/tests/database/start_group_stage.sql`

**Interfaces:**
- Consumes: `start_group_stage(p_player uuid, p_kind text, p_def_key text, p_party uuid[], p_stage_index int, p_total_stages int, p_duration_seconds int, p_lockout text, p_map_gate text default null) returns public.group_runs` (latest definition: `supabase/migrations/20260914110200_skill_busy_checks.sql`, includes the `skill_assignments` busy-check added after the original `group_runs` migration).

- [x] **Step 1: Write the test file** — 21 assertions: invalid kind, empty party, duplicate
  character, invalid duration, downed character, mission/gather/infirmary/skill-training busy-
  checks, busy-in-another-run check, map gate (rejected and satisfied), fresh-run creation shape,
  fresh run with nonzero stage index rejected, the double-start guard, stage-index mismatch,
  daily lockout (still locked and reset-boundary-passed, verifying the reset writes
  status/stage-index/`last_cleared_at` correctly), weekly lockout still locked. Full content:
  `supabase/tests/database/start_group_stage.sql`.

  **Verified pitfall, worth restating**: the daily/weekly "still locked" vs "allowed again"
  timestamp math is easy to get backwards (a `last_cleared_at` from *earlier today* is still
  locked — the reset boundary is *tomorrow's* midnight, not today's; a timestamp from *2+ days
  ago* is unambiguously past the boundary regardless of current time-of-day). First draft had this
  inverted and was caught by actually running it, not by inspection.

- [x] **Step 2: Run and verify** — `npx supabase test db` → `21/21` pass (after fixing the timestamp
  direction and one fixture-reuse cross-contamination, both caught by real failures on first run).

- [x] **Step 3: Commit** (Task 9.)

---

### Task 7: `claim_group_stage.sql`

**Files:**
- Create: `supabase/tests/database/claim_group_stage.sql`

**Interfaces:**
- Consumes: `claim_group_stage(p_player uuid, p_kind text, p_def_key text, p_won boolean, p_char_updates jsonb, p_loot jsonb, p_currencies jsonb, p_resources jsonb, p_is_last_stage boolean, p_lifetime_stats jsonb default '{}'::jsonb) returns jsonb` (latest definition: `supabase/migrations/20260914100200_claim_group_stage_achievements.sql` — the 10-arg version with `p_lifetime_stats` and the unconditional `check_ascendant_milestones`/`check_achievements` calls, well beyond the original 9-arg migration's body).

- [x] **Step 1: Write the test file** — 14 assertions: not-claimable (no run / never started /
  not yet finished), the double-claim guard, win+not-last-stage advances `current_stage_index`,
  win+last-stage completes the run, loss keeps the same stage and frees the party, `char_updates`
  writes level/xp/current_hp, win applies loot (both a fresh inventory stack and incrementing an
  existing one) and currency/resource gains, a loss applies NONE of the above even when provided,
  `lifetime_stats` increments apply unconditionally (even on a loss — the loop runs after, not
  inside, the win-only block), and reaching level 50 via `char_updates` bumps
  `achievement_counters.charactersReachedLevelCap`. Full content:
  `supabase/tests/database/claim_group_stage.sql`.

- [x] **Step 2: Run and verify** — `npx supabase test db` → `14/14` pass.

- [x] **Step 3: Commit** (Task 9.)

---

### Task 8: Static `for update` check in `migration-policy.test.ts`

**Files:**
- Modify: `src/test/migration-policy.test.ts`

**Interfaces:**
- Consumes: nothing external — parses `supabase/migrations/*.sql` from disk, same as the file's
  existing three checks.
- Produces: a `latestFunctionBody: Map<string, string>` (function name → latest `create or
  replace function` body, last-definition-wins) and a `LOCKED_RPCS` constant (the same 6 names),
  both local to the file.

- [x] **Step 1: Write the check** — extract each function's latest full body (not just its
  signature, which the existing `functionReturnTypes` map already does) via a regex capturing
  through the matching `$$;`, then assert each of the 6 target RPCs' latest body contains
  `for update`.

- [x] **Step 2: Run and verify**

```bash
npx vitest run src/test/migration-policy.test.ts
```
Result: `6/6` pass (the pre-existing 5 plus this new one).

- [x] **Step 3: Run the full suite + lint + build**

```bash
npm test && npm run lint && npm run build
```
Result: `497/497` tests pass, lint clean, build clean.

- [x] **Step 4: Commit** (Task 9.)

---

### Task 9: Documentation + TODO/ADR closeout

**Files:**
- Create: `docs/TESTING.md`
- Modify: `CLAUDE.md` (one line in "Before committing")
- Modify: `docs/DECISIONS.md` (new ADR-0058; amend ADR-0048's consequences)
- Modify: `TODO.md` (flip the dungeon/raid test-coverage item to done)
- Modify: `docs/superpowers/specs/2026-09-08-dungeons-and-raids-design.md` (§10, point to ADR-0058)

- [x] **Step 1: Write `docs/TESTING.md`** — setup, the fixture pattern, the isolation rule, and the
  assertion-helper forms actually used (so the next person doesn't have to rediscover
  `throws_ok`'s argument overloads by trial and error, same as this task did).

- [x] **Step 2: Add one line to `CLAUDE.md`'s "Before committing" checklist** — PRs touching
  `supabase/migrations/` also run `npx supabase test db`; note neither that nor `npm test` is
  CI-gated.

- [x] **Step 3: Write ADR-0058** in `docs/DECISIONS.md` — decision, consequences, follow-ups
  (extending to `recruit_character`/`check_ascendant_milestones`/`check_achievements`).

- [x] **Step 4: Amend ADR-0048's consequences** — the `recruit_character` "no test infra" gap is
  no longer blocked; extending pgTAP to it is now a small follow-up.

- [x] **Step 5: Update the dungeons-and-raids spec §10** — past-tense the "no automated test
  coverage" line, point to ADR-0058 as the closure.

- [x] **Step 6: Flip `TODO.md`'s "Dungeon/raid server code has zero automated test coverage"
  item to `[x]`**, rewritten to state what was actually built.

- [x] **Step 7: Commit everything** (test files from Tasks 1-8 plus this task's docs, together)

```bash
git add supabase/tests/database/ src/test/migration-policy.test.ts package.json package-lock.json docs/TESTING.md CLAUDE.md docs/DECISIONS.md TODO.md docs/superpowers/specs/2026-09-08-dungeons-and-raids-design.md docs/superpowers/plans/2026-09-16-dungeon-raid-rpc-tests.md
git commit -m "test: pgTAP coverage for the 6 dungeon/raid-related RPCs (ADR-0058)"
```
