import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import type { PlayerProfile } from '@/services/profile'

// Mock the service (not the hook) so useProfile runs through a real TanStack Query cache —
// matches the pattern in src/hooks/usePlayerCharacters.test.ts.
vi.mock('@/services/profile', () => ({
  fetchProfile: vi.fn(),
}))

import { fetchProfile } from '@/services/profile'
import StatisticsPage from './StatisticsPage'

function renderWithClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    React.createElement(QueryClientProvider, { client }, React.createElement(StatisticsPage)),
  )
}

function makeProfile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    username: 'Tester',
    currencies: {},
    resources: {},
    resetCount: 0,
    infirmaryLevel: 1,
    mapProgress: {},
    unlockedCharacters: {},
    echoes: 0,
    echoShop: {},
    lifetimeStats: {},
    ascendantShards: 0,
    ascendantShop: {},
    ascendantMilestones: {},
    transcendCount: 0,
    achievements: {},
    ascendantShardsEarnedTotal: 0,
    daysPlayed: 0,
    achievementCounters: {},
    ...overrides,
  }
}

describe('StatisticsPage', () => {
  it('renders "Loading…" (not the stat groups) while the profile query is pending', () => {
    vi.mocked(fetchProfile).mockReturnValue(new Promise(() => {})) // never resolves

    renderWithClient()

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByText('Meta-progression')).not.toBeInTheDocument()
    expect(screen.queryByText('Missions & Combat')).not.toBeInTheDocument()
  })

  it('renders the Meta-progression rows from profile.data, formatted with toLocaleString', async () => {
    vi.mocked(fetchProfile).mockResolvedValue(
      makeProfile({ resetCount: 1234, transcendCount: 5, ascendantShardsEarnedTotal: 1000000 }),
    )

    renderWithClient()

    await waitFor(() => expect(screen.getByText('Meta-progression')).toBeInTheDocument())

    expect(screen.getByText('Times Reset')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument()
    expect(screen.getByText('Times Transcended')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('Ascendant Shards earned (lifetime)')).toBeInTheDocument()
    expect(screen.getByText('1,000,000')).toBeInTheDocument()
  })

  it('formats gatherSecondsSpent as a duration (not toLocaleString) like missionSecondsSent', async () => {
    vi.mocked(fetchProfile).mockResolvedValue(
      makeProfile({ lifetimeStats: { gatherSecondsSpent: 90 } }),
    )

    renderWithClient()

    await waitFor(() => expect(screen.getByText('Time spent gathering')).toBeInTheDocument())
    expect(screen.getByText('01:30')).toBeInTheDocument()
  })

  it('still renders the registry-driven groups (Missions & Combat / Economy / Resources Gathered) alongside Meta-progression', async () => {
    vi.mocked(fetchProfile).mockResolvedValue(makeProfile())

    renderWithClient()

    await waitFor(() => expect(screen.getByText('Meta-progression')).toBeInTheDocument())

    expect(screen.getByText('Missions & Combat')).toBeInTheDocument()
    expect(screen.getByText('Economy')).toBeInTheDocument()
    expect(screen.getByText('Resources Gathered')).toBeInTheDocument()
  })

  it('renders stages cleared (summed from mapProgress) in Missions & Combat', async () => {
    vi.mocked(fetchProfile).mockResolvedValue(
      makeProfile({ mapProgress: { gravemarch: 7, embercrag: 3 } }),
    )

    renderWithClient()

    await waitFor(() => expect(screen.getByText('Stages cleared')).toBeInTheDocument())
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('renders legendary items equipped (from achievementCounters) in Economy', async () => {
    vi.mocked(fetchProfile).mockResolvedValue(
      makeProfile({ achievementCounters: { legendaryItemsEquipped: 4 } }),
    )

    renderWithClient()

    await waitFor(() => expect(screen.getByText('Legendary items equipped')).toBeInTheDocument())
    expect(screen.getByText('4')).toBeInTheDocument()
  })
})
