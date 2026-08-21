import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FunctionsHttpError } from '@supabase/supabase-js'

// Mock the supabase module before importing the service — the real module throws at
// evaluation time when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}))

import { supabase } from '@/lib/supabase'
import { recruitCharacter } from './recruit'

describe('recruitCharacter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the recruited character on success', async () => {
    const character = { id: 'pc-1', character_def_id: 'ember-knight', level: 1 }
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { character },
      error: null,
    } as never)

    const result = await recruitCharacter('ember-knight')

    expect(result).toEqual(character)
  })

  it('invokes the recruit function with the characterDefId in the body', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { character: {} },
      error: null,
    } as never)

    await recruitCharacter('ember-knight')

    expect(supabase.functions.invoke).toHaveBeenCalledWith('recruit', {
      body: { characterDefId: 'ember-knight' },
    })
  })

  it('throws the server error message when the function returns a FunctionsHttpError', async () => {
    const context = { json: () => Promise.resolve({ error: 'Character already recruited' }) }
    const error = new FunctionsHttpError(context as never)
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error } as never)

    await expect(recruitCharacter('ember-knight')).rejects.toThrow('Character already recruited')
  })

  it('falls back to a generic message when the FunctionsHttpError body cannot be parsed', async () => {
    const context = { json: () => Promise.reject(new Error('not json')) }
    const error = new FunctionsHttpError(context as never)
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error } as never)

    await expect(recruitCharacter('ember-knight')).rejects.toThrow('Recruit failed')
  })

  it('falls back to a generic message when the FunctionsHttpError body has no error field', async () => {
    const context = { json: () => Promise.resolve({}) }
    const error = new FunctionsHttpError(context as never)
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error } as never)

    await expect(recruitCharacter('ember-knight')).rejects.toThrow('Recruit failed')
  })

  it('rethrows non-FunctionsHttpError errors unchanged', async () => {
    const networkError = new Error('network failure')
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error: networkError } as never)

    await expect(recruitCharacter('ember-knight')).rejects.toBe(networkError)
  })
})
