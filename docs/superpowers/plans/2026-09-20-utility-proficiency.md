# Utility Role Conditional Proficiency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Utility-role characters a passive combat identity — a single authored `proficiency` that grants a flat/pct stat bonus when the character is dispatched on a mission whose `proficiencyTags` include it, resolving ADR-0013 fork 6.

**Architecture:** New registry `src/lib/proficiencies.ts` (Deno-safe, mirrors `skills.ts`) defines proficiency keys + their stat effects, plus a pure `resolveProficiencyBonus(proficiency, missionTags)` function reused verbatim by the client win-chance estimator and the server-authoritative `mission-claim` Edge Function — same pattern `traits.ts`'s `collectTraitBonuses` already establishes for conditional stat modifiers. Two new optional Sanity fields (`characterDef.proficiency`, Utility-only; `missionDef.proficiencyTags`, sparse) carry the authored data through the existing GROQ→client and GROQ→Edge-Function pipelines with no new tables, RPCs, or migrations.

**Tech Stack:** TypeScript, Vitest, Sanity Studio (schema), Supabase Edge Functions (Deno), React.

**Spec:** `docs/superpowers/specs/2026-09-20-utility-proficiency-design.md`

## Global Constraints

- Proficiency is a **fixed authored trait** (recruitment-time), never trained/leveled — no tie to the Skills system.
- **Utility-role-exclusive** — enforced by Sanity studio validation on `characterDef.proficiency`.
- **New, separate registry/field** — never folded into `traitDef`'s point-buy-budgeted trait system.
- The bonus is a **personal conditional stat bonus** (flat/pct, same `{flat, pct}` shape as gear/blessings/traits), never a party-wide effect, never a direct win-chance probability tweak.
- `missionDef.proficiencyTags` is **optional and sparse** — do not retrofit existing missions; most missions carry no tag.
- Initial `PROFICIENCY_DEFS` stat values are **placeholders** pending the `docs/BALANCE.md` sweep (out of scope for this plan) — same precedent `skills.ts`'s `intervalSec`/`xpPerTick` set.
- No hard content gating in this plan (deferred, see spec §3/§7).

---

### Task 1: Proficiency registry + bonus resolver

**Files:**
- Create: `src/lib/proficiencies.ts`
- Test: `src/lib/proficiencies.test.ts`

**Interfaces:**
- Consumes: `StatBonus` type from `src/lib/stats.ts` (`export type StatBonus = { flat: number; pct: number }`).
- Produces: `ProficiencyEffect`, `ProficiencyDef` types; `PROFICIENCY_DEFS: ProficiencyDef[]`; `PROFICIENCY_BY_KEY: Record<string, ProficiencyDef>`; `resolveProficiencyBonus(proficiency: string | null | undefined, missionProficiencyTags: string[] | null | undefined): Record<string, StatBonus>` — all consumed by Tasks 2, 5, and 6.

- [ ] **Step 1: Write the failing test**

Create `src/lib/proficiencies.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { PROFICIENCY_DEFS, PROFICIENCY_BY_KEY, resolveProficiencyBonus } from './proficiencies'

describe('PROFICIENCY_DEFS', () => {
  it('every proficiency has a label and at least one effect', () => {
    for (const p of PROFICIENCY_DEFS) {
      expect(p.label.length).toBeGreaterThan(0)
      expect(p.effects.length).toBeGreaterThan(0)
    }
  })

  it('proficiency keys are unique', () => {
    const keys = PROFICIENCY_DEFS.map((p) => p.proficiencyKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('PROFICIENCY_BY_KEY maps every proficiency key to its def', () => {
    for (const p of PROFICIENCY_DEFS) {
      expect(PROFICIENCY_BY_KEY[p.proficiencyKey]).toBe(p)
    }
  })

  it('includes alchemy', () => {
    expect(PROFICIENCY_BY_KEY.alchemy).toEqual({
      proficiencyKey: 'alchemy',
      label: 'Alchemy',
      effects: [{ stat: 'defense', kind: 'flat', value: 5 }],
    })
  })
})

describe('resolveProficiencyBonus()', () => {
  it('returns no bonus for a character with no proficiency', () => {
    expect(resolveProficiencyBonus(undefined, ['alchemy'])).toEqual({})
    expect(resolveProficiencyBonus(null, ['alchemy'])).toEqual({})
  })

  it('returns no bonus when the mission has no matching tag', () => {
    expect(resolveProficiencyBonus('alchemy', [])).toEqual({})
    expect(resolveProficiencyBonus('alchemy', undefined)).toEqual({})
    expect(resolveProficiencyBonus('alchemy', null)).toEqual({})
    expect(resolveProficiencyBonus('alchemy', ['athletics'])).toEqual({})
  })

  it('returns the flat/pct bonus when the proficiency matches a mission tag', () => {
    expect(resolveProficiencyBonus('alchemy', ['alchemy'])).toEqual({
      defense: { flat: 5, pct: 0 },
    })
  })

  it('matches when the mission carries multiple tags', () => {
    expect(resolveProficiencyBonus('alchemy', ['athletics', 'alchemy'])).toEqual({
      defense: { flat: 5, pct: 0 },
    })
  })

  it('returns no bonus for an unknown proficiency key', () => {
    expect(resolveProficiencyBonus('unknown-key', ['unknown-key'])).toEqual({})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- proficiencies` (from repo root)
Expected: FAIL — `Cannot find module './proficiencies'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/proficiencies.ts`:

```ts
import type { StatBonus } from './stats'

// Utility role conditional proficiency (ADR-0013 fork 6, ADR-0059,
// docs/superpowers/specs/2026-09-20-utility-proficiency-design.md): a fixed authored trait,
// decided at recruitment, that grants a flat/pct stat bonus when the current mission's
// proficiencyTags include it. Same {flat, pct} effect shape as traits/gear/blessings
// (src/lib/stats.ts) so it stacks through the ordinary bonus pipeline — the bonus modifies
// the sim's INPUTS, never a win-chance number post-hoc (see traits.ts's doc comment for why
// that rule exists). Deno-safe: imported by the client, the mission-claim Edge Function, AND
// the Sanity studio's validation (like traits.ts/characterBudget.ts).

export type ProficiencyEffect = { stat: string; kind: 'flat' | 'pct'; value: number }

export type ProficiencyDef = {
  proficiencyKey: string
  label: string
  effects: ProficiencyEffect[]
}

export const PROFICIENCY_DEFS: ProficiencyDef[] = [
  {
    proficiencyKey: 'alchemy',
    label: 'Alchemy',
    // Placeholder value pending docs/BALANCE.md's before/after sweep (design spec §6/§7).
    effects: [{ stat: 'defense', kind: 'flat', value: 5 }],
  },
]

export const PROFICIENCY_BY_KEY: Record<string, ProficiencyDef> = Object.fromEntries(
  PROFICIENCY_DEFS.map((p) => [p.proficiencyKey, p]),
)

/** Resolves a character's proficiency bonus for one mission attempt. A static per-attempt
 *  match (proficiency ∈ mission's tags), not a live combat-state condition — this does NOT
 *  reuse traits.ts's conditionTrigger engine, which exists for a different kind of thing.
 *  Utility-exclusivity is an authoring-time rule (studio validation, Task 2), not enforced
 *  here — this function only checks the key match. */
export function resolveProficiencyBonus(
  proficiency: string | null | undefined,
  missionProficiencyTags: string[] | null | undefined,
): Record<string, StatBonus> {
  const out: Record<string, StatBonus> = {}
  if (!proficiency) return out
  if (!(missionProficiencyTags ?? []).includes(proficiency)) return out
  const def = PROFICIENCY_BY_KEY[proficiency]
  if (!def) return out
  for (const effect of def.effects) {
    const bonus = (out[effect.stat] ??= { flat: 0, pct: 0 })
    if (effect.kind === 'flat') bonus.flat += effect.value
    else bonus.pct += effect.value
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- proficiencies`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/proficiencies.ts src/lib/proficiencies.test.ts
git commit -m "feat: add Utility role proficiency registry + bonus resolver"
```

---

### Task 2: Sanity schema — `characterDef.proficiency` + `missionDef.proficiencyTags`

**Files:**
- Modify: `studio/schemaTypes/characterDef.ts:1-4` (imports), `:29-33` (CharacterDoc type), `:143` (insert new field after `traits`)
- Modify: `studio/schemaTypes/missionDef.ts:1-2` (imports), `:78` (insert new field after `durationSeconds`)

**Interfaces:**
- Consumes: `PROFICIENCY_DEFS` from Task 1's `src/lib/proficiencies.ts`; `resolveRole`, `type CharacterRole` from `src/lib/roles.ts` (already used elsewhere in `characterDef.ts`).
- Produces: `characterDef` documents may carry a `proficiency: string` field; `missionDef` documents may carry a `proficiencyTags: string[]` field. Consumed by Tasks 3 and 6 via GROQ.

- [ ] **Step 1: Add the proficiency field to `characterDef.ts`**

In `studio/schemaTypes/characterDef.ts`, change the imports (line 3) from:

```ts
import { CLASS_ROLE, ROLE_STYLES } from '../../src/lib/roles'
```

to:

```ts
import { CLASS_ROLE, ROLE_STYLES, resolveRole, type CharacterRole } from '../../src/lib/roles'
```

Add a new import right after the `schools` import (line 4):

```ts
import { PROFICIENCY_DEFS } from '../../src/lib/proficiencies'
```

Add a new options constant near `ROLE_OPTIONS` (after line 17):

```ts
const PROFICIENCY_OPTIONS = PROFICIENCY_DEFS.map((p) => ({ title: p.label, value: p.proficiencyKey }))
```

Extend the `CharacterDoc` type (currently lines 29-33) to carry the fields the new validation reads:

```ts
type CharacterDoc = {
  rarity?: CharacterRarity
  baseStats?: BudgetStatValue[]
  growth?: BudgetStatGrowth[]
  charClass?: string
  role?: string
}
```

Insert a new field immediately after the `traits` field closes (after line 143's `}),`, before the `blessingTree` field):

```ts
    defineField({
      name: 'proficiency',
      title: 'Proficiency',
      description:
        'Utility-role-exclusive conditional stat bonus (ADR-0013 fork 6, ADR-0059): applies only on missions whose proficiencyTags include this key. Leave blank for non-Utility characters, and for any Utility character without one authored yet.',
      type: 'string',
      options: { list: PROFICIENCY_OPTIONS },
      validation: (rule) =>
        rule.custom((value: string | undefined, context) => {
          if (!value) return true // optional
          const doc = context.document as CharacterDoc | undefined
          const role = resolveRole(doc?.charClass ?? '', (doc?.role as CharacterRole | undefined) ?? null)
          if (role !== 'utility') {
            return 'Proficiency is Utility-role-exclusive — this character resolves to a different role.'
          }
          return true
        }),
    }),
```

- [ ] **Step 2: Add the proficiencyTags field to `missionDef.ts`**

In `studio/schemaTypes/missionDef.ts`, add a new import after line 2:

```ts
import { PROFICIENCY_DEFS } from '../../src/lib/proficiencies'

const PROFICIENCY_OPTIONS = PROFICIENCY_DEFS.map((p) => ({ title: p.label, value: p.proficiencyKey }))
```

Insert a new field right after `durationSeconds` (after line 78's `}),`, before the `// --- Rewards ---` comment):

```ts
    defineField({
      name: 'proficiencyTags',
      title: 'Proficiency tags',
      description:
        'Optional, sparse (ADR-0059): proficiency keys a Utility character can match for a stat bonus on this mission. Leave empty for missions where no proficiency applies — most missions have none.',
      type: 'array',
      of: [defineArrayMember({ type: 'string', options: { list: PROFICIENCY_OPTIONS } })],
      fieldset: 'identity',
    }),
```

- [ ] **Step 3: Typecheck the studio project**

Run: `cd studio && npm run build`
Expected: build succeeds with no TypeScript errors (this is the studio's own `tsc`-backed build — there is no separate `typecheck` script, and Sanity schema has no Vitest coverage in this repo).

- [ ] **Step 4: Commit**

```bash
git add studio/schemaTypes/characterDef.ts studio/schemaTypes/missionDef.ts
git commit -m "feat: add Sanity proficiency fields to characterDef and missionDef"
```

---

### Task 3: Client data layer — thread `proficiency`/`proficiencyTags` through fetch + roster

**Files:**
- Modify: `src/services/characters.ts:39` (query), `:49-71` (RawCharacterDef), `:18-33` (GameCharacter), `:85-111` (mapping)
- Modify: `src/services/missions.ts:60-68` (query), `:70-95` (RawMission), `:42-58` (GameMission), `:97-136` (mapping)
- Modify: `src/hooks/useRoster.ts:61-100` (RosterMember type), `:145-180` (mapping)

**Interfaces:**
- Consumes: nothing new (plain data plumbing).
- Produces: `GameCharacter.proficiency?: string`, `GameMission.proficiencyTags: string[]`, `RosterMember.proficiency?: string` — consumed by Task 4.

- [ ] **Step 1: `src/services/characters.ts` — add `proficiency`**

Change `CHARACTER_DEFS_QUERY` (line 39) from:

```ts
  charKey, name, charClass, role, damageSchool,
```

to:

```ts
  charKey, name, charClass, role, damageSchool, proficiency,
```

Add `proficiency?: string` to `RawCharacterDef` (after `role?: CharacterRole` at line 53):

```ts
  role?: CharacterRole
  proficiency?: string
```

Add `proficiency?: string` to `GameCharacter` (after `role?: CharacterRole` at line 22):

```ts
  role?: CharacterRole
  proficiency?: string
```

In `fetchCharacterDefs()`'s mapping (the returned object at line 85), add the field after `role: c.role,` (line 89):

```ts
      role: c.role,
      proficiency: c.proficiency,
```

- [ ] **Step 2: `src/services/missions.ts` — add `proficiencyTags`**

Change `MISSIONS_QUERY` (line 61) from:

```ts
  missionKey, name, description, durationSeconds, baseXp, stage,
```

to:

```ts
  missionKey, name, description, durationSeconds, baseXp, stage, proficiencyTags,
```

Add `proficiencyTags?: string[]` to `RawMission` (after `durationSeconds: number` at line 74):

```ts
  durationSeconds: number
  proficiencyTags?: string[]
```

Add `proficiencyTags: string[]` to `GameMission` (after `durationSeconds: number` at line 47):

```ts
  durationSeconds: number
  /** Optional/sparse (ADR-0059) — proficiency keys a Utility character can match for a bonus. */
  proficiencyTags: string[]
```

In `fetchMissions()`'s mapping (the returned object at line 101), add the field after `durationSeconds: m.durationSeconds,` (line 105):

```ts
      durationSeconds: m.durationSeconds,
      proficiencyTags: m.proficiencyTags ?? [],
```

- [ ] **Step 3: `src/hooks/useRoster.ts` — add `proficiency` to `RosterMember`**

Add `proficiency?: string` to the `RosterMember` type (after `damageSchool?: School` at line 67):

```ts
  damageSchool?: School
  /** Utility-role-exclusive conditional bonus (ADR-0059) — resolved against a specific
   *  mission's proficiencyTags at the fight-context call site, not here (context-free). */
  proficiency?: string
```

In the `roster` `useMemo`'s returned object (after `damageSchool: def.damageSchool,` at line 151):

```ts
        damageSchool: def.damageSchool,
        proficiency: def.proficiency,
```

- [ ] **Step 4: Typecheck + run the full client test suite**

Run: `npm run build`
Expected: `tsc -b` succeeds (no new type errors) and the Vite build completes.

Run: `npm test`
Expected: all existing tests still pass (this task adds no new test file — it's plumbing consumed by Task 4's tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/characters.ts src/services/missions.ts src/hooks/useRoster.ts
git commit -m "feat: thread proficiency/proficiencyTags through character and mission fetch"
```

---

### Task 4: Dispatch types + `MissionsPage.tsx` wiring

**Files:**
- Modify: `src/features/missions/components/dispatchSamples.ts:12-25` (DispatchMission), `:27-53` (DispatchChar)
- Modify: `src/features/missions/MissionsPage.tsx:28-40` (`toDispatchMission`), `:138-154` (`dispatchRoster`)

**Interfaces:**
- Consumes: `GameMission.proficiencyTags`, `RosterMember.proficiency` from Task 3.
- Produces: `DispatchMission.proficiencyTags: string[]`, `DispatchChar.proficiency?: string` — consumed by Task 5.

- [ ] **Step 1: `dispatchSamples.ts` — extend the two prop-shape types**

Add to `DispatchMission` (after `mapKey?: string | null` at line 24):

```ts
  mapKey?: string | null
  /** Optional/sparse (ADR-0059) — proficiency keys a Utility character can match for a bonus. */
  proficiencyTags?: string[]
}
```

Add to `DispatchChar` (after `damageSchool?: School` at line 33):

```ts
  damageSchool?: School
  /** Utility-role-exclusive conditional bonus (ADR-0059) — matched against the mission's
   *  proficiencyTags by the win-chance estimator. */
  proficiency?: string
```

- [ ] **Step 2: `MissionsPage.tsx` — pass the fields through**

In `toDispatchMission()` (currently lines 28-40), add `proficiencyTags` after `mapKey: m.map?.mapKey ?? null,` (line 38):

```ts
    mapKey: m.map?.mapKey ?? null,
    proficiencyTags: m.proficiencyTags,
  }
}
```

In the `dispatchRoster` mapping (currently lines 138-154), add `proficiency` after `damageSchool: m.damageSchool,` (line 144):

```ts
    damageSchool: m.damageSchool,
    proficiency: m.proficiency,
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: succeeds with no new type errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/missions/components/dispatchSamples.ts src/features/missions/MissionsPage.tsx
git commit -m "feat: carry proficiency fields through the dispatch view models"
```

---

### Task 5: Apply the bonus in `WinChanceEstimate.tsx`

**Files:**
- Modify: `src/features/missions/components/WinChanceEstimate.tsx` (entire file — small, shown in full below)
- Modify: `src/features/missions/components/MissionDispatch.tsx:89` (pass the new prop)
- Test: `src/features/missions/components/WinChanceEstimate.test.tsx` (new)

**Interfaces:**
- Consumes: `resolveProficiencyBonus` from Task 1's `src/lib/proficiencies.ts`; `DispatchChar.proficiency`, `DispatchMission.proficiencyTags` from Task 4.
- Produces: the estimator's win% now reflects a matching proficiency — no new exports beyond the existing `WinChanceEstimate` component (now taking one more prop, `proficiencyTags`).

- [ ] **Step 1: Write the failing test**

First check whether this component already has a test file:

Run: `ls src/features/missions/components/*.test.tsx 2>/dev/null || echo "none"`

Create `src/features/missions/components/WinChanceEstimate.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WinChanceEstimate } from './WinChanceEstimate'
import type { DispatchChar } from './dispatchSamples'
import type { MissionEnemyView } from '@/services/missions'

vi.mock('@/hooks/useRoster', () => ({
  useItemDefs: () => ({ data: {} }),
}))

const weakEnemy: MissionEnemyView = {
  name: 'Training Dummy',
  count: 1,
  damageType: 'physical',
  resistances: [],
  stats: { health: 1, attack: 0, speed: 10, defense: 0 },
}

function renderEstimate(props: Partial<Parameters<typeof WinChanceEstimate>[0]> & { party: DispatchChar[] }) {
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <WinChanceEstimate enemies={[weakEnemy]} timeLimitSeconds={60} mapKey={null} proficiencyTags={[]} {...props} />
    </QueryClientProvider>,
  )
}

describe('WinChanceEstimate proficiency bonus', () => {
  const baseChar: DispatchChar = {
    id: 'c1',
    name: 'Test',
    charClass: 'Druid',
    level: 1,
    role: 'utility',
    stats: { health: 50, attack: 5, defense: 0, speed: 10 },
    statInputs: {
      baseStats: [{ stat: 'health', value: 50 }, { stat: 'attack', value: 5 }, { stat: 'defense', value: 0 }, { stat: 'speed', value: 10 }],
      growth: [],
      blessingNodes: [],
    },
    proficiency: 'alchemy',
  }

  it('renders a percentage once the estimate resolves for a matching mission', async () => {
    renderEstimate({ party: [baseChar], proficiencyTags: ['alchemy'] })
    await waitFor(() => expect(screen.getByText(/%$/)).toBeInTheDocument())
  })

  it('still renders a percentage with no matching proficiency (no crash, not a hard requirement)', async () => {
    renderEstimate({ party: [baseChar], proficiencyTags: [] })
    await waitFor(() => expect(screen.getByText(/%$/)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- WinChanceEstimate`
Expected: FAIL — `proficiencyTags` doesn't exist on the component's props type yet (TS error surfaces as a test failure/compile error).

- [ ] **Step 3: Implement — update `WinChanceEstimate.tsx`**

Replace the full contents of `src/features/missions/components/WinChanceEstimate.tsx` with:

```tsx
import { useMemo } from 'react'
import { resolveRole } from '@/lib/roles'
import { effectiveStats, mergeBonuses } from '@/lib/stats'
import { collectTraitBonuses } from '@/lib/traits'
import { resolveBlessingAllocations, capstoneEarned, resolveCapstoneBonuses } from '@/lib/blessings'
import { resolveProficiencyBonus } from '@/lib/proficiencies'
import { useItemDefs } from '@/hooks/useRoster'
import type { MissionEnemyView } from '@/services/missions'
import { estimateWinChance, missionTraitContext } from '../winChance'
import type { DispatchChar } from './dispatchSamples'

// The dispatch modal's "Estimated success" box: runs the real combat engine over
// ESTIMATE_RUNS random seeds for the currently selected party (see ../winChance.ts).
// When a member carries statInputs + traits (real roster data), their stats are RECOMPUTED
// with the mission's trait context — the same math mission-claim runs — so picking a
// Gravehand for a Gravemarch mission visibly moves the number (ADR-0035), and picking a
// proficient Utility character for a tagged mission does too (ADR-0059). Always renders
// (shows a "—" placeholder before a party is picked / while stat blocks are loading) so it
// doesn't pop the layout in and out next to Duration/Base XP.
export function WinChanceEstimate({ party, enemies, timeLimitSeconds, mapKey, proficiencyTags }: {
  party: DispatchChar[]
  enemies: MissionEnemyView[]
  timeLimitSeconds: number | null
  mapKey?: string | null
  proficiencyTags?: string[]
}) {
  const itemDefs = useItemDefs()

  const winPct = useMemo(() => {
    const withStats = party.filter((c): c is typeof c & { stats: Record<string, number> } => Boolean(c.stats))
    if (party.length === 0 || withStats.length !== party.length) return null
    const ctx = missionTraitContext(enemies, mapKey)
    return estimateWinChance({
      party: withStats.map((c) => ({
        id: c.id,
        role: resolveRole(c.charClass, c.role),
        stats:
          c.statInputs && itemDefs.data
            ? effectiveStats({
                level: c.level,
                baseStats: c.statInputs.baseStats,
                growth: c.statInputs.growth,
                blessingAllocations: resolveBlessingAllocations(c.blessings ?? {}),
                blessingNodes: c.statInputs.blessingNodes,
                equipped: c.equipped ?? {},
                itemDefs: itemDefs.data,
                extraBonuses: mergeBonuses(
                  collectTraitBonuses(c.traits ?? [], ctx),
                  resolveCapstoneBonuses(
                    c.statInputs.capstone,
                    capstoneEarned(c.level, c.blessings ?? {}),
                    ctx,
                  ),
                  resolveProficiencyBonus(c.proficiency, proficiencyTags),
                ),
              })
            : c.stats, // fixtures / defs still loading: context-free stats
        currentHp: c.currentHp,
        damageSchool: c.damageSchool,
        ability: c.ability,
      })),
      enemies,
      timeLimitSeconds,
    })
  }, [party, enemies, timeLimitSeconds, mapKey, proficiencyTags, itemDefs.data])

  const color = winPct == null ? 'var(--color-text-muted)' : winPct >= 70 ? '#5fc77e' : winPct >= 40 ? '#d89a4f' : '#e0635c'
  const border = winPct == null ? 'var(--color-gold-dark)' : winPct >= 70 ? '#2d6b45' : winPct >= 40 ? '#8c6020' : '#8a2e29'
  const glow = winPct == null ? 'transparent' : winPct >= 70 ? 'rgba(95,199,126,0.4)' : winPct >= 40 ? 'rgba(216,154,79,0.4)' : 'rgba(224,99,92,0.4)'
  return (
    <div className="atom-heavy" style={{
      flex: '1 1 220px', minWidth: 220, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px',
      padding: '12px 16px', borderRadius: '5px',
      border: `2px solid ${border}`,
      background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
    }}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
        Estimated success
        <span style={{ display: 'block', fontSize: '9px', letterSpacing: '0.5px', textTransform: 'none', fontStyle: 'italic', marginTop: '2px' }}>
          Traits & proficiency included
        </span>
      </span>
      <span style={{ fontSize: '18px', fontWeight: 'bold', color, textShadow: winPct == null ? 'none' : `0 0 10px ${glow}` }}>
        {winPct == null ? '—' : `${winPct}%`}
      </span>
    </div>
  )
}
```

- [ ] **Step 4: Pass the new prop from `MissionDispatch.tsx`**

Change line 89 of `src/features/missions/components/MissionDispatch.tsx` from:

```tsx
                <WinChanceEstimate party={party} enemies={mission.enemies} timeLimitSeconds={mission.timeLimitSeconds ?? null} mapKey={mission.mapKey} />
```

to:

```tsx
                <WinChanceEstimate party={party} enemies={mission.enemies} timeLimitSeconds={mission.timeLimitSeconds ?? null} mapKey={mission.mapKey} proficiencyTags={mission.proficiencyTags} />
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- WinChanceEstimate`
Expected: PASS.

- [ ] **Step 6: Run the full test suite + typecheck**

Run: `npm test && npm run build`
Expected: everything passes; no new type errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/missions/components/WinChanceEstimate.tsx src/features/missions/components/WinChanceEstimate.test.tsx src/features/missions/components/MissionDispatch.tsx
git commit -m "feat: apply proficiency bonus in the client win-chance estimate"
```

---

### Task 6: Server — apply the bonus in `mission-claim`

**Files:**
- Modify: `supabase/functions/mission-claim/index.ts:24` (import), `:82-96` (`MissionForClaim` type), `:97-107` (`CharDefRow` type), `:121-131` (`MISSION_GROQ`), `:133-140` (`CHARDEFS_GROQ`), `:255-260` (combatant-building `mergeBonuses` call)

**Interfaces:**
- Consumes: `resolveProficiencyBonus` from Task 1's `src/lib/proficiencies.ts` (imported the same way every other `src/lib` module is: `../../../src/lib/proficiencies.ts`).
- Produces: no new exports — the deployed function's combat resolution now folds in the same bonus the client estimate already applies.

- [ ] **Step 1: Add the import**

In `supabase/functions/mission-claim/index.ts`, add after line 24 (`import { collectTraitBonuses, ... } from '../../../src/lib/traits.ts'`):

```ts
import { resolveProficiencyBonus } from '../../../src/lib/proficiencies.ts'
```

- [ ] **Step 2: Extend `MISSION_GROQ` + `MissionForClaim`**

Change `MISSION_GROQ` (lines 121-131) — add `proficiencyTags` to the projection:

```ts
const MISSION_GROQ = `*[_type == "missionDef" && missionKey == $id][0]{
  baseXp, stage, proficiencyTags,
  "map": map->{ mapKey },
  rewards[]{ kind, code, amount },
  loot[]{ dropChance, quantityMin, quantityMax, rarityWeights[]{ rarity, weight }, "itemKey": item->itemKey },
  characterLootDrop[]{ dropChance, "charKey": character->charKey },
  encounter->{
    timeLimitSeconds,
    enemies[]{ count, "enemy": enemy->{ enemyKey, archetype, health, attack, damageType, speed, defense, resistance, resistances[]{ school, value }, block, critChance, critDamage, armorPen, dodge, healthRegen, spikeEverySeconds, spikeMultiplier } }
  }
}`
```

Add `proficiencyTags?: string[]` to `MissionForClaim` (after `stage?: number` at line 84):

```ts
  stage?: number
  proficiencyTags?: string[]
```

- [ ] **Step 3: Extend `CHARDEFS_GROQ` + `CharDefRow`**

Change `CHARDEFS_GROQ` (lines 133-140) — add `proficiency` to the projection:

```ts
const CHARDEFS_GROQ = `*[_type == "characterDef" && charKey in $keys]{
  charKey, charClass, role, damageSchool, proficiency,
  baseStats[]{ stat, value },
  growth[]{ stat, perLevel, milestones[]{ level, bonus } },
  blessingTree[]{ row, choices[]{ choiceId, effects[]{ stat, kind, value } } },
  capstone{ title, kind, effects[]{ stat, kind, value }, condition{ type, value }, abilityKind, abilityParams{ stat, kind, value } },
  traits[]->{ traitKey, name, condition{ type, value }, effects[]{ stat, kind, value } }
}`
```

Add `proficiency?: string | null` to `CharDefRow` (after `damageSchool?: School | null` at line 101):

```ts
  damageSchool?: School | null
  proficiency?: string | null
```

- [ ] **Step 4: Fold the bonus into the combatant loop**

Change the `extraBonuses: mergeBonuses(...)` call inside the `for (const c of chars)` loop (lines 255-260) from:

```ts
      extraBonuses: mergeBonuses(
        collectTraitBonuses(def.traits ?? [], traitCtx),
        resolveCapstoneBonuses(def.capstone, earnedCapstone, traitCtx),
        resolveCharAscendantBonuses(ascendantShop, def.charKey),
        resolveFlatAscendantStatBonuses(ascendantShop),
      ),
```

to:

```ts
      extraBonuses: mergeBonuses(
        collectTraitBonuses(def.traits ?? [], traitCtx),
        resolveCapstoneBonuses(def.capstone, earnedCapstone, traitCtx),
        resolveCharAscendantBonuses(ascendantShop, def.charKey),
        resolveFlatAscendantStatBonuses(ascendantShop),
        resolveProficiencyBonus(def.proficiency, mission.proficiencyTags),
      ),
```

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: succeeds — Edge Function `.ts` files are covered by the root `tsc -b` project the same way every other `src/lib`-importing function already is.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/mission-claim/index.ts
git commit -m "feat: apply proficiency bonus in the server-authoritative mission-claim sim"
```

- [ ] **Step 7: Deploy note (not executed by this plan)**

This Edge Function change requires a redeploy (`mcp__supabase__deploy_edge_function` or `supabase functions deploy mission-claim`) plus a byte-verify against the live deployment before it's actually live, per this repo's established Edge Function rollout discipline (see TODO.md's prior deploy entries for the exact pattern). Deployment is a separate, deliberate step — do not deploy as part of this plan's automated task loop; flag it for the user to trigger explicitly.

---

### Task 7: Mission card proficiency indicator

**Files:**
- Modify: `src/features/missions/components/MissionCard.tsx` (entire file — small, shown in full below)
- Modify: `src/features/missions/MissionsPage.tsx:208-226` (pass the new prop)

**Interfaces:**
- Consumes: `PROFICIENCY_BY_KEY` from Task 1's `src/lib/proficiencies.ts`; `ROLE_STYLES` from `src/lib/roles.ts` (already used elsewhere for role coloring); `GameMission.proficiencyTags` from Task 3.
- Produces: no new exports — `MissionCard` takes one more optional prop, `proficiencies?: string[]`.

Spec §4d: "Mission card gains a synergy indicator ... same slot pattern as the existing
elemental strong/weak line." The existing `resists`/`weakTo` line (`resistSummary.ts`) is
purely informational about the encounter — it doesn't check whether the player owns a
counter-geared character either. This task follows that exact precedent: display the
mission's proficiency tags (by label) in the same line, unconditionally when present, with
no roster-matching logic — simplest option consistent with how the codebase already treats
this slot (YAGNI: a "do I own a matching character" computed check is not what `resists`/
`weakTo` does today, so adding it here would be inconsistent, not merely simpler).

- [ ] **Step 1: Update `MissionCard.tsx`**

Replace the full contents of `src/features/missions/components/MissionCard.tsx` with:

```tsx
import { StatusTag } from '@/components/atoms/StatusTag'
import { IconSlot } from '@/components/atoms/IconSlot'
import { PrimaryButton } from '@/components/atoms/Button'
import { SCHOOL_DEFS, type School } from '@/lib/schools'
import { PROFICIENCY_BY_KEY } from '@/lib/proficiencies'
import { ROLE_STYLES } from '@/lib/roles'

// School-colored labels for the card's compact resist line (real school icons come later —
// design rule: no emoji icons).
function SchoolNames({ schools }: { schools: School[] }) {
  return (
    <>
      {schools.map((key, i) => {
        const s = SCHOOL_DEFS.find((d) => d.key === key)
        return s ? (
          <span key={key} style={{ color: s.color, fontSize: 11 }}>
            {s.label}{i < schools.length - 1 ? ',' : ''}
          </span>
        ) : null
      })}
    </>
  )
}

// A selectable available mission (maps to a Sanity missionDef). `gold`/`xp` are the BASE rewards
// before the win-gated multipliers; `dropCount` = number of loot-table entries. `stage` is a display
// tag for ordering/difficulty; `boss` = the map's stage-7 finale (ADR-0034 — harder, better loot,
// red treatment). `resists`/`weakTo` = the encounter's school summary (ADR-0033). `proficiencies` =
// the mission's optional proficiency tags (ADR-0059) — informational, same as resists/weakTo.
export function MissionCard({ name, stage, gold, xp, duration, dropCount, resists = [], weakTo = [], proficiencies = [], locked, boss, onSend }: { name: string; stage?: number; gold: number; xp: number; duration: string; dropCount: number; resists?: School[]; weakTo?: School[]; proficiencies?: string[]; locked?: boolean; boss?: boolean; onSend?: () => void }) {
  return (
    <div style={{
      width: 250, borderRadius: 8,
      border: `3px solid ${locked ? 'var(--color-gold-dark)' : boss ? '#8a2e29' : 'var(--color-gold-mid)'}`,
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: [
        '0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', 'inset 0 2px 8px rgba(0,0,0,0.6)',
        boss && !locked ? '0 0 14px rgba(160,45,40,0.35)' : null,
        '0 6px 18px rgba(0,0,0,0.75)',
      ].filter(Boolean).join(', '),
      overflow: 'hidden',
      opacity: locked ? 0.6 : 1,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '10px 12px', borderBottom: `2px solid ${boss && !locked ? '#5c1f1c' : 'var(--color-gold-dark)'}`,
        background: boss && !locked
          ? 'linear-gradient(180deg, rgba(160,45,40,0.20) 0%, rgba(160,45,40,0.04) 100%)'
          : 'linear-gradient(180deg, rgba(200,145,42,0.15) 0%, rgba(200,145,42,0.04) 100%)',
      }}>
        <span style={{ color: 'var(--color-gold-light)', fontSize: 14, fontWeight: 'bold', textShadow: '0 0 10px rgba(240,208,96,0.4)' }}>{name}</span>
        {locked
          ? <StatusTag tone="locked">Locked</StatusTag>
          : boss
            ? <StatusTag tone="danger">Boss</StatusTag>
            : stage != null ? <StatusTag tone="neutral">Stage {stage}</StatusTag> : null}
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <IconSlot size={16} /><span style={{ color: 'var(--color-text-gold)', fontSize: 13, fontWeight: 'bold' }}>{gold}</span>
          </span>
          <span style={{ color: 'var(--color-xp)', fontSize: 12, fontWeight: 'bold' }}>{xp} XP</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--color-text-muted)', fontSize: 12 }}>
            <IconSlot size={12} />{duration}
          </span>
        </div>
        {(resists.length > 0 || weakTo.length > 0 || proficiencies.length > 0) && (
          <p style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, color: 'var(--color-text-muted)', fontSize: 11, marginBottom: 10 }}>
            {resists.length > 0 && <>Resists <SchoolNames schools={resists} /></>}
            {resists.length > 0 && (weakTo.length > 0 || proficiencies.length > 0) && <span style={{ opacity: 0.6 }}>·</span>}
            {weakTo.length > 0 && <>Weak <SchoolNames schools={weakTo} /></>}
            {weakTo.length > 0 && proficiencies.length > 0 && <span style={{ opacity: 0.6 }}>·</span>}
            {proficiencies.length > 0 && (
              <span style={{ color: ROLE_STYLES.utility.color, fontSize: 11 }}>
                Proficiency: {proficiencies.map((key) => PROFICIENCY_BY_KEY[key]?.label ?? key).join(', ')}
              </span>
            )}
          </p>
        )}
        <p style={{ color: 'var(--color-text-muted)', fontSize: 11, marginBottom: 12, fontStyle: 'italic' }}>
          {dropCount} possible drop{dropCount === 1 ? '' : 's'} · base rewards, before win bonuses
        </p>
        {locked
          ? <p style={{ color: 'var(--color-text-muted)', fontSize: 12, textAlign: 'center', padding: '9px 0' }}>{stage != null && stage > 1 ? `Clear stage ${stage - 1} first` : 'Locked'}</p>
          : <PrimaryButton fullWidth onClick={onSend}>Send Party</PrimaryButton>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Pass the prop from `MissionsPage.tsx`**

Change the `<MissionCard>` call (currently lines 212-225) from:

```tsx
                  <MissionCard
                    key={m.missionKey}
                    name={m.name}
                    stage={m.stage ?? undefined}
                    boss={m.stage === BOSS_STAGE}
                    locked={locked}
                    gold={m.baseGold}
                    xp={m.baseXp}
                    duration={fmtDuration(m.durationSeconds)}
                    dropCount={m.loot.length}
                    resists={strong}
                    weakTo={weak}
                    onSend={locked ? undefined : () => setDispatchKey(m.missionKey)}
                  />
```

to:

```tsx
                  <MissionCard
                    key={m.missionKey}
                    name={m.name}
                    stage={m.stage ?? undefined}
                    boss={m.stage === BOSS_STAGE}
                    locked={locked}
                    gold={m.baseGold}
                    xp={m.baseXp}
                    duration={fmtDuration(m.durationSeconds)}
                    dropCount={m.loot.length}
                    resists={strong}
                    weakTo={weak}
                    proficiencies={m.proficiencyTags}
                    onSend={locked ? undefined : () => setDispatchKey(m.missionKey)}
                  />
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run build`
Expected: succeeds with no new type errors. (No dedicated test file — `MissionCard.tsx` has none today, a presentation-only component consistent with this repo's pattern of testing `src/lib`/hooks logic, not styled JSX layout.)

- [ ] **Step 4: Commit**

```bash
git add src/features/missions/components/MissionCard.tsx src/features/missions/MissionsPage.tsx
git commit -m "feat: show proficiency tags on the mission card"
```

---

### Task 8: Record the decision — ADR-0059

**Files:**
- Modify: `docs/DECISIONS.md` (append a new ADR at the end of the file, following the existing ADR format)

**Interfaces:**
- Consumes: nothing (documentation only).
- Produces: nothing consumed by other tasks — this is the terminal task.

- [ ] **Step 1: Read the end of the file to confirm the insertion point**

Run: `tail -40 docs/DECISIONS.md` (or open the file) to find the end of ADR-0058 and match its heading/section style exactly (look at `## ADR-0058 — ...` and its `**Status:**`/`**Context:**`/`**Decision:**`/`**Consequences:**` structure).

- [ ] **Step 2: Append the new ADR**

Add after ADR-0058's content, matching the file's existing ADR structure:

```markdown
## ADR-0059 — Utility role conditional proficiency

**Status:** Accepted (2026-09-20)

**Context:** ADR-0013 fork 6 deliberately left the Utility role (Druid/Bard/Engineer/
Brewmaster/Painter) without a passive combat expression; ADR-0014 confirmed Utility
characters fought as generic combatants in the meantime. The player's framing: Utility's
identity should be *conditional* — proficient in something specific (e.g. Alchemy), useful
on missions where that applies, ordinary elsewhere. Full design:
`docs/superpowers/specs/2026-09-20-utility-proficiency-design.md`.

**Decision:** A new registry, `src/lib/proficiencies.ts` (`PROFICIENCY_DEFS`,
`PROFICIENCY_BY_KEY`, `resolveProficiencyBonus`), defines proficiency keys and their
flat/pct stat effects — the same `{flat, pct}` shape gear/blessings/traits already use.
`characterDef.proficiency` (new, optional, Utility-role-exclusive by studio validation) and
`missionDef.proficiencyTags` (new, optional, sparse — not a forced per-map/per-mission
categorization) carry the authored data. When a character's proficiency is present in the
mission's tags, they receive their own personal stat bonus for that fight — never
party-wide, never a direct win-chance probability tweak (the bonus modifies the sim's
inputs, same rule `traits.ts` already established). One shared function,
`resolveProficiencyBonus()`, is called from both the client's win-chance estimator
(`WinChanceEstimate.tsx`) and the server-authoritative `mission-claim` Edge Function, so the
two never drift.

Proficiency is a **fixed authored trait** decided at recruitment — not trained via the
Skills system (`skill_assignments`), and not folded into `traitDef`'s point-buy-budgeted
trait system (a different kind of thing: a static per-mission-attempt match, not a live
combat-state condition).

**Consequences:** Adding proficiency #2 is a one-line `PROFICIENCY_DEFS` entry plus
opportunistic authoring in Studio — no migration, no new RPC, no new Edge Function
(ADR-0004). Initial stat-effect values ship as placeholders pending a `docs/BALANCE.md`
before/after sweep (not done in this ADR's implementation pass). Hard content gating
("this dungeon requires a proficient character") remains explicitly deferred — the data
model already carries what a future gate check would read, but the gate mechanism and
soft-lock UX are undesigned.
```

- [ ] **Step 3: Commit**

```bash
git add docs/DECISIONS.md
git commit -m "docs: add ADR-0059 for Utility role conditional proficiency"
```

- [ ] **Step 4: Push the branch**

```bash
git push -u origin docs/utility-proficiency-design
```
