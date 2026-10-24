# Tab Ready Signal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap the browser tab's title to a "something's ready" signal the moment any active
timer (mission, dungeon, raid, craft, gather) finishes while the tab is backgrounded, and
restore the real title the moment the player looks back.

**Architecture:** A tiny module-level helper (`signalReady()`), not a React hook with per-
component state — registered once at import time so there's exactly one `visibilitychange`
listener regardless of how many timers exist. Wired into the single shared `CountdownTimer`
atom, which every mission/dungeon/raid/craft/gather timer already renders through — one touch
point covers the whole game.

**Tech Stack:** Page Visibility API (`document.hidden`, `visibilitychange`), the existing
`CountdownTimer` atom and `useNow` hook, Vitest fake timers.

**Spec:** None — bounded-path change (existing flow: the shared countdown display), design
approved in chat on 2026-10-24. This plan is the only design record.

## Global Constraints

- No new store, registry, or context — `CountdownTimer` is already the single shared leaf
  component every timer in the game renders through (missions, dungeons, raids, crafting,
  gathering); hooking the signal in there covers all of them for free.
- `signalReady()` only touches `document.title` while `document.hidden` is true — never
  overwrite the title a visible page might be showing.
- The original title is captured once, at module load (`document.title` at that point — this
  app's `index.html` sets a static title, so this is always the real title), and restored
  verbatim on `visibilitychange` → visible. Don't hardcode the title string here.
- Only fire on a live false→true transition of the timer's own `done` state — a timer that
  mounts already finished (e.g. a page loaded after the real event happened) must not fire the
  signal; nothing "just happened" in that case.

## Review Focus

- A `CountdownTimer` instance that starts already done (`durationSec: 0`, or
  `startedSecAgo >= durationSec`) must never call the signal on mount.
- Calling `signalReady()` while the tab is visible must be a no-op on `document.title`.
- After the signal fires, the title must revert to the real original title (not some other
  string, not stay on the ready signal) the moment the tab becomes visible again.
- Multiple `CountdownTimer`s finishing in the same hidden session must not throw, double-register
  listeners, or leave the title in an inconsistent state — the module-level registration (not
  per-component) is what guarantees this; the review should confirm the listener really is
  registered only once (at module scope, not inside the component).

---

### Task 1: `signalReady()` helper + `CountdownTimer` wiring

**Files:**
- Create: `src/hooks/useTabReadySignal.ts`
- Test: `src/hooks/useTabReadySignal.test.ts`
- Modify: `src/components/atoms/CountdownTimer.tsx`
- Test: `src/components/atoms/CountdownTimer.test.tsx`

**Interfaces:**
- Produces: `export function signalReady(): void` — call it whenever something becomes
  claimable/ready; it decides on its own whether the tab is hidden and whether to act.

- [ ] **Step 1: Write the failing test for the helper**

Create `src/hooks/useTabReadySignal.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/hooks/useTabReadySignal.test.ts`
Expected: FAIL — `Failed to resolve import "./useTabReadySignal"` (file doesn't exist yet).

- [ ] **Step 3: Write the helper**

Create `src/hooks/useTabReadySignal.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/hooks/useTabReadySignal.test.ts`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Write the failing test for `CountdownTimer`'s wiring**

Create `src/components/atoms/CountdownTimer.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render } from '@testing-library/react'
import { CountdownTimer } from './CountdownTimer'

const mockSignalReady = vi.fn()
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
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run src/components/atoms/CountdownTimer.test.tsx`
Expected: FAIL — `signalReady` is never called (the wiring doesn't exist yet).

- [ ] **Step 7: Wire `signalReady()` into `CountdownTimer`**

In `src/components/atoms/CountdownTimer.tsx`, the current full file is:

```tsx
import { useState } from 'react'
import { useNow } from '../../hooks/useNow'
import { formatRemaining } from '../../lib/time'
import { IconSlot } from './IconSlot'

export function CountdownTimer({ durationSec, startedSecAgo = 0 }: { durationSec: number; startedSecAgo?: number }) {
  const [endsAt] = useState(() => Date.now() + (durationSec - startedSecAgo) * 1000)
  const now = useNow()
  const done = endsAt - now <= 0
  return (
    // ...unchanged JSX...
  )
}
```

Change the imports and the body above the `return` to:

```tsx
import { useEffect, useRef, useState } from 'react'
import { useNow } from '../../hooks/useNow'
import { formatRemaining } from '../../lib/time'
import { IconSlot } from './IconSlot'
import { signalReady } from '../../hooks/useTabReadySignal'

export function CountdownTimer({ durationSec, startedSecAgo = 0 }: { durationSec: number; startedSecAgo?: number }) {
  const [endsAt] = useState(() => Date.now() + (durationSec - startedSecAgo) * 1000)
  const now = useNow()
  const done = endsAt - now <= 0
  const wasDone = useRef(done)

  useEffect(() => {
    if (done && !wasDone.current) signalReady()
    wasDone.current = done
  }, [done])

  return (
    // ...unchanged JSX, exactly as it is today...
  )
}
```

Everything inside the `return (...)` JSX stays byte-for-byte the same — only the imports and
the block above `return` change.

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/components/atoms/CountdownTimer.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 9: Verify the whole suite and a real build**

Run: `npm run lint && npm run build && npx vitest run --exclude ".superpowers/**" --exclude "node_modules/**"`
Expected: all clean, all tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/hooks/useTabReadySignal.ts src/hooks/useTabReadySignal.test.ts src/components/atoms/CountdownTimer.tsx src/components/atoms/CountdownTimer.test.tsx
git commit -m "feat: swap the tab title when a timer finishes while backgrounded"
```
