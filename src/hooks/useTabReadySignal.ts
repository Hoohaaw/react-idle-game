import { useEffect, useRef } from 'react'

// Module-level, not a React hook with per-component state — this runs once at import time
// regardless of how many components import it, so there's exactly one visibilitychange
// listener no matter how many callers (CountdownTimer, or any useSignalWhenDone caller) fire
// signalReady() while the tab is hidden. If a component mounts with `done` already true (e.g.
// a page loaded on a stale/already-finished run while the tab was hidden the whole time), the
// signal still fires once on that first hidden render — harmless, since it genuinely is ready.
const ORIGINAL_TITLE = document.title
const READY_TITLE = `✓ Ready! — ${ORIGINAL_TITLE}`

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) document.title = ORIGINAL_TITLE
})

// Call when something becomes claimable/ready while the player might not be looking. Only
// touches the title while the tab is actually hidden — no point signaling someone already here,
// and it would clobber whatever title the visible page already set.
export function signalReady() {
  if (document.hidden) document.title = READY_TITLE
}

// Fires signalReady() the instant `done` transitions from false to true — the same transition-
// detection logic CountdownTimer.tsx uses inline, generalized so the real gameplay cards that
// render their own inline countdown (instead of the shared CountdownTimer atom) can wire in too.
export function useSignalWhenDone(done: boolean) {
  const wasDone = useRef(done)
  useEffect(() => {
    if (done && !wasDone.current) signalReady()
    wasDone.current = done
  }, [done])
}
