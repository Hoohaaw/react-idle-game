import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

declare global {
  interface Window {
    umami?: { track: (url?: string) => void }
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
