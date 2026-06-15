import { describe, it, expect } from 'vitest'
import { CURRENCY_DEFS, CURRENCY_KEYS, CURRENCY_LABELS } from './currencies'

describe('CURRENCY_DEFS', () => {
  it('is a non-empty array', () => {
    expect(CURRENCY_DEFS.length).toBeGreaterThan(0)
  })

  it('every entry has a non-empty key and label', () => {
    for (const def of CURRENCY_DEFS) {
      expect(def.key.length).toBeGreaterThan(0)
      expect(def.label.length).toBeGreaterThan(0)
    }
  })

  it('all keys are unique', () => {
    const keys = CURRENCY_DEFS.map(d => d.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('contains the coins currency', () => {
    const coins = CURRENCY_DEFS.find(d => d.key === 'coins')
    expect(coins).toBeDefined()
    expect(coins!.label).toBe('Coins')
  })
})

describe('CURRENCY_KEYS', () => {
  it('contains every key from CURRENCY_DEFS in the same order', () => {
    expect(CURRENCY_KEYS).toEqual(CURRENCY_DEFS.map(d => d.key))
  })

  it('has the same length as CURRENCY_DEFS', () => {
    expect(CURRENCY_KEYS).toHaveLength(CURRENCY_DEFS.length)
  })

  it('includes "coins"', () => {
    expect(CURRENCY_KEYS).toContain('coins')
  })
})

describe('CURRENCY_LABELS', () => {
  it('maps every key to its corresponding label', () => {
    for (const def of CURRENCY_DEFS) {
      expect(CURRENCY_LABELS[def.key]).toBe(def.label)
    }
  })

  it('has the same number of entries as CURRENCY_DEFS', () => {
    expect(Object.keys(CURRENCY_LABELS)).toHaveLength(CURRENCY_DEFS.length)
  })

  it('maps "coins" to "Coins"', () => {
    expect(CURRENCY_LABELS['coins']).toBe('Coins')
  })
})
