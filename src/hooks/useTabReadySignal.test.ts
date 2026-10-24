import { describe, it, expect, beforeEach, vi } from 'vitest'

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
