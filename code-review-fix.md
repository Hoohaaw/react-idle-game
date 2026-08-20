# Code Review Findings — feature/wire-inventory-upgrading

Generated: 2026-07-10. Branch: `feature/wire-inventory-upgrading`.

---

## 1. cascade/computeOps key mismatch — DATA CORRUPTION

**Location:** `src/lib/upgrade.ts:7` + `src/pages/UpgradingPage.tsx:27`

**Issue:** `cascade()` keys stacks by `name::rarity`; `computeOps` keys by `itemDefId + rarity`. If two Sanity item defs resolve to the same display name (or both have undefined names falling back to the raw itemDefId string), cascade conflates their stacks into one bucket and computeOps diffs against the wrong combined quantity — sending a consumeCount the server rejects, or over-consuming from one def.

**Fix:** Change `cascade()` to key by `itemDefId::rarity` when `itemDefId` is present (fall back to `name::rarity` only for items without one). Or add a pre-flight assert in `computeOps` that all input items have unique `itemDefId` values.

---

## 2. No per-element validation in Edge Function — SECURITY/CORRECTNESS

**Location:** `supabase/functions/item-upgrade/index.ts:39`

**Issue:** After the `Array.isArray(body.ops) && body.ops.length > 0` check, elements are immediately cast and mapped with no per-element property validation. A client sending `{ ops: [{}] }` passes the check and the map produces `{ item_def_id: undefined, from_rarity: undefined, consume_count: NaN }` which reaches the RPC, causing a raw Postgres error that leaks internal table/column names.

**Fix:** Add per-element validation before the `.map()`:
```ts
for (const op of body.ops as unknown[]) {
  if (
    typeof (op as any)?.itemDefId !== 'string' ||
    typeof (op as any)?.fromRarity !== 'string' ||
    typeof (op as any)?.consumeCount !== 'number' ||
    !Number.isInteger((op as any).consumeCount)
  ) return json({ error: 'Invalid op shape' }, 400)
}
```

---

## 3. No upper bound on consumeCount in RPC — ECONOMIC EXPLOIT

**Location:** `supabase/migrations/20260709000000_upgrade_items_rpc.sql:56`

**Issue:** RPC validates `v_consume % 5 == 0` and `v_have >= v_consume` but places no ceiling. A player bypassing the UI can call the Edge Function directly with e.g. `consumeCount=500`, converting their entire stack in one atomic request. Depending on economy tuning this can be a meaningful exploit.

**Fix:** Add a max per-op cap in the RPC (e.g. `v_consume > 500`) or validate `consumeCount <= UPGRADE_COST` (i.e. = 5) for single-op upgrades and limit batch size on the Edge Function side.

---

## 4. Modal stuck open when ops is empty — UX BUG

**Location:** `src/pages/UpgradingPage.tsx:103` (upgradeMax) and `:108` (upgradeAll)

**Issue:** Both functions guard on `if (ops.length)` before calling `mutate`. If `computeOps` returns `[]` (race: inventory changed between render and click, or item already at max), `mutate` is never called, `onSuccess` never fires, and `setTarget(null)` / `setBulkOpen(false)` are never called. The modal stays open permanently with no explanation; user must click Cancel.

**Fix:** Add an else branch that closes the modal:
```ts
const upgradeMax = (stack: Item) => {
  const ops = computeOps(inventory, cascade(inventory, [stack.name]))
  if (ops.length) upgrade.mutate(ops, { onSuccess: () => setTarget(null) })
  else setTarget(null)
}

const upgradeAll = () => {
  const ops = computeOps(inventory, cascade(inventory))
  if (ops.length) upgrade.mutate(ops, { onSuccess: () => setBulkOpen(false) })
  else setBulkOpen(false)
}
```

---

## 5. Double-mutate on stale inventory snapshot — DATA CONSISTENCY

**Location:** `src/pages/UpgradingPage.tsx:101`

**Issue:** `upgradeMax` captures the `inventory` useMemo value at render time. If the user clicks Upgrade to Max twice before `onSuccess` fires and the query re-fetches, the second call uses the same pre-upgrade snapshot and sends the same ops again. The RPC either rejects (insufficient quantity) or double-consumes.

**Fix:** Disable the Upgrade to Max button while `isPending` (same pattern already used on tiles for tile-click). The `UpgradeModal` already passes `isPending` — wire `disabled={isPending}` to the "Upgrade to Max" `SecondaryButton` in `UpgradingModals.tsx`.

---

## 6. upgrade.error hidden behind open BulkUpgradeModal — UX BUG

**Location:** `src/pages/UpgradingPage.tsx:136` + `src/pages/UpgradingModals.tsx` BulkUpgradeModal

**Issue:** `upgrade.error` is rendered in the page body. When `upgradeAll` fails, `setBulkOpen(false)` is not called (only fires in `onSuccess`), so the modal stays open. The error message renders in the page body behind the modal overlay — invisible to the user. The modal shows no error and has a still-enabled Cancel button.

**Fix:** Pass `error={upgrade.error}` into `BulkUpgradeModal` and render it inside the modal body. Or close the modal on error too (`onError: () => setBulkOpen(false)`) and let the page-level error render.

---

## 7. changedItems recomputes cascade() on every render — EFFICIENCY

**Location:** `src/pages/UpgradingPage.tsx:188`

**Issue:** `changes={bulkOpen ? changedItems(inventory) : []}` is called inline in JSX. While `bulkOpen` is true, any re-render (e.g. `isPending` flipping during mutation) recomputes the full cascade for the entire inventory from scratch.

**Fix:**
```ts
const bulkChanges = useMemo(
  () => (bulkOpen ? changedItems(inventory) : []),
  [bulkOpen, inventory]
)
```

---

## 8. Relative imports instead of @/ alias — CONVENTIONS

**Location:** `src/pages/UpgradingModals.tsx:1–5`

**Issue:** All imports use `../` relative paths for code outside the current folder. CLAUDE.md rule: *"Use the @/ alias for anything outside the current folder."* When this file is migrated into `src/features/upgrading/`, every import silently breaks; @/ paths survive unchanged.

**Fix:** Replace:
```ts
import { RarityBadge } from '../components/atoms/RarityBadge'
import { Modal } from '../components/organisms/Modal'
import { PrimaryButton, SecondaryButton } from '../components/atoms/Button'
import { RARITY_ORDER, nextRarity } from '../lib/rarity'
import { UPGRADE_COST } from '../lib/upgrade'
```
With:
```ts
import { RarityBadge } from '@/components/atoms/RarityBadge'
import { Modal } from '@/components/organisms/Modal'
import { PrimaryButton, SecondaryButton } from '@/components/atoms/Button'
import { RARITY_ORDER, nextRarity } from '@/lib/rarity'
import { UPGRADE_COST } from '@/lib/upgrade'
```
