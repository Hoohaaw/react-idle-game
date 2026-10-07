import { describe, it, expect } from 'vitest'
import { ECHO_SHOP_NODES, nodeCost, resolveShopBonus, effectPercent, MAX_PROTECTED_SLOTS } from './echoShop'

describe('ECHO_SHOP_NODES', () => {
  it('has exactly 21 nodes: missionSpeed, goldGain, protectedSlots, and 9 resources x 2 lanes', () => {
    expect(Object.keys(ECHO_SHOP_NODES)).toHaveLength(21)
    expect(ECHO_SHOP_NODES.missionSpeed).toBeDefined()
    expect(ECHO_SHOP_NODES.goldGain).toBeDefined()
    expect(ECHO_SHOP_NODES['gatherRate.Iron']).toBeDefined()
    expect(ECHO_SHOP_NODES['resourceGain.Platinum']).toBeDefined()
  })

  it('per-resource nodes carry the resource on their effect', () => {
    expect(ECHO_SHOP_NODES['gatherRate.Wood'].effect).toEqual({ kind: 'gatherRate', resource: 'Wood' })
    expect(ECHO_SHOP_NODES['resourceGain.Coal'].effect).toEqual({ kind: 'resourceGain', resource: 'Coal' })
  })

  it('flat nodes carry no resource', () => {
    expect(ECHO_SHOP_NODES.missionSpeed.effect).toEqual({ kind: 'missionSpeed' })
    expect(ECHO_SHOP_NODES.goldGain.effect).toEqual({ kind: 'goldGain' })
  })
})

describe('ECHO_SHOP_NODES.protectedSlots', () => {
  it('exists as a flat node with no resource', () => {
    expect(ECHO_SHOP_NODES.protectedSlots).toBeDefined()
    expect(ECHO_SHOP_NODES.protectedSlots.effect).toEqual({ kind: 'protectedSlots' })
  })

  it('is priced steeper than every other flat node', () => {
    expect(ECHO_SHOP_NODES.protectedSlots.costBase).toBeGreaterThan(ECHO_SHOP_NODES.missionSpeed.costBase)
    expect(ECHO_SHOP_NODES.protectedSlots.costGrowth).toBeGreaterThan(ECHO_SHOP_NODES.missionSpeed.costGrowth)
  })
})

describe('MAX_PROTECTED_SLOTS', () => {
  it('is 5', () => {
    expect(MAX_PROTECTED_SLOTS).toBe(5)
  })
})

describe('nodeCost', () => {
  it('grows by costGrowth per level, floored', () => {
    const node = ECHO_SHOP_NODES.missionSpeed // costBase 10, costGrowth 1.15
    expect(nodeCost(node, 0)).toBe(10)
    expect(nodeCost(node, 1)).toBe(11) // floor(10 * 1.15)
    expect(nodeCost(node, 5)).toBe(20) // floor(10 * 1.15^5) = floor(20.11...)
  })
})

describe('resolveShopBonus', () => {
  it('is 1 (no bonus) with an empty shop', () => {
    expect(resolveShopBonus({}, 'missionSpeed')).toBe(1)
    expect(resolveShopBonus({}, 'gatherRate', 'Iron')).toBe(1)
  })

  it('scales with level for a flat node', () => {
    expect(resolveShopBonus({ missionSpeed: 3 }, 'missionSpeed')).toBeCloseTo(1.06) // +2%/level
  })

  it('scales with level for a per-resource node, scoped to that resource only', () => {
    const shop = { 'gatherRate.Iron': 2 }
    expect(resolveShopBonus(shop, 'gatherRate', 'Iron')).toBeCloseTo(1.06) // +3%/level
    expect(resolveShopBonus(shop, 'gatherRate', 'Wood')).toBe(1) // untouched
  })

  it('goldGain and resourceGain are independent', () => {
    const shop = { goldGain: 1, 'resourceGain.Gold': 2 }
    expect(resolveShopBonus(shop, 'goldGain')).toBeCloseTo(1.02)
    expect(resolveShopBonus(shop, 'resourceGain', 'Gold')).toBeCloseTo(1.06)
  })
})

describe('effectPercent', () => {
  it('returns the percent bonus at a given level', () => {
    expect(effectPercent('missionSpeed', 0)).toBe(0)
    expect(effectPercent('missionSpeed', 5)).toBe(10) // 5 * 2%
    expect(effectPercent('gatherRate', 4)).toBe(12) // 4 * 3%
  })
})
