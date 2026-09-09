import { describe, it, expect } from 'vitest'
import {
  CAPSTONE_STAT_BUDGET,
  auditBlessingRow,
  auditCapstoneCost,
  auditCapstonePctCost,
  pctEffectValue,
  auditPctDrift,
} from './blessingBudget'
import { BUDGET_TOLERANCE, STAT_PRICE } from './characterBudget'

describe('auditBlessingRow', () => {
  it('passes when both choices cost the same', () => {
    // attack 10 (price 1) = 10; health ~66.7 (price 0.15) = 10
    const result = auditBlessingRow(
      [{ stat: 'attack', kind: 'flat', value: 10 }],
      [{ stat: 'health', kind: 'flat', value: 10 / STAT_PRICE.health }],
    )
    expect(result.ok).toBe(true)
    expect(result.costA).toBeCloseTo(10)
    expect(result.costB).toBeCloseTo(10)
  })

  it('fails when costs differ beyond tolerance', () => {
    const result = auditBlessingRow(
      [{ stat: 'attack', kind: 'flat', value: 10 }],
      [{ stat: 'attack', kind: 'flat', value: 10 + BUDGET_TOLERANCE + 1 }],
    )
    expect(result.ok).toBe(false)
  })

  it('passes (skips) when either choice carries a pct effect', () => {
    const result = auditBlessingRow(
      [{ stat: 'attack', kind: 'flat', value: 10 }],
      [{ stat: 'healingPower', kind: 'pct', value: 6 }],
    )
    expect(result.ok).toBe(true)
    expect(result.costA).toBe(10)
    expect(result.costB).toBeNull()
  })
})

describe('auditCapstoneCost', () => {
  it('passes exactly at the capstone budget', () => {
    const result = auditCapstoneCost([{ stat: 'attack', kind: 'flat', value: CAPSTONE_STAT_BUDGET }])
    expect(result.ok).toBe(true)
    expect(result.cost).toBe(CAPSTONE_STAT_BUDGET)
  })

  it('fails when over budget', () => {
    const result = auditCapstoneCost([{ stat: 'attack', kind: 'flat', value: CAPSTONE_STAT_BUDGET + BUDGET_TOLERANCE + 1 }])
    expect(result.ok).toBe(false)
  })

  it('skips (ok:true, cost:null) for a pct capstone', () => {
    const result = auditCapstoneCost([{ stat: 'healingPower', kind: 'pct', value: 15 }])
    expect(result.ok).toBe(true)
    expect(result.cost).toBeNull()
  })
})

describe('pctEffectValue', () => {
  it('scales with baseline, pct, and stat price', () => {
    // baseline 200 healingPower, +6% -> 12 flat-equivalent points, price 1 -> 12
    expect(pctEffectValue(200, { stat: 'healingPower', kind: 'pct', value: 6 })).toBeCloseTo(12)
  })

  it('a pct effect on a stat with zero baseline is worth zero (docs/BLESSINGS.md #4)', () => {
    expect(pctEffectValue(0, { stat: 'healingPower', kind: 'pct', value: 50 })).toBe(0)
  })
})

describe('auditPctDrift', () => {
  it('passes when two pct choices are worth the same at this baseline', () => {
    // both worth 200*0.06*1 = 12
    const result = auditPctDrift(
      200, { stat: 'healingPower', kind: 'pct', value: 6 },
      200, { stat: 'spellPower', kind: 'pct', value: 6 },
    )
    expect(result.ok).toBe(true)
  })

  it('fails when the same pct values drift apart at different baselines', () => {
    const result = auditPctDrift(
      200, { stat: 'healingPower', kind: 'pct', value: 6 },
      50, { stat: 'healingPower', kind: 'pct', value: 6 },
    )
    expect(result.ok).toBe(false)
  })
})

describe('auditCapstonePctCost', () => {
  it('passes when the pct effect at L50 baseline hits the capstone budget', () => {
    // baseline 500, pct such that 500 * (pct/100) * 1 = 30 -> pct = 6
    const result = auditCapstonePctCost(500, { stat: 'healingPower', kind: 'pct', value: 6 })
    expect(result.ok).toBe(true)
    expect(result.cost).toBeCloseTo(30)
  })

  it('fails when under-budget', () => {
    const result = auditCapstonePctCost(500, { stat: 'healingPower', kind: 'pct', value: 1 })
    expect(result.ok).toBe(false)
  })
})
