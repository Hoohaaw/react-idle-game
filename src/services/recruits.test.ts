import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock every collaborator — fetchRecruitCandidates fans out to the profile, the recruited-character
// list, and Sanity, and none of them should hit real network/env-dependent modules under test.
vi.mock('./sanity', () => ({
  sanity: {
    fetch: vi.fn(),
  },
}))
vi.mock('./profile', () => ({
  fetchProfile: vi.fn(),
}))
vi.mock('./playerCharacters', () => ({
  fetchRecruitedDefIds: vi.fn(),
}))

import { sanity } from './sanity'
import { fetchProfile } from './profile'
import { fetchRecruitedDefIds } from './playerCharacters'
import { fetchRecruitCandidates } from './recruits'

describe('fetchRecruitCandidates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('never queries Sanity when there are no unlocked characters', async () => {
    vi.mocked(fetchProfile).mockResolvedValue({
      currencies: {},
      resources: {},
      transcendenceCount: 0,
      infirmaryLevel: 1,
      mapProgress: {},
      unlockedCharacters: {},
    } as never)
    vi.mocked(fetchRecruitedDefIds).mockResolvedValue([])

    const result = await fetchRecruitCandidates()

    expect(result).toEqual([])
    expect(sanity.fetch).not.toHaveBeenCalled()
  })

  it('never queries Sanity when every unlocked character is already owned', async () => {
    vi.mocked(fetchProfile).mockResolvedValue({
      currencies: {},
      resources: {},
      transcendenceCount: 0,
      infirmaryLevel: 1,
      mapProgress: {},
      unlockedCharacters: { ember_knight: '2026-08-01T00:00:00Z' },
    } as never)
    vi.mocked(fetchRecruitedDefIds).mockResolvedValue(['ember_knight'])

    const result = await fetchRecruitCandidates()

    expect(result).toEqual([])
    expect(sanity.fetch).not.toHaveBeenCalled()
  })

  it('queries Sanity for exactly the unlocked-minus-owned keys', async () => {
    vi.mocked(fetchProfile).mockResolvedValue({
      currencies: {},
      resources: {},
      transcendenceCount: 0,
      infirmaryLevel: 1,
      mapProgress: {},
      unlockedCharacters: {
        ember_knight: '2026-08-01T00:00:00Z',
        frost_mage: '2026-08-02T00:00:00Z',
        stone_guard: '2026-08-03T00:00:00Z',
      },
    } as never)
    vi.mocked(fetchRecruitedDefIds).mockResolvedValue(['frost_mage'])
    vi.mocked(sanity.fetch).mockResolvedValue([])

    await fetchRecruitCandidates()

    expect(sanity.fetch).toHaveBeenCalledTimes(1)
    const [, params] = vi.mocked(sanity.fetch).mock.calls[0]
    expect(params).toEqual({ keys: ['ember_knight', 'stone_guard'] })
  })

  it('filters out rows missing a numeric goldCost', async () => {
    vi.mocked(fetchProfile).mockResolvedValue({
      currencies: {},
      resources: {},
      transcendenceCount: 0,
      infirmaryLevel: 1,
      mapProgress: {},
      unlockedCharacters: {
        ember_knight: '2026-08-01T00:00:00Z',
        frost_mage: '2026-08-02T00:00:00Z',
      },
    } as never)
    vi.mocked(fetchRecruitedDefIds).mockResolvedValue([])
    vi.mocked(sanity.fetch).mockResolvedValue([
      {
        charKey: 'ember_knight',
        name: 'Ember Knight',
        role: 'tank',
        charClass: 'knight',
        rarity: 'common',
        goldCost: 500,
      },
      {
        charKey: 'frost_mage',
        name: 'Frost Mage',
        role: 'dps',
        charClass: 'mage',
        rarity: 'rare',
        goldCost: undefined,
      },
    ] as never)

    const result = await fetchRecruitCandidates()

    expect(result).toEqual([
      {
        charKey: 'ember_knight',
        name: 'Ember Knight',
        role: 'tank',
        charClass: 'knight',
        rarity: 'common',
        goldCost: 500,
      },
    ])
  })

  it('returns the full candidate list in the normal case', async () => {
    vi.mocked(fetchProfile).mockResolvedValue({
      currencies: {},
      resources: {},
      transcendenceCount: 0,
      infirmaryLevel: 1,
      mapProgress: {},
      unlockedCharacters: {
        ember_knight: '2026-08-01T00:00:00Z',
        frost_mage: '2026-08-02T00:00:00Z',
      },
    } as never)
    vi.mocked(fetchRecruitedDefIds).mockResolvedValue([])
    const candidates = [
      {
        charKey: 'ember_knight',
        name: 'Ember Knight',
        role: 'tank',
        charClass: 'knight',
        rarity: 'common',
        goldCost: 500,
      },
      {
        charKey: 'frost_mage',
        name: 'Frost Mage',
        role: 'dps',
        charClass: 'mage',
        rarity: 'rare',
        goldCost: 1200,
      },
    ]
    vi.mocked(sanity.fetch).mockResolvedValue(candidates as never)

    const result = await fetchRecruitCandidates()

    expect(result).toEqual(candidates)
  })
})
