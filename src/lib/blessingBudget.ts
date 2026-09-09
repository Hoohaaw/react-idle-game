// The blessing-tree point-budget checker (docs/BLESSINGS.md's sizing methodology) — the dedicated
// module the TODO asked for, replacing the throwaway scratchpad script wave-1 authoring used.
// Reuses characterBudget.ts's STAT_PRICE/flatEffectsCost/BUDGET_TOLERANCE (one price table, not
// two that can drift) and stays otherwise dependency-free so the Sanity studio can import it
// directly, same pattern as itemBudget.ts/characterBudget.ts.

import { STAT_PRICE, flatEffectsCost, BUDGET_TOLERANCE } from './characterBudget'

export type NodeEffect = { stat: string; kind: 'flat' | 'pct'; value: number }

const priceOf = (stat: string): number => STAT_PRICE[stat] ?? 1

// ---- Row equal-cost check (flat effects only) --------------------------------------------------

export type RowAudit = {
  costA: number | null
  costB: number | null
  ok: boolean
}

/** Both choices in a blessing row must cost the same (docs/BLESSINGS.md #2 — a real fork, not a
 *  bigger number). Returns ok:true (nothing to check here) when either side carries a `pct`
 *  effect — use auditPctDrift for that case, since a pct effect can't be priced this way. */
export function auditBlessingRow(choiceA: NodeEffect[], choiceB: NodeEffect[]): RowAudit {
  const costA = flatEffectsCost(choiceA)
  const costB = flatEffectsCost(choiceB)
  if (costA === null || costB === null) return { costA, costB, ok: true }
  return { costA, costB, ok: Math.abs(costA - costB) <= BUDGET_TOLERANCE }
}

// ---- Capstone budget (stat/conditional only — ability capstones aren't priced) ------------------

/** Budget points a stat/conditional capstone must spend (docs/BLESSINGS.md #1). Ability capstones
 *  aren't priced at all — never call the functions below for kind: 'ability'. */
export const CAPSTONE_STAT_BUDGET = 30

export type CapstoneAudit = { cost: number | null; ok: boolean }

/** Audits a flat-effects capstone against CAPSTONE_STAT_BUDGET. Returns ok:true (nothing to check
 *  here) when the capstone carries a `pct` effect — use auditCapstonePctCost for that case. */
export function auditCapstoneCost(effects: NodeEffect[]): CapstoneAudit {
  const cost = flatEffectsCost(effects)
  if (cost === null) return { cost, ok: true }
  return { cost, ok: Math.abs(cost - CAPSTONE_STAT_BUDGET) <= BUDGET_TOLERANCE }
}

// ---- Pct-drift check (real character baseline required) -----------------------------------------
//
// A `pct` effect's value depends on the wearer's own baseline for that stat (effective = baseline
// + flat + baseline×pct/100) — it can't be priced the same flat-point way, and a pct choice drifts
// apart from a flat-costed sibling as the character levels (docs/BLESSINGS.md #3: never mix flat
// and pct in the same row; check cost at both the row's unlock level AND L50). These functions
// take the character's REAL baseline for the stat at the level being checked (from
// `computeBaselines` in src/lib/stats.ts, using that character's actual baseStats/growth,
// scripts/balance/roster.ts) — they don't compute the baseline themselves, so this module stays
// dependency-free; the caller does that lookup once per anchor level.

/** Flat-budget-point-equivalent value of ONE pct effect, given the character's real baseline for
 *  that stat at the level being checked. */
export function pctEffectValue(baselineAtLevel: number, effect: NodeEffect): number {
  return baselineAtLevel * (effect.value / 100) * priceOf(effect.stat)
}

export type PctDriftAudit = { costA: number; costB: number; ok: boolean }

/** Compares two pct row-choices' flat-equivalent value at ONE level — call once per anchor level
 *  (the row's unlock level, then again at L50) since a flat/pct pair (or two pct choices with
 *  different baselines) only reads as equal at one anchor and can drift apart otherwise. */
export function auditPctDrift(
  baselineA: number, effectA: NodeEffect,
  baselineB: number, effectB: NodeEffect,
): PctDriftAudit {
  const costA = pctEffectValue(baselineA, effectA)
  const costB = pctEffectValue(baselineB, effectB)
  return { costA, costB, ok: Math.abs(costA - costB) <= BUDGET_TOLERANCE }
}

/** Audits a single pct-effect capstone against CAPSTONE_STAT_BUDGET at the character's baseline
 *  at L50 — capstones are only ever earned at L50 (level >= 50 && row4 picked), so there's exactly
 *  one anchor level to check here, unlike a row's two. */
export function auditCapstonePctCost(baselineAtL50: number, effect: NodeEffect): CapstoneAudit {
  const cost = pctEffectValue(baselineAtL50, effect)
  return { cost, ok: Math.abs(cost - CAPSTONE_STAT_BUDGET) <= BUDGET_TOLERANCE }
}
