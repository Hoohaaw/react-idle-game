import { describe, it, expect } from 'vitest'
import { SKILL_DEFS, SKILL_BY_KEY } from './skills'
import { accrue } from './gather'
import { applyXp, LEVEL_CAP } from './leveling'

describe('SKILL_DEFS', () => {
  it('every skill has a positive interval and xp rate', () => {
    for (const s of SKILL_DEFS) {
      expect(s.intervalSec).toBeGreaterThan(0)
      expect(s.xpPerTick).toBeGreaterThan(0)
    }
  })

  it('skill keys are unique', () => {
    const keys = SKILL_DEFS.map((s) => s.skillKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('SKILL_BY_KEY maps every skill key to its def', () => {
    for (const s of SKILL_DEFS) {
      expect(SKILL_BY_KEY[s.skillKey]).toBe(s)
    }
  })

  it('includes religion, trained at Church', () => {
    expect(SKILL_BY_KEY.religion).toEqual({
      skillKey: 'religion', label: 'Religion', destination: 'Church', intervalSec: 30, xpPerTick: 15,
    })
  })
})

describe('accrue() + applyXp() reused for skill training', () => {
  const religion = SKILL_BY_KEY.religion

  it('banks nothing before the first tick completes', () => {
    expect(accrue(29_000, religion.intervalSec, religion.xpPerTick)).toEqual({ gained: 0, consumedSec: 0 })
  })

  it('banks whole ticks and the gained xp rolls into applyXp from a fresh level 1/0 character', () => {
    // 60s = 2 ticks of 15 xp = 30 gained. leveling.ts: xpToNext(1) = round(50 * 1^1.5) = 50.
    const { gained, consumedSec } = accrue(60_000, religion.intervalSec, religion.xpPerTick)
    expect(gained).toBe(30)
    expect(consumedSec).toBe(60)
    expect(applyXp(1, 0, gained)).toEqual({ level: 1, xp: 30 })
  })

  it('rolls a level up once accumulated xp crosses xpToNext(1) = 50', () => {
    // 4 ticks = 60 gained xp: crosses the 50 xp needed for level 1 -> 2, 10 xp left over.
    const { gained } = accrue(120_000, religion.intervalSec, religion.xpPerTick)
    expect(gained).toBe(60)
    expect(applyXp(1, 0, gained)).toEqual({ level: 2, xp: 10 })
  })

  it('never exceeds LEVEL_CAP, discarding xp earned at the cap same as character leveling', () => {
    expect(applyXp(LEVEL_CAP, 0, 999_999)).toEqual({ level: LEVEL_CAP, xp: 0 })
  })
})
