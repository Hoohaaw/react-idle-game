import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ActiveMissionCard } from './ActiveMissionCard'

// vi.mock factories are hoisted above this file's top-level body, so a plain
// `const mockUseSignalWhenDone = vi.fn()` would still be in its temporal dead zone when the
// factory runs. vi.hoisted() runs alongside the mock hoisting, so the fn exists in time —
// same fix CountdownTimer.test.tsx uses for the same hoisting issue.
const { mockUseSignalWhenDone } = vi.hoisted(() => ({ mockUseSignalWhenDone: vi.fn() }))
vi.mock('@/hooks/useTabReadySignal', () => ({ useSignalWhenDone: mockUseSignalWhenDone }))

describe('ActiveMissionCard', () => {
  beforeEach(() => {
    mockUseSignalWhenDone.mockClear()
  })

  it('wires useSignalWhenDone with done=false while the mission is still running', () => {
    const now = Date.now()
    render(<ActiveMissionCard name="Goblin Outpost" partySize={3} startedAt={now - 1000} endsAt={now + 60000} />)
    expect(mockUseSignalWhenDone).toHaveBeenCalledWith(false)
  })

  it('wires useSignalWhenDone with done=true once the mission has finished', () => {
    const now = Date.now()
    render(<ActiveMissionCard name="Goblin Outpost" partySize={3} startedAt={now - 60000} endsAt={now - 1000} />)
    expect(mockUseSignalWhenDone).toHaveBeenCalledWith(true)
  })
})
