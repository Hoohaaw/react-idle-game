import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render } from '@testing-library/react'
import { CountdownTimer } from './CountdownTimer'

// vi.mock factories are hoisted above this file's top-level body, so a plain
// `const mockSignalReady = vi.fn()` would still be in its temporal dead zone when the factory
// runs (triggered the moment CountdownTimer.tsx's static import of useTabReadySignal resolves).
// vi.hoisted() runs alongside the mock hoisting, so the fn exists by the time the factory needs it.
const { mockSignalReady } = vi.hoisted(() => ({ mockSignalReady: vi.fn() }))
vi.mock('../../hooks/useTabReadySignal', () => ({ signalReady: mockSignalReady }))

describe('CountdownTimer', () => {
  beforeEach(() => {
    mockSignalReady.mockClear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not signal ready on mount when the timer starts already finished', () => {
    render(<CountdownTimer durationSec={0} />)
    expect(mockSignalReady).not.toHaveBeenCalled()
  })

  it('signals ready the instant the timer transitions from running to done', () => {
    render(<CountdownTimer durationSec={5} />)
    expect(mockSignalReady).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(6000)
    })
    expect(mockSignalReady).toHaveBeenCalledOnce()
  })
})
