# Milestone Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track real progression milestones (first mission claimed, first Reset, first
Transcendence) instead of only raw pageviews, so pacing questions ("how many players ever
reach a first reset?") are answerable from analytics.

**Architecture:** One shared, localStorage-gated helper (`trackMilestoneOnce(key)`) added
alongside the existing `useAnalytics()` hook and its `Window.umami` type declaration — reuses
the exact once-per-browser gating pattern `GameLayout`'s `useRecordLogin` already uses for
daily-login tracking. Wired into 3 existing mutation hooks' `onSuccess` callbacks; no new
backend, no new table, no new RPC.

**Tech Stack:** Umami's existing client-side `window.umami.track(name, data?)` API (already
loaded via `index.html`), TanStack Query mutation `onSuccess`, `localStorage`.

**Spec:** None — bounded-path change (extends the existing `useAnalytics` mechanism to 3 new
call sites), design approved in chat on 2026-10-24. This plan is the only design record.

## Global Constraints

- v1 scope is exactly 3 milestones: `first_mission_claimed`, `first_reset`, `first_transcend`.
  Do not add more call sites in this task — if more milestones are wanted later, that's a
  follow-up using the same `trackMilestoneOnce` helper.
- Each milestone fires **at most once ever per browser** (gated by `localStorage`, not by
  server state) — a page refresh or claiming a second mission must never re-fire
  `first_mission_claimed`.
- `trackMilestoneOnce` must never throw if `window.umami` is undefined (the analytics script
  blocked by an ad-blocker, or not yet loaded) — the mutation it's called from must succeed
  regardless of whether analytics is present.
- Don't touch the existing `useAnalytics()` hook's route-tracking behavior or its call sites —
  this plan only widens the `Window.umami` type it already declares and adds one new export
  alongside it.

## Review Focus

- `trackMilestoneOnce('x')` called twice in a row must result in exactly one
  `window.umami.track` call, not two.
- Confirm each of the 3 wired call sites actually fires with the right key
  (`first_mission_claimed` in `useClaimMission`, `first_reset` in `useResetPlayer`,
  `first_transcend` in `useTranscendPlayer`) and that the existing `invalidateQueries` calls in
  each `onSuccess` are untouched, not reordered in a way that changes behavior.
- `localStorage` keys must be namespaced (`milestones:<key>`) to avoid colliding with
  `GameLayout`'s own `achievements:lastRecordedLoginDate` flag or any other existing key.

---

### Task 1: `trackMilestoneOnce` helper + the 3 call sites

**Files:**
- Modify: `src/hooks/useAnalytics.ts`
- Test: `src/hooks/useAnalytics.test.ts`
- Modify: `src/features/missions/hooks.ts`
- Modify: `src/features/reset/hooks.ts`

**Interfaces:**
- Produces: `export function trackMilestoneOnce(key: string): void` — call it inside any
  mutation's `onSuccess` for a true one-time-ever player milestone.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useAnalytics.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/hooks/useAnalytics.test.ts`
Expected: FAIL — `trackMilestoneOnce` is not exported yet.

- [ ] **Step 3: Widen the `Window.umami` type and add the helper**

In `src/hooks/useAnalytics.ts`, the current full file is:

```ts
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
```

Replace the whole file with:

```ts
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

declare global {
  interface Window {
    umami?: { track: (eventNameOrUrl?: string, eventData?: Record<string, unknown>) => void }
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/hooks/useAnalytics.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Wire `first_mission_claimed` into `useClaimMission`**

In `src/features/missions/hooks.ts`, add the import alongside the existing ones:

```ts
import { trackMilestoneOnce } from '@/hooks/useAnalytics'
```

Find `useClaimMission` (currently):

```ts
export function useClaimMission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (runId: string) => claimMission(runId),
    onSuccess: () => {
      // Run deleted; levels/xp/HP changed; wallet + inventory changed.
      void qc.invalidateQueries({ queryKey: ['missionRuns'] })
      void qc.invalidateQueries({ queryKey: ['ownedCharacters'] })
      void qc.invalidateQueries({ queryKey: ['profile'] })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}
```

Add the milestone call as the first line of `onSuccess`, everything else unchanged:

```ts
export function useClaimMission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (runId: string) => claimMission(runId),
    onSuccess: () => {
      trackMilestoneOnce('first_mission_claimed')
      // Run deleted; levels/xp/HP changed; wallet + inventory changed.
      void qc.invalidateQueries({ queryKey: ['missionRuns'] })
      void qc.invalidateQueries({ queryKey: ['ownedCharacters'] })
      void qc.invalidateQueries({ queryKey: ['profile'] })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}
```

- [ ] **Step 6: Wire `first_reset` and `first_transcend` into `src/features/reset/hooks.ts`**

Add the same import alongside the existing ones:

```ts
import { trackMilestoneOnce } from '@/hooks/useAnalytics'
```

Find `useResetPlayer` (currently):

```ts
export function useResetPlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: resetPlayer,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
```

Change to:

```ts
export function useResetPlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: resetPlayer,
    onSuccess: () => {
      trackMilestoneOnce('first_reset')
      void qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
```

Find `useTranscendPlayer` (currently):

```ts
export function useTranscendPlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: transcendPlayer,
    onSuccess: () => {
      void qc.invalidateQueries()
    },
  })
}
```

Change to:

```ts
export function useTranscendPlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: transcendPlayer,
    onSuccess: () => {
      trackMilestoneOnce('first_transcend')
      void qc.invalidateQueries()
    },
  })
}
```

Nothing else in either file changes — `usePurchaseEchoShopNode`, `useRaidKeys`,
`useRaidEligibility`, and `usePurchaseAscendantShopNode` are untouched.

- [ ] **Step 7: Verify the whole suite and a real build**

Run: `npm run lint && npm run build && npx vitest run --exclude ".superpowers/**" --exclude "node_modules/**"`
Expected: all clean, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useAnalytics.ts src/hooks/useAnalytics.test.ts src/features/missions/hooks.ts src/features/reset/hooks.ts
git commit -m "feat: track first-mission/reset/transcend milestones in analytics"
```
