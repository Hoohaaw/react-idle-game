# Project audit and roadmap recommendation — 2026-09-09

Point-in-time snapshot produced by a Claude Code session on 2026-09-09 (two agents run in
parallel: an `explorer` briefing and a `code-reviewer` audit, findings hand-verified before
reporting). Facts below reflect `master` at merge of PR #91. Re-verify before acting on any
file/line citation.

---

## What the game is

Browser idle/incremental RPG. 19 hand-authored characters, real-time-combat missions (can fail,
damage persists), mines for passive gathering, 14-slot gear, bespoke blessing trees per
character, dungeons/raids (new, Sept 2026), transcendence prestige (stub). 3 maps live
(Gravemarch, Embercrag, Frosthollow), 21 missions.

**Stack:** React 19 + Vite + TypeScript strict, Zustand, TanStack Query, Tailwind v4. Sanity
holds authored content, Supabase holds player runtime. All writes are server-authoritative
through 15 Edge Functions + `SECURITY DEFINER` RPCs. Combat is a seeded deterministic
auto-battle sim, tuned via the offline harness (~4.7M fights per sweep).

## Development stage

Mid-development. Core loop live and deployed since July 2026. ~10k LOC, 208 source files,
31 test files, 20 migrations, 51 ADRs.

| Status | Areas |
|---|---|
| **Done** | missions, gathering, infirmary, recruiting, blessings + respec, gear, elemental schools, dungeons/raids engine |
| **In progress** | caster/healer weapon parity (ADR-0051 — new weapons overshoot, +43–47% vs +32% physical; decision pending); page migration to `src/features/` (9 done, 13 pages left) |
| **Unbuilt** | crafting (reads mock data, no Sanity recipe schema), transcendence reset (5-line stub), server-side test infra (zero coverage on RPCs/Edge Functions), real art, activity log |

## Audit result

Codebase notably clean. All core ADR rules verified **PASS**:

- no client gameplay writes anywhere (ADR-0003)
- no stored derived stats (ADR-0002)
- no cross-feature internal imports
- blessing capstone computed, never stored (ADR-0045)
- no `any`, no committed secrets, no XSS vectors
- race guards (`FOR UPDATE`, atomic conditional `DELETE`) present in RPCs

### CRITICAL (1)

**`supabase/migrations/20260908140000_group_runs.sql` — missing table grant.**
The table has RLS enabled and an owner-read policy, but no
`grant select on public.group_runs to authenticated`. RLS without a grant yields
"permission denied". Every other gameplay table has the grant. Client reads in
`src/services/groupContent.ts` (lines 36 and 44 at time of audit) drive the dungeon/raid UI
and the roster busy-state, so the read path is broken in production. The existing test missed
it because it mocks the Supabase client. Fix is a one-line migration.

### Minor

- `DesignPage.tsx` is 825 lines (style-guide page, low risk).
- 3 crafting organisms in the shared kit have a single consumer — move into the feature when
  crafting migrates to `src/features/crafting/`.
- Mock inventory/recipes (known placeholder).

## How to proceed — recommendation

Ordered by leverage:

1. **Fix the `group_runs` grant now.** `fix/group-runs-grant` branch, one migration, apply to
   the hosted project, verify the dungeons page loads. A shipped feature is currently broken;
   nothing else matters first.
2. **Add a thin integration-test layer for DB reads.** The grant bug escaped because tests mock
   the Supabase client. One smoke test hitting a real local Supabase (`supabase start` + seed)
   that exercises each table's authenticated read catches the whole class. Cheap, high value.
   The server RPC test gap (pgTAP or Deno tests for `claim_mission`, `claim_group_stage`, etc.)
   is the next tier — the biggest untested surface in the project, and it guards the money path.
3. **Close the ADR-0051 parity decision.** Half-open balance work blocks item authoring.
   Recommend retuning the weapons down to parity rather than compensating with a physical
   trinket — smaller blast radius, and the harness already proves the numbers.
4. **Build crafting for real.** Last core loop still on mocks: `recipeDef` Sanity schema, a
   craft Edge Function, and migrate the page to `src/features/crafting/` (pulling in those
   3 organisms) in the same effort. Turns a dead page into gameplay and retires the mock files.
5. **Transcendence after crafting.** Prestige is the retention hook but only pays once players
   exhaust content — crafting feeds progression sooner.
6. **Keep page migrations opportunistic**, per the existing rule: migrate a page when touched,
   not as a project. Exception: Inventory/Upgrades will likely be touched by crafting work —
   fold them in then.

**Rationale for the order:** fix broken production first, then invest in the test infra that
would have caught it (compounds on everything after), then unblock the stalled decision, then
the largest missing feature.

## Follow-up status

- 2026-09-10: item 4 started — `docs/superpowers/specs/2026-09-09-crafting-create-recipes-design.md`
  on branch `docs/crafting-create-recipes-design`. Item 1 (grant fix) not yet on `master`.
