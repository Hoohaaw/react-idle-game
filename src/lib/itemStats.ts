import { RARITY_MULT, type ItemDefBonuses } from './stats'
import { STAT_DEFS } from './statDefinitions'

// Display formatting for an item's rarity-scaled stat bonuses — the same base×RARITY_MULT
// math collectGearBonuses applies, so what a tooltip shows always matches what the stat
// engine grants. Used by the inventory grid, the equipped-gear tooltips and the slot picker.

const LABEL_BY_KEY = new Map(STAT_DEFS.map((d) => [d.key, d.label]))

/** UI Item.stats pairs, e.g. { key: 'Attack', value: '+10' } / { key: 'Health', value: '+5%' }. */
export function scaledItemStats(
  statBonuses: ItemDefBonuses['statBonuses'],
  rarity: string,
): { key: string; value: string }[] {
  const mult = RARITY_MULT[rarity] ?? 1
  return (statBonuses ?? []).map((b) => ({
    key: LABEL_BY_KEY.get(b.stat) ?? b.stat,
    value: b.kind === 'pct' ? `+${b.value * mult}%` : `+${b.value * mult}`,
  }))
}

/** One-line-per-stat form ('+10 Attack'), for compact tooltips. */
export function scaledStatLines(statBonuses: ItemDefBonuses['statBonuses'], rarity: string): string[] {
  return scaledItemStats(statBonuses, rarity).map((s) => `${s.value} ${s.key}`)
}
