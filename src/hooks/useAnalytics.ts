import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

declare global {
  interface Window {
    umami?: { track: (eventName?: string, eventData?: Record<string, unknown>) => void }
  }
}

// Umami's script auto-tracks one pageview on load, but this is a client-rendered SPA
// (react-router-dom), so navigating between routes never re-triggers that script — without
// this, every page after the first is invisible to analytics. Skips the first run so the
// auto-tracked initial pageview isn't double-counted.
export function useAnalytics() {
  const location = useLocation()
  const isFirstRun = useRef(true)

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
    window.umami?.track(location.pathname + location.search)
  }, [location.pathname, location.search])
}

// One-time progression milestones (first mission claimed, first Reset, first Transcendence, …)
// — fires window.umami.track(key) at most once ever per browser, gated by localStorage so a
// refresh or a repeat of the same action never re-fires it. Namespaced like GameLayout's own
// 'achievements:lastRecordedLoginDate' flag to avoid key collisions. Never throws if
// window.umami is missing (ad-blocker, not yet loaded) — callers (mutation onSuccess handlers)
// must never fail because analytics didn't load.
export function trackMilestoneOnce(key: string) {
  const flagKey = `milestones:${key}`
  if (localStorage.getItem(flagKey)) return
  localStorage.setItem(flagKey, 'true')
  window.umami?.track(key)
}
