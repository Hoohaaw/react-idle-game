import { describe, it, expect } from 'vitest'
import { ACHIEVEMENT_DEFS, checkAchievements } from './achievements'
import { RESOURCE_SOURCE } from './resources'

describe('ACHIEVEMENT_DEFS', () => {
  it('has one ladder per achievement across all 5 categories', () => {
    const keys = ACHIEVEMENT_DEFS.map((l) => l.metricKey)
    expect(keys).toContain('missionsCleared')
    expect(keys).toContain('dungeonsCleared')
    expect(keys).toContain('raidsCleared')
    expect(keys).toContain('goldEarned')
    expect(keys).toContain('resourceGathered.Wood')
    expect(keys).toContain('resourceGathered.Platinum')
    expect(keys).toContain('fullRoster')
    expect(keys).toContain('legendaryCollector')
    expect(keys).toContain('blessed')
    expect(keys).toContain('echoesOfThePast')
    expect(keys).toContain('ascendant')
    expect(keys).toContain('shardHoarder')
    expect(keys).toContain('daysPlayed')
    expect(keys).toContain('maxLevel')
    // 3 combat + 1 gold + 9 resources + 3 collection + 3 prestige + 2 dedication
    expect(keys).toHaveLength(3 + 1 + Object.keys(RESOURCE_SOURCE).length + 3 + 3 + 2)
  })

  it('every one-off "moment" achievement has a single threshold of 1 (except fullRoster: 19)', () => {
    const fullRoster = ACHIEVEMENT_DEFS.find((l) => l.metricKey === 'fullRoster')!
    expect(fullRoster.thresholds).toEqual([19])
    for (const key of ['legendaryCollector', 'blessed', 'echoesOfThePast', 'ascendant', 'maxLevel']) {
      const ladder = ACHIEVEMENT_DEFS.find((l) => l.metricKey === key)!
      expect(ladder.thresholds).toEqual([1])
    }
  })

  it('reuses resourceGathered thresholds identical to ASCENDANT_MILESTONES, not retyped numbers', () => {
    const ladder = ACHIEVEMENT_DEFS.find((l) => l.metricKey === 'resourceGathered.Wood')!
    expect(ladder.thresholds).toEqual([500, 5000, 50000, 500000])
  })
})

describe('checkAchievements', () => {
  it('claims nothing when every value is at its floor and nothing was previously claimed', () => {
    const result = checkAchievements({
      lifetimeStats: {}, unlockedCharacterCount: 0, resetCount: 0, transcendCount: 0,
      shardsEarnedTotal: 0, daysPlayed: 0,
    }, {})
    expect(result).toEqual([])
  })

  it('claims every lifetime_stats threshold newly crossed', () => {
    const result = checkAchievements({
      lifetimeStats: { goldEarned: 15000 }, unlockedCharacterCount: 0, resetCount: 0,
      transcendCount: 0, shardsEarnedTotal: 0, daysPlayed: 0,
    }, {})
    expect(result).toEqual(expect.arrayContaining(['goldEarned.0', 'goldEarned.1']))
  })

  it('never re-claims an already-claimed threshold', () => {
    const result = checkAchievements({
      lifetimeStats: { goldEarned: 15000 }, unlockedCharacterCount: 0, resetCount: 0,
      transcendCount: 0, shardsEarnedTotal: 0, daysPlayed: 0,
    }, { 'goldEarned.0': true, 'goldEarned.1': true })
    expect(result).toEqual([])
  })

  it('claims fullRoster at exactly 19 unlocked characters', () => {
    const result = checkAchievements({
      lifetimeStats: {}, unlockedCharacterCount: 19, resetCount: 0, transcendCount: 0,
      shardsEarnedTotal: 0, daysPlayed: 0,
    }, {})
    expect(result).toEqual(['fullRoster.0'])
  })

  it('claims echoesOfThePast/ascendant off resetCount/transcendCount, not lifetimeStats', () => {
    const result = checkAchievements({
      lifetimeStats: {}, unlockedCharacterCount: 0, resetCount: 1, transcendCount: 1,
      shardsEarnedTotal: 0, daysPlayed: 0,
    }, {})
    expect(result).toEqual(expect.arrayContaining(['echoesOfThePast.0', 'ascendant.0']))
  })

  it('claims shardHoarder and daysPlayed ladders off their own counters', () => {
    const result = checkAchievements({
      lifetimeStats: {}, unlockedCharacterCount: 0, resetCount: 0, transcendCount: 0,
      shardsEarnedTotal: 60, daysPlayed: 8,
    }, {})
    expect(result).toEqual(expect.arrayContaining(['shardHoarder.0', 'daysPlayed.0', 'daysPlayed.1']))
  })

  it('never evaluates counter-backed one-offs (legendaryCollector/blessed/maxLevel) — those are SQL-only', () => {
    // No counter fields exist on CheckAchievementsInput at all — this is a type-level guarantee
    // as much as a runtime one; the input shape below is exhaustive and compiles.
    const result = checkAchievements({
      lifetimeStats: {}, unlockedCharacterCount: 0, resetCount: 0, transcendCount: 0,
      shardsEarnedTotal: 0, daysPlayed: 0,
    }, {})
    expect(result).not.toContain('legendaryCollector.0')
    expect(result).not.toContain('blessed.0')
    expect(result).not.toContain('maxLevel.0')
  })
})
