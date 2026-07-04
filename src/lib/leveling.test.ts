import { describe, it, expect } from 'vitest'
import { LEVEL_CAP, xpToNext, applyXp } from './leveling'

describe('LEVEL_CAP', () => {
  it('is 50', () => {
    expect(LEVEL_CAP).toBe(50)
  })
})

describe('xpToNext', () => {
  it('returns 50 at level 1 (base of the curve)', () => {
    expect(xpToNext(1)).toBe(50)
  })

  it('applies the power curve at level 10', () => {
    expect(xpToNext(10)).toBe(1581) // round(50 × 10^1.5) = round(1581.14)
  })

  it('returns an exact integer at level 25', () => {
    expect(xpToNext(25)).toBe(6250) // 50 × 25^1.5 = 6250 exactly
  })

  it('returns the correct value at level 49 (one below cap)', () => {
    expect(xpToNext(49)).toBe(17150) // 50 × 49^1.5 = 17150 exactly
  })

  it('returns Infinity at the cap (level 50)', () => {
    expect(xpToNext(50)).toBe(Infinity)
  })

  it('returns Infinity past the cap (level 51)', () => {
    expect(xpToNext(51)).toBe(Infinity)
  })
})

describe('applyXp', () => {
  it('accumulates XP without levelling up when below the threshold', () => {
    expect(applyXp(1, 0, 20)).toEqual({ level: 1, xp: 20 })
  })

  it('levels up and leaves 0 remainder when XP exactly hits the threshold', () => {
    expect(applyXp(1, 0, 50)).toEqual({ level: 2, xp: 0 })
  })

  it('carries the remainder forward after a single level-up', () => {
    // 10 existing + 50 gained = 60; threshold is 50 → level 2, remainder 10
    expect(applyXp(1, 10, 50)).toEqual({ level: 2, xp: 10 })
  })

  it('rolls over multiple levels in one award', () => {
    // xpToNext(1)=50, xpToNext(2)=141; gained=191 crosses both → level 3, xp 0
    expect(applyXp(1, 0, 191)).toEqual({ level: 3, xp: 0 })
  })

  it('leaves a correct remainder after rolling over multiple levels', () => {
    // 201 = 50+141+10 → level 3, remainder 10; xpToNext(3)=260 so 10 < 260
    const result = applyXp(1, 0, 201)
    expect(result.level).toBe(3)
    expect(result.xp).toBe(10)
    expect(result.xp).toBeLessThan(xpToNext(result.level))
  })

  it('is a no-op when gained is 0', () => {
    expect(applyXp(5, 30, 0)).toEqual({ level: 5, xp: 30 })
  })

  it('caps at level 50 and discards all excess XP for a huge award', () => {
    expect(applyXp(1, 0, 10_000_000)).toEqual({ level: 50, xp: 0 })
  })

  it('is a no-op at the cap — XP is discarded immediately', () => {
    expect(applyXp(50, 0, 5000)).toEqual({ level: 50, xp: 0 })
  })
})
