# Indefinite Skill Assignments — Design

**Date:** 2026-09-14
**Status:** Draft, approved by Alex section-by-section in chat, first instance = Religion/Church
**TODO reference:** TODO.md "Indefinite 'hone your skills' mission type (first instance: Religion/Church)"

## 1. Problem

Today every character activity has a fixed shape:

- **Missions** (`mission_runs`) — fixed duration, resolves win/loss, ends automatically.
- **Gathering** (`gather_assignments`) — continuous accrual of a *resource*, but tied to a scarce mine node (one gatherer per node).

Neither shape fits "send a character to train indefinitely, no fixed end, cash out whenever." The player wants a new archetype: assign a character to an open-ended activity (first instance: Church, training a "Religious" skill); XP accrues continuously for as long as they're assigned; the player manually stops the assignment to bank the accrued XP into that skill's level. This is explicitly wanted as a **generalizable pattern** ("implement this in more ways"), not a one-off Church feature.

## 2. Goals

- A generic indefinite-assignment system: assign a character to a **skill**, accrue XP continuously while assigned, collect/stop to bank it.
- Per-character, per-skill level/XP tracking, independent of the character's own `level`/`xp` (ADR-0016/leveling.ts) — a capped level-50 character can still grind skills; skill training never touches blessings, `LEVEL_CAP` gating, or combat balance.
- Adding a second skill type later (beyond Religion) is a one-line registry entry + a UI destination — no migration, no new RPC (ADR-0004).
- Ship the accrual/leveling/UI system now; leave *how a skill level affects character power* as an explicit, flagged-open follow-up (see §7).

## 3. Non-Goals

- **No stat/power effect in this pass.** The player has confirmed skill levels should eventually matter for character power, but the mapping mechanism is undecided and is real balance-design work of its own (touches `src/lib/stats.ts`, and per CLAUDE.md's Balance rule needs its own before/after sweep, regression test, and ADR). This spec only builds the tracking system the future mechanism will read from.
- No character-stat modifiers on the accrual rate itself (no "religionSpeed" stat, unlike gather's `gatherSpeed`/`gatherYield`). Flat rate from the registry only, v1.
- No UI surface on the Team/character-card page. Skill destinations get their own page only.
- No cross-character skill queries/leaderboards.

## 4. Design

### 4a. Data model

- **`player_characters.skills jsonb not null default '{}'`** — per-character map keyed by skill key: `{ "religion": { "level": 1, "xp": 0 } }`. Mirrors the existing `blessings`/`equipped` jsonb-on-character convention (ADR-0002 compute-on-read: this stores *intent* — the banked level/xp — not a derived stat value). A character with no entry for a skill is treated as `{ level: 1, xp: 0 }` (untrained), matching how character levels themselves start at 1.
- **New table `skill_assignments`** (mirrors `gather_assignments`): `id uuid pk, player_id uuid, player_character_id uuid, skill_key text, last_collected_at timestamptz`. One active assignment per character (enforced the same way `gather_assignments`/`mission_runs` busy-checks work today — see §4c). No per-skill-node scarcity constraint: unlike mines, Church has no "one gatherer per node" rule — any number of characters can each train independently at once, since the XP is per-character, not a shared pool.
- RLS/grants follow the existing convention: owner-read on `skill_assignments`, no client write; `player_characters.skills` covered by the table's existing RLS (already owner-scoped).

### 4b. Registry — `src/lib/skills.ts`

Deno-safe (imported by both client and Edge Functions, same constraint as `gather.ts`/`combat.ts`, ADR-0016/ADR-0019):

```ts
export type SkillDef = {
  skillKey: string
  label: string        // UI display name, e.g. "Religion"
  destination: string  // UI display name for the assignment location, e.g. "Church"
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

`intervalSec`/`xpPerTick` are starting values (2 ticks ≈ 1 minute to close the level 1→2 gap of 50 XP per `leveling.ts`'s curve), pending a real balance pass once this is playtested — same status as every other freshly-shipped numeric tuning in this codebase (docs/BALANCE.md governs changing them later, doesn't block shipping them now).

**Reuse, not reinvention:**
- Accrual math: `gather.ts`'s existing `accrue(elapsedMs, intervalSec, ratePerTick, speedPct, yieldPct)` is already generic (floor(elapsed/interval) × rate) — skill XP accrual calls it directly with `speedPct = yieldPct = 0` (no stat modifiers, §3). No new accrual function.
- Leveling curve: `leveling.ts`'s existing `applyXp`/`xpToNext`/`LEVEL_CAP` (capped at 50, `xpToNext(L) = round(50 × L^1.5)`) is reused verbatim for skill levels — same curve, same cap, zero new formula to maintain or drift from the character-level one.

Adding a new skill later = one entry in `SKILL_DEFS` + a UI destination card. No migration, no new RPC, no new Edge Function.

### 4c. SQL functions

**`start_skill(p_player uuid, p_char uuid, p_skill_key text) returns public.skill_assignments`** — mirrors `start_gather` (`gather_rpcs.sql`):
- Row-locks the character (`for update`), same serialization pattern as `start_gather`/`start_mission`.
- Validates owned + not downed.
- Busy-check across all three activity tables: `mission_runs`, `gather_assignments`, `skill_assignments`.
- Inserts `(p_player, p_char, p_skill_key)` with `last_collected_at = now()`.

**`collect_skill(p_player uuid, p_assignment_id uuid, p_skill_key text, p_new_level int, p_new_xp int, p_new_last_collected_at timestamptz, p_stop boolean) returns jsonb`** — mirrors `collect_gather`:
- Owned-check on the assignment.
- Writes `player_characters.skills = jsonb_set(skills, array[p_skill_key], jsonb_build_object('level', p_new_level, 'xp', p_new_xp))`.
- If `p_stop`: delete the assignment (frees the character). Else: advance `last_collected_at` to `p_new_last_collected_at` (partial-tick remainder carries over, same as gather).
- The new level/xp arrive **pre-computed** — the Edge Function calls `accrue()` + `applyXp()` in TypeScript (same division of labor `claim_mission`'s per-character level roll-up already uses: TS computes, SQL persists). SQL never recomputes the leveling curve.

**Cross-cutting change to existing RPCs** — not new code, but a required edit: `start_mission` (`mission_rpcs.sql`) and `start_gather` currently busy-check each other but not a third activity type. Both need one more `exists (select 1 from public.skill_assignments where ...)` clause. `start_group_stage` (`group_runs.sql`, dungeons/raids) needs the same addition — its exact current busy-check text gets confirmed when the plan is written.

Both new functions: `security definer`, pinned `search_path`, revoked from `public`/`anon`/`authenticated`, granted to `service_role` only — same lockdown every RPC in this codebase uses (ADR-0003).

### 4d. Edge Functions

`skill-start` / `skill-collect` — byte-for-byte the same shape as `gather-start`/`gather-collect`:
- Auth check (Bearer token → `admin.auth.getUser`).
- `skill-start`: validate `skillKey` against `SKILL_BY_KEY`, call `start_skill` RPC.
- `skill-collect`: load the assignment (owner-scoped), load the character's current `skills->skillKey` (default `{level: 1, xp: 0}` if absent), compute `accrue()` then `applyXp()` for the elapsed time, call `collect_skill` RPC with the resulting level/xp.
- No stat lookup (no gatherSpeed/gatherYield equivalent — §3).
- Reuse `_shared/cors.ts` / `_shared/supabaseAdmin.ts` unmodified, same as every other Edge Function.

### 4e. UI — `src/features/skills/`

New feature module (copies `missions/`/`gather/`'s shape):
- **`SkillsPage.tsx`** — lists skill destinations (Church/Religion first) as cards. Each card: an assign-a-character control (only characters not currently on a mission, gathering, or another skill assignment), and once assigned: a live elapsed-based XP progress bar toward the next level, current level number, a **Collect** button (bank accrued XP without unassigning — `p_stop = false`) and a **Stop & Cash Out** button (bank + free the character — `p_stop = true`). Same two-action split `gather-collect`'s existing `p_stop` flag already provides.
- `index.ts` barrel exporting `SkillsPage`.
- Route `/skills` in `App.tsx` (lazy import, same pattern as every other route), nav entry `{ label: 'Skills', to: '/skills' }` in `GameHeader`'s `NAV` array.
- `src/services/profile.ts`'s character-fetching path (wherever `player_characters` rows are currently mapped client-side) gains the new `skills` jsonb field on the character type.

Team page / character card: **not touched**. Surfacing skill levels there is a plausible fast-follow, not requested now (YAGNI).

## 5. Extensibility

Adding skill #2 (anything past Religion) requires:
1. One entry in `SKILL_DEFS` (`skillKey`, `label`, `destination`, `intervalSec`, `xpPerTick`).
2. One card in `SkillsPage.tsx`'s destination list (or the list already renders generically off `SKILL_DEFS` — plan decides which; rendering generically off the registry is the natural ADR-0004-consistent choice and avoids a per-skill UI edit entirely).

No migration, no new RPC, no new Edge Function, no touch to `start_mission`/`start_gather`/`start_group_stage` (their busy-check is against the `skill_assignments` table generically, not per skill_key).

## 6. Testing

Same standing constraint as every other SQL/Edge Function change this session: this repo has zero pgTAP/Deno test infrastructure.

- `src/lib/skills.ts`: Vitest coverage for the registry shape and any pure preview-math, mirroring `gather.ts`'s/`achievements.ts`'s existing test files.
- `start_skill`/`collect_skill`/the two Edge Functions: applied live, verified via manual RPC calls (representative cases: fresh assignment, partial collect, stop-and-cash-out, busy-check rejection from each of the three activity tables) — same "apply then byte-diff the deployed bundle" discipline used for every other Edge Function this session.
- The `start_mission`/`start_gather`/`start_group_stage` busy-check additions get a manual live-RPC check each (attempt to start a mission/gather while a skill assignment is active on that character; expect rejection).

## 7. Open Questions (explicitly deferred, not decided)

- **How does a skill level affect character power?** Confirmed it should, eventually — flat stat bonus per level, a threshold unlock, something else, and which stat(s) — all undecided. This is its own design pass (touches `stats.ts`, needs the Balance playbook: before/after sweep, regression test, ADR) and is **not** blocked by shipping this spec; the data model (`player_characters.skills`) already stores what a future stat-effect pass would read.
- Whether `SkillsPage` renders destinations generically off `SKILL_DEFS` or needs bespoke per-skill UI once a second skill exists (Religion is the only instance to observe right now — decide once #2 is designed).
- Whether Team/character-card should eventually surface skill levels read-only (fast-follow candidate, not requested).
