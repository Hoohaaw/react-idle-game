# Error Boundary Fallback UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a React render crash an actual recovery screen instead of a blank white tab.

**Architecture:** One class-component `ErrorBoundary` wrapping `<App />` in `main.tsx`. Crash
*reporting* to Sentry already exists (React 19's root `onCaughtError`/`onUncaughtError` hooks,
wired in `main.tsx` since before this plan) — this plan adds only the missing piece, a
user-facing fallback UI, not a second reporting path.

**Tech Stack:** React 19 (class component, `getDerivedStateFromError`), existing `PrimaryButton`
atom, Vitest + @testing-library/react.

**Spec:** None — bounded-path change (existing flow: the app's root render tree), design
approved in chat on 2026-10-24. This plan is the only design record.

## Global Constraints

- Do not call `Sentry.captureException` or any other manual reporting inside this boundary —
  `main.tsx`'s root `onCaughtError: Sentry.reactErrorHandler()` already reports every error a
  boundary catches. A second manual call would double-report the same crash.
- `getDerivedStateFromError` alone makes a valid error boundary — do not add
  `componentDidCatch` just to "complete the pattern"; it has no job left to do here.
- One root-level boundary for v1 — not per-route or per-widget boundaries. If a specific page
  turns out to need its own isolated boundary later, that's a separate, later change.
- Match the existing dark theme (Georgia serif, `--color-bg-deep`/`--color-gold-light`/
  `--color-text-muted` CSS vars, `src/index.css`) — this is an emergency screen, keep it calm
  and functional, not decorative.

## Review Focus

- The fallback must actually render in place of the crashed subtree, not alongside it or
  blank — verified by the test rendering a component that throws.
- `getDerivedStateFromError` must not reference the thrown error's message/stack in the
  rendered UI — a boundary with no server context has no way to say anything useful about
  *why* it crashed, and surfacing a raw stack trace to a player is not the goal (Sentry has it).
- The Reload button must perform a real full page reload (`window.location.reload()`), not a
  SPA client-side navigation — a crashed React tree can't reliably re-render itself.
- React logs a caught error to the console twice in development by default (its own internal
  logging, separate from the boundary) — the test must not treat that console noise as a test
  failure, and must not accidentally suppress real `expect` failures while doing so.

---

### Task 1: `ErrorBoundary` component, wired into `main.tsx`

**Files:**
- Create: `src/components/organisms/ErrorBoundary.tsx`
- Test: `src/components/organisms/ErrorBoundary.test.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces: `export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }>` — a React component with no other props, wraps anything.

- [ ] **Step 1: Write the failing test**

Create `src/components/organisms/ErrorBoundary.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

function Bomb(): never {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  // React logs a caught render error to the console (its own internal dev logging, separate
  // from this component) — expected noise for this test, not a real failure.
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  afterEach(() => consoleError.mockClear())

  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('renders the fallback instead of the crashed subtree when a child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something broke')).toBeInTheDocument()
    expect(screen.queryByText('All good')).not.toBeInTheDocument()
  })

  it('renders a Reload button that calls window.location.reload', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const reload = vi.fn()
    const originalLocation = window.location
    Object.defineProperty(window, 'location', { value: { ...originalLocation, reload }, writable: true })

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )
    await userEvent.default.click(screen.getByRole('button', { name: 'Reload' }))
    expect(reload).toHaveBeenCalledOnce()

    Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/organisms/ErrorBoundary.test.tsx`
Expected: FAIL — `Failed to resolve import "./ErrorBoundary"` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/components/organisms/ErrorBoundary.tsx`:

```tsx
import { Component, type ReactNode } from 'react'
import { PrimaryButton } from '@/components/atoms/Button'

type Props = { children: ReactNode }
type State = { hasError: boolean }

// getDerivedStateFromError alone makes this a valid error boundary — no componentDidCatch,
// since main.tsx's root onCaughtError (Sentry.reactErrorHandler()) already reports every
// caught error centrally; a second manual report here would double-count it.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100svh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
          backgroundColor: 'var(--color-bg-deep)',
          fontFamily: 'Georgia, serif',
        }}>
          <h1 style={{ color: 'var(--color-gold-light)', fontSize: 22, letterSpacing: '1px' }}>Something broke</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, maxWidth: 360 }}>
            The page hit an error and couldn&rsquo;t continue. Reloading usually fixes it — your
            progress is saved on the server, not in this tab.
          </p>
          <PrimaryButton onClick={() => window.location.reload()}>Reload</PrimaryButton>
        </div>
      )
    }
    return this.props.children
  }
}
```

In `src/main.tsx`, add the import and wrap `<App />`:

```ts
import { ErrorBoundary } from './components/organisms/ErrorBoundary'
```

Change:
```tsx
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
```
to:
```tsx
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
```

(`ErrorBoundary` wraps everything, including the router — a crash in routing itself is still
caught. The existing `createRoot(...).render(...)` call, `onUncaughtError`/`onCaughtError`/
`onRecoverableError` options, and everything above this JSX block are unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/organisms/ErrorBoundary.test.tsx`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Verify the whole suite and a real build**

Run: `npm run lint && npm run build && npx vitest run --exclude ".superpowers/**" --exclude "node_modules/**"`
Expected: all clean, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/organisms/ErrorBoundary.tsx src/components/organisms/ErrorBoundary.test.tsx src/main.tsx
git commit -m "feat: add a real fallback UI for render crashes"
```
