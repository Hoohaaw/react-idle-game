import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WinChanceEstimate } from './WinChanceEstimate'
import type { DispatchChar } from './dispatchSamples'
import type { MissionEnemyView } from '@/services/missions'

vi.mock('@/hooks/useRoster', () => ({
  useItemDefs: () => ({ data: {} }),
}))

const weakEnemy: MissionEnemyView = {
  name: 'Training Dummy',
  count: 1,
  damageType: 'physical',
  resistances: [],
  stats: { health: 1, attack: 0, speed: 10, defense: 0 },
}

function renderEstimate(props: Partial<Parameters<typeof WinChanceEstimate>[0]> & { party: DispatchChar[] }) {
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <WinChanceEstimate enemies={[weakEnemy]} timeLimitSeconds={60} mapKey={null} proficiencyTags={[]} {...props} />
    </QueryClientProvider>,
  )
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
})
