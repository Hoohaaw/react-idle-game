import { describe, it, expect } from 'vitest'
import { cascade, distribution, UPGRADE_COST } from './upgrade'
import type { Item } from '../types/item'

const makeItem = (name: string, rarity: string, quantity: number): Item => ({
  name,
  rarity,
  slot: 'weapon',
  stats: [],
  value: 10,
  quantity,
})

describe('UPGRADE_COST', () => {
  it('is 5', () => {
    expect(UPGRADE_COST).toBe(5)
  })
})

describe('cascade', () => {
  it('upgrades exactly 5 Common into 1 Uncommon', () => {
    const inv = [makeItem('Sword', 'Common', 5)]
    const result = cascade(inv)
    const uncommon = result.find(i => i.name === 'Sword' && i.rarity === 'Uncommon')
    const common = result.find(i => i.name === 'Sword' && i.rarity === 'Common')
    expect(uncommon?.quantity).toBe(1)
    expect(common).toBeUndefined()
  })

  it('leaves a remainder when quantity is not an exact multiple of 5', () => {
    const inv = [makeItem('Axe', 'Common', 7)]
    const result = cascade(inv)
    const uncommon = result.find(i => i.name === 'Axe' && i.rarity === 'Uncommon')
    const common = result.find(i => i.name === 'Axe' && i.rarity === 'Common')
    expect(uncommon?.quantity).toBe(1)
    expect(common?.quantity).toBe(2)
  })

  it('does not upgrade when quantity is below UPGRADE_COST', () => {
    const inv = [makeItem('Shield', 'Common', 4)]
    const result = cascade(inv)
    expect(result).toHaveLength(1)
    expect(result[0].rarity).toBe('Common')
    expect(result[0].quantity).toBe(4)
  })

  it('cascades multiple tiers in a single pass (10 Common → 2 Uncommon)', () => {
    const inv = [makeItem('Ring', 'Common', 10)]
    const result = cascade(inv)
    const uncommon = result.find(i => i.name === 'Ring' && i.rarity === 'Uncommon')
    const common = result.find(i => i.name === 'Ring' && i.rarity === 'Common')
    expect(uncommon?.quantity).toBe(2)
    expect(common).toBeUndefined()
  })

  it('cascades through multiple rarity tiers (25 Common → 1 Rare)', () => {
    // 25 Common → 5 Uncommon → 1 Rare
    const inv = [makeItem('Gem', 'Common', 25)]
    const result = cascade(inv)
    const rare = result.find(i => i.name === 'Gem' && i.rarity === 'Rare')
    const uncommon = result.find(i => i.name === 'Gem' && i.rarity === 'Uncommon')
    const common = result.find(i => i.name === 'Gem' && i.rarity === 'Common')
    expect(rare?.quantity).toBe(1)
    expect(uncommon).toBeUndefined()
    expect(common).toBeUndefined()
  })

  it('merges produced items with existing higher-rarity stacks', () => {
    const inv = [
      makeItem('Helm', 'Common', 5),
      makeItem('Helm', 'Uncommon', 3),
    ]
    const result = cascade(inv)
    const uncommon = result.find(i => i.name === 'Helm' && i.rarity === 'Uncommon')
    expect(uncommon?.quantity).toBe(4) // 3 existing + 1 produced
  })

  it('handles multiple different item names independently', () => {
    const inv = [
      makeItem('Sword', 'Common', 5),
      makeItem('Staff', 'Common', 3),
    ]
    const result = cascade(inv)
    const sword = result.find(i => i.name === 'Sword' && i.rarity === 'Uncommon')
    const staffCommon = result.find(i => i.name === 'Staff' && i.rarity === 'Common')
    const staffUncommon = result.find(i => i.name === 'Staff' && i.rarity === 'Uncommon')
    expect(sword?.quantity).toBe(1)
    expect(staffCommon?.quantity).toBe(3)
    expect(staffUncommon).toBeUndefined()
  })

  it('limits cascade to named items when names array is provided', () => {
    const inv = [
      makeItem('Sword', 'Common', 5),
      makeItem('Shield', 'Common', 5),
    ]
    const result = cascade(inv, ['Sword'])
    const swordUncommon = result.find(i => i.name === 'Sword' && i.rarity === 'Uncommon')
    const shieldCommon = result.find(i => i.name === 'Shield' && i.rarity === 'Common')
    const shieldUncommon = result.find(i => i.name === 'Shield' && i.rarity === 'Uncommon')
    expect(swordUncommon?.quantity).toBe(1)
    expect(shieldCommon?.quantity).toBe(5) // not cascaded
    expect(shieldUncommon).toBeUndefined()
  })

  it('returns an empty array for an empty inventory', () => {
    expect(cascade([])).toEqual([])
  })

  it('does not upgrade Epic into Legendary incorrectly — Legendary is the ceiling', () => {
    const inv = [makeItem('Crown', 'Epic', 5)]
    const result = cascade(inv)
    const legendary = result.find(i => i.name === 'Crown' && i.rarity === 'Legendary')
    expect(legendary?.quantity).toBe(1)
  })

  it('does not upgrade beyond Legendary', () => {
    const inv = [makeItem('Crown', 'Legendary', 10)]
    const result = cascade(inv)
    const legendary = result.find(i => i.name === 'Crown' && i.rarity === 'Legendary')
    // Legendary is the top tier — no upgrade possible
    expect(legendary?.quantity).toBe(10)
    expect(result).toHaveLength(1)
  })

  it('treats a stack with no quantity field as quantity 1 (below upgrade threshold)', () => {
    // cascade keys by (name, rarity) — duplicate objects collapse to one map entry.
    // A single stack with no quantity field = 1, which is below UPGRADE_COST, so no upgrade.
    const item: Item = { name: 'Ring', rarity: 'Common', slot: 'finger', stats: [], value: 5 }
    const result = cascade([item])
    expect(result).toHaveLength(1)
    expect(result[0].rarity).toBe('Common')
  })
})

describe('distribution', () => {
  it('formats a single rarity stack', () => {
    const stacks = [makeItem('Sword', 'Epic', 2)]
    expect(distribution(stacks)).toBe('2× Epic')
  })

  it('formats multiple rarities in high-to-low order', () => {
    const stacks = [
      makeItem('Ring', 'Common', 3),
      makeItem('Ring', 'Epic', 2),
    ]
    expect(distribution(stacks)).toBe('2× Epic  ·  3× Common')
  })

  it('omits tiers with zero quantity', () => {
    const stacks = [makeItem('Axe', 'Rare', 1)]
    const result = distribution(stacks)
    expect(result).not.toContain('Common')
    expect(result).not.toContain('Uncommon')
    expect(result).toContain('Rare')
  })

  it('returns an empty string for an empty array', () => {
    expect(distribution([])).toBe('')
  })

  it('sums quantities for stacks of the same rarity', () => {
    // Both stacks are the same rarity — distribution adds them together
    const stacks = [
      makeItem('Helm', 'Rare', 2),
      makeItem('Helm', 'Rare', 3),
    ]
    expect(distribution(stacks)).toBe('5× Rare')
  })

  it('treats missing quantity as 1', () => {
    const item: Item = { name: 'Gem', rarity: 'Uncommon', slot: 'trinket', stats: [], value: 1 }
    expect(distribution([item])).toBe('1× Uncommon')
  })

  it('formats all five rarities in correct descending order when present', () => {
    const stacks = [
      makeItem('X', 'Common', 1),
      makeItem('X', 'Uncommon', 1),
      makeItem('X', 'Rare', 1),
      makeItem('X', 'Epic', 1),
      makeItem('X', 'Legendary', 1),
    ]
    expect(distribution(stacks)).toBe('1× Legendary  ·  1× Epic  ·  1× Rare  ·  1× Uncommon  ·  1× Common')
  })
})
