import { describe, it, expect } from 'vitest'
import { RARITY_STYLES, RARITY_ORDER, nextRarity } from './rarity'

describe('RARITY_STYLES', () => {
  it('defines an entry for every tier in RARITY_ORDER', () => {
    for (const tier of RARITY_ORDER) {
      expect(RARITY_STYLES[tier]).toBeDefined()
    }
  })

  it('every entry has a non-empty color, border, and glow', () => {
    for (const tier of RARITY_ORDER) {
      const style = RARITY_STYLES[tier]
      expect(style.color.length).toBeGreaterThan(0)
      expect(style.border.length).toBeGreaterThan(0)
      expect(style.glow.length).toBeGreaterThan(0)
    }
  })

  it('has exactly five tiers', () => {
    expect(Object.keys(RARITY_STYLES)).toHaveLength(5)
  })

  it('Common glow is transparent (lowest tier has no glow effect)', () => {
    expect(RARITY_STYLES['Common'].glow).toBe('transparent')
  })
})

describe('RARITY_ORDER', () => {
  it('contains exactly five tiers in ascending order', () => {
    expect(RARITY_ORDER).toHaveLength(5)
  })

  it('starts at Common and ends at Legendary', () => {
    expect(RARITY_ORDER[0]).toBe('Common')
    expect(RARITY_ORDER[RARITY_ORDER.length - 1]).toBe('Legendary')
  })

  it('contains the expected sequence', () => {
    expect([...RARITY_ORDER]).toEqual(['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'])
  })
})

describe('nextRarity', () => {
  it('returns the correct next rarity for each step up the ladder', () => {
    expect(nextRarity('Common')).toBe('Uncommon')
    expect(nextRarity('Uncommon')).toBe('Rare')
    expect(nextRarity('Rare')).toBe('Epic')
    expect(nextRarity('Epic')).toBe('Legendary')
  })

  it('returns null for Legendary (top of ladder)', () => {
    expect(nextRarity('Legendary')).toBeNull()
  })

  it('returns null for an unrecognised rarity string', () => {
    expect(nextRarity('Mythic')).toBeNull()
    expect(nextRarity('')).toBeNull()
    expect(nextRarity('common')).toBeNull() // case-sensitive
  })
})
