import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase module before importing the service — the real module throws at
// evaluation time when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase'
import { fetchProfile } from './profile'

type Row = { currencies: unknown; resources: unknown; transcendence_count: number; infirmary_level?: number }

// Helper: stubs `.from().select().maybeSingle()` to resolve with the given value.
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

  it('maps the wallet row to typed currencies/resources + transcendenceCount', async () => {
    mockProfile({
      data: { currencies: { gold: 1420 }, resources: { Iron: 5, Wood: 30 }, transcendence_count: 2, infirmary_level: 3 },
      error: null,
    })

    const result = await fetchProfile()

    expect(result).toEqual({
      currencies: { gold: 1420 },
      resources: { Iron: 5, Wood: 30 },
      transcendenceCount: 2,
      infirmaryLevel: 3,
    })
  })

  it('defaults to empty balances + zero transcendence when no row exists', async () => {
    mockProfile({ data: null, error: null })

    const result = await fetchProfile()

    expect(result).toEqual({ currencies: {}, resources: {}, transcendenceCount: 0, infirmaryLevel: 1 })
  })

  it('throws when the query returns an error', async () => {
    const dbError = { message: 'permission denied', code: '42501' }
    mockProfile({ data: null, error: dbError })

    await expect(fetchProfile()).rejects.toEqual(dbError)
  })

  it('queries the profiles table and selects the wallet columns', async () => {
    const { select } = mockProfile({
      data: { currencies: {}, resources: {}, transcendence_count: 0 },
      error: null,
    })

    await fetchProfile()

    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(select).toHaveBeenCalledWith('currencies, resources, transcendence_count, infirmary_level')
  })
})
