# Dungeon/raid RPC test coverage — pgTAP infra design

**Date:** 2026-09-16 · **Status:** Draft (pending plan)

## 1. Context

`TODO.md` flags: `purchase_ascendant_shop_node`/`purchase_echo_shop_node`'s price race (fixed,
ADR-0057) sat next to a second, still-open item — the dungeon/raid server code (`group_runs` +
`start_group_stage`/`claim_group_stage`, plus four existing RPCs rewritten in the same migration
to add a `group_runs` busy-check: `equip_item`, `unequip_item`, `choose_blessing`,
`respec_blessings`) has **zero automated test coverage**. This is the same "no pgTAP/Deno test
infra" gap `recruit_character` was accepted to carry (ADR-0048), but on a bigger, more
security-relevant surface: six RPCs, all `SECURITY DEFINER`, all touching real player state
(party dispatch, gear, blessings, gold).

ADR-0048 named pgTAP and Deno as the two candidate technologies without deciding between them.
This spec makes that decision and scopes the first real test suite.

## 2. Decision

- **Tool: pgTAP via the Supabase CLI's local dev stack** (`supabase start` + `supabase test db`).
  pgTAP ships preinstalled in Supabase's local Postgres image — no extension install step. Test
  files are plain `.sql` under `supabase/tests/database/`, auto-discovered by `supabase test db`.
  Chosen over a Deno/Edge-Function-level suite because the actual risk in this codebase lives in
  the RPCs' SQL (locking, busy-checks, state transitions) — the Edge Functions calling them are
  thin parse-and-forward wrappers, already covered well enough by manual/code-review verification
  at every deploy this session. pgTAP also gives real transactional per-test isolation (each test
  file runs in its own transaction, auto-rolled-back), so no manual fixture cleanup between runs.
- **Not CI-gated.** This repo's existing 496-test Vitest suite isn't run in GitHub Actions either
  — `.github/workflows/lint.yml` only runs ESLint; `npm test` is a pre-commit discipline enforced
  by `CLAUDE.md`'s convention, not a CI check. The new pgTAP suite follows the same pattern: it
  exists, it gets run before committing/merging work that touches `supabase/migrations/`, it is
  not wired into GitHub Actions. Wiring Postgres/Docker into CI is a separate, larger decision this
  spec does not make.
- **Scope: exactly the 6 RPCs this TODO item names** — `start_group_stage`, `claim_group_stage`,
  `equip_item`, `unequip_item`, `choose_blessing`, `respec_blessings`. Older RPCs with the same
  known gap (`recruit_character`, `check_ascendant_milestones`, `check_achievements`) are out of
  scope here; once this infra exists, extending it to them is a small, separate, well-scoped task.
- **Concurrency-testing scope: sequential re-invocation, not multi-connection races.** A pgTAP test
  file runs inside one transaction, so it cannot hold two genuinely simultaneous connections
  fighting over the same row lock. What it tests instead, and what actually matters: call an RPC,
  then call it again in the same test, and assert the second call observes the first call's
  already-committed-within-transaction state and is correctly rejected (double-start, double-claim
  guards). This proves the property that actually broke twice in ADR-0054 — does the RPC read
  fresh locked state and act on it — without needing to prove Postgres's `for update` semantics
  themselves, which is a property of the database, not application code, and is cheaper to check
  statically (see §5).

## 3. File layout

```
supabase/tests/database/
  start_group_stage.sql
  claim_group_stage.sql
  group_runs_busy_check.sql   # shared pattern across equip_item/unequip_item/choose_blessing/respec_blessings
  equip_item.sql
  unequip_item.sql
  choose_blessing.sql
  respec_blessings.sql
```

One file per RPC for its own business logic (ownership, validation, state transitions), plus one
shared file for the `group_runs` busy-check pattern — the same 6-line "character is in a dungeon
or raid" guard, near-identical across four RPCs, parametrized over the four function names inside
one file rather than duplicated four times.

Run via `supabase test db` (requires `supabase start` already running locally — Docker Desktop
must be running; neither is installed/running in this session's environment, so implementation
will need that set up first, either by you or in a follow-up session with Docker available).

## 4. Test matrix

**`start_group_stage`:**
- Party: empty rejected; duplicate character rejected; a character not owned or downed rejected.
- Busy-checks: character on an active mission / gathering / in the infirmary / in *another*
  dungeon-or-raid run all reject with their respective messages.
- Map gate: `p_map_gate` given, `map_progress` below 7 → rejected; gate satisfied → allowed;
  `p_map_gate` null → gate skipped entirely.
- Fresh run: no existing `group_runs` row, `p_stage_index = 0` → creates the row
  (`status = 'in_progress'`, `current_stage_index = 0`, `stage_ends_at` set correctly from
  `p_duration_seconds`). Fresh run with `p_stage_index <> 0` → rejected ("no run in progress").
- **Double-start guard**: call once (stage now in flight), call again for the same run → second
  call rejected ("a stage is already in flight").
- Lockout: `status = 'complete'`, `last_cleared_at` before the next reset boundary → rejected;
  after the boundary → allowed and resets `current_stage_index` to 0, `status` to `'in_progress'`.
  Daily vs weekly cadence differ (weekly rounds to next Sunday UTC, not next midnight) — test both.
  Boundary cases constructed via `last_cleared_at` set relative to the test's own `now()` (not
  frozen time — Postgres's `now()` can't be overridden cheaply inside a single transaction test,
  so boundary timestamps are computed algebraically from the real `now()` at test-run time).
- Stage-index mismatch on an in-progress, not-in-flight run → rejected ("wrong stage index").

**`claim_group_stage`:**
- Not claimable: no run at all; run exists but `stage_ends_at` is null (never started); run exists
  but `stage_ends_at` is still in the future (not finished yet) — all three rejected with "not
  claimable".
- **Double-claim guard**: claim successfully once, claim again for the same run → second call
  rejected.
- Win, not last stage: `current_stage_index` increments by exactly 1, `party` cleared to `'{}'`,
  `stage_started_at`/`stage_ends_at` nulled, `status` stays `'in_progress'`.
- Win, last stage: `status` → `'complete'`, `last_cleared_at` set, `party` cleared.
- Loss: `current_stage_index` unchanged (retry-immediately semantics per spec §9), `party` cleared,
  timestamps nulled, `status` unchanged even for a never-cleared run's final boss (no lockout).
- `p_char_updates` writes `level`/`xp`/`current_hp` onto the named characters correctly.
- On win: loot upserts into `player_inventory` (both a fresh stack and incrementing an existing
  one), `currencies`/`resources` increment correctly on `profiles`. On loss: none of the above
  fire — confirm inventory/currencies/resources are untouched.
- Whatever this RPC's *current* SQL actually contains (verify against the latest migration at
  implementation time, not this snapshot) — ADR-0054/0055 mentioned later plumbing
  (`lifetime_stats`, achievement/milestone side effects) that may have landed here since this
  migration; the plan should re-read the live definition before finalizing this file's test list.

**`equip_item` / `unequip_item` / `choose_blessing` / `respec_blessings`:**
Full behavior each, not just the new busy-check line — these have never had any coverage:
- `equip_item`: slot-key validation, rarity validation, ownership, level-requirement gate, all four
  busy-checks (mission/gather/infirmary/group-run), inventory stack consumption (both "last one in
  the stack" delete and "decrement" paths), displaced-item-returned-to-inventory (including the
  same-item-re-equipped net-zero case), resulting `equipped` map shape.
- `unequip_item`: slot-key validation, ownership, all four busy-checks, empty-slot rejection, item
  returned to inventory (both fresh stack and incrementing an existing one), resulting map shape.
- `choose_blessing`: row/choice validation, level gate per row, immutability guard (row already
  chosen → rejected), strict sequence guard (row N before row N-1 → rejected), all four
  busy-checks, resulting `blessings` map shape.
- `respec_blessings`: ownership, no-op rejection (nothing to respec), all four busy-checks, gold
  balance check (insufficient → rejected, sufficient → deducted), tree wipe.
- Shared file (`group_runs_busy_check.sql`): for each of the four functions, a character with an
  active `group_runs` row (party contains them) → the call is rejected with that function's
  "character is in a dungeon or raid" message.

## 5. Companion static check

Add one assertion to the existing `src/test/migration-policy.test.ts` (which already parses
`supabase/migrations/*.sql` with no live database needed): every one of the 6 RPCs' `select ...`
that reads the row it's about to act on includes `for update`. This is the cheap, always-runs-in-
CI-adjacent-to-lint half of "is the lock even there" — pgTAP's job is "does the RPC use that locked
read correctly," not "is the syntax present," which a regex already answers for free.

## 6. Documentation follow-ups (part of implementation, not optional polish)

- New `docs/TESTING.md`: one-time local setup (install Supabase CLI, `supabase start` needs Docker
  Desktop running), the `supabase test db` run command, and where test files live.
- `CLAUDE.md`'s "Before committing" checklist gains one conditional line: PRs touching
  `supabase/migrations/` also run `supabase test db`.
- Once implemented: flip this TODO item to done, record as a new ADR (next number after 0057),
  and remove/update the "no pgTAP/Deno test infra" language currently repeated in `TODO.md`,
  ADR-0048's consequences, and the dungeons-and-raids spec §10 — all three currently assert a gap
  this closes.

## 7. Non-goals

- Not wired into GitHub Actions CI (§2).
- Does not cover `recruit_character`, `check_ascendant_milestones`, `check_achievements`, or any
  RPC outside the 6 named here — explicitly deferred, tracked as future follow-up work once this
  infra exists.
- Does not attempt genuine multi-connection concurrent-lock testing (§2) — sequential
  re-invocation only, with the "is `for update` present" question answered statically instead
  (§5).
- Does not add Edge-Function-level (Deno) tests — the Edge Functions in scope here are thin
  wrappers; their logic is exercised by the RPC tests plus the existing manual byte-verify
  discipline this repo already applies to every deploy.
