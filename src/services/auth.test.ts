import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
    },
  },
}))

import { supabase } from '@/lib/supabase'
import { signUp } from './auth'

describe('signUp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves with the data for a real new signup (identities has one entry, no session yet)', async () => {
    const data = {
      user: { id: 'user-1', identities: [{ id: 'identity-1' }] },
      session: null,
    }
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data, error: null } as unknown as Awaited<
      ReturnType<typeof supabase.auth.signUp>
    >)

    await expect(signUp({ email: 'new@example.com', password: 'password123' })).resolves.toBe(data)
  })

  it('throws a friendly error when identities is empty (duplicate confirmed email)', async () => {
    const data = {
      user: { id: 'user-1', identities: [] },
      session: null,
    }
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data, error: null } as unknown as Awaited<
      ReturnType<typeof supabase.auth.signUp>
    >)

    await expect(signUp({ email: 'taken@example.com', password: 'password123' })).rejects.toThrow(
      'An account with that email already exists. Try signing in instead.',
    )
  })

  it('throws the Supabase error as-is when signUp fails (e.g. weak password)', async () => {
    const authError = { message: 'Password should be at least 6 characters', status: 422 }
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: authError,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.signUp>>)

    await expect(signUp({ email: 'weak@example.com', password: '123' })).rejects.toEqual(authError)
  })

  it('does not throw the duplicate-email error when data.user is null', async () => {
    const data = { user: null, session: null }
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data, error: null } as unknown as Awaited<
      ReturnType<typeof supabase.auth.signUp>
    >)

    await expect(signUp({ email: 'edge@example.com', password: 'password123' })).resolves.toBe(data)
  })

  it('does not throw the duplicate-email error when identities is undefined (field absent, not empty)', async () => {
    const data = { user: { id: 'user-1', identities: undefined }, session: null }
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data, error: null } as unknown as Awaited<
      ReturnType<typeof supabase.auth.signUp>
    >)

    await expect(signUp({ email: 'unknown-shape@example.com', password: 'password123' })).resolves.toBe(data)
  })
})
