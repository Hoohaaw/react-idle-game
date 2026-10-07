import { describe, it, expect } from 'vitest'
import { PROFICIENCY_DEFS, PROFICIENCY_BY_KEY, resolveProficiencyBonus } from './proficiencies'

describe('PROFICIENCY_DEFS', () => {
  it('every proficiency has a label and at least one effect', () => {
    for (const p of PROFICIENCY_DEFS) {
      expect(p.label.length).toBeGreaterThan(0)
      expect(p.effects.length).toBeGreaterThan(0)
    }
  })

  it('proficiency keys are unique', () => {
    const keys = PROFICIENCY_DEFS.map((p) => p.proficiencyKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('PROFICIENCY_BY_KEY maps every proficiency key to its def', () => {
    for (const p of PROFICIENCY_DEFS) {
      expect(PROFICIENCY_BY_KEY[p.proficiencyKey]).toBe(p)
    }
  })

  it('includes alchemy', () => {
    expect(PROFICIENCY_BY_KEY.alchemy).toEqual({
      proficiencyKey: 'alchemy',
      label: 'Alchemy',
      effects: [{ stat: 'defense', kind: 'flat', value: 5 }],
    })
  })
})

describe('resolveProficiencyBonus()', () => {
  it('returns no bonus for a character with no proficiency', () => {
    expect(resolveProficiencyBonus(undefined, ['alchemy'])).toEqual({})
    expect(resolveProficiencyBonus(null, ['alchemy'])).toEqual({})
  })

  it('returns no bonus when the mission has no matching tag', () => {
    expect(resolveProficiencyBonus('alchemy', [])).toEqual({})
    expect(resolveProficiencyBonus('alchemy', undefined)).toEqual({})
    expect(resolveProficiencyBonus('alchemy', null)).toEqual({})
    expect(resolveProficiencyBonus('alchemy', ['athletics'])).toEqual({})
  })

  it('returns the flat/pct bonus when the proficiency matches a mission tag', () => {
    expect(resolveProficiencyBonus('alchemy', ['alchemy'])).toEqual({
      defense: { flat: 5, pct: 0 },
    })
  })

  it('matches when the mission carries multiple tags', () => {
    expect(resolveProficiencyBonus('alchemy', ['athletics', 'alchemy'])).toEqual({
      defense: { flat: 5, pct: 0 },
    })
  })

  it('returns no bonus for an unknown proficiency key', () => {
    expect(resolveProficiencyBonus('unknown-key', ['unknown-key'])).toEqual({})
  })
})
