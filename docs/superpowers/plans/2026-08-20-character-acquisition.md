# Character Acquisition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the character-acquisition economy — varied thematic unlock sources, a full-blind-surprise discovery model, a persistent hire pool, and the first-ever `/recruits` screen — replacing the `recruit` Edge Function's current zero-gate behavior.

**Architecture:** A new Sanity `acquisition` field on `characterDef` (gold cost + optional condition) drives eligibility. Passive conditions (level/stat/resource-total/gold-total/mission-time-total/map-completion) are evaluated inside `mission-claim` and `gather-collect` — the only two places player state changes in ways a condition could newly satisfy — using a new pure `evaluateCondition` function. A new lifetime-counters ledger (`profiles.lifetime_stats`) tracks totals that don't exist anywhere today. Newly-satisfied characters are written into `profiles.unlocked_characters` atomically inside the existing `claim_mission`/`collect_gather` RPCs and surfaced to the client as `newlyUnlocked` for an in-context surprise reveal. A new `recruit_character` RPC replaces the bare insert with an atomic unlock-check + gold-deduct + insert. A new `/recruits` route lists everything unlocked-but-not-owned.

**Tech Stack:** React 19 + Vite + TypeScript (strict), Zustand-free (TanStack Query for server state), Supabase (Postgres + Deno Edge Functions), Sanity (authored content), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-20-character-acquisition-design.md`

## Global Constraints

- Server-authoritative writes only (ADR-0003) — the client never computes or asserts unlock/ownership state; every check that gates a write happens in an Edge Function or RPC.
- Compute-on-read stats (ADR-0002) — `characterLevel`/`statThreshold` conditions are checked against live-computed values (`player_characters.level`, `effectiveStats()`), never a stored derived value.
- Registry-driven JSONB extensibility (ADR-0004) — `lifetime_stats` and `unlocked_characters` are JSONB columns keyed by code, not new tables; adding a tracked stat or a character needs no migration.
- Deno-imported `src/lib/*` modules use explicit `.ts` import extensions inside `supabase/functions/**` (see `mission-claim/index.ts`'s imports) — every new Edge Function import in this plan follows that convention.
- Full-blind-surprise (spec §2, §8): the client is **never** given data about a locked character — no count, no silhouette, no condition text. Every new client-facing type/query in this plan only ever carries data about *unlocked* characters.
- Every character always carries a `goldCost` regardless of condition type — a non-`gold` condition gates eligibility, it never replaces the price (spec §4).
- Once unlocked, a character is never re-locked or time-limited (spec §2) — `unlocked_characters` writes are additive-only, never cleared.
- Elemental-mastery and comeback-moment condition types are explicitly OUT of scope (spec §3, §12 — wave 2, needs the combat-change playbook). Do not add them.

---

## Task 1: `src/lib/lifetimeStats.ts` — the lifetime-counter registry

**Files:**
- Create: `src/lib/lifetimeStats.ts`
- Test: `src/lib/lifetimeStats.test.ts`

**Interfaces:**
- Produces: `LIFETIME_STAT_DEFS: LifetimeStatDef[]`, `LIFETIME_STAT_KEYS: string[]`, `LIFETIME_STAT_LABELS: Record<string, string>`, `resourceGatheredKey(resource: string): string`. Later tasks (3, 8, 10) use `resourceGatheredKey` to build the `resourceGathered.<Resource>` JSONB path key.

This mirrors `src/lib/currencies.ts` exactly (read it if you haven't — same `Def`/`_DEFS`/`_KEYS`/`_LABELS` shape), plus a per-resource key for every resource in `RESOURCE_SOURCE` (`src/lib/resources.ts`), which today has 9 entries (Wood, Copper, Stone, Coal, Iron, Silver, Bronze, Gold, Platinum).

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/lifetimeStats.test.ts
import { describe, it, expect } from 'vitest'
import { LIFETIME_STAT_DEFS, LIFETIME_STAT_KEYS, LIFETIME_STAT_LABELS, resourceGatheredKey } from './lifetimeStats'
import { RESOURCE_SOURCE } from './resources'

describe('LIFETIME_STAT_DEFS', () => {
  it('is a non-empty array', () => {
    expect(LIFETIME_STAT_DEFS.length).toBeGreaterThan(0)
  })

  it('every entry has a non-empty key and label', () => {
    for (const def of LIFETIME_STAT_DEFS) {
      expect(def.key.length).toBeGreaterThan(0)
      expect(def.label.length).toBeGreaterThan(0)
    }
  })

  it('all keys are unique', () => {
    const keys = LIFETIME_STAT_DEFS.map((d) => d.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('contains goldEarned and missionSecondsSent', () => {
    expect(LIFETIME_STAT_DEFS.find((d) => d.key === 'goldEarned')).toBeDefined()
    expect(LIFETIME_STAT_DEFS.find((d) => d.key === 'missionSecondsSent')).toBeDefined()
  })

  it('contains a resourceGathered.<key> entry for every resource in RESOURCE_SOURCE', () => {
    for (const resource of Object.keys(RESOURCE_SOURCE)) {
      expect(LIFETIME_STAT_DEFS.find((d) => d.key === `resourceGathered.${resource}`)).toBeDefined()
    }
  })
})

describe('LIFETIME_STAT_KEYS', () => {
  it('contains every key from LIFETIME_STAT_DEFS in the same order', () => {
    expect(LIFETIME_STAT_KEYS).toEqual(LIFETIME_STAT_DEFS.map((d) => d.key))
  })
})

describe('LIFETIME_STAT_LABELS', () => {
  it('maps every key to its corresponding label', () => {
    for (const def of LIFETIME_STAT_DEFS) {
      expect(LIFETIME_STAT_LABELS[def.key]).toBe(def.label)
    }
  })
})

describe('resourceGatheredKey', () => {
  it('builds the resourceGathered.<Resource> path key', () => {
    expect(resourceGatheredKey('Wood')).toBe('resourceGathered.Wood')
    expect(resourceGatheredKey('Copper')).toBe('resourceGathered.Copper')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/lifetimeStats.test.ts`
Expected: FAIL — `Cannot find module './lifetimeStats'` (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/lifetimeStats.ts
// The lifetime-counter registry — cumulative, increments-only totals that never existed anywhere
// in this codebase before (confirmed: mission_runs rows are DELETED on claim, gather_assignments
// only tracks the live cycle — there was no ledger). Backs the character-acquisition conditions
// that need a running total (resourceTotal / goldTotal / missionTimeTotal — docs/superpowers/specs/
// 2026-08-20-character-acquisition-design.md §5b). Mirrors src/lib/currencies.ts's registry shape:
// balances live in profiles.lifetime_stats (JSONB) keyed by `key`, an absent key means zero, so
// adding a tracked stat needs no migration.
//
// Unlike currencies/resources, spending never decrements these — they only ever go up.

import { RESOURCE_SOURCE } from './resources'

export type LifetimeStatDef = {
  key: string
  label: string
}

/** The JSONB key for "total of this resource ever gathered" — `resourceGathered.<Resource>`. */
export function resourceGatheredKey(resource: string): string {
  return `resourceGathered.${resource}`
}

export const LIFETIME_STAT_DEFS: LifetimeStatDef[] = [
  { key: 'goldEarned', label: 'Gold earned' },
  { key: 'missionSecondsSent', label: 'Time spent on missions' },
  ...Object.keys(RESOURCE_SOURCE).map((resource) => ({
    key: resourceGatheredKey(resource),
    label: `${resource} gathered`,
  })),
]

export const LIFETIME_STAT_KEYS: string[] = LIFETIME_STAT_DEFS.map((d) => d.key)

export const LIFETIME_STAT_LABELS: Record<string, string> = Object.fromEntries(
  LIFETIME_STAT_DEFS.map((d) => [d.key, d.label]),
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/lifetimeStats.test.ts`
Expected: PASS (all cases)

- [ ] **Step 5: Commit**

```bash
git add src/lib/lifetimeStats.ts src/lib/lifetimeStats.test.ts
git commit -m "feat: add lifetime-stats registry for acquisition conditions"
```

---

## Task 2: DB migration — `lifetime_stats` + `unlocked_characters` columns

**Files:**
- Create: `supabase/migrations/20260820100000_acquisition_ledger.sql`

**Interfaces:**
- Produces: `profiles.lifetime_stats jsonb` (increments-only ledger, keys from Task 1's registry), `profiles.unlocked_characters jsonb` (`{ "<charKey>": "<ISO timestamp>" }`). Tasks 7, 9 write to both; Task 13 reads `unlocked_characters` client-side.

Follow the comment style of `supabase/migrations/20260713090000_map_progression.sql` (read it — this migration is much smaller, just two `alter table` statements with the same level of comment thoroughness).

- [ ] **Step 1: Write the migration**

```sql
-- Character acquisition ledger (docs/superpowers/specs/2026-08-20-character-acquisition-design.md).
--
-- Two new registry-JSONB columns on profiles (ADR-0004 pattern — same shape as `currencies`,
-- `resources`, `map_progress`): adding a new tracked key needs no migration, only a code-registry
-- entry (src/lib/lifetimeStats.ts) or a new authored characterDef.
--
-- 1. lifetime_stats — cumulative totals that DON'T EXIST anywhere else in this schema. Confirmed:
--    mission_runs rows are DELETED on claim (20260612180001_activities.sql), and
--    gather_assignments only tracks the current live cycle (last_collected_at), not history. So
--    "total gold ever earned" / "total seconds spent on missions" / "total <resource> ever
--    gathered" have no other source. Increments-only — spending currencies/resources never
--    decrements this. Written by claim_mission (goldEarned, missionSecondsSent — this migration's
--    sibling 20260820120000) and collect_gather (resourceGathered.<key> — sibling 20260820130000).
--
-- 2. unlocked_characters — the canonical "is this character available to hire yet" record,
--    `{ "<charKey>": "<ISO timestamp first unlocked>" }`. A missing key means still locked. Per the
--    spec's full-blind-surprise rule, the client only ever reads its OWN unlocked_characters map —
--    it never queries "which characters are still locked" (there is no such query in this plan).
--    Additive-only: once a key is set it is never removed (a character is never re-locked).
alter table public.profiles
  add column lifetime_stats jsonb not null default '{}'::jsonb;

comment on column public.profiles.lifetime_stats is
  'Cumulative, increments-only totals used by character-acquisition conditions (goldEarned, missionSecondsSent, resourceGathered.<key> — src/lib/lifetimeStats.ts). Never decremented by spending. Written only by claim_mission / collect_gather (service role).';

alter table public.profiles
  add column unlocked_characters jsonb not null default '{}'::jsonb;

comment on column public.profiles.unlocked_characters is
  'Characters this player has unlocked (are eligible to hire) — { "<charKey>": "<ISO timestamp>" }. A missing key means still locked. Additive-only: never cleared once set. Written only by claim_mission / collect_gather / recruit_character (service role). No RLS change needed — the existing "profiles_select_own" owner-read policy already covers this column.';
```

- [ ] **Step 2: Verify the migration is well-formed SQL**

Run: `cd supabase && npx supabase db lint` (or, if that command isn't configured in this repo, at minimum eyeball the file against `20260713090000_map_progression.sql`'s two `alter table ... add column ... jsonb not null default '{}'::jsonb;` + `comment on column ...` pairs — same shape, same idempotent-default pattern). This repo's migrations are applied via `mcp__supabase__apply_migration` or the Supabase CLI during deployment, not run locally in this task — confirm the file parses by reading it back, no local Postgres needed for this step.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260820100000_acquisition_ledger.sql
git commit -m "feat: add profiles.lifetime_stats + unlocked_characters columns"
```

---

## Task 3: `src/lib/acquisition.ts` — condition types + pure evaluator

**Files:**
- Create: `src/lib/acquisition.ts`
- Test: `src/lib/acquisition.test.ts`

**Interfaces:**
- Consumes: nothing (pure, dependency-free — this file is imported by both Edge Functions, so it must stay Deno-safe like `src/lib/combat.ts`/`gather.ts`: no browser/node deps).
- Produces: `AcquisitionConditionType`, `AcquisitionCondition`, `CharacterAcquisition`, `PlayerAcquisitionState`, `evaluateCondition(condition: AcquisitionCondition | undefined, state: PlayerAcquisitionState): boolean`. Tasks 8 and 10 call `evaluateCondition` with a `PlayerAcquisitionState` they build from Sanity + profile + party data.

`evaluateCondition` checks `characterLevel`/`statThreshold` against **any one** of the characters passed in `state.characters` (spec §4: "any owned character") — but scoped to the characters whose state could have just changed in the calling Edge Function's own mutation (the party that just claimed a mission, or the single gatherer who just collected), not the player's entire roster. See Task 8's note for why this scoping is correct and where the real gap is (gear/blessing changes outside mission-claim).

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/acquisition.test.ts
import { describe, it, expect } from 'vitest'
import { evaluateCondition, type AcquisitionCondition, type PlayerAcquisitionState } from './acquisition'

const emptyState: PlayerAcquisitionState = {
  characters: [],
  lifetimeStats: {},
  mapProgress: {},
}

describe('evaluateCondition', () => {
  it('an undefined condition is always met (gold-only)', () => {
    expect(evaluateCondition(undefined, emptyState)).toBe(true)
  })

  describe('characterLevel', () => {
    const condition: AcquisitionCondition = { type: 'characterLevel', level: 10 }
    it('met when any character is at/above the level', () => {
      const state: PlayerAcquisitionState = { ...emptyState, characters: [{ level: 5, stats: {} }, { level: 10, stats: {} }] }
      expect(evaluateCondition(condition, state)).toBe(true)
    })
    it('not met when every character is below the level', () => {
      const state: PlayerAcquisitionState = { ...emptyState, characters: [{ level: 5, stats: {} }, { level: 9, stats: {} }] }
      expect(evaluateCondition(condition, state)).toBe(false)
    })
  })

  describe('statThreshold', () => {
    const condition: AcquisitionCondition = { type: 'statThreshold', stat: 'attack', threshold: 50 }
    it('met when any character has the stat at/above the threshold', () => {
      const state: PlayerAcquisitionState = { ...emptyState, characters: [{ level: 1, stats: { attack: 60 } }] }
      expect(evaluateCondition(condition, state)).toBe(true)
    })
    it('not met when no character has the stat', () => {
      const state: PlayerAcquisitionState = { ...emptyState, characters: [{ level: 1, stats: { attack: 10 } }] }
      expect(evaluateCondition(condition, state)).toBe(false)
    })
  })

  describe('resourceTotal', () => {
    const condition: AcquisitionCondition = { type: 'resourceTotal', resource: 'Wood', threshold: 500 }
    it('met when the lifetime resourceGathered total is at/above the threshold', () => {
      const state: PlayerAcquisitionState = { ...emptyState, lifetimeStats: { 'resourceGathered.Wood': 500 } }
      expect(evaluateCondition(condition, state)).toBe(true)
    })
    it('not met when below the threshold', () => {
      const state: PlayerAcquisitionState = { ...emptyState, lifetimeStats: { 'resourceGathered.Wood': 499 } }
      expect(evaluateCondition(condition, state)).toBe(false)
    })
  })

  describe('goldTotal', () => {
    const condition: AcquisitionCondition = { type: 'goldTotal', threshold: 10000 }
    it('met when lifetime goldEarned is at/above the threshold', () => {
      const state: PlayerAcquisitionState = { ...emptyState, lifetimeStats: { goldEarned: 10000 } }
      expect(evaluateCondition(condition, state)).toBe(true)
    })
    it('not met when below', () => {
      const state: PlayerAcquisitionState = { ...emptyState, lifetimeStats: { goldEarned: 9999 } }
      expect(evaluateCondition(condition, state)).toBe(false)
    })
  })

  describe('missionTimeTotal', () => {
    const condition: AcquisitionCondition = { type: 'missionTimeTotal', threshold: 3600 }
    it('met when lifetime missionSecondsSent is at/above the threshold', () => {
      const state: PlayerAcquisitionState = { ...emptyState, lifetimeStats: { missionSecondsSent: 3600 } }
      expect(evaluateCondition(condition, state)).toBe(true)
    })
    it('not met when below', () => {
      const state: PlayerAcquisitionState = { ...emptyState, lifetimeStats: { missionSecondsSent: 100 } }
      expect(evaluateCondition(condition, state)).toBe(false)
    })
  })

  describe('mapCompletion', () => {
    const condition: AcquisitionCondition = { type: 'mapCompletion', map: 'embercrag', stage: 7 }
    it('met when the map is cleared to at/above the stage', () => {
      const state: PlayerAcquisitionState = { ...emptyState, mapProgress: { embercrag: 7 } }
      expect(evaluateCondition(condition, state)).toBe(true)
    })
    it('not met when cleared less than the stage', () => {
      const state: PlayerAcquisitionState = { ...emptyState, mapProgress: { embercrag: 6 } }
      expect(evaluateCondition(condition, state)).toBe(false)
    })
    it('defaults the required stage to 7 (boss/full clear) when stage is omitted', () => {
      const cond: AcquisitionCondition = { type: 'mapCompletion', map: 'embercrag' }
      expect(evaluateCondition(cond, { ...emptyState, mapProgress: { embercrag: 6 } })).toBe(false)
      expect(evaluateCondition(cond, { ...emptyState, mapProgress: { embercrag: 7 } })).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/acquisition.test.ts`
Expected: FAIL — `Cannot find module './acquisition'`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/acquisition.ts
// Character acquisition — condition types + the pure evaluator. Deno-safe (no browser/node deps):
// imported by BOTH mission-claim and gather-collect Edge Functions with a `.ts` extension, same
// convention as combat.ts/gather.ts. See docs/superpowers/specs/2026-08-20-character-acquisition-
// design.md §4/§5a for the full design.
//
// `evaluateCondition` checks against the state the CALLING Edge Function can cheaply build from its
// own mutation — not the player's whole roster/history. characterLevel/statThreshold check the
// characters passed in (the party that just claimed, or the gatherer that just collected);
// resourceTotal/goldTotal/missionTimeTotal/mapCompletion check the player's lifetime totals /
// map progress. Every non-`gold` condition type from the spec is represented; elementalMastery and
// comebackMoment are OUT OF SCOPE (spec §3, §12 — wave 2).

export type AcquisitionConditionType =
  | 'characterLevel'
  | 'statThreshold'
  | 'resourceTotal'
  | 'goldTotal'
  | 'missionTimeTotal'
  | 'mapCompletion'

export type AcquisitionCondition = {
  type: AcquisitionConditionType
  level?: number // characterLevel
  stat?: string // statThreshold — a key from STAT_DEFS (src/lib/statDefinitions.ts)
  threshold?: number // statThreshold / resourceTotal / goldTotal / missionTimeTotal
  resource?: string // resourceTotal — a key from RESOURCE_SOURCE (src/lib/resources.ts)
  map?: string // mapCompletion — a mapKey
  stage?: number // mapCompletion — stage required cleared; defaults to 7 (boss/full map) if omitted
}

export type CharacterAcquisition = {
  goldCost: number
  condition?: AcquisitionCondition
}

/** One character's level + effective stats, for characterLevel/statThreshold checks. */
export type AcquisitionCharacterState = { level: number; stats: Record<string, number> }

/** Everything evaluateCondition needs, built fresh by the caller from live data — nothing here is
 *  ever stored as a derived value (ADR-0002). */
export type PlayerAcquisitionState = {
  /** The characters whose state could have just changed in this call (the mission party, or the
   *  single gatherer who just collected) — NOT the player's whole roster (see Task 8's note). */
  characters: AcquisitionCharacterState[]
  /** profiles.lifetime_stats, keyed exactly like src/lib/lifetimeStats.ts's LIFETIME_STAT_KEYS. */
  lifetimeStats: Record<string, number>
  /** profiles.map_progress, keyed by mapKey. */
  mapProgress: Record<string, number>
}

const DEFAULT_MAP_STAGE = 7 // boss/full clear, matches the game's fixed 7-stage map shape

export function evaluateCondition(
  condition: AcquisitionCondition | undefined,
  state: PlayerAcquisitionState,
): boolean {
  if (!condition) return true // gold-only, no precondition
  switch (condition.type) {
    case 'characterLevel':
      return state.characters.some((c) => c.level >= (condition.level ?? Infinity))
    case 'statThreshold':
      return state.characters.some(
        (c) => (c.stats[condition.stat ?? ''] ?? 0) >= (condition.threshold ?? Infinity),
      )
    case 'resourceTotal':
      return (
        (state.lifetimeStats[`resourceGathered.${condition.resource}`] ?? 0) >=
        (condition.threshold ?? Infinity)
      )
    case 'goldTotal':
      return (state.lifetimeStats.goldEarned ?? 0) >= (condition.threshold ?? Infinity)
    case 'missionTimeTotal':
      return (state.lifetimeStats.missionSecondsSent ?? 0) >= (condition.threshold ?? Infinity)
    case 'mapCompletion':
      return (
        (state.mapProgress[condition.map ?? ''] ?? 0) >= (condition.stage ?? DEFAULT_MAP_STAGE)
      )
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/acquisition.test.ts`
Expected: PASS (all cases)

- [ ] **Step 5: Commit**

```bash
git add src/lib/acquisition.ts src/lib/acquisition.test.ts
git commit -m "feat: add acquisition condition types + pure evaluator"
```

---

## Task 4: Sanity schema — `acquisition`/`acquisitionCondition` object types + `characterDef` field

**Files:**
- Create: `studio/schemaTypes/objects/acquisitionCondition.ts`
- Create: `studio/schemaTypes/objects/acquisition.ts`
- Modify: `studio/schemaTypes/characterDef.ts`
- Modify: `studio/schemaTypes/index.ts`

**Interfaces:**
- Produces: the `acquisition` field on every `characterDef` document: `{ goldCost: number, condition?: { type, level?, stat?, threshold?, resource?, map?, stage? } }`. Task 6 and the shared helper in Task 8 read this via GROQ.

Read `studio/schemaTypes/objects/itemStat.ts` and `studio/schemaTypes/objects/conditionTrigger.ts` first (both already reviewed in this plan's research — `conditionTrigger.ts`'s `type`-driven `rule.custom` validation on its `value` field is the exact pattern to mirror here, just with several typed params instead of one).

- [ ] **Step 1: Write `acquisitionCondition.ts`**

```typescript
// studio/schemaTypes/objects/acquisitionCondition.ts
import { defineType, defineField } from 'sanity'
import { STAT_DEFS } from '../../../src/lib/statDefinitions'
import { RESOURCE_SOURCE } from '../../../src/lib/resources'

// The precondition gating a character's eligibility to recruit (docs/superpowers/specs/
// 2026-08-20-character-acquisition-design.md §5a). Every character ALWAYS carries a goldCost
// (acquisition.ts) — this object is the OPTIONAL extra condition on top; absent = gold-only.
// elementalMastery/comebackMoment are deliberately NOT here — wave 2, needs combat-sim signal
// capture (spec §3/§12).

const STAT_OPTIONS = STAT_DEFS.map((s) => ({ title: s.label, value: s.key }))
const RESOURCE_OPTIONS = Object.keys(RESOURCE_SOURCE).map((r) => ({ title: r, value: r }))

const CONDITION_TYPES = [
  { title: 'Character reaches a level', value: 'characterLevel' },
  { title: 'Character reaches a stat threshold', value: 'statThreshold' },
  { title: 'Lifetime resource gathered', value: 'resourceTotal' },
  { title: 'Lifetime gold earned', value: 'goldTotal' },
  { title: 'Lifetime mission time', value: 'missionTimeTotal' },
  { title: 'Map/boss completion', value: 'mapCompletion' },
]

export const acquisitionCondition = defineType({
  name: 'acquisitionCondition',
  title: 'Unlock condition',
  type: 'object',
  fields: [
    defineField({
      name: 'type',
      title: 'Type',
      type: 'string',
      options: { list: CONDITION_TYPES },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'level',
      title: 'Level required',
      description: 'characterLevel only — any owned character must reach this level.',
      type: 'number',
      validation: (rule) =>
        rule.custom((value, context) => {
          const type = (context.parent as { type?: string } | undefined)?.type
          if (type === 'characterLevel') return typeof value === 'number' ? true : 'Required for this type'
          return value == null ? true : 'Only used by the characterLevel type'
        }),
    }),
    defineField({
      name: 'stat',
      title: 'Stat',
      description: 'statThreshold only — which stat must reach the threshold.',
      type: 'string',
      options: { list: STAT_OPTIONS },
      validation: (rule) =>
        rule.custom((value, context) => {
          const type = (context.parent as { type?: string } | undefined)?.type
          if (type === 'statThreshold') return value ? true : 'Required for this type'
          return value == null ? true : 'Only used by the statThreshold type'
        }),
    }),
    defineField({
      name: 'threshold',
      title: 'Threshold',
      description: 'statThreshold / resourceTotal / goldTotal / missionTimeTotal — the number to reach.',
      type: 'number',
      validation: (rule) =>
        rule.custom((value, context) => {
          const type = (context.parent as { type?: string } | undefined)?.type
          const needsThreshold = type === 'statThreshold' || type === 'resourceTotal' || type === 'goldTotal' || type === 'missionTimeTotal'
          if (needsThreshold) return typeof value === 'number' ? true : 'Required for this type'
          return value == null ? true : 'Only used by statThreshold/resourceTotal/goldTotal/missionTimeTotal'
        }),
    }),
    defineField({
      name: 'resource',
      title: 'Resource',
      description: 'resourceTotal only — which resource must be gathered in total.',
      type: 'string',
      options: { list: RESOURCE_OPTIONS },
      validation: (rule) =>
        rule.custom((value, context) => {
          const type = (context.parent as { type?: string } | undefined)?.type
          if (type === 'resourceTotal') return value ? true : 'Required for this type'
          return value == null ? true : 'Only used by the resourceTotal type'
        }),
    }),
    defineField({
      name: 'map',
      title: 'Map key',
      description: 'mapCompletion only — the mapKey that must be cleared.',
      type: 'string',
      validation: (rule) =>
        rule.custom((value, context) => {
          const type = (context.parent as { type?: string } | undefined)?.type
          if (type === 'mapCompletion') return value ? true : 'Required for this type'
          return value == null ? true : 'Only used by the mapCompletion type'
        }),
    }),
    defineField({
      name: 'stage',
      title: 'Stage required cleared',
      description: 'mapCompletion only — leave blank for 7 (boss/full map clear).',
      type: 'number',
      validation: (rule) =>
        rule.custom((value, context) => {
          const type = (context.parent as { type?: string } | undefined)?.type
          if (type !== 'mapCompletion' && value != null) return 'Only used by the mapCompletion type'
          if (value != null && (value < 1 || value > 7)) return 'Stage must be 1–7'
          return true
        }),
    }),
  ],
  preview: {
    select: { type: 'type', level: 'level', stat: 'stat', threshold: 'threshold', resource: 'resource', map: 'map' },
    prepare({ type, level, stat, threshold, resource, map }) {
      const detail =
        type === 'characterLevel' ? `Lv ${level}`
        : type === 'statThreshold' ? `${stat} ≥ ${threshold}`
        : type === 'resourceTotal' ? `${resource} ≥ ${threshold}`
        : type === 'goldTotal' ? `gold ≥ ${threshold}`
        : type === 'missionTimeTotal' ? `mission time ≥ ${threshold}s`
        : type === 'mapCompletion' ? `clear ${map}`
        : undefined
      return { title: type ?? '(no type)', subtitle: detail }
    },
  },
})
```

- [ ] **Step 2: Write `acquisition.ts`**

```typescript
// studio/schemaTypes/objects/acquisition.ts
import { defineType, defineField } from 'sanity'

// A character's acquisition price + optional unlock precondition (spec §5a). Referenced directly
// on characterDef, mirroring how `capstone` is a single `capstoneBlessing` object field (not an
// array) on the same document.
export const acquisition = defineType({
  name: 'acquisition',
  title: 'Acquisition',
  type: 'object',
  fields: [
    defineField({
      name: 'goldCost',
      title: 'Gold cost',
      description: 'Always required — every character has a price, even one gated by a condition.',
      type: 'number',
      validation: (rule) => rule.required().min(0),
    }),
    defineField({
      name: 'condition',
      title: 'Unlock condition',
      description: 'Leave blank for gold-only (no precondition, just costs gold once unlocked by default).',
      type: 'acquisitionCondition',
    }),
  ],
  preview: {
    select: { goldCost: 'goldCost', type: 'condition.type' },
    prepare({ goldCost, type }) {
      return { title: `${goldCost ?? '?'} gold`, subtitle: type ? `+ ${type}` : 'gold only' }
    },
  },
})
```

- [ ] **Step 3: Add the `acquisition` field to `characterDef`**

In `studio/schemaTypes/characterDef.ts`, add a field after `capstone` (the existing last field):

```typescript
    defineField({
      name: 'acquisition',
      title: 'Acquisition',
      description:
        'How this character is recruited: always a gold cost, optionally gated by a condition (level/stat/resource/gold/mission-time total, or map completion). Leave blank while unauthored — the recruit flow treats a missing acquisition as "not yet purchasable."',
      type: 'acquisition',
    }),
```

- [ ] **Step 4: Register both new types in `studio/schemaTypes/index.ts`**

```typescript
import { acquisitionCondition } from './objects/acquisitionCondition'
import { acquisition } from './objects/acquisition'
```

Add both to the `schemaTypes` array (alongside `capstoneBlessing`, `itemStat`, etc. — order doesn't matter, but keep the existing entries in place and append these two).

- [ ] **Step 5: Verify with the studio type-checker**

Run: `cd studio && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add studio/schemaTypes/objects/acquisitionCondition.ts studio/schemaTypes/objects/acquisition.ts studio/schemaTypes/characterDef.ts studio/schemaTypes/index.ts
git commit -m "feat: add acquisition + acquisitionCondition Sanity schema"
```

---

## Task 5: DB migration — `recruit_character` RPC

**Files:**
- Create: `supabase/migrations/20260820110000_recruit_character_rpc.sql`

**Interfaces:**
- Produces: `recruit_character(p_player uuid, p_character_def_id text, p_char_key text, p_gold_cost numeric, p_condition_exists boolean) returns public.player_characters`. Task 6 calls this.
- Consumes: `profiles.unlocked_characters`, `profiles.currencies` (both already exist — the latter since the original `profiles` migration).

**Contract:** the Edge Function has ALREADY determined (from Sanity) whether the character has a condition at all (`p_condition_exists`) and what its gold cost is (`p_gold_cost`) before calling this RPC. The RPC's job is purely the atomic, re-validated write:
- If `p_condition_exists`, re-check `unlocked_characters ? p_char_key` server-side (never trust the client / the Edge Function's own prior read — this is the re-validation the spec's §7 step 2 calls for).
- Always re-check `currencies.gold >= p_gold_cost`.
- Deduct gold, insert the `player_characters` row. If the insert hits the existing `UNIQUE(player_id, character_def_id)` constraint, the whole function raises (Postgres surfaces it as SQLSTATE 23505) and — because a Postgres function body is one implicit transaction — the gold deduction rolls back too. No special handling needed for that case; it's automatic.

Raises exceptions with a `recruit_character:` prefix, message body distinguishing the two application-level failures (`not unlocked yet`, `insufficient gold`) so Task 6's Edge Function can map each to the right HTTP status by matching the message body, same pattern `start_mission`/`claim_mission` already use (see `mission-start/index.ts`'s `rpcErr.message.replace(/^.*start_mission:\s*/, '')`).

- [ ] **Step 1: Write the migration**

```sql
-- recruit_character: the atomic recruit write (docs/superpowers/specs/2026-08-20-character-
-- acquisition-design.md §7). Replaces the bare INSERT the `recruit` Edge Function used to do
-- directly — now there's a real acquisition gate (unlock condition + gold cost) that must be
-- re-validated server-side in the same transaction as the write, not trusted from the client.
--
-- Contract: the calling Edge Function has ALREADY fetched the character's acquisition.goldCost and
-- whether it has a condition at all from Sanity — this RPC's job is the atomic re-validate + write:
--   - if p_condition_exists, unlocked_characters must contain p_char_key (server truth, not the
--     Edge Function's earlier read — re-checked here inside the same transaction as the write)
--   - currencies.gold must be >= p_gold_cost
--   - deduct gold, insert player_characters
-- The existing UNIQUE(player_id, character_def_id) constraint still enforces "one of each character,
-- ever" — a duplicate recruit attempt raises Postgres's own unique_violation (23505), and because
-- this whole function body is one implicit transaction, an aborted insert rolls back the gold
-- deduction too. No special handling needed for that case.
create or replace function public.recruit_character(
  p_player          uuid,
  p_character_def_id text,
  p_char_key         text,
  p_gold_cost        numeric,
  p_condition_exists boolean
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
   where player_id = p_player;
  if coalesce(v_gold, 0) < p_gold_cost then
    raise exception 'recruit_character: insufficient gold';
  end if;

  update public.profiles
     set currencies = jsonb_set(currencies, array['gold'], to_jsonb(v_gold - p_gold_cost))
   where player_id = p_player;

  insert into public.player_characters (player_id, character_def_id)
  values (p_player, p_character_def_id)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.recruit_character(uuid, text, text, numeric, boolean) from public, anon, authenticated;
grant execute on function public.recruit_character(uuid, text, text, numeric, boolean) to service_role;
```

- [ ] **Step 2: Verify against the existing pattern**

Read `supabase/migrations/20260707120000_gather_rpcs.sql`'s `start_gather` function side by side with the one written above — same `security definer` / `set search_path = public, pg_temp` / `revoke ... grant ... to service_role` shape. Confirm they match exactly (a mismatch here is a real security bug, not a style nit).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260820110000_recruit_character_rpc.sql
git commit -m "feat: add recruit_character RPC"
```

---

## Task 6: Rewrite `recruit`'s Edge Function to call `recruit_character`

**Files:**
- Modify: `supabase/functions/recruit/index.ts`

**Interfaces:**
- Consumes: `recruit_character` RPC (Task 5).
- Produces: the SAME response contract as today (`{ character: row }`, 201) — no client changes needed. `src/services/recruit.ts` is unmodified by this task (confirmed no `recruit.test.ts` exists to update either).

Note the existing function's `characterDefId` request field is misleadingly named — its value is actually the character's `charKey` string (the original code calls `characterDefExists(characterDefId)`, which queries `charKey == $id`). This task keeps that field name for client-compatibility but treats its value as the charKey internally, exactly like the code it replaces.

- [ ] **Step 1: Write the new implementation**

```typescript
// supabase/functions/recruit/index.ts
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'

// recruit: the atomic acquisition write (ADR-0003, docs/superpowers/specs/2026-08-20-character-
// acquisition-design.md §7). Fetches the character's acquisition (goldCost + whether it has an
// unlock condition) from Sanity, then hands off to the recruit_character RPC, which re-validates
// eligibility + gold server-side and does the atomic deduct+insert. Replaces the old zero-gate bare
// insert.

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type AcquisitionRow = {
  charKey: string
  acquisition?: { goldCost?: number; condition?: { type?: string } } | null
}

const ACQUISITION_GROQ = `*[_type == "characterDef" && charKey == $key][0]{
  charKey, acquisition{ goldCost, condition{ type } }
}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  const admin = createAdminClient()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
  const playerId = userData.user.id

  let body: { characterDefId?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  // NOTE: despite the field name, this is the character's charKey — the client/service layer names
  // it characterDefId for historical reasons (see src/services/recruit.ts), unchanged by this task.
  const characterDefId = body.characterDefId
  if (typeof characterDefId !== 'string' || characterDefId.length === 0) {
    return json({ error: 'characterDefId is required' }, 400)
  }

  let row: AcquisitionRow | null
  try {
    row = await sanityQuery<AcquisitionRow | null>(ACQUISITION_GROQ, { key: characterDefId })
  } catch (e) {
    console.error('Sanity acquisition lookup failed', e)
    return json({ error: 'Could not validate character' }, 502)
  }
  if (!row?.acquisition || typeof row.acquisition.goldCost !== 'number') {
    return json({ error: 'Unknown character' }, 404)
  }
  const goldCost = row.acquisition.goldCost
  const conditionExists = row.acquisition.condition != null

  const { data: charRow, error: rpcErr } = await admin.rpc('recruit_character', {
    p_player: playerId,
    p_character_def_id: characterDefId,
    p_char_key: characterDefId,
    p_gold_cost: goldCost,
    p_condition_exists: conditionExists,
  })

  if (rpcErr) {
    if (rpcErr.code === '23505') return json({ error: 'Character already recruited' }, 409)
    const reason = rpcErr.message.replace(/^.*recruit_character:\s*/, '')
    if (reason.includes('not unlocked')) return json({ error: reason }, 403)
    if (reason.includes('insufficient gold')) return json({ error: reason }, 402)
    console.error('recruit_character failed', rpcErr)
    return json({ error: reason || 'Could not recruit character' }, 500)
  }

  return json({ character: charRow }, 201)
})
```

- [ ] **Step 2: Verify with the Deno/TS check this repo already uses for Edge Functions**

Run: `cd supabase/functions && deno check recruit/index.ts` (if Deno is available locally; otherwise verify by reading the diff against `mission-start/index.ts`'s structure — same auth/body-parse/RPC-call/error-mapping shape, no divergence).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/recruit/index.ts
git commit -m "feat: wire recruit through the acquisition gate + recruit_character RPC"
```

---

## Task 7: DB migration — extend `claim_mission` for lifetime stats + unlocks

**Files:**
- Create: `supabase/migrations/20260820120000_claim_mission_acquisition.sql`

**Interfaces:**
- Consumes: `profiles.lifetime_stats`, `profiles.unlocked_characters` (Task 2).
- Produces: `claim_mission` gains two new params — `p_lifetime_stats jsonb default '{}'::jsonb` (key → increment amount) and `p_newly_unlocked text[] default '{}'` (charKeys to set into `unlocked_characters`, additive-only) — and its return value gains `actually_unlocked text[]` (the subset of `p_newly_unlocked` this specific call actually set, for idempotency — spec §10's race-condition handling). Task 8 calls this with the new params and reads `actually_unlocked` from the response.

Same drop-and-recreate pattern `20260713090000_map_progression.sql` used last time this function was extended. Read that migration's `claim_mission` definition IN FULL first — but its old-signature `drop function` line only has the OLD params, and blessings/traits/respec have added parameters SINCE then (this file predates ADR-0045). **Before writing this migration, grep `supabase/migrations/*.sql` for every `create or replace function public.claim_mission` and use the LATEST one's full parameter list for the `drop function` line** — do not copy the map_progression migration's drop line verbatim, it will be stale.

- [ ] **Step 1: Find the current `claim_mission` signature**

Run: `grep -rn "create or replace function public.claim_mission" supabase/migrations/*.sql`

Read whichever file is the LATEST match in full (by filename timestamp) to get the exact current parameter list and full function body — this is what you drop and what you preserve.

- [ ] **Step 2: Write the migration**

Use the parameter list you found in Step 1 for the `drop function` line below (shown here as the `(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, int, boolean)` signature from the map_progression migration — REPLACE this with whatever Step 1 actually found if it differs):

```sql
-- claim_mission: gains lifetime-stat increments + newly-unlocked-character writes (docs/superpowers/
-- specs/2026-08-20-character-acquisition-design.md §5b/§6/§10). The calling Edge Function
-- (mission-claim) computes both from data it already has (the gold reward + mission duration it's
-- about to grant, and which characterDefs it evaluated as newly-satisfied) — this migration only
-- adds the atomic WRITE of those two things into the SAME transaction as everything claim_mission
-- already does.
--
-- p_lifetime_stats: { "<key>": <amount to ADD> } — same atomic-increment pattern the existing
-- p_currencies/p_resources loops already use (jsonb_set + coalesce(...,0) + value).
--
-- p_newly_unlocked: charKeys to set into unlocked_characters, ADDITIVE-ONLY — a key already present
-- is left untouched (spec §10: a retried/duplicate call must not re-fire the surprise reveal). The
-- function tracks which keys IT actually set (as opposed to found already-present) and returns them
-- as `actually_unlocked` — the Edge Function only includes THOSE in the newlyUnlocked response, not
-- the full p_newly_unlocked list, so a duplicate/retried claim never re-surfaces an old reveal.
--
-- Preserves every existing behavior of claim_mission VERBATIM — double-claim guard, char updates,
-- loot upsert, currency/resource wallet increments, map-progress advancement. Only the two new
-- blocks are added, right before the final RETURN.
drop function public.claim_mission(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, int, boolean);

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
  v_already boolean;
  v_actually_unlocked text[] := '{}';
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
  if p_won and p_map_key is not null and p_stage is not null then
    update public.profiles
       set map_progress = jsonb_set(
             map_progress,
             array[p_map_key],
             to_jsonb(greatest(coalesce((map_progress ->> p_map_key)::int, 0), p_stage))
           )
     where player_id = p_player;
  end if;

  -- Lifetime stats: atomic increments (same pattern as currencies/resources above).
  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_lifetime_stats, '{}'::jsonb))
  loop
    update public.profiles
       set lifetime_stats = jsonb_set(lifetime_stats, array[v_key],
             to_jsonb(coalesce((lifetime_stats->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;

  -- Newly-unlocked characters: additive-only. Only report keys THIS call actually set, so a
  -- retried/duplicate call never re-fires the surprise reveal (spec §10).
  foreach v_key in array coalesce(p_newly_unlocked, '{}')
  loop
    select (unlocked_characters ? v_key) into v_already
      from public.profiles where player_id = p_player;
    if not coalesce(v_already, false) then
      update public.profiles
         set unlocked_characters = jsonb_set(unlocked_characters, array[v_key], to_jsonb(now()))
       where player_id = p_player;
      v_actually_unlocked := array_append(v_actually_unlocked, v_key);
    end if;
  end loop;

  return jsonb_build_object('claimed', true, 'party', v_party, 'actually_unlocked', v_actually_unlocked);
end;
$$;

revoke all on function public.claim_mission(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, int, boolean, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.claim_mission(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, int, boolean, jsonb, text[]) to service_role;
```

- [ ] **Step 2: Diff-check against the function you read in Step 1**

Confirm every line of the pre-existing body (double-claim guard through map-progression) is byte-for-byte identical to what Step 1 found, except for the two new blocks added before the final `return`. If Step 1's version differs from what's shown above (e.g. a blessing/trait-related block was added since), preserve THAT version's body instead — this migration must not silently drop behavior added after `20260713090000_map_progression.sql`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260820120000_claim_mission_acquisition.sql
git commit -m "feat: extend claim_mission for lifetime stats + character unlocks"
```

---

## Task 8: Wire condition evaluation into `mission-claim`

**Files:**
- Create: `supabase/functions/_shared/characterAcquisition.ts`
- Modify: `supabase/functions/mission-claim/index.ts`
- Modify: `src/services/missions.ts` (extend `ClaimResponse`)
- Modify: `src/features/missions/components/claimSamples.ts` (extend `ClaimResultView`)
- Modify: `src/features/missions/MissionsPage.tsx` (extend `buildClaimResult`)

**Interfaces:**
- Consumes: `evaluateCondition`, `PlayerAcquisitionState` (Task 3, `.ts` extension import); `claim_mission`'s new `p_lifetime_stats`/`p_newly_unlocked` params and `actually_unlocked` return field (Task 7).
- Produces: `mission-claim`'s response gains `newlyUnlocked: { charKey: string; name: string; role: string | null }[]`. Task 15 consumes this client-side.

**Scoping decision (read before writing code):** the spec's own §4 table says "any owned character" for `characterLevel`/`statThreshold`, but this task checks those conditions ONLY against the party that just claimed this mission — not the player's entire roster. This is deliberate, not a shortcut: a character's level only changes via `mission-claim` (XP grant), so any character NOT in this party has unchanged level/stats since the last time it WAS checked — if it already met a condition, that was already caught then. The one real gap this leaves: a character's *stats* can also change via `gear-equip` or `blessing-choose` (neither of which claims a mission), so equipping better gear can silently cross a `statThreshold` without ever triggering a reveal until that character's next mission claim. The spec's §6 trigger-point list only names `mission-claim`/`gather-collect` — wiring `gear-equip`/`blessing-choose` as additional trigger points is OUT OF SCOPE for this plan; note it as a known follow-up if raised in review.

- [ ] **Step 1: Write the shared Sanity helper**

```typescript
// supabase/functions/_shared/characterAcquisition.ts
import { sanityQuery } from './sanity.ts'

// Fetches characterDefs that have a real unlock CONDITION (not gold-only — those need no
// evaluation) and are not already unlocked, for mission-claim/gather-collect to evaluate against
// the player's just-updated state. Mirrors _shared/itemDefs.ts's style.

export type AcquisitionCandidate = {
  charKey: string
  name: string
  role: string | null
  condition: {
    type: string
    level?: number
    stat?: string
    threshold?: number
    resource?: string
    map?: string
    stage?: number
  }
}

const CANDIDATES_GROQ = `*[_type == "characterDef" && defined(acquisition.condition) && !(charKey in $unlocked)]{
  charKey, name, role,
  "condition": acquisition.condition{ type, level, stat, threshold, resource, map, stage }
}`

/** Characters with an unlock condition, not yet in `unlockedKeys`. Throws on Sanity failure. */
export async function fetchAcquisitionCandidates(unlockedKeys: string[]): Promise<AcquisitionCandidate[]> {
  return await sanityQuery<AcquisitionCandidate[]>(CANDIDATES_GROQ, { unlocked: unlockedKeys })
}
```

- [ ] **Step 2: Extend `mission-claim/index.ts`**

Add the import (alongside the existing `src/lib/*.ts` imports at the top):

```typescript
import { evaluateCondition, type PlayerAcquisitionState } from '../../../src/lib/acquisition.ts'
import { fetchAcquisitionCandidates } from '../_shared/characterAcquisition.ts'
```

In step 3 (loading the profile), select the two new columns too:

```typescript
  const { data: profile } = await admin
    .from('profiles')
    .select('transcendence_count, map_progress, lifetime_stats, unlocked_characters')
    .eq('player_id', playerId)
    .maybeSingle()
  const transcendenceCount = profile?.transcendence_count ?? 0
  const mapProgress = (profile?.map_progress ?? {}) as Record<string, number>
  const lifetimeStats = (profile?.lifetime_stats ?? {}) as Record<string, number>
  const unlockedCharacters = (profile?.unlocked_characters ?? {}) as Record<string, string>
```

**Placement matters here — read carefully.** `newlyUnlockedCharKeys`/`candidateByKey` must be declared BEFORE the existing step 10 (reward/loot section), because Task 12 pushes a character-loot-drop roll into them from INSIDE that section. But the condition-EVALUATION itself needs `currencies['gold']`, which step 10's reward loop computes — so evaluation must run AFTER step 10 completes, not before. Three separate insertion points in the same function:

**(a)** Right BEFORE the existing step 10 (`// 10. Wallet + loot (win only)...`), declare the two collections empty:

```typescript
  // Acquisition: filled in two places below — Task 12's character-loot-drop roll (inside step 10,
  // right after the item-loot loop) pushes here directly; the condition-evaluation block (after
  // step 10, once `currencies` is known) pushes here too. Both read/write the SAME two collections
  // so either source can unlock a character exactly once each.
  const newlyUnlockedCharKeys: string[] = []
  const candidateByKey = new Map<string, { name: string; role: string | null }>()
```

**(b)** Step 10 runs UNCHANGED (this task doesn't touch it — Task 12 is the one that adds to the end of it).

**(c)** Right AFTER step 10 ends (i.e. after the closing `}` of the `if (win) { ... }` reward/loot block, still before the existing step 11's RPC call), insert the condition-evaluation block, and change the RPC call to capture `data`, pass the two new params, and build `newlyUnlocked` from the RPC's `actually_unlocked` response:

```typescript
  // 10a. Acquisition: lifetime-stat deltas this claim contributes, and which not-yet-unlocked
  // characters this claim's post-state newly satisfies (docs/superpowers/specs/2026-08-20-
  // character-acquisition-design.md §6). Scoped to THIS party (see Task 8's scoping note in the
  // implementation plan) — a character's level/stats only change via mission-claim, so a character
  // outside this party has nothing new to check.
  const lifetimeStatsDelta: Record<string, number> = {}
  if (win) {
    const goldGranted = currencies['gold'] ?? 0
    if (goldGranted > 0) lifetimeStatsDelta.goldEarned = goldGranted
  }
  lifetimeStatsDelta.missionSecondsSent = result.durationSeconds

  const postClaimLifetimeStats: Record<string, number> = { ...lifetimeStats }
  for (const [key, delta] of Object.entries(lifetimeStatsDelta)) {
    postClaimLifetimeStats[key] = (postClaimLifetimeStats[key] ?? 0) + delta
  }
  const postClaimMapProgress =
    win && firstClear && mission.map?.mapKey && typeof mission.stage === 'number'
      ? { ...mapProgress, [mission.map.mapKey]: Math.max(mapProgress[mission.map.mapKey] ?? 0, mission.stage) }
      : mapProgress

  const acquisitionState: PlayerAcquisitionState = {
    characters: charUpdates.map((c) => ({ level: c.level, stats: statsById[c.id] ?? {} })),
    lifetimeStats: postClaimLifetimeStats,
    mapProgress: postClaimMapProgress,
  }

  try {
    const candidates = await fetchAcquisitionCandidates(Object.keys(unlockedCharacters))
    for (const c of candidates) {
      if (!candidateByKey.has(c.charKey)) candidateByKey.set(c.charKey, { name: c.name, role: c.role })
      if (!newlyUnlockedCharKeys.includes(c.charKey) && evaluateCondition(c.condition, acquisitionState)) {
        newlyUnlockedCharKeys.push(c.charKey)
      }
    }
  } catch (e) {
    // Acquisition evaluation must never block a claim from completing — log and continue with none.
    console.error('acquisition candidate fetch failed — skipping unlock checks this claim', e)
  }

  // 11. Apply everything atomically (the RPC owns the double-claim guard). Map progression
  //     (ADR-0034) advances inside the RPC on a win; null map/stage = legacy mission, no-op.
  const { data: claimData, error: claimErr } = await admin.rpc('claim_mission', {
    p_player: playerId,
    p_run_id: run.id,
    p_char_updates: charUpdates,
    p_loot: loot,
    p_currencies: currencies,
    p_resources: resources,
    p_map_key: mission.map?.mapKey ?? null,
    p_stage: mission.stage ?? null,
    p_won: result.outcome === 'win',
    p_lifetime_stats: lifetimeStatsDelta,
    p_newly_unlocked: newlyUnlockedCharKeys,
  })
  if (claimErr) {
    // Most likely the double-claim guard: the row was already claimed or isn't finished.
    console.error('claim_mission failed', claimErr)
    const reason = claimErr.message.replace(/^.*claim_mission:\s*/, '')
    return json({ error: reason || 'Could not claim mission' }, 409)
  }

  const actuallyUnlocked = ((claimData as { actually_unlocked?: string[] } | null)?.actually_unlocked ?? [])
  const newlyUnlocked = actuallyUnlocked.map((charKey) => ({
    charKey,
    name: candidateByKey.get(charKey)?.name ?? charKey,
    role: candidateByKey.get(charKey)?.role ?? null,
  }))
```

Replace the OLD `const { error: claimErr } = await admin.rpc('claim_mission', { ... })` call (the original step 11) with the new call shown in **(c)** above (same params plus the two new ones, and `data:` now captured) — do not leave both versions.

Finally, add `newlyUnlocked` to the response object at the bottom of the function:

```typescript
  return json(
    {
      outcome: result.outcome,
      reason: result.reason,
      survivingHpPct: result.survivingHpPct,
      durationSeconds: result.durationSeconds,
      firstClear,
      rewards: { currencies, resources, loot },
      characters: charUpdates,
      newlyUnlocked,
    },
    200,
  )
```

- [ ] **Step 3: Extend the client-side `ClaimResponse` type**

In `src/services/missions.ts`, add to `ClaimResponse`:

```typescript
export type ClaimResponse = {
  outcome: 'win' | 'loss'
  reason: 'enemies-defeated' | 'party-wiped' | 'timeout'
  survivingHpPct: number
  durationSeconds: number
  firstClear?: boolean
  rewards: {
    currencies: Record<string, number>
    resources: Record<string, number>
    loot: { item_def_id: string; rarity: string; quantity: number }[]
  }
  characters: { id: string; level: number; xp: number; current_hp: number }[]
  newlyUnlocked: { charKey: string; name: string; role: string | null }[]
}
```

- [ ] **Step 4: Extend `ClaimResultView` and `buildClaimResult`**

In `src/features/missions/components/claimSamples.ts`, add to `ClaimResultView`:

```typescript
export type NewRecruitReveal = { charKey: string; name: string; role: string | null }

export type ClaimResultView = {
  // ...existing fields unchanged...
  newlyUnlocked: NewRecruitReveal[]
}
```

Add `newlyUnlocked: []` to `SAMPLE_CLAIM_WIN`, `SAMPLE_CLAIM_LOSS`, and `SAMPLE_CLAIM_WIPE` (a loss never unlocks anything, but the field must always be present on the type).

In `src/features/missions/MissionsPage.tsx`'s `buildClaimResult`, add `newlyUnlocked: resp.newlyUnlocked` to the returned object (pass the Edge Function's data straight through — no transformation needed, the shapes already match).

- [ ] **Step 5: Run the existing test suite to confirm nothing broke**

Run: `npm test -- --run src/features/missions`
Expected: PASS. `ClaimReward.test.tsx` renders `SAMPLE_CLAIM_WIN`/`SAMPLE_CLAIM_LOSS`/`SAMPLE_CLAIM_WIPE` — since Task 15 (not this task) adds the actual rendering of `newlyUnlocked`, this task only needs the TYPE to be satisfied; if `ClaimReward.test.tsx` snapshot-asserts on the full object shape, update its expected fixtures to include `newlyUnlocked: []`.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/characterAcquisition.ts supabase/functions/mission-claim/index.ts src/services/missions.ts src/features/missions/components/claimSamples.ts src/features/missions/MissionsPage.tsx
git commit -m "feat: evaluate acquisition conditions on mission claim"
```

---

## Task 9: DB migration — extend `collect_gather` for lifetime stats + unlocks

**Files:**
- Create: `supabase/migrations/20260820130000_collect_gather_acquisition.sql`

**Interfaces:**
- Consumes: `profiles.lifetime_stats`, `profiles.unlocked_characters` (Task 2).
- Produces: `collect_gather` gains `p_lifetime_stats jsonb default '{}'::jsonb` and `p_newly_unlocked text[] default '{}'`, return value gains `actually_unlocked text[]` — same contract as Task 7's `claim_mission` extension. Task 10 calls this.

Full current definition already read in this plan's research (`supabase/migrations/20260707120000_gather_rpcs.sql`) — `collect_gather` hasn't been touched since, so no "find the latest version" step is needed here (unlike Task 7's `claim_mission`, which had intervening changes). Still, grep first to be certain before writing the drop line:

- [ ] **Step 1: Confirm `collect_gather` hasn't changed since `20260707120000_gather_rpcs.sql`**

Run: `grep -rln "create or replace function public.collect_gather" supabase/migrations/*.sql`
Expected: only `20260707120000_gather_rpcs.sql` matches. If a later file also matches, read IT instead and use its signature/body as the base for this migration.

- [ ] **Step 2: Write the migration**

```sql
-- collect_gather: gains lifetime-stat increments + newly-unlocked-character writes, same shape as
-- claim_mission's extension (20260820120000_claim_mission_acquisition.sql — read that migration's
-- comment for the full rationale). p_lifetime_stats here only ever carries a single
-- resourceGathered.<key> entry (the resource just collected) — gather-collect can't satisfy any
-- OTHER condition type in one call.
drop function public.collect_gather(uuid, uuid, text, int, timestamptz, boolean);

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
  v_already boolean;
  v_actually_unlocked text[] := '{}';
begin
  -- Guard: the assignment exists + is owned.
  select count(*) into v_owned
    from public.gather_assignments
   where id = p_assignment_id and player_id = p_player;
  if v_owned <> 1 then
    raise exception 'collect_gather: assignment not found or not owned';
  end if;

  -- Credit banked resources into the JSONB wallet (skip a no-op zero collect).
  if p_gained > 0 then
    update public.profiles
       set resources = jsonb_set(resources, array[p_resource],
             to_jsonb(coalesce((resources->>p_resource)::numeric, 0) + p_gained))
     where player_id = p_player;
  end if;

  if p_stop then
    -- Stop = collect the remainder, then free the character.
    delete from public.gather_assignments where id = p_assignment_id and player_id = p_player;
  else
    update public.gather_assignments
       set last_collected_at = p_new_last_collected_at
     where id = p_assignment_id and player_id = p_player;
  end if;

  -- Lifetime stats: atomic increments.
  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_lifetime_stats, '{}'::jsonb))
  loop
    update public.profiles
       set lifetime_stats = jsonb_set(lifetime_stats, array[v_key],
             to_jsonb(coalesce((lifetime_stats->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;

  -- Newly-unlocked characters: additive-only, same idempotent pattern as claim_mission.
  foreach v_key in array coalesce(p_newly_unlocked, '{}')
  loop
    select (unlocked_characters ? v_key) into v_already
      from public.profiles where player_id = p_player;
    if not coalesce(v_already, false) then
      update public.profiles
         set unlocked_characters = jsonb_set(unlocked_characters, array[v_key], to_jsonb(now()))
       where player_id = p_player;
      v_actually_unlocked := array_append(v_actually_unlocked, v_key);
    end if;
  end loop;

  return jsonb_build_object('gained', p_gained, 'resource', p_resource, 'stopped', p_stop, 'actually_unlocked', v_actually_unlocked);
end;
$$;

revoke all on function public.collect_gather(uuid, uuid, text, int, timestamptz, boolean, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.collect_gather(uuid, uuid, text, int, timestamptz, boolean, jsonb, text[]) to service_role;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260820130000_collect_gather_acquisition.sql
git commit -m "feat: extend collect_gather for lifetime stats + character unlocks"
```

---

## Task 10: Wire condition evaluation into `gather-collect`

**Files:**
- Modify: `supabase/functions/gather-collect/index.ts`
- Modify: `src/services/gather.ts` (extend `CollectResult`)

**Interfaces:**
- Consumes: `evaluateCondition` (Task 3), `fetchAcquisitionCandidates` (Task 8's shared helper), `collect_gather`'s new params (Task 9).
- Produces: `gather-collect`'s response gains `newlyUnlocked: { charKey: string; name: string; role: string | null }[]`. Task 15 consumes this client-side.

Scoped to `resourceTotal` conditions ONLY, for the specific resource just collected — a gather-collect can't satisfy `characterLevel`/`statThreshold`/`goldTotal`/`missionTimeTotal`/`mapCompletion` (none of those change here), so there's no need to fetch or evaluate those candidate types at all.

- [ ] **Step 1: Extend `gather-collect/index.ts`**

Add imports:

```typescript
import { evaluateCondition, type PlayerAcquisitionState } from '../../../src/lib/acquisition.ts'
import { fetchAcquisitionCandidates } from '../_shared/characterAcquisition.ts'
```

Right after loading `assignment` (before the `mine` lookup), also load the profile's lifetime stats + unlocked characters:

```typescript
  const { data: profile } = await admin
    .from('profiles')
    .select('lifetime_stats, unlocked_characters')
    .eq('player_id', playerId)
    .maybeSingle()
  const lifetimeStats = (profile?.lifetime_stats ?? {}) as Record<string, number>
  const unlockedCharacters = (profile?.unlocked_characters ?? {}) as Record<string, string>
```

Replace the final RPC call + response with:

```typescript
  const lifetimeStatsDelta: Record<string, number> =
    gained > 0 ? { [`resourceGathered.${assignment.resource_id}`]: gained } : {}

  let newlyUnlockedCharKeys: string[] = []
  let candidateByKey = new Map<string, { name: string; role: string | null }>()
  if (gained > 0) {
    try {
      const postCollectLifetimeStats = { ...lifetimeStats }
      for (const [key, delta] of Object.entries(lifetimeStatsDelta)) {
        postCollectLifetimeStats[key] = (postCollectLifetimeStats[key] ?? 0) + delta
      }
      const acquisitionState: PlayerAcquisitionState = {
        characters: [],
        lifetimeStats: postCollectLifetimeStats,
        mapProgress: {},
      }
      const candidates = await fetchAcquisitionCandidates(Object.keys(unlockedCharacters))
      const relevant = candidates.filter(
        (c) => c.condition.type === 'resourceTotal' && c.condition.resource === assignment.resource_id,
      )
      candidateByKey = new Map(relevant.map((c) => [c.charKey, { name: c.name, role: c.role }]))
      newlyUnlockedCharKeys = relevant
        .filter((c) => evaluateCondition(c.condition, acquisitionState))
        .map((c) => c.charKey)
    } catch (e) {
      console.error('acquisition candidate fetch failed — skipping unlock checks this collect', e)
    }
  }

  const { data: rpcData, error: rpcErr } = await admin.rpc('collect_gather', {
    p_player: playerId,
    p_assignment_id: assignment.id,
    p_resource: assignment.resource_id,
    p_gained: gained,
    p_new_last_collected_at: newLastCollectedAt,
    p_stop: stop,
    p_lifetime_stats: lifetimeStatsDelta,
    p_newly_unlocked: newlyUnlockedCharKeys,
  })
  if (rpcErr) {
    console.error('collect_gather failed', rpcErr)
    const reason = rpcErr.message.replace(/^.*collect_gather:\s*/, '')
    return json({ error: reason || 'Could not collect' }, 409)
  }

  const actuallyUnlocked = ((rpcData as { actually_unlocked?: string[] } | null)?.actually_unlocked ?? [])
  const newlyUnlocked = actuallyUnlocked.map((charKey) => ({
    charKey,
    name: candidateByKey.get(charKey)?.name ?? charKey,
    role: candidateByKey.get(charKey)?.role ?? null,
  }))

  return json({ gained, resource: assignment.resource_id, stopped: stop, newlyUnlocked }, 200)
```

Remove the OLD `const { error: rpcErr } = await admin.rpc('collect_gather', { ... })` block and the old bare `return json({ gained, resource: assignment.resource_id, stopped: stop }, 200)` — replaced by the block above.

- [ ] **Step 2: Extend the client-side `CollectResult` type**

In `src/services/gather.ts`:

```typescript
export type CollectResult = {
  gained: number
  resource: string
  stopped: boolean
  newlyUnlocked: { charKey: string; name: string; role: string | null }[]
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/gather-collect/index.ts src/services/gather.ts
git commit -m "feat: evaluate resourceTotal acquisition conditions on gather collect"
```

---

## Task 11: Sanity schema — `characterLootDrop` object + `missionDef` field

**Files:**
- Create: `studio/schemaTypes/objects/characterLootDrop.ts`
- Modify: `studio/schemaTypes/missionDef.ts`
- Modify: `studio/schemaTypes/index.ts`

**Interfaces:**
- Produces: `missionDef.characterLootDrop[]`, each `{ character: reference, dropChance: number }`. Task 12 rolls this.

Mirrors `lootDrop.ts` (already read in this plan's research) but simpler — no rarity weights or quantity (a character isn't rarity-rolled or stackable).

- [ ] **Step 1: Write `characterLootDrop.ts`**

```typescript
// studio/schemaTypes/objects/characterLootDrop.ts
import { defineType, defineField } from 'sanity'

// A rare "recruitment token" loot line — a character named on a mission's loot table, rolled
// independently on a win alongside item loot (docs/superpowers/specs/2026-08-20-character-
// acquisition-design.md §6). No rarity weights or quantity (a character isn't rarity-rolled or
// stackable) — mirrors lootDrop.ts's shape, simplified.
export const characterLootDrop = defineType({
  name: 'characterLootDrop',
  title: 'Character loot drop',
  type: 'object',
  fields: [
    defineField({
      name: 'character',
      title: 'Character',
      type: 'reference',
      to: [{ type: 'characterDef' }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'dropChance',
      title: 'Drop chance (%)',
      description: 'Independent probability this character unlocks on a win (rolled once, separately from item loot).',
      type: 'number',
      initialValue: 1,
      validation: (rule) => rule.required().min(0).max(100),
    }),
  ],
  preview: {
    select: { name: 'character.name', chance: 'dropChance' },
    prepare({ name, chance }) {
      return { title: name || '(no character selected)', subtitle: chance != null ? `${chance}% drop` : undefined }
    },
  },
})
```

- [ ] **Step 2: Add the field to `missionDef.ts`**

Add after the existing `loot` field in the `rewards` fieldset:

```typescript
    defineField({
      name: 'characterLootDrop',
      title: 'Character loot table',
      description:
        'Rare "recruitment token" drops — a character named here can unlock on a win, independent of item loot.',
      type: 'array',
      of: [defineArrayMember({ type: 'characterLootDrop' })],
      fieldset: 'rewards',
    }),
```

(`defineArrayMember` is already imported at the top of `missionDef.ts`.)

- [ ] **Step 3: Register in `studio/schemaTypes/index.ts`**

```typescript
import { characterLootDrop } from './objects/characterLootDrop'
```

Add to the `schemaTypes` array.

- [ ] **Step 4: Verify**

Run: `cd studio && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add studio/schemaTypes/objects/characterLootDrop.ts studio/schemaTypes/missionDef.ts studio/schemaTypes/index.ts
git commit -m "feat: add characterLootDrop mission loot schema"
```

---

## Task 12: Roll `characterLootDrop` in `mission-claim`

**Files:**
- Modify: `supabase/functions/mission-claim/index.ts`

**Interfaces:**
- Consumes: `missionDef.characterLootDrop[]` (Task 11).
- Produces: extends the `newlyUnlockedCharKeys` list Task 8 already builds, before the RPC call.

Rolled with the SAME seeded `lootRng` stream the item-loot loop already uses (deterministic/replayable, consistent with the rest of the sim) — sequentially, right after the item-loot loop, still inside the `if (win) { ... }` block.

- [ ] **Step 1: Extend the `MISSION_GROQ` query**

Add `characterLootDrop[]{ dropChance, "charKey": character->charKey }` to `MISSION_GROQ`'s selection (alongside the existing `loot[]{...}` line), and add the matching field to the `MissionForClaim` type:

```typescript
type MissionForClaim = {
  // ...existing fields unchanged...
  characterLootDrop?: { charKey: string | null; dropChance?: number }[]
}
```

- [ ] **Step 2: Roll it inside the `if (win)` block**

Immediately after the existing `for (const drop of mission.loot ?? []) { ... }` loop (still inside `if (win) { ... }`, still using the same `lootRng`), add:

```typescript
    for (const drop of mission.characterLootDrop ?? []) {
      if (!drop.charKey) continue
      if (unlockedCharacters[drop.charKey]) continue // already unlocked — don't waste the roll
      if (newlyUnlockedCharKeys.includes(drop.charKey)) continue // already unlocked earlier this same claim
      const chance = Math.min(100, drop.dropChance ?? 0)
      if (lootRng() * 100 >= chance) continue
      newlyUnlockedCharKeys.push(drop.charKey)
      if (!candidateByKey.has(drop.charKey)) {
        // Not already in candidateByKey (it only holds CONDITION-gated characters) — fetch its
        // name/role for the reveal. A single extra Sanity call, only on an actual drop (rare).
        try {
          const row = await sanityQuery<{ name?: string; role?: string | null } | null>(
            `*[_type == "characterDef" && charKey == $key][0]{ name, role }`,
            { key: drop.charKey },
          )
          if (row) candidateByKey.set(drop.charKey, { name: row.name ?? drop.charKey, role: row.role ?? null })
        } catch (e) {
          console.error('character loot-drop name lookup failed', e)
        }
      }
    }
```

This relies on Task 8's placement **(a)**: `newlyUnlockedCharKeys`/`candidateByKey` are already declared (empty) right before this reward/loot section runs, so this loop pushes into the same collections Task 8's later condition-evaluation block (placement **(c)**, after this section) also pushes into. No further declaration or reordering needed here — just add this loop where Step 2 above says (right after the existing item-loot loop, still inside `if (win) { ... }`).

- [ ] **Step 3: Run the mission-claim-adjacent test suite**

Run: `npm test -- --run src/features/missions src/lib/acquisition.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/mission-claim/index.ts
git commit -m "feat: roll characterLootDrop into newly-unlocked characters"
```

---

## Task 13: `src/services/recruits.ts` + `useRecruits` hook

**Files:**
- Modify: `src/services/profile.ts` (add `unlockedCharacters` field)
- Create: `src/services/recruits.ts`
- Create: `src/hooks/useRecruits.ts`
- Modify: `src/hooks/useRecruit.ts` (invalidate the new query on success)

**Interfaces:**
- Produces: `fetchRecruitCandidates(): Promise<RecruitCandidate[]>`, `useRecruits()` (TanStack Query, key `['recruits']`). Task 14's `RecruitsPage` consumes `useRecruits()`.
- Full-blind-surprise constraint: this query returns ONLY characters in the player's own `unlocked_characters` — there is no code path anywhere in this task that fetches or exposes a locked character's existence.

- [ ] **Step 1: Extend `PlayerProfile`**

In `src/services/profile.ts`:

```typescript
export type PlayerProfile = {
  currencies: Record<string, number>
  resources: Record<string, number>
  transcendenceCount: number
  infirmaryLevel: number
  mapProgress: Record<string, number>
  /** charKey -> ISO timestamp first unlocked (spec §5c). Absent key = still locked — and per the
   *  full-blind-surprise rule, the client never asks which keys are missing. */
  unlockedCharacters: Record<string, string>
}

export async function fetchProfile(): Promise<PlayerProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('currencies, resources, transcendence_count, infirmary_level, map_progress, unlocked_characters')
    .maybeSingle()
  if (error) throw error
  return {
    currencies: (data?.currencies ?? {}) as Record<string, number>,
    resources: (data?.resources ?? {}) as Record<string, number>,
    transcendenceCount: data?.transcendence_count ?? 0,
    infirmaryLevel: data?.infirmary_level ?? 1,
    mapProgress: (data?.map_progress ?? {}) as Record<string, number>,
    unlockedCharacters: (data?.unlocked_characters ?? {}) as Record<string, string>,
  }
}
```

- [ ] **Step 2: Write `recruits.ts`**

```typescript
// src/services/recruits.ts
import { sanity } from './sanity'
import { fetchProfile } from './profile'
import { fetchRecruitedDefIds } from './playerCharacters'

// Everything the player has UNLOCKED but not yet recruited — the /recruits screen's data source.
// Full-blind-surprise: this only ever queries characterDefs the player's own unlocked_characters
// already names. There is no query anywhere in this file for "which characters exist that I
// haven't unlocked" — that would leak locked-character existence to the client, which the spec
// (§2, §8) explicitly forbids.

export type RecruitCandidate = {
  charKey: string
  name: string
  role: string | null
  charClass: string
  rarity: string
  goldCost: number
}

const CANDIDATES_QUERY = `*[_type == "characterDef" && charKey in $keys]{
  charKey, name, role, charClass, rarity, "goldCost": acquisition.goldCost
}`

export async function fetchRecruitCandidates(): Promise<RecruitCandidate[]> {
  const [profile, ownedDefIds] = await Promise.all([fetchProfile(), fetchRecruitedDefIds()])
  const owned = new Set(ownedDefIds)
  const availableKeys = Object.keys(profile.unlockedCharacters).filter((key) => !owned.has(key))
  if (availableKeys.length === 0) return []
  const rows = await sanity.fetch<RecruitCandidate[]>(CANDIDATES_QUERY, { keys: availableKeys })
  return rows.filter((r) => typeof r.goldCost === 'number')
}
```

- [ ] **Step 3: Write `useRecruits.ts`**

```typescript
// src/hooks/useRecruits.ts
import { useQuery } from '@tanstack/react-query'
import { fetchRecruitCandidates } from '../services/recruits'

// Loads the player's unlocked-but-not-owned characters — the /recruits screen's data. Keyed
// ['recruits'] — useRecruit invalidates this on a successful hire (character moves from here to
// the owned roster), and any Edge Function response carrying newlyUnlocked should too (Task 15).
export function useRecruits() {
  return useQuery({ queryKey: ['recruits'], queryFn: fetchRecruitCandidates })
}
```

- [ ] **Step 4: Update `useRecruit.ts` to invalidate `['recruits']` too**

```typescript
// src/hooks/useRecruit.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recruitCharacter } from '../services/recruit'

export function useRecruit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: recruitCharacter,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['playerCharacters'] })
      void queryClient.invalidateQueries({ queryKey: ['recruits'] }) // hired character leaves the pool
      void queryClient.invalidateQueries({ queryKey: ['profile'] }) // gold spent
    },
  })
}
```

- [ ] **Step 5: Commit**

```bash
git add src/services/profile.ts src/services/recruits.ts src/hooks/useRecruits.ts src/hooks/useRecruit.ts
git commit -m "feat: add recruits data layer (unlocked-but-not-owned characters)"
```

---

## Task 14: `/recruits` screen

**Files:**
- Create: `src/features/recruits/RecruitsPage.tsx`
- Create: `src/features/recruits/index.ts`
- Modify: `src/App.tsx` (add the route)

**Interfaces:**
- Consumes: `useRecruits()`, `useRecruit()` (Task 13), `useProfile()` (existing, for the gold balance to grey out unaffordable Hire buttons).

New feature module, following the `missions/` reference shape per root `CLAUDE.md` (`components/`, a `<Feature>Page.tsx`, an `index.ts` barrel — this feature is small enough that everything fits directly in `RecruitsPage.tsx`, no `components/` subfolder needed yet).

- [ ] **Step 1: Write `RecruitsPage.tsx`**

```typescript
// src/features/recruits/RecruitsPage.tsx
import { RarityBadge } from '@/components/atoms/RarityBadge'
import { RoleBadge } from '@/components/atoms/RoleBadge'
import { GoldDivider } from '@/components/atoms/GoldDivider'
import { PrimaryButton } from '@/components/atoms/Button'
import { IconSlot } from '@/components/atoms/IconSlot'
import type { CharacterRole } from '@/lib/roles'
import { useRecruits } from '@/hooks/useRecruits'
import { useRecruit } from '@/hooks/useRecruit'
import { useProfile } from '@/hooks/useProfile'

const NOTE: React.CSSProperties = { color: 'var(--color-text-muted)', fontSize: '12px', fontStyle: 'italic' }

export default function RecruitsPage() {
  const recruitsQ = useRecruits()
  const { data: profile } = useProfile()
  const recruit = useRecruit()

  const candidates = recruitsQ.data ?? []
  const gold = profile?.currencies?.gold ?? 0

  return (
    <div>
      <h2 style={{
        color: 'var(--color-gold-mid)', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase',
        marginBottom: '14px', paddingBottom: '6px', borderBottom: '1px solid var(--color-gold-dark)',
      }}>Recruits</h2>

      {recruitsQ.isLoading ? (
        <p style={NOTE}>Loading…</p>
      ) : candidates.length === 0 ? (
        <p style={NOTE}>Keep playing — recruits show up as you go.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {candidates.map((c) => {
            const affordable = gold >= c.goldCost
            return (
              <div key={c.charKey} className="atom-heavy" style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '5px',
                border: '2px solid var(--color-gold-dark)',
                background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
              }}>
                <div style={{ width: 36, height: 44, flexShrink: 0, borderRadius: '4px', border: '2px solid var(--color-gold-dark)', background: 'linear-gradient(180deg, #1a0608 0%, #0d0304 100%)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <p style={{ color: 'var(--color-text-primary)', fontSize: '13px', fontWeight: 'bold' }}>{c.name}</p>
                    <RarityBadge rarity={c.rarity} />
                  </div>
                  <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RoleBadge role={(c.role as CharacterRole) ?? 'damage'} size="sm" />
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>{c.charClass}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IconSlot size={16} />
                  <span style={{ color: 'var(--color-text-gold)', fontSize: '14px', fontWeight: 'bold' }}>{c.goldCost}</span>
                </div>
                <PrimaryButton
                  disabled={!affordable || recruit.isPending}
                  title={affordable ? undefined : `Need ${c.goldCost - gold} more gold`}
                  onClick={() => recruit.mutate(c.charKey)}
                >
                  Hire
                </PrimaryButton>
              </div>
            )
          })}
        </div>
      )}

      {recruit.error && (
        <>
          <div style={{ margin: '16px 0' }}><GoldDivider /></div>
          <p style={{ color: '#e0635c', fontSize: 12 }}>{(recruit.error as Error).message}</p>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write the barrel**

```typescript
// src/features/recruits/index.ts
export { default as RecruitsPage } from './RecruitsPage'
```

- [ ] **Step 3: Route it in `src/App.tsx`**

Add the import alongside the other feature imports:

```typescript
import { RecruitsPage } from '@/features/recruits'
```

Add the route inside the `<Route element={<GameLayout />}>` block, alongside the existing routes (e.g. right after `/team`):

```typescript
          <Route path="/recruits" element={<RecruitsPage />} />
```

(If `App.tsx` has since been migrated to `React.lazy()` route-level code splitting — check for `lazy(` at the top of the file before editing — follow that pattern instead: `const RecruitsPage = lazy(() => import('@/features/recruits').then((m) => ({ default: m.RecruitsPage })))`, matching how the other feature-barrel routes are already lazy-loaded there.)

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, sign in, navigate to `/recruits`. Expected: the empty state ("Keep playing — recruits show up as you go.") renders for a fresh player with nothing unlocked yet (confirms the full-blind-surprise behavior — nothing about locked characters shows).

- [ ] **Step 5: Commit**

```bash
git add src/features/recruits/RecruitsPage.tsx src/features/recruits/index.ts src/App.tsx
git commit -m "feat: add /recruits screen"
```

---

## Task 15: Surprise-reveal UI in claim/collect flows

**Files:**
- Modify: `src/features/missions/components/ClaimReward.tsx`
- Modify: `src/features/gather/GatherPage.tsx`

**Interfaces:**
- Consumes: `ClaimResultView.newlyUnlocked` (Task 8), `CollectResult.newlyUnlocked` (Task 10), the existing `Alert` atom (`src/components/atoms/Alert.tsx`, already reviewed — `variant="success"` fits this exactly, no new component needed).

- [ ] **Step 1: Render `newlyUnlocked` in `ClaimReward.tsx`**

Add the import:

```typescript
import { Alert } from '@/components/atoms/Alert'
```

Insert right after the header block and before the `<div style={{ padding: '16px' }}>` party section (so it's the first thing seen, regardless of win/loss — a loot-drop reveal can technically coincide with a loss's screen too since `newlyUnlocked` is independent of the win/loss XP path... actually re-check: newlyUnlocked can only be non-empty on a WIN, since both the condition-evaluation block and the loot-roll are inside `if (win)` in mission-claim — so this only ever renders on the win branch in practice, but the check below doesn't need to special-case that, it just renders nothing when the array is empty):

```typescript
      {result.newlyUnlocked.length > 0 && (
        <div style={{ padding: '12px 16px 0' }}>
          {result.newlyUnlocked.map((r) => (
            <div key={r.charKey} style={{ marginBottom: '8px' }}>
              <Alert variant="success">
                New recruit available: <strong>{r.name}</strong>{r.role ? ` (${r.role})` : ''} — visit Recruits to hire them.
              </Alert>
            </div>
          ))}
        </div>
      )}
```

- [ ] **Step 2: Render `newlyUnlocked` in `GatherPage.tsx`**

Add the import:

```typescript
import { Alert } from '@/components/atoms/Alert'
```

Add local state and render the reveal after a successful collect. `useCollectGather`'s mutation already exposes `.data` (the `CollectResult`) after success — add a small piece of local state to hold the LATEST collect's `newlyUnlocked` so it's visible until the next collect or a manual dismiss:

```typescript
  const [newlyUnlocked, setNewlyUnlocked] = useState<{ charKey: string; name: string; role: string | null }[]>([])
```

(add to the existing `useState` imports at the top — `GatherPage.tsx` already imports `useState`).

Change every `collectG.mutate(...)` call in this file to also capture the reveal on success:

```typescript
                  onCollect={a ? () => collectG.mutate({ assignmentId: a.id }, {
                    onSuccess: (data) => setNewlyUnlocked(data.newlyUnlocked),
                  }) : undefined}
                  onStop={a ? () => collectG.mutate({ assignmentId: a.id, stop: true }, {
                    onSuccess: (data) => setNewlyUnlocked(data.newlyUnlocked),
                  }) : undefined}
```

(apply the same `onSuccess` pattern to the `ActiveGatherCard`'s `onStop={() => collectG.mutate({ assignmentId: assignment.id, stop: true })}` call too.)

Render it near the top of the page, above the "Active Gathering" section:

```typescript
      {newlyUnlocked.length > 0 && (
        <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {newlyUnlocked.map((r) => (
            <Alert key={r.charKey} variant="success">
              New recruit available: <strong>{r.name}</strong>{r.role ? ` (${r.role})` : ''} — visit Recruits to hire them.
            </Alert>
          ))}
        </div>
      )}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. This is genuinely hard to trigger without real unlocked content (Task 16 authors the actual conditions) — verify by temporarily hardcoding a non-empty `newlyUnlocked` sample in `claimSamples.ts`'s `SAMPLE_CLAIM_WIN` and checking `/design`'s ClaimReward showcase renders the Alert correctly, then revert the hardcode (keep `newlyUnlocked: []` in the sample, per Task 8 Step 4).

- [ ] **Step 4: Commit**

```bash
git add src/features/missions/components/ClaimReward.tsx src/features/gather/GatherPage.tsx
git commit -m "feat: surface newly-unlocked characters as a reveal in claim/collect UI"
```

---

## Task 16: Wave-1 content authoring

**Files:** none (Sanity content via MCP tools, not repo files) — optionally update `TODO.md` to mark the acquisition-economy item done, matching this session's established pattern for content-only changes.

**Interfaces:**
- Consumes: everything above — this task is inert until Tasks 1–15 are live.

Not a code task. Author `acquisition` on real characters using the Sanity MCP tools, the same workflow already used this session for item flavour text (`mcp__Sanity__patch_documents`) and for verifying itemBudget.ts against real data (`mcp__Sanity__query_documents`). Ground every threshold in REAL roster data — query first, don't guess.

- [ ] **Step 1: Query the current roster for real numbers to reason from**

```
mcp__Sanity__query_documents:
*[_type=="characterDef"]{ charKey, name, charClass, role, rarity, baseStats, growth }
```

For each of the 7 wave-1 characters named in spec §9 (Nira Barkholm, Rowan Thicket, Gort Deepvein, Brom Ironwall, Vex Nightcut, Aldric Faithward, Lyra Brightnote), compute their L1/L25/L50 stat values from `baseStats`/`growth` using the same `baselineForStat` formula `src/lib/stats.ts` already implements (`base + perLevel × (L−1) + milestones`), so thresholds are anchored to what's actually achievable, not arbitrary.

- [ ] **Step 2: Pick and record real threshold numbers**

Using the queried data:
- **Nira Barkholm / Rowan Thicket** (`resourceTotal`, Wood) — `MINE_DEFS`'s Wood mine yields 4/tick every 20s (`src/lib/gather.ts`), so 1 hour of unmodified gathering banks `3600/20 × 4 = 720` Wood. Set Nira's threshold around 500 (under an hour, an early unlock) and Rowan's around 2000 (a few hours across sessions, a later unlock) — both well below what a dedicated player hits in a normal play session, per the mine rate just computed.
- **Gort Deepvein** (`resourceTotal`, Copper) — Copper's mine yields 5/tick every 30s → `3600/30 × 5 = 600`/hour unmodified. Set threshold around 400.
- **Brom Ironwall** (`missionTimeTotal`) — check a representative early-map mission's `durationSeconds` (query `missionDef` for Gravemarch stage 1–3) and set the threshold to roughly 10–15 clears' worth of combined `result.durationSeconds` (the in-fight time, not the real-world wait) — reason from the actual `timeLimitSeconds`/typical fight length in `docs/BALANCE.md`'s power-budget notes if present, else default to 1800 (30 minutes of cumulative combat) as a defensible early-game bar.
- **Vex Nightcut** (`statThreshold`, attack) — from Vex's own queried `baseStats`/`growth`, compute their OWN `attack` at level 20–25 using `baselineForStat`, and set the threshold at or just below that level's value (so leveling Vex — or any other character with a comparable attack stat — up naturally crosses it; the condition is "any owned character", not specifically Vex).
- **Aldric Faithward** (`characterLevel`) — pick a round number in the 15–25 range (below the level-50 cap, achievable in normal play but not immediate).
- **Lyra Brightnote** (`goldTotal`) — check a representative mission's gold reward (`missionDef.rewards[]` where `code == "gold"`) and set the threshold to roughly 20–30 wins' worth.

Do not guess these numbers without having queried the real data in Step 1 — that's the whole point of this step.

- [ ] **Step 3: Pick 1–2 characters for `mapCompletion` and `lootDrop`**

From the remaining 12 characters (everyone not in the 7 above), pick one for `mapCompletion` (condition: `{ type: 'mapCompletion', map: '<a mapKey from mapDef>', stage: 7 }` — clearing a map's boss) and one for `lootDrop` (authored on a mission instead — pick a stage-7 boss mission on a DIFFERENT map than the mapCompletion pick, so the two aren't redundant, `dropChance` around 2–5%, a genuinely rare "you got lucky" moment per the spec's surprise framing).

- [ ] **Step 4: Write `goldCost` for every one of the 19 characters**

Every character needs `acquisition.goldCost` even if it has no condition (the other 12 get gold-only). Scale roughly with `rarity` (Common cheapest, Epic most expensive — no Legendary exists yet per TODO.md) — pick a simple linear-ish scale (e.g. Common 200, Uncommon 500, Rare 1000, Epic 2500) as a first pass; this is a first-pass economy number, not balance-critical in the way combat stats are, so it doesn't need the full balance-harness sweep.

- [ ] **Step 5: Write it all via `mcp__Sanity__patch_documents`**

One `patch_documents` call (or a small batch), setting `acquisition` on all 19 characters and `characterLootDrop` on the one chosen mission — same tool, same drafts-write pattern already used this session for the item-flavour-text task. Set `acquisition` field per character:

```json
{ "acquisition": { "goldCost": 200 } }
```

for gold-only characters, and e.g.

```json
{ "acquisition": { "goldCost": 800, "condition": { "type": "resourceTotal", "resource": "Wood", "threshold": 500 } } }
```

for Nira Barkholm.

- [ ] **Step 6: Verify with a read-back query**

```
mcp__Sanity__query_documents:
*[_type=="characterDef"]{ charKey, "acquisition": acquisition }
```

Confirm all 19 have a `goldCost`, and exactly the 7 (+ 1 mapCompletion) intended characters have a `condition`.

- [ ] **Step 7: Update `TODO.md`**

Mark the "Character acquisition economy" line (currently `project-undecided`) done, following this session's established style for closing out TODO items — one-sentence summary + what shipped + reference to the spec/plan paths, no separate branch needed if bundled with an unrelated docs commit is avoided (open its own `docs/` branch per this repo's one-branch-per-task rule).

- [ ] **Step 8: Commit the TODO.md update**

```bash
git checkout -b docs/acquisition-economy-shipped
git add TODO.md
git commit -m "docs: mark character acquisition economy done"
git push -u origin docs/acquisition-economy-shipped
```

(Open a PR per this repo's standard workflow — Sanity content itself isn't committed to git, only this TODO.md pointer to it.)

---

## Self-Review

**Spec coverage** (every section of `docs/superpowers/specs/2026-08-20-character-acquisition-design.md` mapped to a task):
- §1 Problem / §2 Goals → the plan as a whole (Tasks 1–16)
- §3 Non-goals → respected: no elementalMastery/comebackMoment anywhere, no Legendary-character decision, no retroactive migration of existing owned characters
- §4 Condition types → Task 3 (`evaluateCondition`, all 6 non-gold types), Task 4 (Sanity authoring for all 6)
- §5a `characterDef.acquisition` → Task 4
- §5b `lifetime_stats` → Task 1 (registry), Task 2 (column), Task 7/Task 8 (claim_mission + mission-claim), Task 9/Task 10 (collect_gather + gather-collect)
- §5c `unlocked_characters` → Task 2 (column), Task 7/9 (RPC writes), Task 13 (client read)
- §6 Evaluation when/where → Task 8 (mission-claim), Task 10 (gather-collect), Task 11/12 (lootDrop)
- §7 Recruit flow → Task 5 (RPC), Task 6 (Edge Function)
- §8 UI → Task 14 (`/recruits`), Task 15 (surprise reveal)
- §9 Wave-1 content → Task 16
- §10 Error handling → the `actually_unlocked` idempotency mechanism (Tasks 7, 9) directly implements the race-condition handling; insufficient-gold-stays-unlocked is Task 5's RPC design (no unlock is ever cleared); the "already-unlocked-but-never-bought never re-fires" case is the same `unlocked_characters ? key` check in every RPC
- §11 Testing → Task 1 (`lifetimeStats.test.ts`), Task 3 (`acquisition.test.ts`), Task 8 Step 5 (existing suite still passes)
- §12 Follow-ups → out of scope, correctly excluded (Global Constraints calls this out explicitly)

**Placeholder scan:** no "TBD"/"TODO"/"implement later" strings in any task's code. Every step shows real, complete code. Task 16 (content authoring) is the one task with genuinely open numbers, but it specifies the exact METHOD to derive them (query real data, compute via the existing `baselineForStat` formula) rather than leaving them unspecified — this is the spec's own explicitly-sanctioned flexibility point (§9: "proposed pairing, adjustable during authoring — not a spec blocker"), not a plan-authoring placeholder.

**Type consistency:**
- `evaluateCondition(condition: AcquisitionCondition | undefined, state: PlayerAcquisitionState): boolean` — identical signature used in Task 3 (defined), Task 8 and Task 10 (called). Verified the field names (`type`, `level`, `stat`, `threshold`, `resource`, `map`, `stage`) match across Task 3's TS type, Task 4's Sanity schema, and Task 8's `AcquisitionCandidate.condition` shape from the shared helper.
- `AcquisitionCandidate` (Task 8's `_shared/characterAcquisition.ts`) and the client-side `RecruitCandidate` (Task 13) are deliberately DIFFERENT types for different purposes — the former (server-only) carries the condition, the latter (client-facing) never does, per the full-blind-surprise constraint. Confirmed no field named `condition` appears in any client-importable file in this plan.
- `newlyUnlocked: { charKey: string; name: string; role: string | null }[]` — identical shape used in `ClaimResponse` (Task 8), `CollectResult` (Task 10), `ClaimResultView`/`NewRecruitReveal` (Task 8 Step 4), and consumed identically in Task 15's two render sites.
- Fixed a real ordering/mutation bug found during this review: the first draft declared `newlyUnlockedCharKeys`/`candidateByKey` via `filter().map()` reassignment right before the RPC call (after step 10), but Task 12's loot-drop roll needs to push into them from INSIDE step 10 — a reassignment after step 10 would have silently discarded Task 12's pushes. Corrected in both tasks: Task 8 now declares the two collections as empty `const` arrays/maps BEFORE step 10 (placement **(a)**), Task 12's loot-roll pushes into them from inside step 10 unchanged, and Task 8's condition-evaluation (placement **(c)**, which needs `currencies['gold']` from step 10 and so must run after it) pushes into the SAME collections rather than reassigning them. Both tasks' code blocks were rewritten to match this corrected structure — not just noted here.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-20-character-acquisition.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
