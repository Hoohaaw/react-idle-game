import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StageWizard } from './StageWizard'
import type { GroupStageView } from '@/services/groupContent'

// Regression carried over from StagePath.test.tsx: Sanity's GROQ projection `loot[]{...}` returns
// `null` (not `[]`) for a stage whose `loot` array was never authored — this is the live shape of
// both reference dungeons/raids today (every trash stage has no loot authored, only boss stages
// do), NOT a hypothetical. The query's coalesce(..., []) guards this server-side now, but the
// component keeps its own defensive guard too (defense in depth, not either/or).
describe('StageWizard', () => {
  const baseProps = {
    dungeonName: 'Emberdeep Vault',
    description: 'A sunken forge.',
    currentStageIndex: 0,
    stageEndsAt: null,
    roster: [],
    cap: 5,
    selected: [],
    onToggle: vi.fn(),
    traitCtx: { mapKey: null, enemyArchetypes: [], enemySchools: [] },
    onSend: vi.fn(),
    onClaim: vi.fn(),
    onRetry: vi.fn(),
  }

  it('renders without crashing when a stage has no loot authored (loot is null, not [])', () => {
    const stages = [
      { kind: 'trash', loot: null },
      { kind: 'boss', loot: [{ itemKey: 'x', name: 'Cinder Blade', slot: 'Weapon', chances: [{ rarity: 'Rare', chance: 20 }] }] },
    ] as unknown as GroupStageView[]

    render(<StageWizard {...baseProps} stages={stages} />)

    expect(screen.getByText('No loot table authored for this stage yet.')).toBeInTheDocument()
    expect(screen.getByText('Emberdeep Vault')).toBeInTheDocument()
  })

  it('renders real loot rarity-chance pills when a stage has an authored loot table', () => {
    const stages = [
      { kind: 'boss', durationSeconds: 180, baseXp: 120, loot: [{ itemKey: 'x', name: 'Cinder Blade', slot: 'Weapon', chances: [{ rarity: 'Rare', chance: 22 }] }] },
    ] as unknown as GroupStageView[]

    render(<StageWizard {...baseProps} stages={stages} />)

    expect(screen.getByText('Cinder Blade')).toBeInTheDocument()
    expect(screen.getByText('22%')).toBeInTheDocument()
  })

  it('shows the Party Wiped fail screen and a Retry CTA on a loss claim, instead of the trail/body', () => {
    const stages = [{ kind: 'trash', durationSeconds: 90, baseXp: 40, loot: [] }] as GroupStageView[]

    render(<StageWizard {...baseProps} stages={stages} claimOutcome="loss" claimReason="party-wiped" />)

    expect(screen.getByText('Party Wiped')).toBeInTheDocument()
    expect(screen.getByText('Your party has fallen — no rewards')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.queryByText('No loot table authored for this stage yet.')).not.toBeInTheDocument()
  })

  it('falls back to the Out of Time fail screen for any non-party-wiped loss reason', () => {
    const stages = [{ kind: 'trash', durationSeconds: 90, baseXp: 40, loot: [] }] as GroupStageView[]

    render(<StageWizard {...baseProps} stages={stages} claimOutcome="loss" claimReason="timeout" />)

    expect(screen.getByText('Out of Time')).toBeInTheDocument()
  })
})
