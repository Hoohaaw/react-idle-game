import { describe, it, expect } from 'vitest'
import {
  GEAR_SLOT_KEYS,
  isGearSlotKey,
  itemSlotForSlotKey,
  slotKeyLabel,
  requiredLevelForRarity,
  LEVEL_REQ_STEP_BY_RARITY,
  type GearSlotKey,
} from './equipment'

// ---------------------------------------------------------------------------
// GEAR_SLOT_KEYS
// ---------------------------------------------------------------------------

describe('GEAR_SLOT_KEYS', () => {
  it('has exactly 14 entries', () => {
    expect(GEAR_SLOT_KEYS).toHaveLength(14)
  })

  it('contains no duplicates', () => {
    expect(new Set(GEAR_SLOT_KEYS).size).toBe(GEAR_SLOT_KEYS.length)
  })

  it('lists the 8 unique gear slots first in the documented order', () => {
    expect(GEAR_SLOT_KEYS.slice(0, 8)).toEqual([
      'head', 'shoulders', 'chest', 'hands', 'legs', 'feet', 'weapon', 'offhand',
    ])
  })

  it('lists ring1..ring4 in positions 8–11', () => {
    expect(GEAR_SLOT_KEYS.slice(8, 12)).toEqual(['ring1', 'ring2', 'ring3', 'ring4'])
  })

  it('lists trinket1 and trinket2 last', () => {
    expect(GEAR_SLOT_KEYS.slice(12)).toEqual(['trinket1', 'trinket2'])
  })
})

// ---------------------------------------------------------------------------
// isGearSlotKey
// ---------------------------------------------------------------------------

describe('isGearSlotKey', () => {
  it('returns true for every key in GEAR_SLOT_KEYS', () => {
    for (const key of GEAR_SLOT_KEYS) {
      expect(isGearSlotKey(key)).toBe(true)
    }
  })

  it('returns false for the empty string', () => {
    expect(isGearSlotKey('')).toBe(false)
  })

  it('returns false for "ring" (the base item slot, not a slot key)', () => {
    expect(isGearSlotKey('ring')).toBe(false)
  })

  it('returns false for "trinket" (the base item slot, not a slot key)', () => {
    expect(isGearSlotKey('trinket')).toBe(false)
  })

  it('returns false for "ring5" (out of range)', () => {
    expect(isGearSlotKey('ring5')).toBe(false)
  })

  it('returns false for "belt" (not a slot in the game)', () => {
    expect(isGearSlotKey('belt')).toBe(false)
  })

  it('returns false for "HEAD" (wrong case)', () => {
    expect(isGearSlotKey('HEAD')).toBe(false)
  })

  it('returns false for "weapon2" (no such key)', () => {
    expect(isGearSlotKey('weapon2')).toBe(false)
  })

  it('returns false for an arbitrary string', () => {
    expect(isGearSlotKey('notaslot')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// itemSlotForSlotKey
// ---------------------------------------------------------------------------

describe('itemSlotForSlotKey', () => {
  it('is an identity for each of the 8 base gear slots', () => {
    const baseSlots = ['head', 'shoulders', 'chest', 'hands', 'legs', 'feet', 'weapon', 'offhand'] as const
    for (const slot of baseSlots) {
      expect(itemSlotForSlotKey(slot)).toBe(slot)
    }
  })

  it('maps ring1..ring4 to "ring"', () => {
    expect(itemSlotForSlotKey('ring1')).toBe('ring')
    expect(itemSlotForSlotKey('ring2')).toBe('ring')
    expect(itemSlotForSlotKey('ring3')).toBe('ring')
    expect(itemSlotForSlotKey('ring4')).toBe('ring')
  })

  it('maps trinket1 and trinket2 to "trinket"', () => {
    expect(itemSlotForSlotKey('trinket1')).toBe('trinket')
    expect(itemSlotForSlotKey('trinket2')).toBe('trinket')
  })

  it('returns null for "ring" (not a valid slot key)', () => {
    expect(itemSlotForSlotKey('ring')).toBeNull()
  })

  it('returns null for "trinket" (not a valid slot key)', () => {
    expect(itemSlotForSlotKey('trinket')).toBeNull()
  })

  it('returns null for "belt"', () => {
    expect(itemSlotForSlotKey('belt')).toBeNull()
  })

  it('returns null for "ring5"', () => {
    expect(itemSlotForSlotKey('ring5')).toBeNull()
  })

  it('returns null for the empty string', () => {
    expect(itemSlotForSlotKey('')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// slotKeyLabel
// ---------------------------------------------------------------------------

describe('slotKeyLabel', () => {
  it('capitalizes single-word gear slot keys', () => {
    expect(slotKeyLabel('head')).toBe('Head')
    expect(slotKeyLabel('shoulders')).toBe('Shoulders')
    expect(slotKeyLabel('chest')).toBe('Chest')
    expect(slotKeyLabel('hands')).toBe('Hands')
    expect(slotKeyLabel('legs')).toBe('Legs')
    expect(slotKeyLabel('feet')).toBe('Feet')
    expect(slotKeyLabel('weapon')).toBe('Weapon')
    expect(slotKeyLabel('offhand')).toBe('Offhand')
  })

  it('formats ring1..ring4 as "Ring N"', () => {
    expect(slotKeyLabel('ring1')).toBe('Ring 1')
    expect(slotKeyLabel('ring2')).toBe('Ring 2')
    expect(slotKeyLabel('ring3')).toBe('Ring 3')
    expect(slotKeyLabel('ring4')).toBe('Ring 4')
  })

  it('formats trinket1 and trinket2 as "Trinket N"', () => {
    expect(slotKeyLabel('trinket1')).toBe('Trinket 1')
    expect(slotKeyLabel('trinket2')).toBe('Trinket 2')
  })

  it('produces a non-empty label for all 14 slot keys', () => {
    for (const key of GEAR_SLOT_KEYS) {
      const label = slotKeyLabel(key as GearSlotKey)
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('every label starts with an uppercase letter', () => {
    for (const key of GEAR_SLOT_KEYS) {
      const label = slotKeyLabel(key as GearSlotKey)
      expect(label[0]).toBe(label[0].toUpperCase())
      expect(label[0]).not.toBe(label[0].toLowerCase())
    }
  })
})

// ---------------------------------------------------------------------------
// requiredLevelForRarity (ADR-0043)
// ---------------------------------------------------------------------------

describe('requiredLevelForRarity', () => {
  it('equals minLevel unchanged at Common (step 0)', () => {
    expect(requiredLevelForRarity(12, 'Common')).toBe(12)
  })

  it('adds the documented flat step per rarity', () => {
    expect(requiredLevelForRarity(10, 'Uncommon')).toBe(12)
    expect(requiredLevelForRarity(10, 'Rare')).toBe(15)
    expect(requiredLevelForRarity(10, 'Epic')).toBe(19)
    expect(requiredLevelForRarity(10, 'Legendary')).toBe(24)
  })

  it('falls back to step 0 for an unknown rarity string', () => {
    expect(requiredLevelForRarity(10, 'Mythic')).toBe(10)
  })

  it('the rarity ladder is strictly increasing', () => {
    const order = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']
    const steps = order.map((r) => LEVEL_REQ_STEP_BY_RARITY[r])
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1])
    }
  })

  it('a later map\'s Common item still out-gates an earlier map\'s Legendary (worked check)', () => {
    // Gravemarch ≈1, Embercrag ≈6, Frosthollow ≈12 (the 3 live maps' minLevel anchors).
    const gravemarchLegendary = requiredLevelForRarity(1, 'Legendary')
    const embercragLegendary = requiredLevelForRarity(6, 'Legendary')
    const frosthollowLegendary = requiredLevelForRarity(12, 'Legendary')
    expect(gravemarchLegendary).toBeLessThan(embercragLegendary)
    expect(embercragLegendary).toBeLessThan(frosthollowLegendary)
  })
})
