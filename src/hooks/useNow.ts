import { useEffect, useState } from 'react'

// Ticks the current time every second and re-syncs on tab focus/visibility,
// so anything derived from it (countdowns, progress) never drifts while a
// background tab is throttled. Remaining time is always computed from the
// real clock — never decremented.
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = setInterval(tick, 1000)
    const onFocus = () => tick()
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  }, [])
  return now
}
