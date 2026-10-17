import { describe, it, expect } from 'vitest'
import {
  PROFESSION_DEFS,
  PROFESSION_KEYS,
  PROFESSION_LABELS,
  PROFESSION_LEVEL_CAP,
  xpToNextProfessionLevel,
  applyProfessionXp,
} from './professions'

describe('PROFESSION_DEFS', () => {
  it('has exactly the 5 planned professions', () => {
    expect(PROFESSION_KEYS).toEqual(['alchemy', 'carving', 'prospecting', 'tempering', 'arcaneWriting'])
    expect(PROFESSION_LABELS.alchemy).toBe('Alchemy')
    expect(PROFESSION_LABELS.arcaneWriting).toBe('Arcane Writing')
    expect(PROFESSION_DEFS.length).toBe(5)
  })
})

describe('xpToNextProfessionLevel', () => {
  it('is 100 × level, Infinity at the cap', () => {
    expect(xpToNextProfessionLevel(1)).toBe(100)
    expect(xpToNextProfessionLevel(2)).toBe(200)
    expect(xpToNextProfessionLevel(9)).toBe(900)
    expect(xpToNextProfessionLevel(PROFESSION_LEVEL_CAP)).toBe(Infinity)
  })
})

describe('applyProfessionXp', () => {
  it('accumulates xp without leveling until the threshold', () => {
    expect(applyProfessionXp(1, 0, 50)).toEqual({ level: 1, xp: 50 })
  })

  it('levels up and carries the remainder', () => {
    expect(applyProfessionXp(1, 90, 30)).toEqual({ level: 2, xp: 20 })
  })

  it('rolls over multiple levels from one large gain', () => {
    // level 1: needs 100. level 2: needs 200. 0 + 350 = 350 → level1 (−100=250) → level2 (−200=50) → level 3, xp 50.
    expect(applyProfessionXp(1, 0, 350)).toEqual({ level: 3, xp: 50 })
  })

  it('discards xp once the level cap is reached', () => {
    // level 9, xp 850, gained 100 → crosses into level 10 (cap), remainder discarded to 0.
    expect(applyProfessionXp(9, 850, 100)).toEqual({ level: 10, xp: 0 })
  })

  it('a profession already at the cap gains nothing further', () => {
    expect(applyProfessionXp(10, 0, 9999)).toEqual({ level: 10, xp: 0 })
  })
})
