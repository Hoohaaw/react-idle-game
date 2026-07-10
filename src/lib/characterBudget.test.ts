import { describe, it, expect } from 'vitest'
import {
  STAT_PRICE,
  GROWTH_BUDGET,
  BASE_BUDGET,
  BUDGET_TOLERANCE,
  baseCost,
  growthCostPerLevel,
  auditCharacter,
} from './characterBudget'
import { STAT_KEYS } from './statDefinitions'

describe('characterBudget', () => {
  it('prices every stat in the registry (no accidental free stats)', () => {
    for (const key of STAT_KEYS) expect(STAT_PRICE[key], key).toBeGreaterThan(0)
  })

  it('budgets rise monotonically with rarity', () => {
    expect(GROWTH_BUDGET.Common).toBeLessThan(GROWTH_BUDGET.Uncommon)
    expect(GROWTH_BUDGET.Uncommon).toBeLessThan(GROWTH_BUDGET.Rare)
    expect(GROWTH_BUDGET.Rare).toBeLessThan(GROWTH_BUDGET.Epic)
    expect(GROWTH_BUDGET.Epic).toBeLessThan(GROWTH_BUDGET.Legendary)
    expect(BASE_BUDGET.Common).toBeLessThan(BASE_BUDGET.Legendary)
  })

  it('baseCost sums price × value', () => {
    // health 100 × 0.15 + strength 10 × 1 + dodge 5 × 3 = 15 + 10 + 15
    expect(
      baseCost([
        { stat: 'health', value: 100 },
        { stat: 'strength', value: 10 },
        { stat: 'dodge', value: 5 },
      ]),
    ).toBeCloseTo(40)
  })

  it('growthCostPerLevel prices perLevel and amortizes milestones over the level span', () => {
    // strength 2/level = 2 pts; health 6.5/level = 0.975; milestone 49 HP once = 49×0.15/49 = 0.15
    expect(
      growthCostPerLevel([
        { stat: 'strength', perLevel: 2 },
        { stat: 'health', perLevel: 6.5, milestones: [{ level: 20, bonus: 49 }] },
      ]),
    ).toBeCloseTo(2 + 0.975 + 0.15)
  })

  it('auditCharacter passes within tolerance and fails outside it', () => {
    // Exactly Common growth budget: 8 points of strength.
    const onBudget = auditCharacter('Common', [{ stat: 'strength', value: 80 }], [{ stat: 'strength', perLevel: 8 }])
    expect(onBudget.baseOk).toBe(true)
    expect(onBudget.growthOk).toBe(true)

    const over = auditCharacter(
      'Common',
      [{ stat: 'strength', value: 80 + BUDGET_TOLERANCE + 1 }],
      [{ stat: 'strength', perLevel: 8 + BUDGET_TOLERANCE + 1 }],
    )
    expect(over.baseOk).toBe(false)
    expect(over.growthOk).toBe(false)
  })
})
