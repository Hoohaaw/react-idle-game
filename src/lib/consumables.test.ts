import { describe, it, expect } from 'vitest'
import { slotsForCharacter, resolveConsumableBuffBonus, validateMissionLoadout } from './consumables'

describe('slotsForCharacter', () => {
  it('is 1 slot at level 20 and below', () => {
    expect(slotsForCharacter(1, false)).toBe(1)
    expect(slotsForCharacter(20, false)).toBe(1)
  })
  it('is 2 slots at level 21 and above', () => {
    expect(slotsForCharacter(21, false)).toBe(2)
    expect(slotsForCharacter(50, false)).toBe(2)
  })
  it('adds 1 more when bonusConsumableSlot is set, on top of the level-based count', () => {
    expect(slotsForCharacter(1, true)).toBe(2)
    expect(slotsForCharacter(21, true)).toBe(3)
  })
})

describe('resolveConsumableBuffBonus', () => {
  it('sums flat and pct effects per stat into the {flat, pct} shape', () => {
    const out = resolveConsumableBuffBonus([
      { stat: 'resistance', kind: 'flat', value: 20 },
      { stat: 'resistance', kind: 'pct', value: 5 },
    ])
    expect(out.resistance).toEqual({ flat: 20, pct: 5 })
  })
  it('returns {} for an empty effects list', () => {
    expect(resolveConsumableBuffBonus([])).toEqual({})
  })
})

describe('validateMissionLoadout', () => {
  const party = [
    { characterId: 'a', level: 10, bonusSlot: false },
    { characterId: 'b', level: 25, bonusSlot: false },
  ]

  it('passes an empty loadout', () => {
    expect(validateMissionLoadout(party, [])).toBeNull()
  })

  it('rejects a character carrying more items than their slot count', () => {
    const loadout = [
      { characterId: 'a', consumableDefId: 'pot-1', category: 'buff' as const },
      { characterId: 'a', consumableDefId: 'pot-2', category: 'buff' as const },
    ]
    expect(validateMissionLoadout(party, loadout)).toMatch(/slot/i)
  })

  it('allows a level-21+ character to carry 2 items', () => {
    const loadout = [
      { characterId: 'b', consumableDefId: 'pot-1', category: 'buff' as const },
      { characterId: 'b', consumableDefId: 'pot-2', category: 'buff' as const },
    ]
    expect(validateMissionLoadout(party, loadout)).toBeNull()
  })

  it('rejects an unknown character id not in the party', () => {
    const loadout = [{ characterId: 'z', consumableDefId: 'pot-1', category: 'buff' as const }]
    expect(validateMissionLoadout(party, loadout)).toMatch(/not in the party/i)
  })

  it('rejects more than one heal-category item across the WHOLE PARTY, even split across different characters', () => {
    const loadout = [
      { characterId: 'a', consumableDefId: 'heal-1', category: 'heal' as const },
      { characterId: 'b', consumableDefId: 'heal-2', category: 'heal' as const },
    ]
    expect(validateMissionLoadout(party, loadout)).toMatch(/one healing/i)
  })

  it('allows exactly one heal-category item for the whole party', () => {
    const loadout = [{ characterId: 'a', consumableDefId: 'heal-1', category: 'heal' as const }]
    expect(validateMissionLoadout(party, loadout)).toBeNull()
  })

  it('allows unlimited buff-category items up to each character\'s own slot cap', () => {
    const loadout = [
      { characterId: 'a', consumableDefId: 'buff-1', category: 'buff' as const },
      { characterId: 'b', consumableDefId: 'buff-2', category: 'buff' as const },
      { characterId: 'b', consumableDefId: 'buff-3', category: 'buff' as const },
    ]
    expect(validateMissionLoadout(party, loadout)).toBeNull()
  })
})
