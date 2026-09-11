import { describe, it, expect } from 'vitest'
import { ECHO_SHOP_NODES, nodeCost, resolveShopBonus, effectPercent } from './echoShop'

describe('ECHO_SHOP_NODES', () => {
  it('has exactly 20 nodes: missionSpeed, goldGain, and 9 resources x 2 lanes', () => {
    expect(Object.keys(ECHO_SHOP_NODES)).toHaveLength(20)
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

describe('nodeCost', () => {
  it('grows by costGrowth per level, floored', () => {
    const node = ECHO_SHOP_NODES.missionSpeed // costBase 20, costGrowth 1.15
    expect(nodeCost(node, 0)).toBe(20)
    expect(nodeCost(node, 1)).toBe(23) // floor(20 * 1.15)
    expect(nodeCost(node, 5)).toBe(40) // floor(20 * 1.15^5) = floor(40.227...)
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
