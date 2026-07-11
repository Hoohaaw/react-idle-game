// Roster fixture for the balance harness — a point-in-time snapshot of the 19 authored
// characterDefs (Sanity `production`, DRAFTS perspective; re-costed to the ADR-0031 point-buy
// budgets and re-snapshotted 2026-07-10). The sweep must be reproducible offline, so the data
// lives here rather than being fetched per run. Re-snapshot when baseStats/growth/rarity change
// (see docs/BALANCE.md § keeping the fixture fresh).
//
// Shape mirrors what mission-claim feeds the sim: baseStats + growth → computeBaselines(level) →
// Combatant. No blessings or gear — none are authored yet, so this is the NAKED-BASELINE pass
// (docs/BALANCE.md § scope).

import { computeBaselines, type StatGrowth, type StatValue } from '../../src/lib/stats.ts'
import { resolveRole, type CharacterRole } from '../../src/lib/roles.ts'
import type { CharacterRarity } from '../../src/lib/characterBudget.ts'
import type { School } from '../../src/lib/schools.ts'
import type { Combatant } from '../../src/lib/combat.ts'

export type RosterEntry = {
  charKey: string
  name: string
  charClass: string
  /** Authored role override (Sanity `role`); class default applies when null. */
  role: CharacterRole | null
  /** Budget tier (ADR-0031). */
  rarity: CharacterRarity
  /** School of the character's magic damage (ADR-0033); undefined = neutral 'magic'. */
  damageSchool?: School
  baseStats: StatValue[]
  growth: StatGrowth[]
}

const sv = (stat: string, value: number): StatValue => ({ stat, value })
const g = (
  stat: string,
  perLevel: number,
  milestones?: { level: number; bonus: number }[],
): StatGrowth => ({ stat, perLevel, milestones })

export const ROSTER: RosterEntry[] = [
  {
    charKey: 'gort-deepvein',
    name: "Gort Deepvein",
    charClass: 'Miner',
    role: null,
    rarity: 'Common',
    baseStats: [sv('health', 95), sv('defense', 8), sv('strength', 13), sv('attack', 9), sv('agility', 5), sv('speed', 5), sv('block', 3), sv('resistance', 7), sv('gatherSpeed', 8), sv('gatherYield', 5), sv('healthRegen', 2)],
    growth: [g('strength', 2), g('health', 9), g('defense', 1), g('gatherSpeed', 3), g('gatherYield', 2), g('block', 0.5)],
  },
  {
    charKey: 'nira-barkholm',
    name: "Nira Barkholm",
    charClass: 'Forester',
    role: null,
    rarity: 'Common',
    baseStats: [sv('health', 78), sv('defense', 5), sv('strength', 8), sv('attack', 8), sv('agility', 10), sv('speed', 9), sv('dodge', 3), sv('resistance', 4), sv('gatherSpeed', 10), sv('gatherYield', 4), sv('healthRegen', 2)],
    growth: [g('agility', 2), g('speed', 1), g('health', 6), g('gatherSpeed', 3), g('gatherYield', 2), g('attack', 1)],
  },
  {
    charKey: 'rowan-thicket',
    name: "Rowan Thicket [WIP]",
    charClass: 'Forester',
    role: null,
    rarity: 'Common',
    baseStats: [sv('gatherYield', 20), sv('gatherSpeed', 15), sv('health', 100), sv('agility', 8), sv('speed', 8), sv('attack', 5), sv('defense', 8), sv('strength', 5), sv('resistance', 5), sv('healthRegen', 2)],
    growth: [g('gatherYield', 3), g('gatherSpeed', 2), g('health', 6), g('agility', 1), g('speed', 1), g('attack', 2)],
  },
  {
    charKey: 'elia-dawnstroke',
    name: "Elia Dawnstroke",
    charClass: 'Painter',
    role: null,
    rarity: 'Common',
    baseStats: [sv('health', 90), sv('defense', 4), sv('strength', 4), sv('attack', 6), sv('intelligence', 12), sv('agility', 8), sv('speed', 9), sv('resistance', 7), sv('luck', 10), sv('magicFind', 6), sv('healthRegen', 2)],
    growth: [g('intelligence', 2), g('speed', 1), g('health', 5), g('luck', 2), g('attack', 1), g('defense', 1), g('magicFind', 1)],
  },
  {
    charKey: 'torvin-gearlock',
    name: "Torvin Gearlock",
    charClass: 'Engineer',
    role: null,
    rarity: 'Common',
    baseStats: [sv('health', 82), sv('defense', 8), sv('strength', 5), sv('attack', 9), sv('intelligence', 11), sv('agility', 7), sv('speed', 6), sv('resistance', 7), sv('critChance', 3), sv('healthRegen', 2)],
    growth: [g('intelligence', 2), g('attack', 2), g('defense', 1), g('health', 6), g('critChance', 0.5), g('haste', 0.5)],
  },
  {
    charKey: 'fenn-mosswhisper',
    damageSchool: 'earth',
    name: "Fenn Mosswhisper",
    charClass: 'Druid',
    role: null,
    rarity: 'Common',
    baseStats: [sv('health', 90), sv('defense', 8), sv('strength', 5), sv('attack', 7), sv('intelligence', 10), sv('healingPower', 8), sv('agility', 8), sv('speed', 7), sv('resistance', 6), sv('healthRegen', 2)],
    growth: [g('intelligence', 2), g('health', 6), g('agility', 1), g('defense', 1), g('healingPower', 2), g('healthRegen', 0.5)],
  },
  {
    charKey: 'callum-emberveil',
    damageSchool: 'fire',
    name: "Callum Emberveil",
    charClass: 'Mage',
    role: null,
    rarity: 'Uncommon',
    baseStats: [sv('health', 75), sv('defense', 3), sv('strength', 2), sv('attack', 4), sv('intelligence', 20), sv('spellPower', 16), sv('agility', 6), sv('speed', 7), sv('resistance', 5), sv('haste', 5)],
    growth: [g('intelligence', 3), g('spellPower', 3), g('health', 4), g('haste', 0.25), g('speed', 1)],
  },
  {
    charKey: 'mira-ashbind',
    damageSchool: 'shadow',
    name: "Mira Ashbind",
    charClass: 'Warlock',
    role: null,
    rarity: 'Uncommon',
    baseStats: [sv('health', 80), sv('defense', 3), sv('strength', 3), sv('attack', 5), sv('intelligence', 20), sv('spellPower', 15), sv('agility', 5), sv('speed', 6), sv('resistance', 9), sv('armorPen', 2), sv('healthRegen', 1)],
    growth: [g('intelligence', 3), g('spellPower', 3), g('health', 6), g('resistance', 1), g('armorPen', 0.5)],
  },
  {
    charKey: 'yenna-stonecall',
    damageSchool: 'earth',
    name: "Yenna Stonecall",
    charClass: 'Shaman',
    role: null,
    rarity: 'Uncommon',
    baseStats: [sv('health', 88), sv('defense', 8), sv('strength', 4), sv('attack', 7), sv('intelligence', 10), sv('healingPower', 11), sv('agility', 6), sv('speed', 7), sv('resistance', 9), sv('healthRegen', 3)],
    growth: [g('intelligence', 2), g('healingPower', 3), g('health', 7), g('defense', 1), g('healthRegen', 0.5)],
  },
  {
    charKey: 'dara-steelfist',
    name: "Dara Steelfist",
    charClass: 'Fighter',
    role: null,
    rarity: 'Uncommon',
    baseStats: [sv('health', 85), sv('defense', 7), sv('strength', 14), sv('attack', 12), sv('agility', 9), sv('speed', 8), sv('dodge', 3), sv('resistance', 5), sv('healthRegen', 2)],
    growth: [g('strength', 3), g('attack', 2), g('health', 7), g('defense', 1), g('agility', 1), g('block', 0.25)],
  },
  {
    charKey: 'oku-mellow',
    name: "Oku Mellow",
    charClass: 'Brewmaster',
    role: null,
    rarity: 'Uncommon',
    baseStats: [sv('health', 105), sv('defense', 9), sv('strength', 9), sv('attack', 8), sv('intelligence', 4), sv('agility', 5), sv('speed', 6), sv('block', 4), sv('resistance', 9), sv('healthRegen', 4)],
    growth: [g('health', 10), g('defense', 1.5), g('strength', 2), g('resistance', 1), g('healthRegen', 1), g('block', 0.25)],
  },
  {
    charKey: 'lyra-brightnote',
    name: "Lyra Brightnote",
    charClass: 'Bard',
    role: null,
    rarity: 'Uncommon',
    baseStats: [sv('health', 72), sv('defense', 5), sv('strength', 5), sv('attack', 7), sv('intelligence', 12), sv('agility', 10), sv('speed', 12), sv('resistance', 6), sv('haste', 5), sv('healthRegen', 2)],
    growth: [g('intelligence', 2), g('speed', 2), g('health', 5), g('agility', 1), g('haste', 1)],
  },
  {
    charKey: 'aldric-faithward',
    damageSchool: 'holy',
    name: "Aldric Faithward",
    charClass: 'Priest',
    role: null,
    rarity: 'Uncommon',
    baseStats: [sv('health', 86), sv('defense', 6), sv('strength', 3), sv('attack', 5), sv('intelligence', 12), sv('healingPower', 14), sv('agility', 5), sv('speed', 6), sv('resistance', 10), sv('healthRegen', 4)],
    growth: [g('intelligence', 2), g('healingPower', 3), g('healthRegen', 0.75), g('health', 5), g('resistance', 1)],
  },
  {
    charKey: 'brom-ironwall',
    name: "Brom Ironwall",
    charClass: 'Warrior',
    role: null,
    rarity: 'Rare',
    baseStats: [sv('health', 115), sv('defense', 13), sv('strength', 14), sv('attack', 10), sv('agility', 4), sv('speed', 5), sv('block', 5), sv('dodge', 1), sv('resistance', 7), sv('healthRegen', 2)],
    growth: [g('health', 9, [{ level: 20, bonus: 25 }]), g('defense', 2), g('strength', 3), g('attack', 1), g('block', 0.75)],
  },
  {
    charKey: 'vex-nightcut',
    name: "Vex Nightcut",
    charClass: 'Rogue',
    role: null,
    rarity: 'Rare',
    baseStats: [sv('health', 65), sv('defense', 4), sv('strength', 6), sv('attack', 15), sv('agility', 14), sv('speed', 11), sv('dodge', 4), sv('resistance', 3), sv('critChance', 4)],
    growth: [g('attack', 3), g('agility', 2), g('health', 5), g('speed', 1), g('critChance', 0.5), g('critDamage', 0.33)],
  },
  {
    charKey: 'sera-fletchwind',
    name: "Sera Fletchwind",
    charClass: 'Hunter',
    role: null,
    rarity: 'Rare',
    baseStats: [sv('health', 70), sv('defense', 5), sv('strength', 7), sv('attack', 13), sv('agility', 12), sv('speed', 10), sv('dodge', 3), sv('resistance', 4), sv('critChance', 6)],
    growth: [g('attack', 3), g('agility', 2), g('health', 5), g('speed', 1), g('critChance', 0.5), g('armorPen', 0.5)],
  },
  {
    charKey: 'tyla-windcarrier',
    damageSchool: 'wind',
    name: "Tyla Windcarrier",
    charClass: 'Shaman',
    role: 'healer',
    rarity: 'Rare',
    baseStats: [sv('intelligence', 18), sv('healingPower', 14), sv('spellPower', 8), sv('health', 85), sv('healthRegen', 3), sv('resistance', 8), sv('haste', 5), sv('speed', 7), sv('defense', 3), sv('attack', 2)],
    growth: [g('intelligence', 3), g('healingPower', 2.5), g('spellPower', 1), g('health', 7), g('healthRegen', 0.5), g('resistance', 0.5)],
  },
  {
    charKey: 'dace-ashveil',
    name: "Dace Ashveil [WIP]",
    charClass: 'Rogue',
    role: null,
    rarity: 'Rare',
    baseStats: [sv('attack', 18), sv('agility', 14), sv('speed', 12), sv('critChance', 8), sv('dodge', 2), sv('health', 70), sv('defense', 3)],
    growth: [g('attack', 3), g('agility', 2), g('speed', 1.5), g('critChance', 0.5), g('health', 3)],
  },
  {
    charKey: 'mordrek-graveborn',
    name: "Mordrek Graveborn",
    charClass: 'Death Knight',
    role: null,
    rarity: 'Epic',
    baseStats: [sv('health', 120), sv('defense', 14), sv('strength', 12), sv('attack', 9), sv('agility', 3), sv('speed', 5), sv('block', 5), sv('dodge', 2), sv('resistance', 10), sv('healthRegen', 3)],
    growth: [g('health', 10, [{ level: 25, bonus: 30 }]), g('defense', 2), g('strength', 3, [{ level: 10, bonus: 8 }]), g('attack', 1), g('block', 0.5, [{ level: 15, bonus: 5 }]), g('healthRegen', 0.25)],
  },
]

const byKey = new Map(ROSTER.map((r) => [r.charKey, r]))

/** Build a sim-ready Combatant for one roster character at a level (full HP, no gear/blessings). */
export function buildCombatant(charKey: string, level: number): Combatant {
  const def = byKey.get(charKey)
  if (!def) throw new Error(`Unknown roster charKey: ${charKey}`)
  return {
    id: def.charKey,
    role: resolveRole(def.charClass, def.role),
    stats: computeBaselines(level, def.baseStats, def.growth),
    damageSchool: def.damageSchool,
  }
}

/** Build a whole party at one shared level. */
export function buildParty(charKeys: string[], level: number): Combatant[] {
  return charKeys.map((k) => buildCombatant(k, level))
}
