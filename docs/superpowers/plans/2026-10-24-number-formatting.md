# Number Formatting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a K/M/B-suffix number formatter and apply it to the two most number-heavy
displays (the wallet/gold header, the XP readout) — not a sweep of every `toLocaleString()`
call site in the codebase.

**Architecture:** One pure formatting function in `src/lib/`, with no dependency on anything
else — a straight swap-in wherever a raw number is currently rendered via `toLocaleString()`
or interpolated directly.

**Tech Stack:** Plain TypeScript, no new dependency.

**Spec:** None — bounded-path change (narrow application, by explicit choice — the shop cost
curves (`costBase`/`costGrowth` in `src/lib/echoShop.ts`) don't yet produce astronomically
large numbers), design approved in chat on 2026-10-24. This plan is the only design record.

## Global Constraints

- Scope is exactly 2 call sites: `CoinDisplay` (the wallet/gold header number) and
  `CharacterCard`'s XP readout. Do not touch any of the other `toLocaleString()` call sites
  found elsewhere in the codebase — that's explicitly out of scope for this pass.
- Below 1,000, output must match the current plain-integer display exactly (e.g. `142`, not
  `0.14K`) — small numbers (most resource/gold amounts today) must look unchanged.
- Negative numbers must keep their sign (`-1500` → `"-1.5K"`), not silently become positive.
- No new dependency — this is a small enough formatting rule to write by hand, not worth
  pulling in a library for.

## Review Focus

- `formatNumber(999)` must stay `"999"`, not `"999"` with a stray suffix or decimal — the
  below-1,000 path must exactly match pre-existing `toLocaleString()` output for small values.
- Trailing-zero trimming must only ever remove a *decimal* trailing zero (`"1.50K"` → `"1.5K"`,
  `"1.00K"` → `"1K"`) — it must never strip a significant zero from a whole-number suffix value
  like `"100K"` (100,000 must render as `"100K"`, not `"1K"`).
- `CoinDisplay`'s and `CharacterCard`'s existing styling/layout must be completely unchanged —
  only the number-to-string conversion changes, nothing visual around it.

---

### Task 1: `formatNumber` utility + the 2 call sites

**Files:**
- Create: `src/lib/formatNumber.ts`
- Test: `src/lib/formatNumber.test.ts`
- Modify: `src/components/atoms/CoinDisplay.tsx`
- Modify: `src/components/organisms/CharacterCard.tsx`

**Interfaces:**
- Produces: `export function formatNumber(value: number): string`

- [ ] **Step 1: Write the failing test**

Create `src/lib/formatNumber.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatNumber } from './formatNumber'

describe('formatNumber', () => {
  it('formats numbers below 1,000 as a plain integer, matching the old toLocaleString output', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(142)).toBe('142')
    expect(formatNumber(999)).toBe('999')
  })

  it('formats thousands with a K suffix, trimming trailing decimal zeros', () => {
    expect(formatNumber(1000)).toBe('1K')
    expect(formatNumber(1500)).toBe('1.5K')
    expect(formatNumber(10000)).toBe('10K')
    expect(formatNumber(12340)).toBe('12.3K')
  })

  it('switches to 0 decimals once the scaled value reaches 100, without dropping a digit', () => {
    expect(formatNumber(100000)).toBe('100K')
    expect(formatNumber(999000)).toBe('999K')
  })

  it('formats millions with an M suffix', () => {
    expect(formatNumber(1_000_000)).toBe('1M')
    expect(formatNumber(2_500_000)).toBe('2.5M')
    expect(formatNumber(125_000_000)).toBe('125M')
  })

  it('formats billions with a B suffix', () => {
    expect(formatNumber(1_000_000_000)).toBe('1B')
    expect(formatNumber(4_200_000_000)).toBe('4.2B')
  })

  it('preserves the sign on negative numbers', () => {
    expect(formatNumber(-142)).toBe('-142')
    expect(formatNumber(-1500)).toBe('-1.5K')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/formatNumber.test.ts`
Expected: FAIL — `Failed to resolve import "./formatNumber"` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/formatNumber.ts`:

```ts
// K/M/B-suffix number formatting (e.g. 1500 -> "1.5K", 2_340_000 -> "2.34M"). Below 1,000,
// falls back to a plain locale-formatted integer — unchanged from how these values displayed
// before this formatter existed. Decimal precision narrows as the scaled value grows (2 decimals
// under 10, 1 under 100, 0 at 100+) so the string never gets longer than ~5-6 characters.
const SUFFIXES: [number, string][] = [
  [1_000_000_000, 'B'],
  [1_000_000, 'M'],
  [1_000, 'K'],
]

export function formatNumber(value: number): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)

  for (const [threshold, suffix] of SUFFIXES) {
    if (abs < threshold) continue
    const scaled = abs / threshold
    const decimals = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2
    const formatted = decimals === 0
      ? scaled.toFixed(0)
      : scaled.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '')
    return `${sign}${formatted}${suffix}`
  }
  return `${sign}${abs.toLocaleString()}`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/formatNumber.test.ts`
Expected: PASS (all 6 tests).

- [ ] **Step 5: Apply it to `CoinDisplay`**

In `src/components/atoms/CoinDisplay.tsx`, add the import:

```ts
import { formatNumber } from '@/lib/formatNumber'
```

Change line 27 from:
```tsx
      }}>{amount.toLocaleString()}</span>
```
to:
```tsx
      }}>{formatNumber(amount)}</span>
```

Nothing else in the file changes.

- [ ] **Step 6: Apply it to `CharacterCard`'s XP readout**

In `src/components/organisms/CharacterCard.tsx`, add the import alongside the existing ones
(e.g. near the `@/lib/proficiencies` import, same `@/` alias style already used in this file):

```ts
import { formatNumber } from '@/lib/formatNumber'
```

Change:
```tsx
              <span style={{ color: 'var(--color-text-primary)', fontSize: '10px', fontWeight: 'bold' }}>{xpCurrent} / {xpNeeded}</span>
```
to:
```tsx
              <span style={{ color: 'var(--color-text-primary)', fontSize: '10px', fontWeight: 'bold' }}>{formatNumber(xpCurrent)} / {formatNumber(xpNeeded)}</span>
```

Nothing else in the file changes.

- [ ] **Step 7: Verify the whole suite and a real build**

Run: `npm run lint && npm run build && npx vitest run --exclude ".superpowers/**" --exclude "node_modules/**"`
Expected: all clean, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/formatNumber.ts src/lib/formatNumber.test.ts src/components/atoms/CoinDisplay.tsx src/components/organisms/CharacterCard.tsx
git commit -m "feat: add K/M/B number formatting to the wallet and XP displays"
```
