import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StagePath } from './StagePath'
import type { GroupStageView } from '@/services/groupContent'

// Regression: Sanity's GROQ projection `loot[]{...}` returns `null` (not `[]`) for a stage whose
// `loot` array was never authored — this is the live shape of both reference dungeons/raids today
// (every trash stage has no loot authored, only boss stages do), NOT a hypothetical. StageNode must
// not assume `stage.loot` is always an array.
describe('StagePath', () => {
  it('renders without crashing when a stage has no loot authored (loot is null, not [])', () => {
    const stages = [
      { kind: 'trash', loot: null },
      { kind: 'boss', loot: [{ itemKey: 'x', name: 'Cinder Blade', slot: 'Weapon' }] },
    ] as unknown as GroupStageView[]

    render(<StagePath stages={stages} variant="preview" />)

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})
