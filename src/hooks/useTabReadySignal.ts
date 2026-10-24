// Module-level, not a React hook with per-component state — this runs once at import time
// regardless of how many components import it, so there's exactly one visibilitychange
// listener no matter how many CountdownTimers call signalReady() while the tab is hidden.
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
