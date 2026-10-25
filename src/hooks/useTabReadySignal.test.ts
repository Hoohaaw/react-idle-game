import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

// signalReady's "original title" is captured once at module import time, so each test needs a
// fresh module instance (vi.resetModules + a dynamic import) after setting a known document.title
// — a static top-level import would only ever see whatever title happened to be set first.
describe('useTabReadySignal', () => {
  beforeEach(() => {
    vi.resetModules()
    document.title = 'The Idle Game'
  })

  function setHidden(hidden: boolean) {
    Object.defineProperty(document, 'hidden', { value: hidden, configurable: true })
  }

  it('sets the title to a ready signal when the tab is hidden', async () => {
    setHidden(true)
    const { signalReady } = await import('./useTabReadySignal')
    signalReady()
    expect(document.title).toBe('✓ Ready! — The Idle Game')
  })

  it('does not change the title when the tab is visible', async () => {
    setHidden(false)
    const { signalReady } = await import('./useTabReadySignal')
    signalReady()
    expect(document.title).toBe('The Idle Game')
  })

  it('restores the original title when the tab becomes visible again', async () => {
    setHidden(true)
    const { signalReady } = await import('./useTabReadySignal')
    signalReady()
    expect(document.title).toBe('✓ Ready! — The Idle Game')

    setHidden(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(document.title).toBe('The Idle Game')
  })
})

describe('useSignalWhenDone', () => {
  beforeEach(() => {
    vi.resetModules()
    document.title = 'The Idle Game'
  })

  function setHidden(hidden: boolean) {
    Object.defineProperty(document, 'hidden', { value: hidden, configurable: true })
  }

  it('does not signal on mount when done starts true (nothing "just happened")', async () => {
    setHidden(true)
    const { useSignalWhenDone } = await import('./useTabReadySignal')
    renderHook(() => useSignalWhenDone(true))
    expect(document.title).toBe('The Idle Game')
  })

  it('signals the instant done transitions from false to true while hidden', async () => {
    setHidden(true)
    const { useSignalWhenDone } = await import('./useTabReadySignal')
    const { rerender } = renderHook(({ done }) => useSignalWhenDone(done), { initialProps: { done: false } })
    expect(document.title).toBe('The Idle Game')

    rerender({ done: true })
    expect(document.title).toBe('✓ Ready! — The Idle Game')
  })

  it('does not signal the transition while the tab is visible', async () => {
    setHidden(false)
    const { useSignalWhenDone } = await import('./useTabReadySignal')
    const { rerender } = renderHook(({ done }) => useSignalWhenDone(done), { initialProps: { done: false } })
    rerender({ done: true })
    expect(document.title).toBe('The Idle Game')
  })
})
