// The item point-budget checker (TODO "item power-budget file", companion to characterBudget.ts's
// ADR-0031 point-buy). Items don't author rarity (only the Common baseline is authored —
// RARITY_MULT scales it at equip time, docs/ITEMS.md), so the budget dimension here is SLOT TYPE,
// not rarity: each slot gets a target cost-PER-LEVEL (minLevel), not a flat cap, because real
// wave-1 content shows cost scaling with minLevel within a slot (a L1 weapon and a L14 weapon are
// not meant to cost the same). The Sanity studio imports this module directly for its
// authoring-time validation (studio/schemaTypes/itemDef.ts), so this file stays dependency-free
// apart from reusing characterBudget's STAT_PRICE table (one price list, not two that can drift).
//
// First-pass numbers, reasoned from the 23 live wave-1 itemDefs (same "anchor to authored content,
// then calibrate" approach characterBudget used for its own budgets). Expect this to flag some
// existing items as out of band on first run — most are minLevel<=3 "universal fill" items that
// docs/ITEMS.md already calls informal/not level-tuned; that's the checker doing its job, not a
// bug to tune away.

import { STAT_PRICE } from './characterBudget'

export type ItemSlot =
  | 'head'
  | 'shoulders'
  | 'chest'
  | 'hands'
  | 'legs'
  | 'feet'
  | 'weapon'
  | 'offhand'
  | 'ring'
  | 'trinket'

export type BudgetItemStat = { stat: string; kind: 'flat' | 'pct'; value: number }

// ---- Pricing --------------------------------------------------------------------------------

const priceOf = (stat: string): number => STAT_PRICE[stat] ?? 1

/** Points per 1 pct-point of a `kind: 'pct'` stat bonus. A pct effect's real power depends on the
 *  wearer's own base stat (context characterBudget's flatEffectsCost punts on entirely, ADR-0045),
 *  so this is a deliberate first-pass approximation — same numeric scale as the flat price for the
 *  stats that actually appear as pct on items today, not a modeled equivalence. Calibrate as real
 *  pct content accumulates. */
const PCT_STAT_PRICE: Record<string, number> = {
  spellPower: 1,
  healingPower: 1,
  health: 0.15,
}

const pctPriceOf = (stat: string): number => PCT_STAT_PRICE[stat] ?? priceOf(stat)

/** Budget points spent by one item's stat bonuses (flat + pct combined). */
export function itemCost(statBonuses: BudgetItemStat[]): number {
  return statBonuses.reduce((sum, b) => {
    const price = b.kind === 'pct' ? pctPriceOf(b.stat) : priceOf(b.stat)
    return sum + b.value * price
  }, 0)
}

// ---- Per-slot rate budget ---------------------------------------------------------------------

/** Target budget points spent PER LEVEL of minLevel, by slot. Anchored to wave-1 medians:
 *  weapon/ring run richer per level (single build-defining stat or two-stat combos); offhand/chest/
 *  the health-only armor slots run leaner (defense/health are the cheap bulk stats). */
export const SLOT_TARGET_RATE: Record<ItemSlot, number> = {
  weapon: 1.5,
  offhand: 0.8,
  chest: 0.75,
  head: 0.7,
  shoulders: 0.7,
  hands: 0.7,
  legs: 0.7,
  feet: 0.7,
  ring: 1.2,
  trinket: 1.0,
}

/** Normal tolerance band, as a fraction of the slot's target rate (wide on purpose — rings and
 *  trinkets intentionally vary by flavor, docs/ITEMS.md's "pick one flavor per ring"). */
export const RATE_TOLERANCE = 0.45

/** minLevel at/below this is docs/ITEMS.md's "universal fill" pass — informal, not level-tuned —
 *  so it gets a looser tolerance instead of being held to the per-map build-defining items' band. */
export const INFORMAL_MIN_LEVEL_CEILING = 3
export const INFORMAL_RATE_TOLERANCE = 1.0

export type ItemBudgetAudit = {
  cost: number
  rate: number
  targetRate: number
  minRate: number
  maxRate: number
  ok: boolean
}

/** Audit one itemDef's statBonuses against its slot's per-level rate budget. */
export function auditItem(
  slot: ItemSlot,
  minLevel: number | undefined,
  statBonuses: BudgetItemStat[],
): ItemBudgetAudit {
  const cost = itemCost(statBonuses)
  const level = Math.max(minLevel ?? 1, 1)
  const rate = cost / level
  const targetRate = SLOT_TARGET_RATE[slot]
  const tolerance = level <= INFORMAL_MIN_LEVEL_CEILING ? INFORMAL_RATE_TOLERANCE : RATE_TOLERANCE
  const minRate = targetRate * (1 - tolerance)
  const maxRate = targetRate * (1 + tolerance)
  return { cost, rate, targetRate, minRate, maxRate, ok: rate >= minRate && rate <= maxRate }
}
