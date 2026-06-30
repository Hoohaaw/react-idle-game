import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock the service so the hook test doesn't need supabase env vars.
vi.mock('../services/playerCharacters', () => ({
  fetchRecruitedDefIds: vi.fn(),
}))

import { fetchRecruitedDefIds } from '../services/playerCharacters'
import { usePlayerCharacters } from './usePlayerCharacters'

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
}

describe('usePlayerCharacters', () => {
  it('returns the recruited def IDs fetched by the service', async () => {
    vi.mocked(fetchRecruitedDefIds).mockResolvedValue(['char-warrior-01', 'char-mage-02'])

    const { result } = renderHook(() => usePlayerCharacters(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(['char-warrior-01', 'char-mage-02'])
  })

  it('exposes the error when the service throws', async () => {
    const dbError = new Error('network error')
    vi.mocked(fetchRecruitedDefIds).mockRejectedValue(dbError)

    const { result } = renderHook(() => usePlayerCharacters(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe(dbError)
  })

  it('uses the playerCharacters query key', async () => {
    vi.mocked(fetchRecruitedDefIds).mockResolvedValue([])

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children)

    const { result } = renderHook(() => usePlayerCharacters(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // The cache entry keyed ['playerCharacters'] should be populated.
    expect(client.getQueryData(['playerCharacters'])).toEqual([])
  })
})
