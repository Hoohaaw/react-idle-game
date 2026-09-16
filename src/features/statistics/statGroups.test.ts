import { describe, it, expect } from 'vitest'
import { groupLifetimeStats } from './statGroups'
import { LIFETIME_STAT_DEFS } from '@/lib/lifetimeStats'

describe('groupLifetimeStats', () => {
  it('returns exactly the three named groups, in this order', () => {
    const groups = groupLifetimeStats()
    expect(groups.map((g) => g.title)).toEqual(['Missions & Combat', 'Economy', 'Resources Gathered'])
  })

  it('accounts for every entry in LIFETIME_STAT_DEFS exactly once (no stat lost or duplicated)', () => {
    const groups = groupLifetimeStats()
    const totalGrouped = groups.reduce((sum, g) => sum + g.stats.length, 0)
    expect(totalGrouped).toBe(LIFETIME_STAT_DEFS.length)

    const allGroupedKeys = groups.flatMap((g) => g.stats.map((s) => s.key))
    expect(new Set(allGroupedKeys).size).toBe(allGroupedKeys.length) // no duplicates across groups
    expect(new Set(allGroupedKeys)).toEqual(new Set(LIFETIME_STAT_DEFS.map((d) => d.key))) // no stat lost
  })

  it('puts goldEarned in the Economy group', () => {
    const groups = groupLifetimeStats()
    const economy = groups.find((g) => g.title === 'Economy')!
    expect(economy.stats.map((s) => s.key)).toEqual(['goldEarned'])
  })

  it('puts every resourceGathered.<Resource> key in the Resources Gathered group', () => {
    const groups = groupLifetimeStats()
    const resources = groups.find((g) => g.title === 'Resources Gathered')!
    const expectedKeys = LIFETIME_STAT_DEFS.filter((d) => d.key.startsWith('resourceGathered.')).map((d) => d.key)
    expect(resources.stats.map((s) => s.key)).toEqual(expectedKeys)
    for (const s of resources.stats) {
      expect(s.key.startsWith('resourceGathered.')).toBe(true)
    }
  })

  it('excludes goldEarned and all resourceGathered.* keys from Missions & Combat', () => {
    const groups = groupLifetimeStats()
    const combat = groups.find((g) => g.title === 'Missions & Combat')!
    const combatKeys = combat.stats.map((s) => s.key)
    expect(combatKeys).not.toContain('goldEarned')
    expect(combatKeys.some((key) => key.startsWith('resourceGathered.'))).toBe(false)
  })
})
