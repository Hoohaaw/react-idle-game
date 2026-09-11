import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase'
import { fetchProfile } from './profile'

type Row = {
  currencies: unknown
  resources: unknown
  reset_count: number
  infirmary_level?: number
  map_progress?: unknown
  unlocked_characters?: unknown
  echoes?: number
  echo_shop?: unknown
  lifetime_stats?: unknown
}

function mockProfile(result: { data: Row | null; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const select = vi.fn().mockReturnValue({ maybeSingle })
  vi.mocked(supabase.from).mockReturnValue({ select } as unknown as ReturnType<typeof supabase.from>)
  return { select, maybeSingle }
}

describe('fetchProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps the wallet row to typed currencies/resources/echoes/echoShop/lifetimeStats/resetCount', async () => {
    mockProfile({
      data: {
        currencies: { gold: 1420 },
        resources: { Iron: 5, Wood: 30 },
        reset_count: 2,
        infirmary_level: 3,
        map_progress: { gravemarch: 4 },
        unlocked_characters: { ember_knight: '2026-08-01T00:00:00Z' },
        echoes: 380,
        echo_shop: { missionSpeed: 3, 'gatherRate.Iron': 1 },
        lifetime_stats: { goldEarned: 5000 },
      },
      error: null,
    })

    const result = await fetchProfile()

    expect(result).toEqual({
      currencies: { gold: 1420 },
      resources: { Iron: 5, Wood: 30 },
      resetCount: 2,
      infirmaryLevel: 3,
      mapProgress: { gravemarch: 4 },
      unlockedCharacters: { ember_knight: '2026-08-01T00:00:00Z' },
      echoes: 380,
      echoShop: { missionSpeed: 3, 'gatherRate.Iron': 1 },
      lifetimeStats: { goldEarned: 5000 },
    })
  })

  it('defaults to empty/zero when no row exists', async () => {
    mockProfile({ data: null, error: null })

    const result = await fetchProfile()

    expect(result).toEqual({
      currencies: {},
      resources: {},
      resetCount: 0,
      infirmaryLevel: 1,
      mapProgress: {},
      unlockedCharacters: {},
      echoes: 0,
      echoShop: {},
      lifetimeStats: {},
    })
  })

  it('throws when the query returns an error', async () => {
    const dbError = { message: 'permission denied', code: '42501' }
    mockProfile({ data: null, error: dbError })

    await expect(fetchProfile()).rejects.toEqual(dbError)
  })

  it('queries the profiles table and selects the wallet columns', async () => {
    const { select } = mockProfile({
      data: { currencies: {}, resources: {}, reset_count: 0 },
      error: null,
    })

    await fetchProfile()

    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(select).toHaveBeenCalledWith(
      'currencies, resources, reset_count, infirmary_level, map_progress, unlocked_characters, echoes, echo_shop, lifetime_stats',
    )
  })
})
