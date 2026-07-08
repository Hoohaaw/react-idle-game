import { describe, it, expect } from 'vitest'
import {
  GEAR_SLOT_KEYS,
  isGearSlotKey,
  itemSlotForSlotKey,
  slotKeyLabel,
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
