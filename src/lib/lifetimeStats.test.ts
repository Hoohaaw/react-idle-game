import { describe, it, expect } from 'vitest'
import { LIFETIME_STAT_DEFS, LIFETIME_STAT_KEYS, LIFETIME_STAT_LABELS, resourceGatheredKey } from './lifetimeStats'
import { RESOURCE_SOURCE } from './resources'

describe('LIFETIME_STAT_DEFS', () => {
  it('is a non-empty array', () => {
    expect(LIFETIME_STAT_DEFS.length).toBeGreaterThan(0)
  })

  it('every entry has a non-empty key and label', () => {
    for (const def of LIFETIME_STAT_DEFS) {
      expect(def.key.length).toBeGreaterThan(0)
      expect(def.label.length).toBeGreaterThan(0)
    }
  })

  it('all keys are unique', () => {
    const keys = LIFETIME_STAT_DEFS.map((d) => d.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('contains goldEarned and missionSecondsSent', () => {
    expect(LIFETIME_STAT_DEFS.find((d) => d.key === 'goldEarned')).toBeDefined()
    expect(LIFETIME_STAT_DEFS.find((d) => d.key === 'missionSecondsSent')).toBeDefined()
  })

  it('contains a resourceGathered.<key> entry for every resource in RESOURCE_SOURCE', () => {
    for (const resource of Object.keys(RESOURCE_SOURCE)) {
      expect(LIFETIME_STAT_DEFS.find((d) => d.key === `resourceGathered.${resource}`)).toBeDefined()
    }
  })
})

describe('LIFETIME_STAT_KEYS', () => {
  it('contains every key from LIFETIME_STAT_DEFS in the same order', () => {
    expect(LIFETIME_STAT_KEYS).toEqual(LIFETIME_STAT_DEFS.map((d) => d.key))
  })
})

describe('LIFETIME_STAT_LABELS', () => {
  it('maps every key to its corresponding label', () => {
    for (const def of LIFETIME_STAT_DEFS) {
      expect(LIFETIME_STAT_LABELS[def.key]).toBe(def.label)
    }
  })
})

describe('resourceGatheredKey', () => {
  it('builds the resourceGathered.<Resource> path key', () => {
    expect(resourceGatheredKey('Wood')).toBe('resourceGathered.Wood')
    expect(resourceGatheredKey('Copper')).toBe('resourceGathered.Copper')
  })
})
