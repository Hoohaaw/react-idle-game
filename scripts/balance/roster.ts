// Roster fixture for the balance harness — a point-in-time snapshot of the 19 authored
// characterDefs (Sanity `production`, DRAFTS perspective, pulled 2026-07-10). The sweep must be
// reproducible offline, so the data lives here rather than being fetched per run. Re-snapshot when
// the roster's baseStats/growth change (see docs/BALANCE.md § keeping the fixture fresh).
//
// Shape mirrors what mission-claim feeds the sim: baseStats + growth → computeBaselines(level) →
// Combatant. No blessings or gear — none are authored yet, so this is the NAKED-BASELINE pass
// (docs/BALANCE.md § scope).

import { computeBaselines, type StatGrowth, type StatValue } from '../../src/lib/stats.ts'
import { resolveRole, type CharacterRole } from '../../src/lib/roles.ts'
import type { Combatant } from '../../src/lib/combat.ts'

export type RosterEntry = {
  charKey: string
  name: string
  charClass: string
  /** Authored role override (Sanity `role`); class default applies when null. */
  role: CharacterRole | null
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
    charKey: 'aldric-faithward',
    name: 'Aldric Faithward',
    charClass: 'Priest',
    role: null,
    baseStats: [
      sv('health', 80), sv('defense', 6), sv('strength', 3), sv('attack', 5),
      sv('intelligence', 12), sv('healingPower', 14), sv('agility', 5), sv('speed', 6),
      sv('resistance', 10), sv('healthRegen', 5),
    ],
    growth: [g('intelligence', 2), g('healingPower', 2), g('healthRegen', 1), g('health', 6), g('resistance', 1)],
  },
  {
    charKey: 'brom-ironwall',
    name: 'Brom Ironwall',
    charClass: 'Warrior',
    role: null,
    baseStats: [
      sv('health', 115), sv('defense', 13), sv('strength', 14), sv('attack', 10),
      sv('agility', 4), sv('speed', 5), sv('block', 9), sv('dodge', 3),
      sv('resistance', 7), sv('healthRegen', 2),
    ],
    growth: [
      g('health', 9, [{ level: 20, bonus: 25 }]),
      g('defense', 2), g('strength', 3), g('attack', 1), g('block', 1),
    ],
  },
  {
    charKey: 'callum-emberveil',
    name: 'Callum Emberveil',
    charClass: 'Mage',
    role: null,
    baseStats: [
      sv('health', 55), sv('defense', 3), sv('strength', 2), sv('attack', 4),
      sv('intelligence', 17), sv('spellPower', 12), sv('agility', 6), sv('speed', 7),
      sv('resistance', 5), sv('haste', 4),
    ],
    growth: [g('intelligence', 3), g('spellPower', 2), g('health', 4), g('speed', 1)],
  },
  {
    charKey: 'dace-ashveil',
    name: 'Dace Ashveil [WIP]',
    charClass: 'Rogue',
    role: null,
    baseStats: [
      sv('attack', 18), sv('agility', 14), sv('speed', 12), sv('critChance', 8),
      sv('dodge', 6), sv('health', 70), sv('defense', 3),
    ],
    growth: [g('attack', 4), g('agility', 3), g('speed', 2), g('critChance', 1), g('health', 6), g('dodge', 1)],
  },
  {
    charKey: 'dara-steelfist',
    name: 'Dara Steelfist',
    charClass: 'Fighter',
    role: null,
    baseStats: [
      sv('health', 85), sv('defense', 7), sv('strength', 14), sv('attack', 12),
      sv('agility', 9), sv('speed', 8), sv('dodge', 5), sv('resistance', 5), sv('healthRegen', 2),
    ],
    growth: [g('strength', 3), g('attack', 2), g('health', 6), g('defense', 1), g('agility', 1)],
  },
  {
    charKey: 'elia-dawnstroke',
    name: 'Elia Dawnstroke',
    charClass: 'Painter',
    role: null,
    baseStats: [
      sv('health', 70), sv('defense', 4), sv('strength', 4), sv('attack', 6),
      sv('intelligence', 12), sv('agility', 8), sv('speed', 9), sv('resistance', 7),
      sv('luck', 6), sv('healthRegen', 2),
    ],
    growth: [g('intelligence', 2), g('speed', 1), g('health', 5), g('luck', 1)],
  },
  {
    charKey: 'fenn-mosswhisper',
    name: 'Fenn Mosswhisper',
    charClass: 'Druid',
    role: null,
    baseStats: [
      sv('health', 90), sv('defense', 8), sv('strength', 7), sv('attack', 7),
      sv('intelligence', 10), sv('healingPower', 8), sv('agility', 8), sv('speed', 8),
      sv('resistance', 8), sv('healthRegen', 3),
    ],
    growth: [g('intelligence', 2), g('health', 6), g('agility', 1), g('defense', 1), g('healingPower', 1)],
  },
  {
    charKey: 'gort-deepvein',
    name: 'Gort Deepvein',
    charClass: 'Miner',
    role: null,
    baseStats: [
      sv('health', 95), sv('defense', 8), sv('strength', 13), sv('attack', 9),
      sv('agility', 5), sv('speed', 5), sv('block', 5), sv('resistance', 7),
      sv('gatherSpeed', 8), sv('gatherYield', 5), sv('healthRegen', 2),
    ],
    growth: [g('strength', 2), g('health', 7), g('defense', 1), g('gatherSpeed', 1)],
  },
  {
    charKey: 'lyra-brightnote',
    name: 'Lyra Brightnote',
    charClass: 'Bard',
    role: null,
    baseStats: [
      sv('health', 72), sv('defense', 5), sv('strength', 5), sv('attack', 7),
      sv('intelligence', 10), sv('agility', 10), sv('speed', 12), sv('resistance', 6),
      sv('haste', 5), sv('healthRegen', 2),
    ],
    growth: [g('intelligence', 2), g('speed', 2), g('health', 5), g('agility', 1), g('haste', 1)],
  },
  {
    charKey: 'mira-ashbind',
    name: 'Mira Ashbind',
    charClass: 'Warlock',
    role: null,
    baseStats: [
      sv('health', 60), sv('defense', 3), sv('strength', 3), sv('attack', 5),
      sv('intelligence', 16), sv('spellPower', 10), sv('agility', 5), sv('speed', 6),
      sv('resistance', 7), sv('healthRegen', 1),
    ],
    growth: [g('intelligence', 3), g('spellPower', 2), g('health', 4), g('resistance', 1)],
  },
  {
    charKey: 'mordrek-graveborn',
    name: 'Mordrek Graveborn',
    charClass: 'Death Knight',
    role: null,
    baseStats: [
      sv('health', 120), sv('defense', 14), sv('strength', 12), sv('attack', 9),
      sv('agility', 5), sv('speed', 6), sv('intelligence', 4), sv('block', 8),
      sv('dodge', 4), sv('resistance', 10), sv('healthRegen', 3),
    ],
    growth: [
      g('strength', 3, [{ level: 10, bonus: 8 }]),
      g('health', 10, [{ level: 25, bonus: 30 }]),
      g('defense', 2), g('attack', 2), g('agility', 1), g('speed', 1),
      g('block', 1, [{ level: 15, bonus: 5 }]),
      g('resistance', 1), g('healthRegen', 1),
    ],
  },
  {
    charKey: 'nira-barkholm',
    name: 'Nira Barkholm',
    charClass: 'Forester',
    role: null,
    baseStats: [
      sv('health', 78), sv('defense', 5), sv('strength', 8), sv('attack', 8),
      sv('agility', 12), sv('speed', 10), sv('dodge', 7), sv('resistance', 5),
      sv('gatherSpeed', 10), sv('gatherYield', 4), sv('healthRegen', 2),
    ],
    growth: [g('agility', 2), g('speed', 1), g('health', 5), g('gatherSpeed', 1)],
  },
  {
    charKey: 'oku-mellow',
    name: 'Oku Mellow',
    charClass: 'Brewmaster',
    role: null,
    baseStats: [
      sv('health', 105), sv('defense', 9), sv('strength', 9), sv('attack', 8),
      sv('intelligence', 7), sv('agility', 6), sv('speed', 6), sv('block', 6),
      sv('resistance', 9), sv('healthRegen', 4),
    ],
    growth: [g('health', 8), g('defense', 1), g('strength', 2), g('resistance', 1), g('healthRegen', 1)],
  },
  {
    charKey: 'rowan-thicket',
    name: 'Rowan Thicket [WIP]',
    charClass: 'Forester',
    role: null,
    baseStats: [
      sv('gatherYield', 20), sv('gatherSpeed', 15), sv('health', 80), sv('agility', 8),
      sv('speed', 8), sv('attack', 5), sv('defense', 3),
    ],
    growth: [g('gatherYield', 3), g('gatherSpeed', 2), g('health', 6), g('agility', 1), g('speed', 1)],
  },
  {
    charKey: 'sera-fletchwind',
    name: 'Sera Fletchwind',
    charClass: 'Hunter',
    role: null,
    baseStats: [
      sv('health', 70), sv('defense', 5), sv('strength', 7), sv('attack', 13),
      sv('agility', 12), sv('speed', 10), sv('dodge', 7), sv('resistance', 4), sv('critChance', 6),
    ],
    growth: [g('attack', 3), g('agility', 2), g('health', 5), g('speed', 1)],
  },
  {
    charKey: 'torvin-gearlock',
    name: 'Torvin Gearlock',
    charClass: 'Engineer',
    role: null,
    baseStats: [
      sv('health', 82), sv('defense', 8), sv('strength', 7), sv('attack', 9),
      sv('intelligence', 11), sv('agility', 7), sv('speed', 7), sv('resistance', 7),
      sv('critChance', 5), sv('healthRegen', 2),
    ],
    growth: [g('intelligence', 2), g('attack', 2), g('defense', 1), g('health', 6)],
  },
  {
    charKey: 'tyla-windcarrier',
    name: 'Tyla Windcarrier',
    charClass: 'Shaman',
    role: 'healer',
    baseStats: [
      sv('intelligence', 18), sv('healingPower', 14), sv('spellPower', 8), sv('health', 85),
      sv('healthRegen', 6), sv('resistance', 8), sv('haste', 6), sv('speed', 7),
      sv('defense', 3), sv('attack', 3),
    ],
    growth: [
      g('intelligence', 4), g('healingPower', 3), g('spellPower', 2), g('health', 8),
      g('healthRegen', 1), g('resistance', 2), g('defense', 1),
    ],
  },
  {
    charKey: 'vex-nightcut',
    name: 'Vex Nightcut',
    charClass: 'Rogue',
    role: null,
    baseStats: [
      sv('health', 65), sv('defense', 4), sv('strength', 8), sv('attack', 15),
      sv('agility', 14), sv('speed', 12), sv('dodge', 10), sv('resistance', 3), sv('critChance', 8),
    ],
    growth: [g('attack', 3), g('agility', 2), g('health', 4), g('speed', 1), g('dodge', 1)],
  },
  {
    charKey: 'yenna-stonecall',
    name: 'Yenna Stonecall',
    charClass: 'Shaman',
    role: null,
    baseStats: [
      sv('health', 88), sv('defense', 8), sv('strength', 6), sv('attack', 7),
      sv('intelligence', 10), sv('healingPower', 11), sv('agility', 6), sv('speed', 7),
      sv('resistance', 9), sv('healthRegen', 4),
    ],
    growth: [g('intelligence', 2), g('healingPower', 2), g('health', 7), g('defense', 1), g('healthRegen', 1)],
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
  }
}

/** Build a whole party at one shared level. */
export function buildParty(charKeys: string[], level: number): Combatant[] {
  return charKeys.map((k) => buildCombatant(k, level))
}
