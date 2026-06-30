import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase module before importing the service — the real module throws at
// evaluation time when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase'
import { fetchRecruitedDefIds } from './playerCharacters'

// Helper: sets up the chained `.from().select()` mock to resolve with the given value.
function mockSelect(result: { data: { character_def_id: string }[] | null; error: unknown }) {
  const selectMock = vi.fn().mockResolvedValue(result)
  vi.mocked(supabase.from).mockReturnValue({ select: selectMock } as ReturnType<typeof supabase.from>)
  return selectMock
}

describe('fetchRecruitedDefIds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a list of character_def_id strings on success', async () => {
    mockSelect({
      data: [
        { character_def_id: 'char-warrior-01' },
        { character_def_id: 'char-mage-02' },
      ],
      error: null,
    })

    const result = await fetchRecruitedDefIds()

    expect(result).toEqual(['char-warrior-01', 'char-mage-02'])
  })

  it('returns an empty array when the player has no recruited characters', async () => {
    mockSelect({ data: [], error: null })

    const result = await fetchRecruitedDefIds()

    expect(result).toEqual([])
  })

  it('throws when the query returns an error', async () => {
    const dbError = { message: 'permission denied', code: '42501' }
    mockSelect({ data: null, error: dbError })

    await expect(fetchRecruitedDefIds()).rejects.toEqual(dbError)
  })

  it('queries the player_characters table and selects only character_def_id', async () => {
    const selectMock = mockSelect({ data: [], error: null })

    await fetchRecruitedDefIds()

    expect(supabase.from).toHaveBeenCalledWith('player_characters')
    expect(selectMock).toHaveBeenCalledWith('character_def_id')
  })

  it('returns a single-element array when one character is recruited', async () => {
    mockSelect({ data: [{ character_def_id: 'char-priest-03' }], error: null })

    const result = await fetchRecruitedDefIds()

    expect(result).toHaveLength(1)
    expect(result[0]).toBe('char-priest-03')
  })
})
