import { describe, it, expect } from 'vitest'
import {
  FLAT_ASCENDANT_NODES, flatNodeCost, resolveFlatAscendantBonus, resolveFlatAscendantStatBonuses,
  charNodeKey, charNodeCost, resolveCharAscendantBonus, resolveCharAscendantBonuses,
} from './ascendantShop'

describe('FLAT_ASCENDANT_NODES', () => {
  it('has exactly 6 flat nodes', () => {
    expect(Object.keys(FLAT_ASCENDANT_NODES)).toHaveLength(6)
    expect(FLAT_ASCENDANT_NODES.missionSpeed).toBeDefined()
    expect(FLAT_ASCENDANT_NODES.goldFind).toBeDefined()
    expect(FLAT_ASCENDANT_NODES.magicFind).toBeDefined()
    expect(FLAT_ASCENDANT_NODES.xpGain).toBeDefined()
    expect(FLAT_ASCENDANT_NODES.resourceGain).toBeDefined()
    expect(FLAT_ASCENDANT_NODES.rarityBias).toBeDefined()
  })
})

describe('flatNodeCost', () => {
  it('grows by costGrowth per level, floored', () => {
    const node = FLAT_ASCENDANT_NODES.missionSpeed // costBase 200, costGrowth 1.35
    expect(flatNodeCost(node, 0)).toBe(200)
    expect(flatNodeCost(node, 1)).toBe(270) // floor(200 * 1.35)
  })
})

describe('resolveFlatAscendantBonus', () => {
  it('is 1 (no bonus) with an empty shop', () => {
    expect(resolveFlatAscendantBonus({}, 'missionSpeed')).toBe(1)
  })
  it('scales with level', () => {
    expect(resolveFlatAscendantBonus({ missionSpeed: 2 }, 'missionSpeed')).toBeCloseTo(1.10) // +5%/level
    expect(resolveFlatAscendantBonus({ resourceGain: 3 }, 'resourceGain')).toBeCloseTo(1.18) // +6%/level
  })
})

describe('resolveFlatAscendantStatBonuses', () => {
  it('returns an empty map with an empty shop', () => {
    expect(resolveFlatAscendantStatBonuses({})).toEqual({})
  })
  it('folds goldFind/magicFind/xpGain in as FLAT percentage-point stat bonuses, not multipliers', () => {
    const out = resolveFlatAscendantStatBonuses({ goldFind: 2, xpGain: 1 })
    expect(out.goldFind).toEqual({ flat: 16, pct: 0 }) // 2 levels * 8%/level * 100 = 16 points
    expect(out.xpGain).toEqual({ flat: 8, pct: 0 })
    expect(out.magicFind).toBeUndefined() // level 0 -> not included at all
  })
})

describe('charNodeKey / charNodeCost', () => {
  it('builds the dotted key', () => {
    expect(charNodeKey('lyra-swift', 'power')).toBe('lyra-swift.power')
    expect(charNodeKey('lyra-swift', 'vitality')).toBe('lyra-swift.vitality')
  })
  it('costs the same regardless of character', () => {
    expect(charNodeCost(0)).toBe(500)
    expect(charNodeCost(1)).toBe(750) // floor(500 * 1.5)
  })
})

describe('resolveCharAscendantBonus', () => {
  it('is 0 with no investment', () => {
    expect(resolveCharAscendantBonus({}, 'lyra-swift', 'power')).toBe(0)
  })
  it('scales with level, scoped to that character and kind only', () => {
    const shop = { 'lyra-swift.power': 3, 'lyra-swift.vitality': 1, 'brom-ironwall.power': 5 }
    expect(resolveCharAscendantBonus(shop, 'lyra-swift', 'power')).toBeCloseTo(0.30) // 3 * 10%
    expect(resolveCharAscendantBonus(shop, 'lyra-swift', 'vitality')).toBeCloseTo(0.10)
    expect(resolveCharAscendantBonus(shop, 'brom-ironwall', 'vitality')).toBe(0) // untouched
  })
})

describe('resolveCharAscendantBonuses', () => {
  it('returns an empty map when neither power nor vitality is invested', () => {
    expect(resolveCharAscendantBonuses({}, 'lyra-swift')).toEqual({})
  })
  it('bundles power into the 7 offense stats and vitality into health/defense', () => {
    const out = resolveCharAscendantBonuses({ 'lyra-swift.power': 2, 'lyra-swift.vitality': 1 }, 'lyra-swift')
    expect(out.attack).toEqual({ flat: 0, pct: 20 }) // 2 * 10% * 100
    expect(out.strength).toEqual({ flat: 0, pct: 20 })
    expect(out.agility).toEqual({ flat: 0, pct: 20 })
    expect(out.speed).toEqual({ flat: 0, pct: 20 })
    expect(out.intelligence).toEqual({ flat: 0, pct: 20 })
    expect(out.spellPower).toEqual({ flat: 0, pct: 20 })
    expect(out.haste).toEqual({ flat: 0, pct: 20 })
    expect(out.health).toEqual({ flat: 0, pct: 10 })
    expect(out.defense).toEqual({ flat: 0, pct: 10 })
    expect(Object.keys(out)).toHaveLength(9)
  })
})
