import { describe, it, expect } from 'vitest'
import { MINE_DEFS, MINE_BY_RESOURCE, accrue } from './gather'
import { RESOURCE_COLOR } from './resources'

describe('MINE_DEFS', () => {
  it('every mine resource exists in the resource registry (wallet keys line up)', () => {
    for (const m of MINE_DEFS) {
      expect(RESOURCE_COLOR[m.resourceKey], m.resourceKey).toBeDefined()
    }
  })

  it('every mine has a positive interval and yield', () => {
    for (const m of MINE_DEFS) {
      expect(m.intervalSec).toBeGreaterThan(0)
      expect(m.yieldPerTick).toBeGreaterThan(0)
    }
  })

  it('resource keys are unique', () => {
    const keys = MINE_DEFS.map((m) => m.resourceKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('MINE_BY_RESOURCE maps every resource key to its def', () => {
    for (const m of MINE_DEFS) {
      expect(MINE_BY_RESOURCE[m.resourceKey]).toBe(m)
    }
  })
})

describe('accrue', () => {
  // Reference mine: 30s interval, 5 per tick.
  it('banks nothing before the first tick completes', () => {
    expect(accrue(29_000, 30, 5)).toEqual({ gained: 0, consumedSec: 0 })
  })

  it('banks exactly one tick at the interval boundary', () => {
    expect(accrue(30_000, 30, 5)).toEqual({ gained: 5, consumedSec: 30 })
  })

  it('banks whole ticks only and reports the consumed time (remainder carries over)', () => {
    // 95s = 3 full 30s ticks (90s consumed); the trailing 5s is NOT credited.
    expect(accrue(95_000, 30, 5)).toEqual({ gained: 15, consumedSec: 90 })
  })

  it('scales yield per tick', () => {
    expect(accrue(300_000, 300, 25)).toEqual({ gained: 25, consumedSec: 300 })
    expect(accrue(905_000, 900, 75)).toEqual({ gained: 75, consumedSec: 900 })
  })

  it('returns zero for non-positive elapsed or interval', () => {
    expect(accrue(0, 30, 5)).toEqual({ gained: 0, consumedSec: 0 })
    expect(accrue(-1000, 30, 5)).toEqual({ gained: 0, consumedSec: 0 })
    expect(accrue(30_000, 0, 5)).toEqual({ gained: 0, consumedSec: 0 })
  })
})
