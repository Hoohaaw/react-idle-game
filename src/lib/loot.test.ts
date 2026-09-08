import { describe, it, expect } from 'vitest'
import { rollRarity, rollItemLoot } from './loot'

function fixedRng(...values: number[]): () => number {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

describe('rollRarity', () => {
  it('returns Common when weights are empty or undefined', () => {
    expect(rollRarity(undefined, () => 0.5)).toBe('Common')
    expect(rollRarity([], () => 0.5)).toBe('Common')
  })

  it('picks proportionally to weight', () => {
    const weights = [{ rarity: 'Common', weight: 80 }, { rarity: 'Epic', weight: 20 }]
    expect(rollRarity(weights, () => 0)).toBe('Common') // r=0 -> first bucket
    expect(rollRarity(weights, () => 0.9999)).toBe('Epic') // r near total -> last bucket
  })

  it('ignores zero-weight entries', () => {
    const weights = [{ rarity: 'Legendary', weight: 0 }, { rarity: 'Rare', weight: 1 }]
    expect(rollRarity(weights, () => 0.5)).toBe('Rare')
  })
})

describe('rollItemLoot', () => {
  it('skips a line with no itemKey', () => {
    const result = rollItemLoot([{ itemKey: null, dropChance: 100 }], fixedRng(0), { magicFind: 0, luck: 0 })
    expect(result).toEqual([])
  })

  it('rolls no drop when the roll exceeds dropChance', () => {
    const result = rollItemLoot(
      [{ itemKey: 'sword', dropChance: 10 }],
      fixedRng(0.5), // 0.5*100=50 >= 10 -> no drop
      { magicFind: 0, luck: 0 },
    )
    expect(result).toEqual([])
  })

  it('rolls a drop, applies magicFind to chance, and rolls quantity/rarity', () => {
    const result = rollItemLoot(
      [{ itemKey: 'sword', dropChance: 50, quantityMin: 1, quantityMax: 1, rarityWeights: [{ rarity: 'Epic', weight: 1 }] }],
      fixedRng(0.4, 0, 0), // dropChance roll 40 < 50+magicFind -> drops; rarity roll 0; quantity roll 0
      { magicFind: 0, luck: 0 },
    )
    expect(result).toEqual([{ item_def_id: 'sword', rarity: 'Epic', quantity: 1 }])
  })

  it('luck can add +1 quantity', () => {
    const result = rollItemLoot(
      [{ itemKey: 'sword', dropChance: 100, quantityMin: 1, quantityMax: 1 }],
      fixedRng(0, 0, 0, 0), // drop roll, rarity roll (no weights->Common path skips rng), quantity roll, luck roll = 0 < luck
      { magicFind: 0, luck: 100 },
    )
    expect(result[0].quantity).toBe(2)
  })
})
