import { describe, it, expect } from 'vitest'
import { STAT_DEFS, STAT_KEYS, STAT_LABELS } from './statDefinitions'

describe('STAT_DEFS', () => {
  it('is a non-empty array', () => {
    expect(STAT_DEFS.length).toBeGreaterThan(0)
  })

  it('every entry has a non-empty key, label, and category', () => {
    for (const def of STAT_DEFS) {
      expect(def.key.length).toBeGreaterThan(0)
      expect(def.label.length).toBeGreaterThan(0)
      expect(def.category.length).toBeGreaterThan(0)
    }
  })

  it('every entry has a boolean reward field', () => {
    for (const def of STAT_DEFS) {
      expect(typeof def.reward).toBe('boolean')
    }
  })

  it('every category is one of the four valid values', () => {
    const valid = ['offensive', 'defensive', 'support', 'misc']
    for (const def of STAT_DEFS) {
      expect(valid).toContain(def.category)
    }
  })

  it('all keys are unique', () => {
    const keys = STAT_DEFS.map(d => d.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('all labels are unique', () => {
    const labels = STAT_DEFS.map(d => d.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('core power stats are present and reward:true', () => {
    const rewardKeys = STAT_DEFS.filter(d => d.reward).map(d => d.key)
    expect(rewardKeys).toContain('attack')
    expect(rewardKeys).toContain('health')
    expect(rewardKeys).toContain('strength')
    expect(rewardKeys).toContain('agility')
    expect(rewardKeys).toContain('intelligence')
    expect(rewardKeys).toContain('spellPower')
    expect(rewardKeys).toContain('haste')
    expect(rewardKeys).toContain('defense')
    expect(rewardKeys).toContain('speed')
  })

  it('combat depth stats (critChance, dodge, etc.) are reward:false', () => {
    const depth = ['critChance', 'critDamage', 'armorPen', 'dodge', 'block', 'resistance', 'healthRegen']
    for (const key of depth) {
      const def = STAT_DEFS.find(d => d.key === key)
      expect(def).toBeDefined()
      expect(def!.reward).toBe(false)
    }
  })

  it('economy/misc stats are reward:false', () => {
    const misc = ['gatherSpeed', 'gatherYield', 'missionSpeedDecrease', 'magicFind', 'luck']
    for (const key of misc) {
      const def = STAT_DEFS.find(d => d.key === key)
      expect(def).toBeDefined()
      expect(def!.reward).toBe(false)
    }
  })

  it('support stats (healingPower, healingCrit) are reward:false', () => {
    const support = ['healingPower', 'healingCrit']
    for (const key of support) {
      const def = STAT_DEFS.find(d => d.key === key)
      expect(def).toBeDefined()
      expect(def!.reward).toBe(false)
    }
  })
})

describe('STAT_KEYS', () => {
  it('contains every key from STAT_DEFS in the same order', () => {
    expect(STAT_KEYS).toEqual(STAT_DEFS.map(d => d.key))
  })

  it('has the same length as STAT_DEFS', () => {
    expect(STAT_KEYS).toHaveLength(STAT_DEFS.length)
  })
})

describe('STAT_LABELS', () => {
  it('maps every key to its corresponding label', () => {
    for (const def of STAT_DEFS) {
      expect(STAT_LABELS[def.key]).toBe(def.label)
    }
  })

  it('has the same number of entries as STAT_DEFS', () => {
    expect(Object.keys(STAT_LABELS)).toHaveLength(STAT_DEFS.length)
  })

  it('maps attack to "Attack"', () => {
    expect(STAT_LABELS['attack']).toBe('Attack')
  })

  it('maps spellPower to "Spell Power"', () => {
    expect(STAT_LABELS['spellPower']).toBe('Spell Power')
  })

  it('maps missionSpeedDecrease to "Mission Speed Decrease"', () => {
    expect(STAT_LABELS['missionSpeedDecrease']).toBe('Mission Speed Decrease')
  })
})
