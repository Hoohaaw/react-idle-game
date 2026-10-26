import { describe, it, expect, vi, beforeEach } from 'vitest'
import { trackMilestoneOnce } from './useAnalytics'

describe('trackMilestoneOnce', () => {
  beforeEach(() => {
    localStorage.clear()
    window.umami = { track: vi.fn() }
  })

  it('calls window.umami.track the first time a milestone key fires', () => {
    trackMilestoneOnce('first_mission_claimed')
    expect(window.umami?.track).toHaveBeenCalledWith('first_mission_claimed')
  })

  it('does not call track again for the same key on a second call', () => {
    trackMilestoneOnce('first_reset')
    trackMilestoneOnce('first_reset')
    expect(window.umami?.track).toHaveBeenCalledOnce()
  })

  it('tracks different keys independently', () => {
    trackMilestoneOnce('first_mission_claimed')
    trackMilestoneOnce('first_reset')
    expect(window.umami?.track).toHaveBeenCalledTimes(2)
  })

  it('does not throw when window.umami is undefined (script blocked or not loaded)', () => {
    window.umami = undefined
    expect(() => trackMilestoneOnce('first_transcend')).not.toThrow()
  })
})
