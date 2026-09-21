import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WinChanceEstimate } from './WinChanceEstimate'
import type { DispatchChar } from './dispatchSamples'
import type { MissionEnemyView } from '@/services/missions'

vi.mock('@/hooks/useRoster', () => ({
  useItemDefs: () => ({ data: {} }),
}))

// Calibrated (not arbitrary) so the fight is actually sensitive to the 'alchemy' proficiency's
// +5 flat defense (src/lib/proficiencies.ts): strong enough that the party doesn't win/lose
// every run regardless of the bonus (a 100%/0% fixture would pass identically even with the
// bonus wiring ripped out), weak enough to leave room for the bonus to move the outcome.
// Empirically: with baseChar's attack/health/defense below, 200 simulated seeds resolve to
// ~34% win with the matching tag vs. ~22% without it — a reliable double-digit gap, not noise.
const calibratedEnemy: MissionEnemyView = {
  name: 'Training Dummy',
  count: 1,
  damageType: 'physical',
  resistances: [],
  stats: { health: 30, attack: 10, speed: 10, defense: 0 },
}

function renderEstimate(props: Partial<Parameters<typeof WinChanceEstimate>[0]> & { party: DispatchChar[] }) {
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <WinChanceEstimate enemies={[calibratedEnemy]} timeLimitSeconds={60} mapKey={null} proficiencyTags={[]} {...props} />
    </QueryClientProvider>,
  )
}

function readPct(container: HTMLElement): number {
  const text = within(container).getByText(/%$/).textContent!
  return Number(text.replace('%', ''))
}

describe('WinChanceEstimate proficiency bonus', () => {
  const baseChar: DispatchChar = {
    id: 'c1',
    name: 'Test',
    charClass: 'Druid',
    level: 1,
    role: 'utility',
    stats: { health: 50, attack: 5, defense: 0, speed: 10 },
    statInputs: {
      baseStats: [{ stat: 'health', value: 50 }, { stat: 'attack', value: 5 }, { stat: 'defense', value: 0 }, { stat: 'speed', value: 10 }],
      growth: [],
      blessingNodes: [],
    },
    proficiency: 'alchemy',
  }

  it('renders a percentage once the estimate resolves for a matching mission', async () => {
    renderEstimate({ party: [baseChar], proficiencyTags: ['alchemy'] })
    await waitFor(() => expect(screen.getByText(/%$/)).toBeInTheDocument())
  })

  it('still renders a percentage with no matching proficiency (no crash, not a hard requirement)', async () => {
    renderEstimate({ party: [baseChar], proficiencyTags: [] })
    await waitFor(() => expect(screen.getByText(/%$/)).toBeInTheDocument())
  })

  it('a matching proficiency tag raises the win% over an otherwise-identical non-matching mission', async () => {
    // Same party, same enemy, same simulated seeds — the only difference is whether the
    // mission's proficiencyTags include 'alchemy'. If resolveProficiencyBonus were a no-op,
    // these two numbers would be identical; the calibrated fixture guarantees they aren't.
    const matching = render(
      <QueryClientProvider client={new QueryClient()}>
        <WinChanceEstimate party={[baseChar]} enemies={[calibratedEnemy]} timeLimitSeconds={60} mapKey={null} proficiencyTags={['alchemy']} />
      </QueryClientProvider>,
    )
    await waitFor(() => expect(within(matching.container).getByText(/%$/)).toBeInTheDocument())
    const matchingPct = readPct(matching.container)

    const nonMatching = render(
      <QueryClientProvider client={new QueryClient()}>
        <WinChanceEstimate party={[baseChar]} enemies={[calibratedEnemy]} timeLimitSeconds={60} mapKey={null} proficiencyTags={[]} />
      </QueryClientProvider>,
    )
    await waitFor(() => expect(within(nonMatching.container).getByText(/%$/)).toBeInTheDocument())
    const nonMatchingPct = readPct(nonMatching.container)

    expect(matchingPct).toBeGreaterThan(nonMatchingPct)
  })
})
