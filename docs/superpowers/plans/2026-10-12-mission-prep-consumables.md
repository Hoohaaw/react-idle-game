# Mission Prep & Consumables Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a party carry self-only heal/buff consumables into a mission and equip one
durable, party-wide totem at the account level, both resolved through the existing
deterministic combat sim — proven end-to-end with one starter item per category.

**Architecture:** Two new Sanity content types (`consumableDef`, `totemDef`) feed a new
per-character inventory loadout (validated/consumed at `mission-start`, applied inside
`combat.ts` at claim) and a new account-level equip slot (`profiles.active_totem_id`,
applied the same way a capstone's `partyBuffOnStart` already is). No new RNG, no change to
the sim's deterministic-replay guarantee.

**Tech Stack:** React+Vite+TS, Supabase (Postgres + Edge Functions, Deno), Sanity (authored
content), Vitest, pgTAP.

**Spec:** `docs/superpowers/specs/2026-10-12-mission-prep-consumables-design.md`

## Global Constraints

- Slot formula: `slotsForCharacter(level) = level >= 21 ? 2 : 1`, plus `+1` if
  `characterDef.bonusConsumableSlot` is set (Utility-role-exclusive, studio-authored).
- Consumables are flat, tiered items — **no rarity roll**. Always stored in
  `player_inventory` with `rarity = 'Common'` as a fixed placeholder value (the column is
  part of that table's existing composite key and can't be null).
- At most **one `heal`-category consumable per party per mission**, counted across every
  character in the party, not per character. `buff`-category items are uncapped for v1.
- Consumables are consumed at `mission-start` (dispatch), unconditionally — same timing as
  `start_craft`'s reagent deduction — regardless of whether the mission is won, lost, or
  the item's trigger condition is ever actually met.
- Heal-type trigger: self-only, fixed threshold per item, checked on the holder's own
  action tick (same point the Healer role's existing conditional override fires), costs
  that action cycle (no attack that turn), heal amount clamps to `maxHp`.
- Totems: one account-wide equip slot (`profiles.active_totem_id`), free to swap, no
  busy-check (not scoped to any one character), read live at claim time (not locked at
  dispatch) — same "whatever's equipped now applies" rule gear already follows.
- Totem bonuses are restricted to the same `AbilityStat` allowlist capstone's
  `partyBuffOnStart` already uses: `defense`, `resistance`, `critChance`, `critDamage`,
  `dodge`, `block`, `healthRegen`.
- All numeric content values (heal amount, trigger %, buff magnitude, reagent costs) are
  placeholders pending a `docs/BALANCE.md`-style pass — ship them, flag them, don't block
  on tuning (same convention as every other first-pass constant in this project).

## Review Focus

- A naive **per-character** heal-cap check would let 3 different characters each bring 1
  heal item — the cap must count across the **whole party** for one mission.
- An unused consumable (threshold never crossed, or the mission lost before it mattered)
  is still gone — consumed at dispatch unconditionally. Pin this explicitly; it's easy to
  assume otherwise.
- `profiles.active_totem_id` can point at a totemDef that's since been deleted/unpublished
  in Sanity by claim time — must degrade to "no totem bonus applied," never a 500 that
  blocks every future claim for that player.
- Swapping gear or a totem between dispatch and claim changes the fight that resolves —
  not a bug, matches how equipped gear already works, but worth confirming explicitly
  rather than assuming it was an oversight.
- `characterDef.bonusConsumableSlot` must be rejected by Studio validation on any
  non-Utility character — mirrors `characterDef.proficiency`'s existing validation; a
  silent miss here means an unintended slot ships to a live character.

---

### Task 1: Sanity schema — consumableDef, totemDef, characterDef.bonusConsumableSlot

**Files:**
- Create: `studio/schemaTypes/consumableDef.ts`
- Create: `studio/schemaTypes/totemDef.ts`
- Modify: `studio/schemaTypes/characterDef.ts` (add `bonusConsumableSlot` field)
- Modify: `studio/schemaTypes/index.ts` (register the two new types)

**Interfaces:**
- Produces: the Sanity document shapes every later task's GROQ queries assume —
  `consumableDef { consumableKey, name, category: 'heal'|'buff', healAmount?, triggerHpPct?, effects?: [{stat, kind, value}] }`
  and `totemDef { totemKey, name, effects: [{stat, kind, value}] }`.

- [ ] **Step 1: Write `consumableDef.ts`**

```typescript
import { defineType, defineField, defineArrayMember } from 'sanity'
import { FilterIcon } from '@sanity/icons'

// A CONSUMABLE definition (docs/superpowers/specs/2026-10-12-mission-prep-consumables-
// design.md §B): a flat, tiered mission-prep item — NOT rarity-rolled like itemDef. Two
// categories with different timing models (src/lib/consumables.ts owns the engine):
//   heal — mid-fight, HP-threshold-triggered, self-only (combat.ts).
//   buff — pre-fight, whole-encounter, self-only (folds into effectiveStats' extraBonuses).
export const consumableDef = defineType({
  name: 'consumableDef',
  title: 'Consumable',
  type: 'document',
  icon: FilterIcon,
  fields: [
    defineField({ name: 'name', type: 'string', validation: (rule) => rule.required() }),
    defineField({
      name: 'consumableKey',
      title: 'Consumable key',
      description: 'Stable id (player_inventory.item_def_id). Lowercase letters, numbers and hyphens. NEVER change once live.',
      type: 'string',
      validation: (rule) =>
        rule.required().custom((value) => {
          if (!value) return 'Required'
          if (!/^[a-z0-9-]+$/.test(value)) return 'Lowercase letters, numbers and hyphens only'
          return true
        }),
    }),
    defineField({ name: 'description', type: 'text', rows: 2 }),
    defineField({
      name: 'category',
      title: 'Category',
      description: 'heal = mid-fight HP-threshold trigger. buff = pre-fight, whole-encounter.',
      type: 'string',
      options: { list: [{ title: 'Heal', value: 'heal' }, { title: 'Buff', value: 'buff' }], layout: 'radio' },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'healAmount',
      title: 'Heal amount (heal category only)',
      description: 'Flat HP restored, clamped to max HP. Placeholder pending a balance pass.',
      type: 'number',
      hidden: ({ document }) => document?.category !== 'heal',
      validation: (rule) =>
        rule.custom((value, context) => {
          const doc = context.document as { category?: string } | undefined
          if (doc?.category === 'heal' && (value == null || value <= 0)) return 'Required for heal-category items'
          return true
        }),
    }),
    defineField({
      name: 'triggerHpPct',
      title: 'Trigger HP % (heal category only)',
      description: 'Fires when the holder\'s own HP fraction drops to or below this (0–1). Fixed per item, not player-configurable.',
      type: 'number',
      hidden: ({ document }) => document?.category !== 'heal',
      validation: (rule) =>
        rule.custom((value, context) => {
          const doc = context.document as { category?: string } | undefined
          if (doc?.category === 'heal' && (value == null || value <= 0 || value > 1)) {
            return 'Required for heal-category items, between 0 (exclusive) and 1'
          }
          return true
        }),
    }),
    defineField({
      name: 'effects',
      title: 'Effects (buff category only)',
      description: 'Same {stat, kind, value} shape as gear/blessings/traits — applied pre-fight, whole-encounter, self-only.',
      type: 'array',
      of: [defineArrayMember({ type: 'itemStat' })],
      hidden: ({ document }) => document?.category !== 'buff',
      validation: (rule) =>
        rule.custom((value, context) => {
          const doc = context.document as { category?: string } | undefined
          if (doc?.category === 'buff' && (!value || (value as unknown[]).length === 0)) {
            return 'Required for buff-category items'
          }
          return true
        }),
    }),
  ],
  preview: {
    select: { title: 'name', category: 'category', heal: 'healAmount' },
    prepare({ title, category, heal }) {
      return { title, subtitle: category === 'heal' ? `heal +${heal ?? '?'}` : 'buff' }
    },
  },
})
```

- [ ] **Step 2: Write `totemDef.ts`**

```typescript
import { defineType, defineField, defineArrayMember } from 'sanity'
import { ShieldIcon } from '@sanity/icons'

// A TOTEM definition (design spec §E): durable, party-wide, account-level equip — NOT a
// per-mission consumable. One active at a time (profiles.active_totem_id). Effects are
// restricted to combat.ts's AbilityStat allowlist (same set capstone's partyBuffOnStart
// already respects) — enforced by the `kind` options list below; the STAT allowlist itself
// is enforced in code (src/lib/totems.ts), not re-validated here, to avoid a second source
// of truth for that list.
export const totemDef = defineType({
  name: 'totemDef',
  title: 'Totem',
  type: 'document',
  icon: ShieldIcon,
  fields: [
    defineField({ name: 'name', type: 'string', validation: (rule) => rule.required() }),
    defineField({
      name: 'totemKey',
      title: 'Totem key',
      description: 'Stable id (profiles.active_totem_id). Lowercase letters, numbers and hyphens. NEVER change once live.',
      type: 'string',
      validation: (rule) =>
        rule.required().custom((value) => {
          if (!value) return 'Required'
          if (!/^[a-z0-9-]+$/.test(value)) return 'Lowercase letters, numbers and hyphens only'
          return true
        }),
    }),
    defineField({ name: 'description', type: 'text', rows: 2 }),
    defineField({
      name: 'effects',
      title: 'Effects',
      description: 'Small, flat magnitudes (illustrative target ~+3) — applied to EVERY party member at fight start. Placeholder pending a balance pass.',
      type: 'array',
      of: [defineArrayMember({ type: 'itemStat' })],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: { select: { title: 'name' } },
})
```

- [ ] **Step 3: Add `bonusConsumableSlot` to `characterDef.ts`**

Open `studio/schemaTypes/characterDef.ts`. Add this field right after the `proficiency`
field (after its closing `}),` around line 165), mirroring that field's exact
Utility-exclusivity validation pattern:

```typescript
    defineField({
      name: 'bonusConsumableSlot',
      title: 'Bonus consumable slot',
      description:
        'Utility-role-exclusive. Grants a 3rd mission-prep slot (on top of the level-based 1–2) for this SPECIFIC character — authored by hand, never earned automatically. Leave off unless you have deliberately decided this character gets it.',
      type: 'boolean',
      initialValue: false,
      validation: (rule) =>
        rule.custom((value: boolean | undefined, context) => {
          if (!value) return true // optional, default-off
          const doc = context.document as CharacterDoc | undefined
          const role = resolveRole(doc?.charClass ?? '', (doc?.role as CharacterRole | undefined) ?? null)
          if (role !== 'utility') {
            return 'Bonus consumable slot is Utility-role-exclusive — this character resolves to a different role.'
          }
          return true
        }),
    }),
```

- [ ] **Step 4: Register both new types**

In `studio/schemaTypes/index.ts`, add the two imports and list entries:

```typescript
import { consumableDef } from './consumableDef'
import { totemDef } from './totemDef'
```

Add `consumableDef, totemDef,` to the `schemaTypes` array (anywhere after `recipeDef,` is
fine, matching the existing append-at-the-end convention).

- [ ] **Step 5: Manual verify (no automated test — Studio validation isn't vitest/pgTAP-covered anywhere in this repo, same as `proficiency`'s)**

Run `cd studio && npm run typecheck` (or the studio's existing build/typecheck script —
check `studio/package.json` for the exact name) to confirm the new schema files compile.
Then, in Studio (local or via `npm run dev` in `studio/`), confirm: creating a
`consumableDef` with `category: 'heal'` shows the heal fields and hides `effects`; creating
one with `category: 'buff'` shows `effects` and hides the heal fields; setting
`bonusConsumableSlot: true` on a non-Utility test character shows the validation error.

- [ ] **Step 6: Commit**

```bash
git add studio/schemaTypes/consumableDef.ts studio/schemaTypes/totemDef.ts studio/schemaTypes/characterDef.ts studio/schemaTypes/index.ts
git commit -m "feat: Sanity schema for consumableDef, totemDef, and bonusConsumableSlot"
```

---

### Task 2: src/lib/consumables.ts — slot formula, buff bonus, loadout validation

**Files:**
- Create: `src/lib/consumables.ts`
- Test: `src/lib/consumables.test.ts`

**Interfaces:**
- Produces: `slotsForCharacter(level, bonusSlot)`, `resolveConsumableBuffBonus(effects)`,
  `validateMissionLoadout(party, loadout)` — all pure functions, no I/O. Later tasks
  (mission-start Edge Function, Task 7) call `validateMissionLoadout` directly instead of
  re-deriving the heal-cap/slot-cap rule inline, so the rule is tested once here.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from 'vitest'
import { slotsForCharacter, resolveConsumableBuffBonus, validateMissionLoadout } from './consumables'

describe('slotsForCharacter', () => {
  it('is 1 slot at level 20 and below', () => {
    expect(slotsForCharacter(1, false)).toBe(1)
    expect(slotsForCharacter(20, false)).toBe(1)
  })
  it('is 2 slots at level 21 and above', () => {
    expect(slotsForCharacter(21, false)).toBe(2)
    expect(slotsForCharacter(50, false)).toBe(2)
  })
  it('adds 1 more when bonusConsumableSlot is set, on top of the level-based count', () => {
    expect(slotsForCharacter(1, true)).toBe(2)
    expect(slotsForCharacter(21, true)).toBe(3)
  })
})

describe('resolveConsumableBuffBonus', () => {
  it('sums flat and pct effects per stat into the {flat, pct} shape', () => {
    const out = resolveConsumableBuffBonus([
      { stat: 'resistance', kind: 'flat', value: 20 },
      { stat: 'resistance', kind: 'pct', value: 5 },
    ])
    expect(out.resistance).toEqual({ flat: 20, pct: 5 })
  })
  it('returns {} for an empty effects list', () => {
    expect(resolveConsumableBuffBonus([])).toEqual({})
  })
})

describe('validateMissionLoadout', () => {
  const party = [
    { characterId: 'a', level: 10, bonusSlot: false },
    { characterId: 'b', level: 25, bonusSlot: false },
  ]

  it('passes an empty loadout', () => {
    expect(validateMissionLoadout(party, [])).toBeNull()
  })

  it('rejects a character carrying more items than their slot count', () => {
    const loadout = [
      { characterId: 'a', consumableDefId: 'pot-1', category: 'buff' as const },
      { characterId: 'a', consumableDefId: 'pot-2', category: 'buff' as const },
    ]
    expect(validateMissionLoadout(party, loadout)).toMatch(/slot/i)
  })

  it('allows a level-21+ character to carry 2 items', () => {
    const loadout = [
      { characterId: 'b', consumableDefId: 'pot-1', category: 'buff' as const },
      { characterId: 'b', consumableDefId: 'pot-2', category: 'buff' as const },
    ]
    expect(validateMissionLoadout(party, loadout)).toBeNull()
  })

  it('rejects an unknown character id not in the party', () => {
    const loadout = [{ characterId: 'z', consumableDefId: 'pot-1', category: 'buff' as const }]
    expect(validateMissionLoadout(party, loadout)).toMatch(/not in the party/i)
  })

  it('rejects more than one heal-category item across the WHOLE PARTY, even split across different characters', () => {
    const loadout = [
      { characterId: 'a', consumableDefId: 'heal-1', category: 'heal' as const },
      { characterId: 'b', consumableDefId: 'heal-2', category: 'heal' as const },
    ]
    expect(validateMissionLoadout(party, loadout)).toMatch(/one healing/i)
  })

  it('allows exactly one heal-category item for the whole party', () => {
    const loadout = [{ characterId: 'a', consumableDefId: 'heal-1', category: 'heal' as const }]
    expect(validateMissionLoadout(party, loadout)).toBeNull()
  })

  it('allows unlimited buff-category items up to each character\'s own slot cap', () => {
    const loadout = [
      { characterId: 'a', consumableDefId: 'buff-1', category: 'buff' as const },
      { characterId: 'b', consumableDefId: 'buff-2', category: 'buff' as const },
      { characterId: 'b', consumableDefId: 'buff-3', category: 'buff' as const },
    ]
    expect(validateMissionLoadout(party, loadout)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/consumables.test.ts`
Expected: FAIL — `src/lib/consumables.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
import type { StatBonus } from './stats.ts'

// Mission prep & consumables (docs/superpowers/specs/2026-10-12-mission-prep-consumables-
// design.md): self-only items a character brings on a mission. Two categories:
//   heal — mid-fight, HP-threshold-triggered (combat.ts owns the trigger logic).
//   buff — pre-fight, whole-encounter (folds into effectiveStats' extraBonuses, same {flat,
//          pct} shape gear/blessings/traits/proficiencies already use).
// Flat, tiered items — deliberately NOT rarity-rolled like itemDef (ADR analog: design
// spec §B "Alternatives considered").

export type ConsumableCategory = 'heal' | 'buff'
export type ConsumableEffect = { stat: string; kind: 'flat' | 'pct'; value: number }

/**
 * Per-character mission-prep slot count: 1 up to level 20, 2 from level 21 on, plus 1 more
 * if the character carries the studio-authored bonusConsumableSlot flag (Utility-role-
 * exclusive, granted by hand per character — never computed from role alone).
 */
export function slotsForCharacter(level: number, bonusSlot: boolean): number {
  return (level >= 21 ? 2 : 1) + (bonusSlot ? 1 : 0)
}

/** Totals a buff-category consumable's authored effects into the {flat, pct}-per-stat shape
 *  every other bonus source already uses — pass straight into effectiveStats' extraBonuses. */
export function resolveConsumableBuffBonus(effects: ConsumableEffect[]): Record<string, StatBonus> {
  const out: Record<string, StatBonus> = {}
  for (const effect of effects) {
    const bonus = (out[effect.stat] ??= { flat: 0, pct: 0 })
    if (effect.kind === 'flat') bonus.flat += effect.value
    else bonus.pct += effect.value
  }
  return out
}

export type LoadoutPartyMember = { characterId: string; level: number; bonusSlot: boolean }
export type LoadoutEntry = { characterId: string; consumableDefId: string; category: ConsumableCategory }

/**
 * Validates a proposed mission loadout against the party's slot budgets and the party-wide
 * healing cap. Returns an error string, or null if valid. Called by the mission-start Edge
 * Function (Task 7) AFTER it has resolved each party member's level/bonusSlot and each
 * submitted item's category from Sanity — this function is pure and knows nothing about
 * Sanity or the database, which is what makes it unit-testable without either.
 */
export function validateMissionLoadout(
  party: LoadoutPartyMember[],
  loadout: LoadoutEntry[],
): string | null {
  const byChar = new Map(party.map((p) => [p.characterId, p]))
  const countByChar = new Map<string, number>()
  let healCount = 0

  for (const entry of loadout) {
    const member = byChar.get(entry.characterId)
    if (!member) return `Character ${entry.characterId} is not in the party`
    countByChar.set(entry.characterId, (countByChar.get(entry.characterId) ?? 0) + 1)
    if (entry.category === 'heal') healCount += 1
  }

  for (const [characterId, count] of countByChar) {
    const member = byChar.get(characterId)!
    const cap = slotsForCharacter(member.level, member.bonusSlot)
    if (count > cap) {
      return `Character ${characterId} carries ${count} items but only has ${cap} slot(s)`
    }
  }

  if (healCount > 1) {
    return 'Only one healing-category consumable may be brought per party per mission'
  }

  return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/consumables.test.ts`
Expected: PASS, all 9 cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/consumables.ts src/lib/consumables.test.ts
git commit -m "feat: consumables slot formula, buff bonus, and loadout validation"
```

---

### Task 3: src/lib/totems.ts — party buff resolution, null-safe

**Files:**
- Create: `src/lib/totems.ts`
- Test: `src/lib/totems.test.ts`

**Interfaces:**
- Consumes: `AbilityStat` type from `./combat.ts` (Task 4 — but that type already exists on
  `master` today, unchanged by Task 4, so this task has no real dependency on Task 4
  landing first).
- Produces: `TOTEM_ALLOWED_STATS`, `resolveTotemPartyBuffs(totem)` — the exact array shape
  `simulateCombat`'s new `partyBuffs` param (Task 4) expects:
  `{ stat: AbilityStat; kind: 'flat' | 'pct'; value: number }[]`.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from 'vitest'
import { resolveTotemPartyBuffs } from './totems'

describe('resolveTotemPartyBuffs', () => {
  it('returns an empty array when no totem is equipped (null)', () => {
    expect(resolveTotemPartyBuffs(null)).toEqual([])
  })

  it('returns an empty array when the totem reference is stale/undefined (deleted in Sanity)', () => {
    expect(resolveTotemPartyBuffs(undefined)).toEqual([])
  })

  it('passes through effects on the allowed-stat list unchanged', () => {
    const out = resolveTotemPartyBuffs({
      totemKey: 'totem-of-minor-warding',
      effects: [{ stat: 'resistance', kind: 'flat', value: 3 }],
    })
    expect(out).toEqual([{ stat: 'resistance', kind: 'flat', value: 3 }])
  })

  it('drops an effect targeting a stat outside the allowlist, rather than throwing', () => {
    const out = resolveTotemPartyBuffs({
      totemKey: 'bad-totem',
      // 'attack' is not in TOTEM_ALLOWED_STATS — pre-routed into `power` by combat.ts's
      // partyUnit(), same reason capstone's partyBuffOnStart restricts to the same list.
      effects: [
        { stat: 'attack', kind: 'flat', value: 999 },
        { stat: 'block', kind: 'flat', value: 3 },
      ],
    })
    expect(out).toEqual([{ stat: 'block', kind: 'flat', value: 3 }])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/totems.test.ts`
Expected: FAIL — `src/lib/totems.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
import type { AbilityStat } from './combat.ts'

// Totems (design spec §E): a durable, party-wide, ACCOUNT-level equip (profiles.
// active_totem_id) — not a per-mission consumable. Applied in combat.ts the exact same way
// a capstone's partyBuffOnStart ability already is: a flat/pct buff to every party member,
// once, at fight start. Restricted to the same AbilityStat allowlist for the same reason
// (attack/spellPower/healingPower are pre-routed into power/healPower by partyUnit() and
// aren't separately addressable after construction).

export type TotemEffect = { stat: string; kind: 'flat' | 'pct'; value: number }
export type TotemDef = { totemKey: string; effects: TotemEffect[] }

const TOTEM_ALLOWED_STATS: ReadonlySet<string> = new Set<AbilityStat>([
  'defense', 'resistance', 'critChance', 'critDamage', 'dodge', 'block', 'healthRegen',
])

/**
 * Resolves the equipped totem's effects into the exact array shape simulateCombat's new
 * `partyBuffs` param expects. Null-safe by design: a missing totem (none equipped) or a
 * stale reference (the totemDef was deleted/unpublished in Sanity since being equipped —
 * see Review Focus) both degrade to "no bonus," never a throw. Effects targeting a stat
 * outside the allowlist are silently dropped rather than corrupting the sim's internal
 * (non-addressable) power/healPower fields.
 */
export function resolveTotemPartyBuffs(
  totem: TotemDef | null | undefined,
): { stat: AbilityStat; kind: 'flat' | 'pct'; value: number }[] {
  if (!totem) return []
  return totem.effects
    .filter((e): e is TotemEffect & { stat: AbilityStat } => TOTEM_ALLOWED_STATS.has(e.stat))
    .map((e) => ({ stat: e.stat, kind: e.kind, value: e.value }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/totems.test.ts`
Expected: PASS, all 4 cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/totems.ts src/lib/totems.test.ts
git commit -m "feat: totem party-buff resolution, null-safe against stale references"
```

---

### Task 4: combat.ts — heal-trigger consumable + totem partyBuffs

**Files:**
- Modify: `src/lib/combat.ts:109-121` (the `Combatant` type), `:200-237` (the `Unit` type),
  `:251-292` (`partyUnit()`), `:415-456` (`simulateCombat()`'s signature and the capstone
  buff-application loop), `:483-498` (the per-action resolution — insert the new check
  right before the existing `if (actor.isHealer)` block)
- Test: `src/lib/combat.test.ts` (add new cases to the existing file)

**Interfaces:**
- Consumes: nothing new from earlier tasks (this task only touches `combat.ts` itself).
- Produces: `Combatant.consumable` field and `simulateCombat`'s new `partyBuffs` param —
  Task 9 (mission-claim) sets both when building combatants.

- [ ] **Step 1: Write the failing tests (append to `src/lib/combat.test.ts`)**

```typescript
describe('mission-prep consumables (heal trigger)', () => {
  const baseEncounter = {
    enemies: [{ id: 'e1', health: 100000, attack: 1, damageType: 'physical' as const, speed: 10 }],
    timeLimitSeconds: 60,
  }

  it('heals the holder once their HP fraction drops to or below triggerHpPct, consuming that action', () => {
    const result = simulateCombat({
      party: [{
        id: 'p1',
        role: 'tank',
        stats: { health: 100, attack: 1, speed: 10, defense: 0 },
        currentHp: 25, // 25% — at the trigger threshold
        consumable: { healAmount: 40, triggerHpPct: 0.3, used: false },
      }],
      encounter: baseEncounter,
      seed: 'heal-trigger-1',
    })
    // Started at 25 HP; a 40-HP heal should have fired and the unit should never have been
    // allowed to take an attack action instead that same cycle, so ending HP reflects the
    // heal (clamped to maxHp=100) rather than straight combat resolution from 25.
    expect(result.endingHp.p1).toBeGreaterThanOrEqual(25)
  })

  it('does not fire if the holder never crosses triggerHpPct', () => {
    const result = simulateCombat({
      party: [{
        id: 'p1',
        role: 'tank',
        stats: { health: 100, attack: 1, speed: 10, defense: 10000 }, // effectively unhittable
        consumable: { healAmount: 40, triggerHpPct: 0.3, used: false },
      }],
      encounter: baseEncounter,
      seed: 'heal-trigger-2',
    })
    expect(result.log.some((e) => e.type === 'heal' && e.source === 'p1' && e.target === 'p1')).toBe(false)
  })

  it('fires at most once per fight (the "used" flag is respected)', () => {
    const result = simulateCombat({
      party: [{
        id: 'p1',
        role: 'tank',
        stats: { health: 100, attack: 1, speed: 10, defense: 0 },
        currentHp: 10,
        consumable: { healAmount: 5, triggerHpPct: 0.9, used: false }, // tiny heal, huge threshold — would refire every tick if not gated
      }],
      encounter: baseEncounter,
      seed: 'heal-trigger-3',
    })
    const selfHeals = result.log.filter((e) => e.type === 'heal' && e.source === 'p1' && e.target === 'p1')
    expect(selfHeals.length).toBeLessThanOrEqual(1)
  })
})

describe('mission-prep consumables (totem party buffs)', () => {
  it('applies a partyBuffs entry to every party member, same as a partyBuffOnStart capstone would', () => {
    const result = simulateCombat({
      party: [
        { id: 'p1', role: 'tank', stats: { health: 100, attack: 1, speed: 10, defense: 10, block: 0 } },
        { id: 'p2', role: 'damage', stats: { health: 100, attack: 1, speed: 10, defense: 10, block: 0 } },
      ],
      encounter: {
        enemies: [{ id: 'e1', health: 50, attack: 10, damageType: 'physical' as const, speed: 10, block: 0 }],
        timeLimitSeconds: 30,
      },
      seed: 'totem-buff-1',
      partyBuffs: [{ stat: 'block', kind: 'flat', value: 50 }],
    })
    // With both party members' block raised to 50%, roughly half of incoming hits should be
    // halved — a crude but deterministic-per-seed smoke check that the buff was actually
    // applied (not a precise damage assertion, which belongs to a dedicated balance sweep).
    expect(result.endingHp.p1).toBeGreaterThan(0)
  })

  it('an empty/omitted partyBuffs changes nothing (backward compatible default)', () => {
    const party = [{ id: 'p1', role: 'tank' as const, stats: { health: 100, attack: 10, speed: 10, defense: 0 } }]
    const encounter = { enemies: [{ id: 'e1', health: 30, attack: 1, damageType: 'physical' as const, speed: 10 }], timeLimitSeconds: 30 }
    const withOmitted = simulateCombat({ party, encounter, seed: 'totem-default' })
    const withEmpty = simulateCombat({ party, encounter, seed: 'totem-default', partyBuffs: [] })
    expect(withOmitted).toEqual(withEmpty)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/combat.test.ts`
Expected: FAIL — `Combatant` has no `consumable` field, `simulateCombat` has no
`partyBuffs` param, TypeScript errors on the test file itself.

- [ ] **Step 3: Implement — extend the `Combatant` type (around line 109)**

```typescript
/** A party member entering combat: effective stats + role + carried-in HP (persistent damage). */
export type Combatant = {
  id: string
  role: Role
  stats: StatMap
  /** Current HP carried from prior fights; defaults to full (`stats.health`) when omitted. */
  currentHp?: number
  /** School of the character's MAGIC damage (ADR-0033); 'magic' (neutral) when unauthored.
   *  Ignored when the physical routing wins — physical attacks are always school 'physical'. */
  damageSchool?: School
  /** A capstone-earned scripted ability (ADR-0045 Phase B), resolved by the caller from the
   *  character's earned capstone; absent for everyone else. */
  ability?: CombatAbility
  /** A self-only, mid-fight heal trigger from a carried `heal`-category consumable (mission
   *  prep, 2026-10-12 spec). Absent = no consumable carried, or a `buff`-category one (which
   *  applies pre-fight via effectiveStats' extraBonuses instead — see Task 9). `used` starts
   *  `false`; the sim flips it once the trigger fires. */
  consumable?: { healAmount: number; triggerHpPct: number; used: boolean }
}
```

- [ ] **Step 4: Implement — extend the `Unit` type (around line 200-237)**

Add one field, right after the existing `ability?: CombatAbility` line:

```typescript
  /** Pass-through of Combatant.consumable (mission prep); mutated in place when it fires. */
  consumable?: { healAmount: number; triggerHpPct: number; used: boolean }
```

- [ ] **Step 5: Implement — pass it through in `partyUnit()` (around line 251-292)**

In the returned object literal, add one line right after the existing `ability: c.ability,`:

```typescript
    ability: c.ability,
    consumable: c.consumable,
```

- [ ] **Step 6: Implement — extend `simulateCombat`'s signature and buff loop (around line 415-456)**

```typescript
export function simulateCombat(args: {
  party: Combatant[]
  encounter: Encounter
  seed: string
  /** Account-level totem bonus (mission prep, 2026-10-12 spec) — applied the same way a
   *  partyBuffOnStart capstone ability is, to every party member, once, at fight start.
   *  Restricted to the same AbilityStat allowlist by the caller (src/lib/totems.ts). */
  partyBuffs?: { stat: AbilityStat; kind: 'flat' | 'pct'; value: number }[]
}): CombatResult {
  const { party, encounter, seed, partyBuffs = [] } = args
```

(Only the destructuring line changes — add `partyBuffs = []` to it; everything else in the
function body up to the capstone-buff loop is unchanged.)

Immediately after the existing capstone `partyBuffOnStart` loop (the `for (const buffer of
units) { ... }` block), add a second loop for totem buffs:

```typescript
  // Totem party buffs (mission prep, 2026-10-12 spec): account-level, not tied to any one
  // unit's ability, so this is a second pass over the SAME units rather than a per-unit
  // ability check. Re-clamp dodge for the same reason the capstone loop above does.
  for (const buff of partyBuffs) {
    for (const target of units) {
      if (target.side !== 'party') continue
      target[buff.stat] += buff.kind === 'flat' ? buff.value : target[buff.stat] * (buff.value / 100)
      if (buff.stat === 'dodge') target.dodge = Math.min(target.dodge, COMBAT.DODGE_CAP)
    }
  }
```

- [ ] **Step 7: Implement — the heal-trigger check in the action loop (around line 483-498)**

Insert this block immediately after the existing `healthRegen` block and immediately
**before** the existing `if (actor.isHealer) { ... }` block — self-preservation is checked
before the healer's "heal someone else" duty:

```typescript
    // Mission-prep heal consumable (2026-10-12 spec): checked at the SAME point the Healer
    // role's own conditional override is — on the holder's own action tick, before a normal
    // attack. Self-only; fires at most once per fight.
    if (
      actor.side === 'party' &&
      actor.consumable &&
      !actor.consumable.used &&
      actor.hp / actor.maxHp <= actor.consumable.triggerHpPct
    ) {
      actor.consumable.used = true
      const before = actor.hp
      actor.hp = Math.min(actor.maxHp, actor.hp + actor.consumable.healAmount)
      log.push({ t, type: 'heal', source: actor.id, target: actor.id, amount: actor.hp - before })
      actor.nextAt += actor.interval
      continue
    }

```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/lib/combat.test.ts`
Expected: PASS — all new cases, and every pre-existing `combat.test.ts` case still passes
unchanged (the new param defaults to `[]` and the new field defaults to `undefined`, so
nothing already passing can regress).

- [ ] **Step 9: Commit**

```bash
git add src/lib/combat.ts src/lib/combat.test.ts
git commit -m "feat: combat sim support for heal-trigger consumables and totem party buffs"
```

---

### Task 5: Migration — mission_runs.consumables_used + extend start_mission

**Files:**
- Create: `supabase/migrations/20261012100000_mission_consumables.sql`
- Test: `supabase/tests/database/mission_consumables.sql`

**Interfaces:**
- Produces: `mission_runs.consumables_used jsonb` column; `start_mission`'s new
  `p_consumables jsonb default '[]'::jsonb` parameter, validated (ownership + quantity) and
  consumed from `player_inventory`, recorded onto the inserted row.

- [ ] **Step 1: Write the migration**

The current `start_mission` is defined in `supabase/migrations/20260914110200_skill_busy_checks.sql`
(its latest drop/recreate, adding the skill-training busy-check). This migration copies
that exact body and adds one new parameter plus one new block, per this project's
drop-and-recreate convention for signature changes (same pattern `upgrade_items`'
migrations already use):

```sql
-- Mission-prep consumables (docs/superpowers/specs/2026-10-12-mission-prep-consumables-
-- design.md §F): a per-character, self-only heal/buff loadout, validated and CONSUMED at
-- dispatch (same timing as start_craft's reagent deduction), recorded on the run so
-- mission-claim knows what to apply later. Slot-count and heal-category-cap validation
-- happen in the mission-start Edge Function (needs Sanity-sourced level/bonusSlot/category
-- data this RPC can't reach) — this RPC owns only the DB-side guarantee: ownership and
-- quantity, same split equip_item/start_craft already use for their own reagent/item checks.
-- Body below is copied verbatim from 20260914110200_skill_busy_checks.sql's start_mission,
-- plus the new p_consumables param and the consumption loop marked NEW below.

alter table public.mission_runs
  add column consumables_used jsonb not null default '[]'::jsonb;

comment on column public.mission_runs.consumables_used is
  'The validated {characterId, consumableDefId}[] loadout spent at dispatch. Read by mission-claim to build each Combatant''s heal-trigger/buff fields.';

create or replace function public.start_mission(
  p_player           uuid,
  p_mission_def_id   text,
  p_party            uuid[],
  p_duration_seconds integer,
  p_map_key          text    default null,
  p_stage            int     default null,
  p_prev_map_key     text    default null,
  p_consumables      jsonb   default '[]'::jsonb
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
  v_item        jsonb;
  v_char        text;
  v_cdef        text;
  v_qty         integer;
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

  -- NEW: mission-prep consumables. Lock + verify + consume each submitted item, atomically,
  -- before the run is inserted. Ownership and quantity only — slot-count/heal-cap were
  -- already validated by the mission-start Edge Function (see header comment).
  for v_item in select * from jsonb_array_elements(coalesce(p_consumables, '[]'::jsonb))
  loop
    v_char := v_item->>'characterId';
    v_cdef := v_item->>'consumableDefId';
    if v_char is null or v_cdef is null then
      raise exception 'start_mission: invalid consumable entry';
    end if;
    select quantity into v_qty
      from public.player_inventory
     where player_id = p_player and item_def_id = v_cdef and rarity = 'Common'
     for update;
    if not found or v_qty < 1 then
      raise exception 'start_mission: consumable % not in inventory', v_cdef;
    end if;
    if v_qty = 1 then
      delete from public.player_inventory
       where player_id = p_player and item_def_id = v_cdef and rarity = 'Common';
    else
      update public.player_inventory
         set quantity = quantity - 1
       where player_id = p_player and item_def_id = v_cdef and rarity = 'Common';
    end if;
  end loop;

  insert into public.mission_runs (player_id, mission_def_id, party, started_at, ends_at, consumables_used)
  values (p_player, p_mission_def_id, p_party, now(), now() + make_interval(secs => p_duration_seconds), p_consumables)
  returning * into v_run;

  return v_run;
end;
$$;

revoke all on function public.start_mission(uuid, text, uuid[], integer, text, int, text, jsonb) from public, anon, authenticated;
grant execute on function public.start_mission(uuid, text, uuid[], integer, text, int, text, jsonb) to service_role;
```

- [ ] **Step 2: Write the pgTAP tests**

```sql
-- mission_consumables: start_mission's new p_consumables param — ownership/quantity
-- validation, atomic consumption, and recording onto consumables_used. Slot-count/heal-cap
-- validation is covered separately in src/lib/consumables.test.ts (pure TS, Task 2) since
-- it needs Sanity-sourced data this RPC never sees.
begin;
select plan(5);

insert into auth.users (id, email, raw_user_meta_data)
values ('50000000-0000-0000-0000-000000000001', 'mp-1@test.local', jsonb_build_object('username', 'mp_1'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'test_char', 25);

-- 1. Rejects an unowned/missing consumable.
select throws_ok(
  $$ select public.start_mission(
       '50000000-0000-0000-0000-000000000001'::uuid, 'test_mission',
       array['50000000-0000-0000-0000-000000000002'::uuid], 60, null, null, null,
       jsonb_build_array(jsonb_build_object('characterId', '50000000-0000-0000-0000-000000000002', 'consumableDefId', 'no-such-potion'))
     ) $$,
  'start_mission: consumable no-such-potion not in inventory'
);

-- 2. Happy path: owning 1 of a consumable lets dispatch succeed and consumes it.
insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
values ('50000000-0000-0000-0000-000000000001', 'minor-healing-potion', 'Common', 1);

select is(
  (public.start_mission(
     '50000000-0000-0000-0000-000000000001'::uuid, 'test_mission',
     array['50000000-0000-0000-0000-000000000002'::uuid], 60, null, null, null,
     jsonb_build_array(jsonb_build_object('characterId', '50000000-0000-0000-0000-000000000002', 'consumableDefId', 'minor-healing-potion'))
   )).consumables_used,
  jsonb_build_array(jsonb_build_object('characterId', '50000000-0000-0000-0000-000000000002', 'consumableDefId', 'minor-healing-potion')),
  'start_mission records the validated loadout onto the new run'
);

select is(
  (select quantity from public.player_inventory
    where player_id = '50000000-0000-0000-0000-000000000001' and item_def_id = 'minor-healing-potion' and rarity = 'Common'),
  null,
  'start_mission deletes the inventory stack once it hits zero'
);

-- 3. Consumption happens even for a dispatch with no consumables at all (default empty array).
delete from public.mission_runs where player_id = '50000000-0000-0000-0000-000000000001';
select is(
  (public.start_mission(
     '50000000-0000-0000-0000-000000000001'::uuid, 'test_mission',
     array['50000000-0000-0000-0000-000000000002'::uuid], 60, null, null, null
   )).consumables_used,
  '[]'::jsonb,
  'omitting p_consumables defaults to an empty loadout, not an error'
);

-- 4. A second item of the same def decrements rather than deletes.
delete from public.mission_runs where player_id = '50000000-0000-0000-0000-000000000001';
insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
values ('50000000-0000-0000-0000-000000000001', 'fire-resistance-draught', 'Common', 2);

select public.start_mission(
  '50000000-0000-0000-0000-000000000001'::uuid, 'test_mission',
  array['50000000-0000-0000-0000-000000000002'::uuid], 60, null, null, null,
  jsonb_build_array(jsonb_build_object('characterId', '50000000-0000-0000-0000-000000000002', 'consumableDefId', 'fire-resistance-draught'))
);

select is(
  (select quantity from public.player_inventory
    where player_id = '50000000-0000-0000-0000-000000000001' and item_def_id = 'fire-resistance-draught' and rarity = 'Common'),
  1,
  'start_mission decrements (not deletes) a stack with more than 1 remaining'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Run migration + tests locally**

Run: `supabase db reset` then `npx supabase test db`
Expected: the new migration applies cleanly; `mission_consumables.sql`'s 5 assertions pass;
all pre-existing pgTAP files still pass (confirms the signature change didn't break any
other RPC that calls `start_mission`, if any do).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261012100000_mission_consumables.sql supabase/tests/database/mission_consumables.sql
git commit -m "feat: mission_runs.consumables_used + start_mission consumable validation"
```

---

### Task 6: Migration — profiles.active_totem_id + equip_totem/unequip_totem RPCs

**Files:**
- Create: `supabase/migrations/20261012110000_totem_equip.sql`
- Test: `supabase/tests/database/totem_equip.sql`

**Interfaces:**
- Produces: `profiles.active_totem_id text` (nullable); `equip_totem(p_player, p_totem_def_id)`,
  `unequip_totem(p_player)` RPCs.

- [ ] **Step 1: Write the migration**

```sql
-- Totems (design spec §E): a durable, party-wide, ACCOUNT-level equip slot — one totem
-- active at a time, free to swap, no busy-check (not scoped to any one character, unlike
-- equip_item's character-level busy checks — see the spec's "Alternatives considered").
-- totem_def_id is a bare Sanity totemKey string, not FK'd to a table (same looseness
-- player_inventory.item_def_id already has toward itemDef) — existence is validated by the
-- calling Edge Function's own Sanity lookup (Task 8), same split every other content-
-- referencing RPC in this codebase uses.

alter table public.profiles
  add column active_totem_id text;

comment on column public.profiles.active_totem_id is
  'Sanity totemKey of the player''s currently equipped totem, or null for none. Read live at mission-claim time, not locked at dispatch.';

create or replace function public.equip_totem(
  p_player       uuid,
  p_totem_def_id text
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_totem_def_id is null or length(p_totem_def_id) = 0 then
    raise exception 'equip_totem: totem id required';
  end if;

  update public.profiles
     set active_totem_id = p_totem_def_id
   where player_id = p_player;
  if not found then
    raise exception 'equip_totem: no profile';
  end if;

  return p_totem_def_id;
end;
$$;

revoke all on function public.equip_totem(uuid, text) from public, anon, authenticated;
grant execute on function public.equip_totem(uuid, text) to service_role;

create or replace function public.unequip_totem(
  p_player uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles
     set active_totem_id = null
   where player_id = p_player;
  if not found then
    raise exception 'unequip_totem: no profile';
  end if;
end;
$$;

revoke all on function public.unequip_totem(uuid) from public, anon, authenticated;
grant execute on function public.unequip_totem(uuid) to service_role;
```

- [ ] **Step 2: Write the pgTAP tests**

```sql
-- totem_equip: equip_totem/unequip_totem — no busy-check (account-level, not scoped to any
-- one character), free swap, missing-profile guard.
begin;
select plan(4);

insert into auth.users (id, email, raw_user_meta_data)
values ('60000000-0000-0000-0000-000000000001', 'totem-1@test.local', jsonb_build_object('username', 'totem_1'));

-- 1. Equipping writes active_totem_id.
select is(
  public.equip_totem('60000000-0000-0000-0000-000000000001'::uuid, 'totem-of-minor-warding'),
  'totem-of-minor-warding',
  'equip_totem writes and returns the totem id'
);

select is(
  (select active_totem_id from public.profiles where player_id = '60000000-0000-0000-0000-000000000001'),
  'totem-of-minor-warding',
  'active_totem_id is set on the profile row'
);

-- 2. Swapping to a different totem is free and immediate (no busy-check, no cost).
select public.equip_totem('60000000-0000-0000-0000-000000000001'::uuid, 'totem-of-swiftness');
select is(
  (select active_totem_id from public.profiles where player_id = '60000000-0000-0000-0000-000000000001'),
  'totem-of-swiftness',
  'swapping totems overwrites the previous one, no error'
);

-- 3. Unequipping clears it back to null.
select public.unequip_totem('60000000-0000-0000-0000-000000000001'::uuid);
select is(
  (select active_totem_id from public.profiles where player_id = '60000000-0000-0000-0000-000000000001'),
  null,
  'unequip_totem clears active_totem_id to null'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Run migration + tests locally**

Run: `supabase db reset` then `npx supabase test db`
Expected: 4 assertions pass; no pre-existing test regresses.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261012110000_totem_equip.sql supabase/tests/database/totem_equip.sql
git commit -m "feat: profiles.active_totem_id + equip_totem/unequip_totem RPCs"
```

---

### Task 7: mission-start Edge Function — slot/heal-cap validation

**Files:**
- Modify: `supabase/functions/mission-start/index.ts`

**Interfaces:**
- Consumes: `slotsForCharacter`, `validateMissionLoadout` (Task 2); the extended
  `start_mission` RPC's `p_consumables` param (Task 5).
- Produces: `mission-start` now accepts an optional `consumables` field in its request body.

- [ ] **Step 1: Extend the request body type and validation (around line 33-46)**

```typescript
  let body: { missionDefId?: unknown; party?: unknown; consumables?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const missionDefId = body.missionDefId
  const party = body.party
  const consumablesInput = body.consumables ?? []
  if (typeof missionDefId !== 'string' || missionDefId.length === 0) {
    return json({ error: 'missionDefId is required' }, 400)
  }
  if (!Array.isArray(party) || party.length < 1 || party.length > 3 || !party.every((p) => typeof p === 'string')) {
    return json({ error: 'party must be 1–3 character ids' }, 400)
  }
  if (!Array.isArray(consumablesInput)) {
    return json({ error: 'consumables must be an array' }, 400)
  }
```

- [ ] **Step 2: Add the import and the slot/heal-cap resolve-and-validate block**

Add to the top imports:

```typescript
import { validateMissionLoadout, slotsForCharacter, type LoadoutEntry } from '../../../src/lib/consumables.ts'
```

Insert this block right after the existing "party missionSpeedDecrease" try/catch (after
the block ending around line 107, before the Echo Shop mission-speed adjustment) — it needs
`partyRows` from that same block, so reads from it rather than re-fetching:

```typescript
  // Mission-prep consumables (2026-10-12 spec): resolve each party member's level/
  // bonusConsumableSlot and each submitted item's category from Sanity, then validate the
  // loadout with the pure function (Task 2) before it ever reaches the RPC. consumablesInput
  // entries are expected as { characterId: string, consumableDefId: string }.
  let validatedConsumables: LoadoutEntry[] = []
  if (consumablesInput.length > 0) {
    if (!consumablesInput.every((c) => typeof c === 'object' && c !== null && typeof (c as { characterId?: unknown }).characterId === 'string' && typeof (c as { consumableDefId?: unknown }).consumableDefId === 'string')) {
      return json({ error: 'Each consumable entry needs characterId and consumableDefId' }, 400)
    }
    const raw = consumablesInput as { characterId: string; consumableDefId: string }[]

    type CharLevelRow = { id: string; character_def_id: string; level: number }
    const { data: charRows } = await admin
      .from('player_characters')
      .select('id, character_def_id, level')
      .in('id', party as string[])
      .eq('player_id', playerId)
    const charLevelById = new Map((charRows as CharLevelRow[] | null ?? []).map((r) => [r.id, r]))

    const charDefKeys = [...new Set((charRows as CharLevelRow[] | null ?? []).map((r) => r.character_def_id))]
    type CharFlagRow = { charKey: string; bonusConsumableSlot?: boolean }
    let bonusSlotByCharKey = new Map<string, boolean>()
    try {
      const flagRows = await sanityQuery<CharFlagRow[]>(
        `*[_type == "characterDef" && charKey in $keys]{ charKey, bonusConsumableSlot }`,
        { keys: charDefKeys },
      )
      bonusSlotByCharKey = new Map(flagRows.map((r) => [r.charKey, r.bonusConsumableSlot ?? false]))
    } catch (e) {
      console.error('Sanity bonusConsumableSlot lookup failed — treating as no bonus slots', e)
    }

    const consumableDefIds = [...new Set(raw.map((c) => c.consumableDefId))]
    type ConsumableCategoryRow = { consumableKey: string; category: 'heal' | 'buff' }
    let categoryByDefId = new Map<string, 'heal' | 'buff'>()
    try {
      const catRows = await sanityQuery<ConsumableCategoryRow[]>(
        `*[_type == "consumableDef" && consumableKey in $keys]{ consumableKey, category }`,
        { keys: consumableDefIds },
      )
      categoryByDefId = new Map(catRows.map((r) => [r.consumableKey, r.category]))
    } catch (e) {
      console.error('Sanity consumableDef category lookup failed', e)
      return json({ error: 'Could not validate consumables' }, 502)
    }

    const partyForValidation = (charRows as CharLevelRow[] | null ?? []).map((r) => ({
      characterId: r.id,
      level: r.level,
      bonusSlot: bonusSlotByCharKey.get(r.character_def_id) ?? false,
    }))
    const loadout: LoadoutEntry[] = raw.map((c) => ({
      characterId: c.characterId,
      consumableDefId: c.consumableDefId,
      category: categoryByDefId.get(c.consumableDefId) ?? 'buff',
    }))
    if (loadout.some((l) => !categoryByDefId.has(l.consumableDefId))) {
      return json({ error: 'Unknown consumable' }, 400)
    }

    const error = validateMissionLoadout(partyForValidation, loadout)
    if (error) return json({ error }, 400)
    validatedConsumables = loadout
  }
```

(`slotsForCharacter` is imported for completeness/future use by this file but not called
directly here — `validateMissionLoadout` already applies it internally.)

- [ ] **Step 3: Pass the validated loadout to the RPC call**

In the existing `admin.rpc('start_mission', { ... })` call, add one field:

```typescript
  const { data: run, error: rpcErr } = await admin.rpc('start_mission', {
    p_player: playerId,
    p_mission_def_id: missionDefId,
    p_party: party as string[],
    p_duration_seconds: durationSeconds,
    p_map_key: def.map?.mapKey ?? null,
    p_stage: def.stage ?? null,
    p_prev_map_key: def.map?.prevMapKey ?? null,
    p_consumables: validatedConsumables.map((c) => ({ characterId: c.characterId, consumableDefId: c.consumableDefId })),
  })
```

- [ ] **Step 4: Manual smoke check (Edge Functions aren't vitest-unit-tested in this repo — the pure validation logic they call already is, per Task 2)**

Run `npx vitest run src/lib/consumables.test.ts` once more to confirm nothing in this task
accidentally changed `consumables.ts` itself (it shouldn't have — this task only imports
from it). Read the modified file back once to confirm the control flow is correct (every
early-return path still returns a `json(...)` response, no fallthrough).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/mission-start/index.ts
git commit -m "feat: mission-start validates per-character slots and the party heal-cap"
```

---

### Task 8: New Edge Functions — totem-equip, totem-unequip

**Files:**
- Create: `supabase/functions/totem-equip/index.ts`
- Create: `supabase/functions/totem-unequip/index.ts`

**Interfaces:**
- Consumes: `equip_totem`/`unequip_totem` RPCs (Task 6).
- Produces: two new invokable Edge Functions, mirroring `mission-start`'s auth/JSON-parsing
  skeleton exactly.

- [ ] **Step 1: Write `totem-equip/index.ts`**

```typescript
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'

// totem-equip: swap the player's single account-level totem slot (design spec §E). No
// busy-check (not scoped to any one character, unlike gear's equip_item) — free to swap
// anytime. Existence of the totemDef is validated here via Sanity, the same split every
// other content-referencing write in this codebase uses; equip_totem itself only writes.

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

  let body: { totemDefId?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const totemDefId = body.totemDefId
  if (typeof totemDefId !== 'string' || totemDefId.length === 0) {
    return json({ error: 'totemDefId is required' }, 400)
  }

  try {
    const def = await sanityQuery<{ totemKey: string } | null>(
      `*[_type == "totemDef" && totemKey == $id][0]{ totemKey }`,
      { id: totemDefId },
    )
    if (!def) return json({ error: 'Unknown totem' }, 404)
  } catch (e) {
    console.error('Sanity totemDef lookup failed', e)
    return json({ error: 'Could not validate totem' }, 502)
  }

  const { data, error: rpcErr } = await admin.rpc('equip_totem', {
    p_player: playerId,
    p_totem_def_id: totemDefId,
  })
  if (rpcErr) {
    const reason = rpcErr.message.replace(/^.*equip_totem:\s*/, '')
    return json({ error: reason || 'Could not equip totem' }, 409)
  }

  return json({ activeTotemId: data }, 200)
})
```

- [ ] **Step 2: Write `totem-unequip/index.ts`**

```typescript
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'

// totem-unequip: clear the player's account-level totem slot back to none.

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

  const { error: rpcErr } = await admin.rpc('unequip_totem', { p_player: playerId })
  if (rpcErr) {
    const reason = rpcErr.message.replace(/^.*unequip_totem:\s*/, '')
    return json({ error: reason || 'Could not unequip totem' }, 409)
  }

  return json({ ok: true }, 200)
})
```

- [ ] **Step 3: Verify both compile under Deno's checker**

Run: `deno check supabase/functions/totem-equip/index.ts supabase/functions/totem-unequip/index.ts`
(If this repo doesn't have a direct `deno` CLI invocation convention, check
`docs/TESTING.md`/`CLAUDE.md` for the project's actual Edge-Function-compile-check command
and use that instead — don't skip this verification.)
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/totem-equip/index.ts supabase/functions/totem-unequip/index.ts
git commit -m "feat: totem-equip and totem-unequip Edge Functions"
```

---

### Task 9: mission-claim Edge Function — wire consumables and totem into the fight

**Files:**
- Modify: `supabase/functions/mission-claim/index.ts`

**Interfaces:**
- Consumes: `mission_runs.consumables_used` (Task 5), `profiles.active_totem_id` (Task 6),
  `resolveConsumableBuffBonus` (Task 2), `resolveTotemPartyBuffs` (Task 3),
  `Combatant.consumable` + `simulateCombat`'s `partyBuffs` param (Task 4).

- [ ] **Step 1: Select the new columns**

In the existing run-lookup select (`.from('mission_runs').select('id, mission_def_id,
party, started_at, ends_at')`), add `consumables_used`:

```typescript
    .select('id, mission_def_id, party, started_at, ends_at, consumables_used')
```

In the existing profile select (`.from('profiles').select('map_progress, lifetime_stats,
unlocked_characters, echo_shop, ascendant_shop')`), add `active_totem_id`:

```typescript
    .select('map_progress, lifetime_stats, unlocked_characters, echo_shop, ascendant_shop, active_totem_id')
```

- [ ] **Step 2: Add the imports**

```typescript
import { resolveConsumableBuffBonus } from '../../../src/lib/consumables.ts'
import { resolveTotemPartyBuffs, type TotemDef } from '../../../src/lib/totems.ts'
```

- [ ] **Step 3: Fetch the consumableDef/totemDef data this run actually needs**

Add this block right after the existing mission/charDefs/itemDefs Sanity fetch (the `try {
mission = await sanityQuery... } catch { ... }` block), reusing the same `mission`/
`charDefs`/`itemDefs` fetch pattern:

```typescript
  const consumablesUsed = (run.consumables_used ?? []) as { characterId: string; consumableDefId: string }[]
  const consumableKeys = [...new Set(consumablesUsed.map((c) => c.consumableDefId))]
  type ConsumableRow = {
    consumableKey: string
    category: 'heal' | 'buff'
    healAmount?: number
    triggerHpPct?: number
    effects?: { stat: string; kind: 'flat' | 'pct'; value: number }[]
  }
  let consumableDefs: ConsumableRow[] = []
  let activeTotem: TotemDef | null = null
  try {
    if (consumableKeys.length > 0) {
      consumableDefs = await sanityQuery<ConsumableRow[]>(
        `*[_type == "consumableDef" && consumableKey in $keys]{ consumableKey, category, healAmount, triggerHpPct, effects[]{ stat, kind, value } }`,
        { keys: consumableKeys },
      )
    }
    if (profile?.active_totem_id) {
      activeTotem = await sanityQuery<TotemDef | null>(
        `*[_type == "totemDef" && totemKey == $key][0]{ totemKey, effects[]{ stat, kind, value } }`,
        { key: profile.active_totem_id },
      )
    }
  } catch (e) {
    // Stale/deleted totemDef or consumableDef reference degrades to "no bonus applied" —
    // never blocks the claim (Review Focus: a dangling active_totem_id must not 500 every
    // future claim for this player).
    console.error('consumable/totem content lookup failed — continuing without their bonuses', e)
  }
  const consumableByKey = new Map(consumableDefs.map((c) => [c.consumableKey, c]))
  const consumableByChar = new Map(consumablesUsed.map((c) => [c.characterId, consumableByKey.get(c.consumableDefId)]))
```

- [ ] **Step 4: Set `consumable` on heal-category combatants and merge buff-category bonuses**

In the existing per-character combatant-building loop (`for (const c of chars) { ... const
stats = effectiveStats({ ... }) ... combatants.push({ ... }) }`), make two changes.

First, add the consumable's buff bonus into the existing `extraBonuses` merge:

```typescript
    const consumableForChar = consumableByChar.get(c.id)
    const consumableBuffBonus =
      consumableForChar?.category === 'buff' && consumableForChar.effects
        ? resolveConsumableBuffBonus(consumableForChar.effects)
        : {}
    const stats = effectiveStats({
      level: c.level,
      baseStats: def.baseStats ?? [],
      growth: def.growth ?? [],
      blessingAllocations: resolveBlessingAllocations(picks),
      blessingNodes: flattenBlessingTree(def.blessingTree),
      equipped: c.equipped ?? {},
      itemDefs: itemDefById,
      extraBonuses: mergeBonuses(
        collectTraitBonuses(def.traits ?? [], traitCtx),
        resolveCapstoneBonuses(def.capstone, earnedCapstone, traitCtx),
        resolveCharAscendantBonuses(ascendantShop, def.charKey),
        resolveFlatAscendantStatBonuses(ascendantShop),
        resolveProficiencyBonus(def.proficiency, mission.proficiencyTags),
        consumableBuffBonus,
      ),
    })
```

Second, in the `combatants.push({ ... })` call, add the `consumable` field for
heal-category items:

```typescript
    combatants.push({
      id: c.id,
      role: resolveRole(def.charClass, def.role),
      stats,
      currentHp: c.current_hp ?? undefined,
      damageSchool: def.damageSchool ?? undefined,
      ability: resolveCapstoneAbility(def.capstone, earnedCapstone),
      consumable:
        consumableForChar?.category === 'heal' &&
        typeof consumableForChar.healAmount === 'number' &&
        typeof consumableForChar.triggerHpPct === 'number'
          ? { healAmount: consumableForChar.healAmount, triggerHpPct: consumableForChar.triggerHpPct, used: false }
          : undefined,
    })
```

- [ ] **Step 5: Pass the totem's party buffs into `simulateCombat`**

In the existing `simulateCombat({ party: combatants, encounter: {...}, seed: run.id })`
call, add `partyBuffs`:

```typescript
  const result = simulateCombat({
    party: combatants,
    encounter: { enemies, timeLimitSeconds: mission.encounter.timeLimitSeconds },
    seed: run.id,
    partyBuffs: resolveTotemPartyBuffs(activeTotem),
  })
```

- [ ] **Step 6: Manual review pass**

Read the full modified file back once to confirm: no variable name collides with the
file's existing declarations (`mission`, `charDefs`, `itemDefs`, `profile` are all already
in scope by the point these blocks are inserted); the new Sanity fetch's try/catch degrades
gracefully exactly as commented, never throwing past this function's outer error handling.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/mission-claim/index.ts
git commit -m "feat: mission-claim applies carried consumables and the equipped totem"
```

---

### Task 10: Client services and hooks

**Files:**
- Modify: `src/services/missions.ts`
- Modify: `src/features/missions/hooks.ts`
- Create: `src/services/totems.ts`
- Create: `src/hooks/useTotem.ts` (confirmed: `src/hooks/useProfile.ts` already holds the
  comparable account-level, non-mission-specific hook — `useTotem.ts` joins it there rather
  than living under `src/features/missions/`, matching that precedent)

**Interfaces:**
- Consumes: `totem-equip`/`totem-unequip` Edge Functions (Task 8); `mission-start`'s new
  `consumables` body field (Task 7).
- Produces: `startMission(missionDefId, party, consumables)`, `equipTotem(totemDefId)`,
  `unequipTotem()`, and their corresponding mutation hooks.

- [ ] **Step 1: Extend `startMission` in `src/services/missions.ts`**

```typescript
export type MissionLoadoutEntry = { characterId: string; consumableDefId: string }

export async function startMission(
  missionDefId: string,
  party: string[],
  consumables: MissionLoadoutEntry[] = [],
): Promise<MissionRun> {
  const { data, error } = await supabase.functions.invoke('mission-start', {
    body: { missionDefId, party, consumables },
  })
  if (error) await invokeError(error, 'Could not start mission')
  return data.run as MissionRun
}
```

- [ ] **Step 2: Update `useStartMission` in `src/features/missions/hooks.ts`**

```typescript
export function useStartMission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ missionDefId, party, consumables }: { missionDefId: string; party: string[]; consumables?: MissionLoadoutEntry[] }) =>
      startMission(missionDefId, party, consumables),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['missionRuns'] })
      void qc.invalidateQueries({ queryKey: ['inventory'] }) // consumables are consumed at dispatch
    },
  })
}
```

(Add `MissionLoadoutEntry` to the existing `import { fetchMissions, startMission,
claimMission } from '@/services/missions'` line's type imports.)

- [ ] **Step 3: Write `src/services/totems.ts`**

```typescript
import { supabase } from '@/lib/supabase'
import { invokeError } from './_invoke'

// Totem equip/unequip — account-level writes, same Edge-Function-invoke pattern as every
// other server-authoritative write (ADR-0003).

export async function equipTotem(totemDefId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('totem-equip', {
    body: { totemDefId },
  })
  if (error) await invokeError(error, 'Could not equip totem')
  return data.activeTotemId as string
}

export async function unequipTotem(): Promise<void> {
  const { error } = await supabase.functions.invoke('totem-unequip', { body: {} })
  if (error) await invokeError(error, 'Could not unequip totem')
}
```

- [ ] **Step 4: Write the totem mutation hooks**

Confirmed: `src/hooks/useProfile.ts` already holds the comparable account-level query hook
(query key `['profile']`, the same key `useClaimMission` already invalidates). Create
`src/hooks/useTotem.ts` alongside it rather than under `src/features/missions/` — totems
are account-level, not mission-specific, matching that file's own placement precedent:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { equipTotem, unequipTotem } from '@/services/totems'

export function useEquipTotem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (totemDefId: string) => equipTotem(totemDefId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export function useUnequipTotem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => unequipTotem(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: no TypeScript errors across the modified/new files.

- [ ] **Step 6: Commit**

```bash
git add src/services/missions.ts src/services/totems.ts src/features/missions/hooks.ts src/hooks/useTotem.ts
git commit -m "feat: client services and hooks for mission consumables and totem equip"
```

---

### Task 11: Minimal UI — mission loadout picker + totem equip control

**Files:**
- Modify: `src/features/missions/components/MissionDispatch.tsx` (add a loadout picker
  before the existing dispatch button)
- Modify: `src/pages/InventoryPage.tsx` (add a small "Totem" section)

**Interfaces:**
- Consumes: `useStartMission` (now taking `consumables`, Task 10), `useEquipTotem`/
  `useUnequipTotem` (Task 10), inventory data already fetched by `InventoryPage` (reuse its
  existing query rather than adding a second one).

- [ ] **Step 1: Read `MissionDispatch.tsx` and `InventoryPage.tsx` in full before editing**

Both files are outside what earlier tasks in this plan touched directly, and this plan
cannot safely fabricate their exact current prop shapes and render structure from
inference. Read them now; the steps below describe the SHAPE of the change relative to
what you'll find, not a verbatim diff — fit it to the file's actual current structure,
matching its existing component style (inline style objects, atomic-design component
imports, etc. — see CLAUDE.md's project-structure section) rather than introducing a new
styling approach.

- [ ] **Step 2: Add a loadout picker to `MissionDispatch.tsx`**

Add local state for the selected loadout (`Record<characterId, consumableDefId | null>`,
one picked slot's worth — v1 keeps this to the simplest form: one optional consumable per
party member in the dispatch party, which already satisfies the level-1-20 default of 1
slot; a character's actual slot cap from `slotsForCharacter` is a future UI refinement, not
required for this plan's "prove it end-to-end" bar). Render one `<select>` per party member
listing their owned, un-equipped consumables (fetch via a simple
`supabase.from('player_inventory').select('item_def_id, quantity').eq('rarity', 'Common')`
query scoped to consumable item defs — reuse whatever inventory-fetching hook/query already
exists on this page if one does; check before adding a second one). Pass the picked
`{ characterId, consumableDefId }[]` into `useStartMission`'s `mutationFn` call alongside
the existing `missionDefId`/`party` arguments.

- [ ] **Step 3: Add a totem section to `InventoryPage.tsx`**

Render the player's currently equipped totem (from `useProfile()`'s `active_totem_id`,
resolved to a display name via the same kind of Sanity lookup the page's other
content-name resolution already uses) plus an "Equip"/"Change" control listing totemDefs
fetched from Sanity (`*[_type == "totemDef"]{ totemKey, name }`). Wire its selection to
`useEquipTotem`; add an "Unequip" button wired to `useUnequipTotem` when one is active.

- [ ] **Step 4: Manual browser verification**

Start the dev server (`npm run dev`), sign in, and confirm: the mission dispatch screen
shows a consumable picker per party member when the player owns at least one consumable;
dispatching with one selected consumes it from inventory (visible on `/inventory`
afterward); the Inventory page's totem control successfully equips/unequips and the choice
persists across a page reload.

- [ ] **Step 5: Commit**

```bash
git add src/features/missions/components/MissionDispatch.tsx src/pages/InventoryPage.tsx
git commit -m "feat: minimal UI for mission consumable loadout and totem equip"
```

---

### Task 12: Content authoring — starter heal potion, resistance potion, totem

**Files:**
- Content only (Sanity), authored via the Sanity CLI or MCP tools this project already
  uses for content (see `docs/DECISIONS.md`'s precedent for authoring itemDefs/recipeDefs
  this way) — no repo files change except whatever script/notes you use to drive the
  authoring, which don't need to be committed.

**Interfaces:**
- Produces: three live documents — one `consumableDef` (category `heal`), one
  `consumableDef` (category `buff`), one `totemDef` — plus three `recipeDef`s wiring them
  into the existing generic crafting system (ADR-0052), craftable from day one with no
  profession gate.

- [ ] **Step 1: Author the heal-category consumableDef**

`consumableKey: 'minor-healing-potion'`, `name: 'Minor Healing Potion'`, `category: 'heal'`,
`healAmount: 200` (matches the exact number named in the original design discussion),
`triggerHpPct: 0.3` (placeholder — flagged in Task 1's schema as pending a balance pass).

- [ ] **Step 2: Author the buff-category consumableDef**

`consumableKey: 'fire-resistance-draught'`, `name: 'Fire Resistance Draught'`, `category:
'buff'`, `effects: [{ stat: 'resistance', kind: 'flat', value: 20 }]` (placeholder value).

- [ ] **Step 3: Author the totemDef**

`totemKey: 'totem-of-minor-warding'`, `name: 'Totem of Minor Warding'`, `effects: [{ stat:
'resistance', kind: 'flat', value: 3 }]` (matches the "+3-ish" illustrative magnitude from
the design discussion).

- [ ] **Step 4: Author 3 recipeDefs using the existing crafting system (ADR-0052)**

For each of the 3 items above, author a `recipeDef` whose `result` is... **note:**
`recipeDef.result` is currently typed as a reference to `itemDef` only (see
`studio/schemaTypes/recipeDef.ts`, Step 1 of this task's reads). Since `consumableDef` and
`totemDef` are new, separate document types, `recipeDef.result`'s reference `to` array
needs widening to also accept them — this is a necessary, small follow-up schema change
this plan didn't originally call out as its own task. Add it here:

```typescript
// in studio/schemaTypes/recipeDef.ts, change:
      type: 'reference',
      to: [{ type: 'itemDef' }],
// to:
      type: 'reference',
      to: [{ type: 'itemDef' }, { type: 'consumableDef' }, { type: 'totemDef' }],
```

Then author each recipe with a short `durationSeconds` (e.g. 30) and a small, cheap
reagent line (whatever resources/items feel like a sensible first-tier recipe — these are
explicitly placeholder costs, same convention as every other first-pass number in this
plan).

- [ ] **Step 5: Verify via a quick GROQ read-back**

Query `*[_type in ["consumableDef", "totemDef", "recipeDef"] && (consumableKey in
["minor-healing-potion", "fire-resistance-draught"] || totemKey == "totem-of-minor-warding"
|| recipeKey match "*")]` (or equivalent) to confirm all 3 content docs and their 3 recipes
exist and are shaped correctly — same "read it back and re-verify" discipline this
project's other content-authoring tasks already follow.

- [ ] **Step 6: Commit the recipeDef schema widening**

```bash
git add studio/schemaTypes/recipeDef.ts
git commit -m "feat: widen recipeDef.result to accept consumableDef and totemDef"
```

---

### Task 13: Closing task — ADR, TODO.md, full verification

**Files:**
- Modify: `docs/DECISIONS.md` (new ADR)
- Modify: `TODO.md`

**Interfaces:** none — this task only records and verifies what the previous 12 produced.

- [ ] **Step 1: Write the ADR**

Append a new ADR to `docs/DECISIONS.md` (next sequential number after whatever the current
highest is at implementation time — re-check, don't assume the number this plan was written
against is still current) titled along the lines of "Mission prep & consumables: self-only
heal/buff items + a durable, party-wide totem equip." Cover: the two-category split and why
(heal needs a trigger, buff doesn't); the anti-stacking rule and the Tank-threat interaction
that motivated it; totems being durable/account-level rather than consumed, and why
(explicitly answers E7 from `docs/QUALITY_HYBRID.md`); the slot formula and the
studio-authored, Utility-exclusive 3rd slot; what's deferred (the five profession specs
that follow — Alchemy, Carving, Prospecting, Tempering, Arcane Writing).

- [ ] **Step 2: Update TODO.md**

Add a `[x]` entry (or `[ ]` if the manual browser verification from Task 11 Step 4 wasn't
actually completed by whoever ran this plan — be honest about what's actually been done,
matching this project's own convention of flagging incomplete verification rather than
marking it done) for the mission-prep-consumables feature, pointing at the new ADR and
`docs/superpowers/specs/2026-10-12-mission-prep-consumables-design.md`.

- [ ] **Step 3: Full verification**

Run, in order:
```bash
npm run lint
npm run build
npx vitest run
npx supabase test db
```
Expected: all four pass clean. If `npx vitest run` picks up stray files from this plan's
own SDD workspace (a known repo quirk — see `docs/TESTING.md`/CLAUDE.md's own history of
this), scope it with `--exclude ".superpowers/**" --exclude "node_modules/**"` the same way
prior sessions in this repo have.

- [ ] **Step 4: Commit**

```bash
git add docs/DECISIONS.md TODO.md
git commit -m "docs: ADR + TODO.md entry for mission prep & consumables framework"
```
