// The character point-buy budget (ADR-0031) — the authoring rulebook that keeps every character
// comparable by construction. A character's power is priced in BUDGET POINTS: each stat has a
// price per +1, and both the level-1 base spread and the per-level growth must spend a fixed
// budget set by the character's RARITY. Identity comes from WHERE the points go, not how many.
//
// Prices are FIRST-PASS values reasoned from the combat model (ADR-0024…0030 sweeps); the balance
// harness calibrates them over time (docs/BALANCE.md). The Sanity studio imports this module
// directly for its authoring-time validation (studio/schemaTypes/characterDef.ts), so this file
// stays dependency-free.
//
// Full guideline with worked examples: docs/CHARACTERS.md.

// Structural mirrors of stats.ts's StatValue/StatGrowth — kept local (no imports) so the Sanity
// studio can import this module directly for its authoring validation.
export type BudgetStatValue = { stat: string; value: number }
export type BudgetStatGrowth = {
  stat: string
  perLevel: number
  milestones?: { level: number; bonus: number }[]
}

// ---- Stat prices (budget points per +1 of the stat) --------------------------------------------

export const STAT_PRICE: Record<string, number> = {
  // Bulk pool — cheap per point because it takes ~6-7 HP to equal one primary point of value.
  health: 0.15,
  // The reference unit: flat combat scalars.
  attack: 1,
  strength: 1,
  agility: 1,
  intelligence: 1,
  spellPower: 1,
  healingPower: 1,
  defense: 1,
  resistance: 1,
  // Action economy — still strong after the ADR-0030 DR curve, priced above the reference.
  speed: 1.5,
  haste: 1.5,
  // Percent-chance procs — the runaway family (ADR-0028/0029); expensive, and dodge past the
  // 25% cap (ADR-0029) is wasted regardless of price.
  critChance: 2.5,
  critDamage: 1.5,
  armorPen: 1,
  dodge: 3,
  block: 2,
  healthRegen: 2,
  healingCrit: 2,
  // Non-combat utility — half price; it buys economy, not survival.
  missionSpeedDecrease: 1,
  gatherSpeed: 0.5,
  gatherYield: 0.5,
  magicFind: 0.5,
  luck: 0.5,
  // Trait-era economy/recovery stats (ADR-0035) — priced like the other economy stats so a
  // character COULD buy them with budget, though traits are their primary source.
  goldFind: 0.5,
  xpGain: 0.5,
  recoverySpeed: 0.5,
}

// ---- Rarity budgets ------------------------------------------------------------------------------

export type CharacterRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary'

export const CHARACTER_RARITIES: CharacterRarity[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']

/** Budget points spent per LEVEL of growth (Σ price × perLevel). Anchored to the authored
 *  roster's median under this price table (~7.3–8) so re-costing was nudges, not rewrites.
 *  A tight band on purpose — rarity should feel meaningful (~25% growth spread), never dominant. */
export const GROWTH_BUDGET: Record<CharacterRarity, number> = {
  Common: 8,
  Uncommon: 8.5,
  Rare: 9,
  Epic: 9.5,
  Legendary: 10,
}

/** Budget points in the LEVEL-1 base spread (Σ price × base value). Same anchoring (median ~89). */
export const BASE_BUDGET: Record<CharacterRarity, number> = {
  Common: 80,
  Uncommon: 85,
  Rare: 90,
  Epic: 95,
  Legendary: 100,
}

/** Authoring tolerance: |spent − budget| ≤ this passes validation. */
export const BUDGET_TOLERANCE = 0.5

/** Traits per character by rarity (ADR-0035, Alex's table). Traits sit OUTSIDE the point-buy
 *  budget — they're conditional, so rarity buys versatility, never a higher always-on floor.
 *  Studio validation enforces the exact count (and max one always-on combat trait). */
export const TRAIT_COUNT_BY_RARITY: Record<CharacterRarity, number> = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  Epic: 4,
  Legendary: 5,
}

/** Milestones spend the growth pool too: a milestone's cost is amortized as bonus × price,
 *  counted once (it is a one-time spike, roughly one level's worth of that stat pre-paid). */
export const MILESTONE_PRICE_FACTOR = 1

// ---- Costing helpers -----------------------------------------------------------------------------

const priceOf = (stat: string): number => STAT_PRICE[stat] ?? 1

/** Budget points spent by a level-1 base spread. */
export function baseCost(baseStats: BudgetStatValue[]): number {
  return baseStats.reduce((sum, b) => sum + b.value * priceOf(b.stat), 0)
}

/** Budget points spent PER LEVEL by a growth set (milestones amortized over the 49 level-ups). */
export function growthCostPerLevel(growth: BudgetStatGrowth[], levelSpan = 49): number {
  return growth.reduce((sum, g) => {
    const milestoneCost = (g.milestones ?? []).reduce(
      (m, ms) => m + ms.bonus * priceOf(g.stat) * MILESTONE_PRICE_FACTOR,
      0,
    )
    return sum + g.perLevel * priceOf(g.stat) + milestoneCost / levelSpan
  }, 0)
}

export type BudgetAudit = {
  baseCost: number
  baseBudget: number
  baseOk: boolean
  growthCost: number
  growthBudget: number
  growthOk: boolean
}

/** Audit one character definition against its rarity's budgets. */
export function auditCharacter(
  rarity: CharacterRarity,
  baseStats: BudgetStatValue[],
  growth: BudgetStatGrowth[],
): BudgetAudit {
  const bCost = baseCost(baseStats)
  const gCost = growthCostPerLevel(growth)
  return {
    baseCost: bCost,
    baseBudget: BASE_BUDGET[rarity],
    baseOk: Math.abs(bCost - BASE_BUDGET[rarity]) <= BUDGET_TOLERANCE,
    growthCost: gCost,
    growthBudget: GROWTH_BUDGET[rarity],
    growthOk: Math.abs(gCost - GROWTH_BUDGET[rarity]) <= BUDGET_TOLERANCE,
  }
}
