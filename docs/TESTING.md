# Testing

Two separate test suites, two separate tools. Don't conflate them.

## Frontend / TypeScript — Vitest

`npm test` (or `npm run test:watch`). Runs every `*.test.ts`/`*.test.tsx` under `src/`. Pure/mocked
— no database, no network. This is the suite `CLAUDE.md`'s "before committing" checklist means by
"`npm test` should pass."

## Postgres RPCs / SQL — pgTAP

Real behavioral tests for the SECURITY DEFINER RPCs in `supabase/migrations/` — locking, busy-checks,
state transitions, the things a mocked Supabase client in a Vitest test can't exercise. Local-only,
not CI-gated (see `docs/superpowers/specs/2026-09-16-dungeon-raid-rpc-tests-design.md` §2 for why).

**One-time setup:**
1. Install the Supabase CLI as a project dev dependency (already done — `npx supabase` just works):
   `npm install supabase --save-dev --save-exact`
2. Docker Desktop must be running (pgTAP runs inside the local Postgres container).
3. `npx supabase start` — spins up the local stack. First run pulls several images, takes a few
   minutes. Prints local API/DB URLs and keys when ready.
4. If the local database schema looks stale or wrong (missing columns that exist in
   `supabase/migrations/`), it's a leftover Docker volume from an old project state, not a real bug
   — `npx supabase db reset` rebuilds the local database from scratch against every current
   migration in `supabase/migrations/`.

**Running the tests:** `npx supabase test db` — discovers and runs every `.sql` file under
`supabase/tests/database/`. Each file runs inside its own transaction (`begin; ... rollback;`),
so there's no manual cleanup between runs and no risk of test data lingering.

**Writing a new test file — the fixture pattern:**

`profiles`/`player_characters`/etc. all foreign-key to `auth.users(id)`, and inserting into
`auth.users` fires the `handle_new_user()` trigger, which requires
`raw_user_meta_data->>'username'` (`profiles.username` is `NOT NULL`). The working pattern:

```sql
insert into auth.users (id, email, raw_user_meta_data)
values ('<uuid>', '<email>', jsonb_build_object('username', '<username>'));
-- profiles row now exists automatically, via the trigger. Customize it directly:
update public.profiles set currencies = jsonb_build_object('gold', 1000) where player_id = '<uuid>';

insert into public.player_characters (id, player_id, character_def_id, level)
values ('<char-uuid>', '<uuid>', 'test_char', 15);
```

**Critical isolation rule:** give a fresh player+character to every scenario that exercises a
busy-check, or whose success would leave a character "busy" for a scenario after it. The
busy-checks (`mission_runs`/`gather_assignments`/`infirmary_admissions`/`group_runs`/
`skill_assignments`) span the whole character, not one def_key — if scenario B reuses a character
that scenario A's call left busy (e.g. a successful `start_group_stage` leaves the party
non-empty), scenario B fails with a busy-check exception that has nothing to do with what it's
actually testing. This bit `start_group_stage.sql` during authoring; it's not hypothetical. It's
fine to reuse one fixture across a deliberate chain of validation-only calls that all throw before
touching state (e.g. equip_item.sql's early invalid-slot/invalid-rarity/level-gate checks), or
across an intentional sequential build-up against the same run/character — the rule is specifically
about not letting one scenario's *successful* busy-producing call bleed into an unrelated one.

**Assertion helpers actually used in this repo's test files** (see `supabase/tests/database/*.sql`
for real examples): `plan(n)` / `finish()` bookend every file; `throws_ok($$ sql $$)` (1-arg, any
exception) or `throws_ok($$ sql $$, 'exact message')` (3-arg with a description, exact match — no
plain 2-arg "any exception + custom description" overload exists, the 2nd arg is always treated as
an expected message/errcode); `is(actual, expected, 'description')` for single values;
`results_eq($$ query $$, $$ values (...) $$, 'description')` for multi-column/multi-row
comparisons. pgTAP also has `lives_ok(sql, description)` for asserting a call does NOT throw — not
currently used in this repo (every success path here is checked via `is()`/`results_eq()` on the
actual return value instead), but available if a future test needs it.

**Full RPC coverage today:** `start_group_stage`, `claim_group_stage`, `equip_item`,
`unequip_item`, `choose_blessing`, `respec_blessings` (ADR-0058). Extending this to other RPCs with
the same historical "no test infra" gap (`recruit_character`, `check_ascendant_milestones`,
`check_achievements`) is a separate, smaller follow-up now that the infra exists.
