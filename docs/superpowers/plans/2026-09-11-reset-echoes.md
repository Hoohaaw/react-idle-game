# Reset & the Echo Shop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ADR-0023's soft **Reset** tier end to end: a player can wipe current-run
progress for **Echoes**, spend Echoes forever in a code-registry **Echo Shop** (mission speed,
gold gain, per-resource gather rate + loot gain), and retire the old flat
`transcendenceCount × 10%` reward bonus that was never really "transcendence."

**Architecture:** One migration (renamed/new `profiles` columns + two `SECURITY DEFINER` RPCs),
one code registry (`src/lib/echoShop.ts`, not Sanity — mechanical/account-wide, ADR-0004), two
new Edge Functions mirroring the existing `*-start`/`respec`-style shape, five existing Edge
Functions gain a small, precise edit each to read `echo_shop` and apply its bonuses, and a new
`src/features/reset/` page built as a tab shell so a future Transcendence tier is additive.

**Tech Stack:** React 19 + TypeScript strict, TanStack Query, Supabase (Postgres + Deno Edge
Functions), Sanity (one read: the order-1 map's key/name), Vitest.

**Spec:** [`docs/superpowers/specs/2026-09-11-reset-echoes-design.md`](../specs/2026-09-11-reset-echoes-design.md) — the binding authority; this plan argues from it.

## Global Constraints

- **`echoes` and `echo_shop` are separate `profiles` columns, never keys inside `currencies`.**
  `reset_player` wipes `currencies` wholesale (`'{}'::jsonb`) — if Echoes lived inside that map,
  the reward a reset just earned would be wiped in the same statement. This is non-negotiable
  (spec §4a).
- **What `reset_player` wipes:** `currencies` → `{}`, `resources` → `{}`, `map_progress` → `{}`,
  `infirmary_level` → `1`, every `group_runs` row for the player → deleted. **What it credits/
  increments:** `echoes` (+= the formula's result), `reset_count` (+= 1). **What it never
  touches:** `player_characters` (all columns), `lifetime_stats`, `unlocked_characters`,
  `echo_shop` (spec §4a self-review catches).
- **Formula (provisional constants, spec §5b):**
  `echoesAwarded = floor(totalStagesCleared × 10) + floor(sqrt(lifetimeGoldEarned) × 2)`.
- **Gate:** Reset requires `map_progress[<order-1 map's key>] >= 7` — content-driven via Sanity
  `mapDef.order`, not a hardcoded map key.
- **Busy check:** `reset_player` raises unless the player has zero rows across `mission_runs`,
  `gather_assignments` (joined through `player_characters`), `group_runs` (party non-empty),
  `infirmary_admissions` (joined through `player_characters`), and `craft_runs`.
- **Echo Shop is a code registry** (`src/lib/echoShop.ts`), not Sanity content — mechanical,
  account-wide multipliers, ADR-0004's registry pattern (like `statDefinitions.ts`/
  `currencies.ts`), not narrative content.
- **20 nodes this wave:** `missionSpeed`, `goldGain`, and `gatherRate.<R>` / `resourceGain.<R>`
  for each of Wood/Copper/Stone/Coal/Iron/Silver/Bronze/Gold/Platinum (`RESOURCE_SOURCE` in
  `src/lib/resources.ts`). **Character-power nodes are explicitly out of scope** — reserved for
  a future Transcendence tier.
- **`missionSpeed` only shortens a FIXED-duration activity** (`mission-start`, `group-start-stage`
  — both set an `ends_at`). **`gather-start` is never touched** — gathering is continuous accrual
  with no duration to shorten; its speed lane is `gatherRate` at collect time only (spec §5d,
  corrected after reading `gather-start/index.ts` — the original spec draft was wrong here).
- **Echo Shop bonuses apply AFTER `finalReward()`, never folded into `RewardModifiers`** —
  `goldGain`/`resourceGain` aren't uniform across coins/resources/XP the way margin/level/party
  are (spec §5d).
- Every SQL function: `security definer`, `set search_path = public, pg_temp`,
  `revoke all ... from public, anon, authenticated`, `grant execute ... to service_role`. No new
  tables in this plan (only new/renamed columns on the existing `profiles` table), so no new RLS
  policy/grant is needed — `src/test/migration-policy.test.ts` enforces the function pairs
  automatically.
- `npm run lint`, `npm run build`, and `npx vitest run` pass before every commit (repo CLAUDE.md).
  The pre-commit hook runs lint.
- Commits end with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

### Task 1: Migration — `profiles` columns + `reset_player` + `purchase_echo_shop_node`

**Files:**
- Create: `supabase/migrations/20260911100000_reset_echoes.sql`

**Interfaces:**
- Produces: columns `profiles.reset_count` (renamed from `transcendence_count`),
  `profiles.echoes integer`, `profiles.echo_shop jsonb`; RPC
  `reset_player(p_player uuid, p_total_stages integer, p_lifetime_gold numeric) returns jsonb` →
  `{ "echoesAwarded": <int> }`; RPC
  `purchase_echo_shop_node(p_player uuid, p_node_key text, p_cost integer) returns jsonb` →
  `{ "echoShop": <jsonb> }`.

- [ ] **Step 1: Write the migration**

```sql
-- Reset (ADR-0053, the soft-reset half of ADR-0023's two-tier prestige split) — profiles.
-- transcendence_count is renamed reset_count (the OLD single-tier design this column tracked is
-- what ADR-0023 called "Reset"; the harder full-wipe "Transcendence" tier is a separate future
-- spec, not this one — see docs/superpowers/specs/2026-09-11-reset-echoes-design.md).
--
-- echoes is a DEDICATED column, deliberately not a key inside `currencies` — reset_player wipes
-- currencies wholesale as part of the reset; if Echoes lived inside that same map, the very
-- reward a reset just earned would be wiped in the same statement. echo_shop is also its own
-- column: { "<nodeKey>": <levelPurchased> }, a missing key = level 0, and reset_player never
-- touches it — that permanence is the whole point (spec §4a).

alter table public.profiles rename column transcendence_count to reset_count;

alter table public.profiles
  add column echoes    integer not null default 0 check (echoes >= 0);
alter table public.profiles
  add column echo_shop jsonb   not null default '{}'::jsonb;

comment on column public.profiles.reset_count is
  'How many times the player has done a soft Reset (ADR-0053). Display/achievement counter only — no reward multiplier reads it (the old flat transcendenceCount x 10% bonus is retired in favor of the Echo Shop''s explicit bonuses).';
comment on column public.profiles.echoes is
  'Spendable currency earned by resetting (ADR-0053). Separate from `currencies` on purpose — see the table-level note above. Written only by reset_player / purchase_echo_shop_node (service role).';
comment on column public.profiles.echo_shop is
  '{ "<nodeKey>": <levelPurchased> } — permanent, never wiped by a reset. nodeKey matches src/lib/echoShop.ts''s ECHO_SHOP_NODES registry. Written only by purchase_echo_shop_node (service role).';

-- ---------------------------------------------------------------------------------------------
-- reset_player: the soft-reset action. Busy-checked across every activity table this codebase
-- has (mission/gather/group/infirmary/craft); gated on the order-1 map's boss being cleared
-- (checked by the calling Edge Function, not here — a UX gate, not a security boundary, same
-- split as every other *-start function in this codebase). p_total_stages and p_lifetime_gold
-- are computed by the Edge Function from the player's OWN profile row (map_progress summed,
-- lifetime_stats.goldEarned) — this function only does the atomic wipe + award.
-- ---------------------------------------------------------------------------------------------
create or replace function public.reset_player(
  p_player        uuid,
  p_total_stages  integer,
  p_lifetime_gold numeric
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_awarded integer;
begin
  if exists (select 1 from public.mission_runs where player_id = p_player)
    or exists (
      select 1 from public.gather_assignments ga
        join public.player_characters pc on pc.id = ga.player_character_id
       where pc.player_id = p_player
    )
    or exists (select 1 from public.group_runs where player_id = p_player and cardinality(party) > 0)
    or exists (
      select 1 from public.infirmary_admissions ia
        join public.player_characters pc on pc.id = ia.player_character_id
       where pc.player_id = p_player
    )
    or exists (select 1 from public.craft_runs where player_id = p_player)
  then
    raise exception 'reset_player: a character is busy';
  end if;

  -- STAGE_RATE=10, GOLD_RATE=2 — first-pass provisional constants (spec §3's non-goal on
  -- tuning), same treatment as combat.ts's COMBAT block: shape is final, numbers are tuned
  -- later against real playtest data via a calc-script pass.
  v_awarded := floor(coalesce(p_total_stages, 0) * 10) + floor(sqrt(greatest(coalesce(p_lifetime_gold, 0), 0)) * 2);

  update public.profiles
     set currencies      = '{}'::jsonb,
         resources       = '{}'::jsonb,
         map_progress    = '{}'::jsonb,
         infirmary_level = 1,
         echoes          = echoes + v_awarded,
         reset_count     = reset_count + 1
   where player_id = p_player;

  delete from public.group_runs where player_id = p_player;

  return jsonb_build_object('echoesAwarded', v_awarded);
end;
$$;

revoke all on function public.reset_player(uuid, integer, numeric) from public, anon, authenticated;
grant execute on function public.reset_player(uuid, integer, numeric) to service_role;

-- ---------------------------------------------------------------------------------------------
-- purchase_echo_shop_node: buy the next level of one Echo Shop node. p_cost is resolved
-- authoritatively by the calling Edge Function from the CODE registry (src/lib/echoShop.ts) —
-- no Sanity round-trip, the shop is mechanical content, not authored (ADR-0004/ADR-0003). This
-- function locks the row, verifies the balance, and applies both writes atomically.
-- ---------------------------------------------------------------------------------------------
create or replace function public.purchase_echo_shop_node(
  p_player   uuid,
  p_node_key text,
  p_cost     integer
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_echoes integer;
  v_shop   jsonb;
begin
  if p_node_key is null or length(p_node_key) = 0 then
    raise exception 'purchase_echo_shop_node: node key required';
  end if;
  if p_cost is null or p_cost < 0 then
    raise exception 'purchase_echo_shop_node: invalid cost';
  end if;

  select echoes into v_echoes
    from public.profiles where player_id = p_player for update;
  if coalesce(v_echoes, 0) < p_cost then
    raise exception 'purchase_echo_shop_node: insufficient echoes (have %, need %)', coalesce(v_echoes, 0), p_cost;
  end if;

  update public.profiles
     set echoes = echoes - p_cost,
         echo_shop = jsonb_set(echo_shop, array[p_node_key], to_jsonb(coalesce((echo_shop->>p_node_key)::int, 0) + 1))
   where player_id = p_player
   returning echo_shop into v_shop;

  return jsonb_build_object('echoShop', v_shop);
end;
$$;

revoke all on function public.purchase_echo_shop_node(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.purchase_echo_shop_node(uuid, text, integer) to service_role;
```

- [ ] **Step 2: Verify no BOM**

Run: `head -c 3 supabase/migrations/20260911100000_reset_echoes.sql | od -c`
Expected: first bytes are `-` `-` ` ` (not a BOM sequence).

- [ ] **Step 3: Verify against the migration policy test**

There is no local Supabase stack in every environment; if one is available
(`docker exec -i supabase_db_the-idle-game psql ...` or similar), apply this file and confirm no
errors. Regardless, run: `npx vitest run src/test/migration-policy.test.ts` — this repo-wide
static test scans every file in `supabase/migrations/` for the required RLS/grant/revoke pairs
and will fail by name if this migration's `revoke`/`grant` lines are missing or malformed.
Expected: PASS (5 tests, unaffected by this migration since it adds no new table).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260911100000_reset_echoes.sql
git commit -m "feat: add reset_player/purchase_echo_shop_node RPCs and profiles columns"
```

---

### Task 2: Hand-patch `database.types.ts`

**Files:**
- Modify: `src/types/database.types.ts:201-236` (the `profiles` table entry)

**Interfaces:**
- Produces: `Tables<'profiles'>.Row/Insert/Update` gain `echoes: number`, `echo_shop: Json`, and
  `transcendence_count` is renamed to `reset_count` throughout.

- [ ] **Step 1: Apply the rename + additions**

In `src/types/database.types.ts`, the `profiles` table's `Row`, `Insert`, and `Update` blocks each
currently have a `transcendence_count: number` (or `transcendence_count?: number`) line. In ALL
THREE blocks:
1. Rename `transcendence_count` to `reset_count` (keep the same optionality — `Row` has no `?`,
   `Insert`/`Update` do).
2. Add two new lines, alphabetically placed (`echo_shop` before `echoes`... no — alphabetically
   `echo_shop` < `echoes` is false since `_` (0x5F) sorts after lowercase letters in ASCII, so
   `echoes` < `echo_shop`; place `echoes` first, then `echo_shop`, both right after `currencies`):

```typescript
          currencies: Json
          echo_shop: Json
          echoes: number
```

(`Insert`/`Update` versions get `echo_shop?: Json` and `echoes?: number` — optional, matching
every other column's style in those two blocks.)

The full `Row` block after this change:

```typescript
        Row: {
          created_at: string
          currencies: Json
          echo_shop: Json
          echoes: number
          infirmary_level: number
          lifetime_stats: Json
          map_progress: Json
          player_id: string
          reset_count: number
          resources: Json
          unlocked_characters: Json
        }
```

Apply the equivalent renames/additions to `Insert` and `Update` (both use `?` on every field
already, including the renamed `reset_count?: number`).

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/types/database.types.ts
git commit -m "chore: hand-patch database.types.ts for reset_count/echoes/echo_shop"
```

---

### Task 3: `src/lib/echoShop.ts` — the Echo Shop registry

**Files:**
- Create: `src/lib/echoShop.ts`
- Create: `src/lib/echoShop.test.ts`

**Interfaces:**
- Consumes: `RESOURCE_SOURCE` from `./resources.ts` (`Record<string, { tier: string; from: string }>` — only its keys are used).
- Produces:
  - `type ShopEffectKind = 'missionSpeed' | 'goldGain' | 'gatherRate' | 'resourceGain'`
  - `type ShopNode = { key: string; label: string; description: string; effect: { kind: ShopEffectKind; resource?: string }; costBase: number; costGrowth: number }`
  - `ECHO_SHOP_NODES: Record<string, ShopNode>` (20 entries)
  - `nodeCost(node: ShopNode, currentLevel: number): number`
  - `resolveShopBonus(shop: Record<string, number>, kind: ShopEffectKind, resource?: string): number`
  - `effectPercent(kind: ShopEffectKind, level: number): number`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/echoShop.test.ts
import { describe, it, expect } from 'vitest'
import { ECHO_SHOP_NODES, nodeCost, resolveShopBonus, effectPercent } from './echoShop'

describe('ECHO_SHOP_NODES', () => {
  it('has exactly 20 nodes: missionSpeed, goldGain, and 9 resources x 2 lanes', () => {
    expect(Object.keys(ECHO_SHOP_NODES)).toHaveLength(20)
    expect(ECHO_SHOP_NODES.missionSpeed).toBeDefined()
    expect(ECHO_SHOP_NODES.goldGain).toBeDefined()
    expect(ECHO_SHOP_NODES['gatherRate.Iron']).toBeDefined()
    expect(ECHO_SHOP_NODES['resourceGain.Platinum']).toBeDefined()
  })

  it('per-resource nodes carry the resource on their effect', () => {
    expect(ECHO_SHOP_NODES['gatherRate.Wood'].effect).toEqual({ kind: 'gatherRate', resource: 'Wood' })
    expect(ECHO_SHOP_NODES['resourceGain.Coal'].effect).toEqual({ kind: 'resourceGain', resource: 'Coal' })
  })

  it('flat nodes carry no resource', () => {
    expect(ECHO_SHOP_NODES.missionSpeed.effect).toEqual({ kind: 'missionSpeed' })
    expect(ECHO_SHOP_NODES.goldGain.effect).toEqual({ kind: 'goldGain' })
  })
})

describe('nodeCost', () => {
  it('grows by costGrowth per level, floored', () => {
    const node = ECHO_SHOP_NODES.missionSpeed // costBase 20, costGrowth 1.15
    expect(nodeCost(node, 0)).toBe(20)
    expect(nodeCost(node, 1)).toBe(23) // floor(20 * 1.15)
    expect(nodeCost(node, 5)).toBe(40) // floor(20 * 1.15^5) = floor(40.227...)
  })
})

describe('resolveShopBonus', () => {
  it('is 1 (no bonus) with an empty shop', () => {
    expect(resolveShopBonus({}, 'missionSpeed')).toBe(1)
    expect(resolveShopBonus({}, 'gatherRate', 'Iron')).toBe(1)
  })

  it('scales with level for a flat node', () => {
    expect(resolveShopBonus({ missionSpeed: 3 }, 'missionSpeed')).toBeCloseTo(1.06) // +2%/level
  })

  it('scales with level for a per-resource node, scoped to that resource only', () => {
    const shop = { 'gatherRate.Iron': 2 }
    expect(resolveShopBonus(shop, 'gatherRate', 'Iron')).toBeCloseTo(1.06) // +3%/level
    expect(resolveShopBonus(shop, 'gatherRate', 'Wood')).toBe(1) // untouched
  })

  it('goldGain and resourceGain are independent', () => {
    const shop = { goldGain: 1, 'resourceGain.Gold': 2 }
    expect(resolveShopBonus(shop, 'goldGain')).toBeCloseTo(1.02)
    expect(resolveShopBonus(shop, 'resourceGain', 'Gold')).toBeCloseTo(1.06)
  })
})

describe('effectPercent', () => {
  it('returns the percent bonus at a given level', () => {
    expect(effectPercent('missionSpeed', 0)).toBe(0)
    expect(effectPercent('missionSpeed', 5)).toBe(10) // 5 * 2%
    expect(effectPercent('gatherRate', 4)).toBe(12) // 4 * 3%
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/echoShop.test.ts`
Expected: FAIL with "Cannot find module './echoShop'".

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/echoShop.ts
// The Echo Shop registry (ADR-0053) — permanent, repeatable-purchase upgrades bought with
// Echoes (earned by Resetting, spec's data model). A CODE registry, not Sanity content: these
// are mechanical, account-wide multipliers, the same category as statDefinitions.ts/
// currencies.ts (ADR-0004), not narrative per-character content. Character-power nodes are
// explicitly reserved for a future Transcendence tier — this shop is economy/logistics only.

import { RESOURCE_SOURCE } from './resources'

export type ShopEffectKind = 'missionSpeed' | 'goldGain' | 'gatherRate' | 'resourceGain'

export type ShopNode = {
  key: string
  label: string
  description: string
  /** `resource` is set only for the per-resource kinds (gatherRate/resourceGain). */
  effect: { kind: ShopEffectKind; resource?: string }
  costBase: number
  costGrowth: number
}

/** +%/level for each effect kind. Provisional first-pass values (spec §3's non-goal on tuning),
 *  same treatment as combat.ts's COMBAT block — shape is final, numbers are tuned later. */
const PER_LEVEL_BONUS: Record<ShopEffectKind, number> = {
  missionSpeed: 0.02,
  goldGain: 0.02,
  gatherRate: 0.03,
  resourceGain: 0.03,
}

const FLAT_NODES: Record<string, ShopNode> = {
  missionSpeed: {
    key: 'missionSpeed',
    label: 'Mission Speed',
    description: 'Missions and dungeon/raid stages take less real-world time to finish.',
    effect: { kind: 'missionSpeed' },
    costBase: 20,
    costGrowth: 1.15,
  },
  goldGain: {
    key: 'goldGain',
    label: 'Gold Gain',
    description: 'More gold from every mission and dungeon/raid win.',
    effect: { kind: 'goldGain' },
    costBase: 20,
    costGrowth: 1.15,
  },
}

// Derived from RESOURCE_SOURCE's keys (src/lib/resources.ts) — a future 10th resource
// automatically gets both shop lanes with zero registry edits (ADR-0004's registry-driven
// promise extends to resource growth, not just adding an unrelated new node).
const RESOURCE_NODES: Record<string, ShopNode> = Object.fromEntries(
  Object.keys(RESOURCE_SOURCE).flatMap((resource) => [
    [
      `gatherRate.${resource}`,
      {
        key: `gatherRate.${resource}`,
        label: `${resource} Gather Rate`,
        description: `Gather ${resource} faster at the mines.`,
        effect: { kind: 'gatherRate' as const, resource },
        costBase: 15,
        costGrowth: 1.12,
      },
    ],
    [
      `resourceGain.${resource}`,
      {
        key: `resourceGain.${resource}`,
        label: `${resource} Gain`,
        description: `More ${resource} from mission and dungeon/raid loot.`,
        effect: { kind: 'resourceGain' as const, resource },
        costBase: 15,
        costGrowth: 1.12,
      },
    ],
  ]),
)

export const ECHO_SHOP_NODES: Record<string, ShopNode> = { ...FLAT_NODES, ...RESOURCE_NODES }

/** Cost to buy the NEXT level (i.e. going from `currentLevel` to `currentLevel + 1`). */
export function nodeCost(node: ShopNode, currentLevel: number): number {
  return Math.floor(node.costBase * node.costGrowth ** currentLevel)
}

/** Total multiplier from the player's current level of one effect (+ the matching resource for
 *  the per-resource kinds). A missing key in `shop` is level 0 → multiplier 1 (no bonus). */
export function resolveShopBonus(shop: Record<string, number>, kind: ShopEffectKind, resource?: string): number {
  const key = resource ? `${kind}.${resource}` : kind
  const level = shop[key] ?? 0
  return 1 + level * PER_LEVEL_BONUS[kind]
}

/** Display helper: the bonus percent at a given level (e.g. level 5 missionSpeed → 10). */
export function effectPercent(kind: ShopEffectKind, level: number): number {
  return level * PER_LEVEL_BONUS[kind] * 100
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/echoShop.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/echoShop.ts src/lib/echoShop.test.ts
git commit -m "feat: add the Echo Shop registry (src/lib/echoShop.ts)"
```

---

### Task 4: `src/lib/reset.ts` — the reset formula + gate

**Files:**
- Create: `src/lib/reset.ts`
- Create: `src/lib/reset.test.ts`

**Interfaces:**
- Produces:
  - `RESET_GATE_STAGE = 7`
  - `sumStagesCleared(mapProgress: Record<string, number>): number`
  - `isResetGateMet(gateStageCleared: number): boolean`
  - `computeEchoesAward(totalStagesCleared: number, lifetimeGoldEarned: number): number`

This module mirrors the SQL formula in `reset_player` (Task 1) in TypeScript so the client can
show a live preview before the player commits — the RPC remains the authoritative calculation
(server-side, in SQL); this is a parallel, tested implementation of the same shape, not a shared
import (Postgres can't import TypeScript).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/reset.test.ts
import { describe, it, expect } from 'vitest'
import { RESET_GATE_STAGE, sumStagesCleared, isResetGateMet, computeEchoesAward } from './reset'

describe('sumStagesCleared', () => {
  it('sums every map\'s highest stage cleared', () => {
    expect(sumStagesCleared({ gravemarch: 7, embercrag: 3 })).toBe(10)
  })
  it('is 0 for an empty map_progress', () => {
    expect(sumStagesCleared({})).toBe(0)
  })
})

describe('isResetGateMet', () => {
  it('requires at least RESET_GATE_STAGE (7)', () => {
    expect(isResetGateMet(6)).toBe(false)
    expect(isResetGateMet(7)).toBe(true)
    expect(isResetGateMet(8)).toBe(true)
    expect(RESET_GATE_STAGE).toBe(7)
  })
})

describe('computeEchoesAward', () => {
  it('matches the SQL formula: floor(stages * 10) + floor(sqrt(gold) * 2)', () => {
    expect(computeEchoesAward(7, 500)).toBe(70 + 44) // floor(sqrt(500)*2) = floor(44.72...) = 44
    expect(computeEchoesAward(21, 5000)).toBe(210 + 141) // floor(sqrt(5000)*2) = floor(141.42...) = 141
  })
  it('is 0 for a fresh account (no stages, no gold)', () => {
    expect(computeEchoesAward(0, 0)).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/reset.test.ts`
Expected: FAIL with "Cannot find module './reset'".

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/reset.ts
// The soft-Reset formula and gate (ADR-0053), mirroring reset_player's SQL exactly (see
// supabase/migrations/20260911100000_reset_echoes.sql) so the client can preview a reset before
// committing to it. The RPC is the authoritative calculation; this is a tested parallel
// implementation, not a shared import (Postgres can't import TypeScript).

/** Stages cleared on the order-1 map (Sanity mapDef.order) required before a Reset is allowed. */
export const RESET_GATE_STAGE = 7

/** Total world-content progress across every map — breadth + depth, not just one map. */
export function sumStagesCleared(mapProgress: Record<string, number>): number {
  return Object.values(mapProgress).reduce((sum, stage) => sum + stage, 0)
}

export function isResetGateMet(gateStageCleared: number): boolean {
  return gateStageCleared >= RESET_GATE_STAGE
}

// STAGE_RATE=10, GOLD_RATE=2 — first-pass provisional constants, same treatment as combat.ts's
// COMBAT block: shape is final, numbers are tuned later against real playtest data.
const STAGE_RATE = 10
const GOLD_RATE = 2

/** sqrt on the gold term deliberately flattens it — gold accumulates unbounded over a long run
 *  and would otherwise dwarf the stage term, defeating "a combination of both" (spec §5b). */
export function computeEchoesAward(totalStagesCleared: number, lifetimeGoldEarned: number): number {
  return Math.floor(totalStagesCleared * STAGE_RATE) + Math.floor(Math.sqrt(Math.max(0, lifetimeGoldEarned)) * GOLD_RATE)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/reset.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reset.ts src/lib/reset.test.ts
git commit -m "feat: add src/lib/reset.ts (the reset formula and gate)"
```

---

### Task 5: Retire `RewardModifiers.transcendenceBonus`

**Files:**
- Modify: `src/lib/stats.ts:275-298`
- Modify: `src/lib/stats.test.ts:197-205`

**Interfaces:**
- Produces: `RewardModifiers = { marginBonus?: number; levelBonus?: number; partyBonus?: number }`
  (three fields, `transcendenceBonus` removed) and `finalReward(base, mods)` computing the
  three-term product.

- [ ] **Step 1: Update the failing test first**

In `src/lib/stats.test.ts`, replace the `finalReward` describe block:

```typescript
describe('finalReward', () => {
  it('multiplies the base by each (1 + modifier) — margin × level × party', () => {
    const out = finalReward(100, { marginBonus: 0.15, levelBonus: 0.2, partyBonus: 0.2 })
    expect(out).toBeCloseTo(100 * 1.15 * 1.2 * 1.2)
  })

  it('treats missing modifiers as 0 (no change)', () => {
    expect(finalReward(100)).toBe(100)
    expect(finalReward(100, { marginBonus: 0.5 })).toBe(150)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/stats.test.ts -t finalReward`
Expected: FAIL — `out` still includes the old `transcendenceBonus` multiplication (the test now
expects a 3-term product, the current implementation still does 4).

- [ ] **Step 3: Update `src/lib/stats.ts`**

Replace:

```typescript
export type RewardModifiers = {
  marginBonus?: number
  levelBonus?: number
  partyBonus?: number
  transcendenceBonus?: number
}

/**
 * The reward pipeline (ADR-0012/0014), applied on a WIN only:
 *
 *   final = base × (1 + marginBonus) × (1 + levelBonus) × (1 + partyBonus) × (1 + transcendenceBonus)
 *
 * Each modifier is an INDEPENDENT multiplier (not summed into one pool). `marginBonus` (combat
 * decisiveness) and `levelBonus` (avg party level) come from the combat result via the helpers in
 * `combat.ts`; party-size and transcendence are their systems' tuning numbers. Returns a raw number;
 * callers round for the specific reward type (coins/resources/XP are integers).
 */
export function finalReward(base: number, mods: RewardModifiers = {}): number {
  const margin = 1 + (mods.marginBonus ?? 0)
  const level = 1 + (mods.levelBonus ?? 0)
  const party = 1 + (mods.partyBonus ?? 0)
  const transcendence = 1 + (mods.transcendenceBonus ?? 0)
  return base * margin * level * party * transcendence
}
```

with:

```typescript
export type RewardModifiers = {
  marginBonus?: number
  levelBonus?: number
  partyBonus?: number
}

/**
 * The reward pipeline (ADR-0012/0014), applied on a WIN only:
 *
 *   final = base × (1 + marginBonus) × (1 + levelBonus) × (1 + partyBonus)
 *
 * Each modifier is an INDEPENDENT multiplier (not summed into one pool). `marginBonus` (combat
 * decisiveness) and `levelBonus` (avg party level) come from the combat result via the helpers in
 * `combat.ts`; party-size is that system's tuning number. Echo Shop bonuses (gold gain,
 * per-resource gain, mission speed — ADR-0053) are a SEPARATE multiplier the caller applies
 * after this function returns: they aren't uniform across coins/resources/XP the way these
 * three are, so they don't belong in this shared pipeline. Returns a raw number; callers round
 * for the specific reward type (coins/resources/XP are integers).
 */
export function finalReward(base: number, mods: RewardModifiers = {}): number {
  const margin = 1 + (mods.marginBonus ?? 0)
  const level = 1 + (mods.levelBonus ?? 0)
  const party = 1 + (mods.partyBonus ?? 0)
  return base * margin * level * party
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/stats.test.ts`
Expected: PASS (all tests in the file, `finalReward`'s block included).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats.ts src/lib/stats.test.ts
git commit -m "refactor: retire RewardModifiers.transcendenceBonus"
```

---

### Task 6: `src/services/profile.ts` — expose the new fields

**Files:**
- Modify: `src/services/profile.ts` (full file rewrite — it's short)
- Modify: `src/services/profile.test.ts` (full file rewrite)

**Interfaces:**
- Produces: `PlayerProfile` gains `echoes: number`, `echoShop: Record<string, number>`,
  `lifetimeStats: Record<string, number>`; `transcendenceCount` is renamed `resetCount`.

- [ ] **Step 1: Update the failing tests first**

```typescript
// src/services/profile.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase'
import { fetchProfile } from './profile'

type Row = {
  currencies: unknown
  resources: unknown
  reset_count: number
  infirmary_level?: number
  map_progress?: unknown
  unlocked_characters?: unknown
  echoes?: number
  echo_shop?: unknown
  lifetime_stats?: unknown
}

function mockProfile(result: { data: Row | null; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const select = vi.fn().mockReturnValue({ maybeSingle })
  vi.mocked(supabase.from).mockReturnValue({ select } as unknown as ReturnType<typeof supabase.from>)
  return { select, maybeSingle }
}

describe('fetchProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps the wallet row to typed currencies/resources/echoes/echoShop/lifetimeStats/resetCount', async () => {
    mockProfile({
      data: {
        currencies: { gold: 1420 },
        resources: { Iron: 5, Wood: 30 },
        reset_count: 2,
        infirmary_level: 3,
        map_progress: { gravemarch: 4 },
        unlocked_characters: { ember_knight: '2026-08-01T00:00:00Z' },
        echoes: 380,
        echo_shop: { missionSpeed: 3, 'gatherRate.Iron': 1 },
        lifetime_stats: { goldEarned: 5000 },
      },
      error: null,
    })

    const result = await fetchProfile()

    expect(result).toEqual({
      currencies: { gold: 1420 },
      resources: { Iron: 5, Wood: 30 },
      resetCount: 2,
      infirmaryLevel: 3,
      mapProgress: { gravemarch: 4 },
      unlockedCharacters: { ember_knight: '2026-08-01T00:00:00Z' },
      echoes: 380,
      echoShop: { missionSpeed: 3, 'gatherRate.Iron': 1 },
      lifetimeStats: { goldEarned: 5000 },
    })
  })

  it('defaults to empty/zero when no row exists', async () => {
    mockProfile({ data: null, error: null })

    const result = await fetchProfile()

    expect(result).toEqual({
      currencies: {},
      resources: {},
      resetCount: 0,
      infirmaryLevel: 1,
      mapProgress: {},
      unlockedCharacters: {},
      echoes: 0,
      echoShop: {},
      lifetimeStats: {},
    })
  })

  it('throws when the query returns an error', async () => {
    const dbError = { message: 'permission denied', code: '42501' }
    mockProfile({ data: null, error: dbError })

    await expect(fetchProfile()).rejects.toEqual(dbError)
  })

  it('queries the profiles table and selects the wallet columns', async () => {
    const { select } = mockProfile({
      data: { currencies: {}, resources: {}, reset_count: 0 },
      error: null,
    })

    await fetchProfile()

    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(select).toHaveBeenCalledWith(
      'currencies, resources, reset_count, infirmary_level, map_progress, unlocked_characters, echoes, echo_shop, lifetime_stats',
    )
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/services/profile.test.ts`
Expected: FAIL — `fetchProfile` doesn't yet select/return the new fields, and still reads/returns
`transcendence_count`/`transcendenceCount`.

- [ ] **Step 3: Rewrite `src/services/profile.ts`**

```typescript
import { supabase } from '@/lib/supabase'

// The player's account wallet + scalars, read from `profiles` (RLS owner-read, SELECT-only grant).
// Balances are JSONB maps keyed by the code registries (currencies -> src/lib/currencies.ts;
// resources -> src/lib/resources.ts); an absent key means a zero balance. All WRITES happen
// server-side (Edge Functions / claim_mission) — the client only reads this (ADR-0003).

export type PlayerProfile = {
  currencies: Record<string, number>
  resources: Record<string, number>
  /** How many times the player has done a soft Reset (ADR-0053). Display-only counter. */
  resetCount: number
  infirmaryLevel: number
  /** Highest stage cleared per map, keyed by mapKey (ADR-0034). Absent key = nothing cleared. */
  mapProgress: Record<string, number>
  /** charKey -> ISO timestamp first unlocked (spec §5c). Absent key = still locked — and per the
   *  full-blind-surprise rule, the client never asks which keys are missing. */
  unlockedCharacters: Record<string, string>
  /** Spendable Echo Shop currency (ADR-0053), earned by Resetting. */
  echoes: number
  /** nodeKey -> level purchased (ADR-0053, src/lib/echoShop.ts). Never wiped by a Reset. */
  echoShop: Record<string, number>
  /** Cumulative "ever earned" ledger (docs/superpowers/specs/2026-08-20-character-acquisition-
   *  design.md) — goldEarned, missionSecondsSent, resourceGathered.<key>. Never wiped by a Reset. */
  lifetimeStats: Record<string, number>
}

export async function fetchProfile(): Promise<PlayerProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('currencies, resources, reset_count, infirmary_level, map_progress, unlocked_characters, echoes, echo_shop, lifetime_stats')
    .maybeSingle()
  if (error) throw error
  return {
    currencies: (data?.currencies ?? {}) as Record<string, number>,
    resources: (data?.resources ?? {}) as Record<string, number>,
    resetCount: data?.reset_count ?? 0,
    infirmaryLevel: data?.infirmary_level ?? 1,
    mapProgress: (data?.map_progress ?? {}) as Record<string, number>,
    unlockedCharacters: (data?.unlocked_characters ?? {}) as Record<string, string>,
    echoes: data?.echoes ?? 0,
    echoShop: (data?.echo_shop ?? {}) as Record<string, number>,
    lifetimeStats: (data?.lifetime_stats ?? {}) as Record<string, number>,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/profile.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Check for other `transcendenceCount` readers**

Run: `grep -rn "transcendenceCount" src`
Expected: no matches (this repo has no other reader of the old field name — if any turn up,
update them to `resetCount` in this same commit).

- [ ] **Step 6: Verify the full suite + build**

Run: `npm run lint && npm run build && npx vitest run`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/services/profile.ts src/services/profile.test.ts
git commit -m "feat: expose echoes/echoShop/lifetimeStats on PlayerProfile, rename transcendenceCount"
```

---

### Task 7: `src/services/reset.ts` — data layer

**Files:**
- Create: `src/services/reset.ts`
- Create: `src/services/reset.test.ts`

**Interfaces:**
- Consumes: `sanity` from `./sanity`; `supabase` from `@/lib/supabase`; `invokeError` from
  `./_invoke`.
- Produces:
  - `type GateMap = { mapKey: string; name: string }`
  - `fetchGateMap(): Promise<GateMap | null>`
  - `resetPlayer(): Promise<{ echoesAwarded: number }>`
  - `purchaseEchoShopNode(nodeKey: string): Promise<{ echoShop: Record<string, number> }>`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/services/reset.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./sanity', () => ({ sanity: { fetch: vi.fn() } }))
vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}))

import { sanity } from './sanity'
import { supabase } from '@/lib/supabase'
import { fetchGateMap, resetPlayer, purchaseEchoShopNode } from './reset'

describe('fetchGateMap', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries the order-1 mapDef and returns its key/name', async () => {
    vi.mocked(sanity.fetch).mockResolvedValue({ mapKey: 'gravemarch', name: 'Gravemarch' })

    const result = await fetchGateMap()

    expect(result).toEqual({ mapKey: 'gravemarch', name: 'Gravemarch' })
    const [query] = vi.mocked(sanity.fetch).mock.calls[0]
    expect(query).toContain('order == 1')
  })

  it('returns null when no map is authored yet', async () => {
    vi.mocked(sanity.fetch).mockResolvedValue(null)
    expect(await fetchGateMap()).toBeNull()
  })
})

describe('resetPlayer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invokes reset-player with an empty body and returns the award', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { echoesAwarded: 114 }, error: null } as never)

    const result = await resetPlayer()

    expect(supabase.functions.invoke).toHaveBeenCalledWith('reset-player', { body: {} })
    expect(result).toEqual({ echoesAwarded: 114 })
  })
})

describe('purchaseEchoShopNode', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invokes echo-shop-purchase with the node key and returns the updated shop', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { echoShop: { missionSpeed: 1 } }, error: null } as never)

    const result = await purchaseEchoShopNode('missionSpeed')

    expect(supabase.functions.invoke).toHaveBeenCalledWith('echo-shop-purchase', { body: { nodeKey: 'missionSpeed' } })
    expect(result).toEqual({ echoShop: { missionSpeed: 1 } })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/reset.test.ts`
Expected: FAIL with "Cannot find module './reset'".

- [ ] **Step 3: Write the implementation**

```typescript
// src/services/reset.ts
import { supabase } from '@/lib/supabase'
import { sanity } from './sanity'
import { invokeError } from './_invoke'

// Reset data layer (ADR-0053) — the one Sanity read (which map is "the first map," for the
// gate) plus the two Edge Function calls. Reads that don't need a network round-trip (map
// progress, lifetime gold) already come from useProfile() — see src/features/reset/hooks.ts.

export type GateMap = { mapKey: string; name: string }

const GATE_MAP_QUERY = `*[_type == "mapDef" && order == 1][0]{ mapKey, name }`

export async function fetchGateMap(): Promise<GateMap | null> {
  return sanity.fetch<GateMap | null>(GATE_MAP_QUERY)
}

export async function resetPlayer(): Promise<{ echoesAwarded: number }> {
  const { data, error } = await supabase.functions.invoke('reset-player', { body: {} })
  if (error) await invokeError(error, 'Could not reset')
  return data as { echoesAwarded: number }
}

export async function purchaseEchoShopNode(nodeKey: string): Promise<{ echoShop: Record<string, number> }> {
  const { data, error } = await supabase.functions.invoke('echo-shop-purchase', { body: { nodeKey } })
  if (error) await invokeError(error, 'Could not purchase upgrade')
  return data as { echoShop: Record<string, number> }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/reset.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/reset.ts src/services/reset.test.ts
git commit -m "feat: add src/services/reset.ts data layer"
```

---

### Task 8: `reset-player` Edge Function

**Files:**
- Create: `supabase/functions/reset-player/index.ts`

**Interfaces:**
- Consumes: `corsHeaders`/`createAdminClient`/`sanityQuery` from `../_shared/`;
  `sumStagesCleared`/`isResetGateMet` from `../../../src/lib/reset.ts`; RPC `reset_player`
  (Task 1).
- Produces: `POST /reset-player` (no body) → `{ echoesAwarded: number }` (200).

- [ ] **Step 1: Write the function**

```typescript
// supabase/functions/reset-player/index.ts
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'
import { sumStagesCleared, isResetGateMet } from '../../../src/lib/reset.ts'

// reset-player: the soft-reset action (ADR-0053). Validates the caller, checks the gate (the
// order-1 map's boss cleared) against the player's OWN profile — a UX gate, not a security
// boundary; reset_player itself doesn't re-check it (nothing bad happens if bypassed beyond
// "reset with fewer stages cleared than intended," which only costs the player who did it) —
// computes the two numbers the RPC needs (total stages cleared, lifetime gold earned) from that
// same profile row, and hands off to the atomic reset_player RPC, which owns the wipe/award and
// the busy check.

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  const admin = createAdminClient()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
  const playerId = userData.user.id

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('map_progress, lifetime_stats')
    .eq('player_id', playerId)
    .maybeSingle()
  if (profileErr) {
    console.error('reset-player: profile lookup failed', profileErr)
    return json({ error: 'Could not load profile' }, 500)
  }
  const mapProgress = (profile?.map_progress ?? {}) as Record<string, number>
  const lifetimeStats = (profile?.lifetime_stats ?? {}) as Record<string, number>

  let gateMap: { mapKey?: string } | null
  try {
    gateMap = await sanityQuery<{ mapKey?: string } | null>(
      `*[_type == "mapDef" && order == 1][0]{ mapKey }`,
    )
  } catch (e) {
    console.error('reset-player: gate map lookup failed', e)
    return json({ error: 'Could not validate reset eligibility' }, 502)
  }
  if (!gateMap?.mapKey) return json({ error: 'No starter map configured' }, 500)

  const gateStageCleared = mapProgress[gateMap.mapKey] ?? 0
  if (!isResetGateMet(gateStageCleared)) {
    return json({ error: "Clear the first map's boss before resetting" }, 403)
  }

  const totalStages = sumStagesCleared(mapProgress)
  const lifetimeGold = lifetimeStats.goldEarned ?? 0

  const { data: result, error: rpcErr } = await admin.rpc('reset_player', {
    p_player: playerId,
    p_total_stages: totalStages,
    p_lifetime_gold: lifetimeGold,
  })
  if (rpcErr) {
    console.error('reset-player: reset_player failed', rpcErr)
    const reason = rpcErr.message.replace(/^.*reset_player:\s*/, '')
    return json({ error: reason || 'Could not reset' }, 409)
  }

  return json(result, 200)
})
```

- [ ] **Step 2: Verify**

No local Deno/Supabase runtime in every environment — verify by reading: the
`admin.rpc('reset_player', {...})` object has exactly the three keys `p_player, p_total_stages,
p_lifetime_gold` matching Task 1's signature. Then run `npm run build` (this file isn't in the
`tsc` project, so this only confirms nothing here broke `src/`). State explicitly in your report
that the function was not executed.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/reset-player/index.ts
git commit -m "feat: add reset-player Edge Function"
```

---

### Task 9: `echo-shop-purchase` Edge Function

**Files:**
- Create: `supabase/functions/echo-shop-purchase/index.ts`

**Interfaces:**
- Consumes: `corsHeaders`/`createAdminClient` from `../_shared/`; `ECHO_SHOP_NODES`/`nodeCost`
  from `../../../src/lib/echoShop.ts`; RPC `purchase_echo_shop_node` (Task 1).
- Produces: `POST /echo-shop-purchase` `{ nodeKey: string }` → `{ echoShop: Record<string, number> }` (200).

- [ ] **Step 1: Write the function**

```typescript
// supabase/functions/echo-shop-purchase/index.ts
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { ECHO_SHOP_NODES, nodeCost } from '../../../src/lib/echoShop.ts'

// echo-shop-purchase: buy the next level of one Echo Shop node (ADR-0053). The cost is resolved
// authoritatively here from the CODE registry (no Sanity round-trip — the shop is mechanical
// content, not Sanity-authored) using the player's CURRENT level for that node; the client is
// never trusted for the price (ADR-0003). A concurrent purchase in another tab can make this
// read stale — the RPC still applies the level increment atomically under its own row lock
// regardless, so the level is always correct; only the exact price of a rare simultaneous
// double-buy could be off by one growth step, which only affects the same player's own wallet.

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  const admin = createAdminClient()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
  const playerId = userData.user.id

  let body: { nodeKey?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const nodeKey = body.nodeKey
  if (typeof nodeKey !== 'string' || !ECHO_SHOP_NODES[nodeKey]) {
    return json({ error: 'Unknown shop node' }, 400)
  }
  const node = ECHO_SHOP_NODES[nodeKey]

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('echo_shop')
    .eq('player_id', playerId)
    .maybeSingle()
  if (profileErr) {
    console.error('echo-shop-purchase: profile lookup failed', profileErr)
    return json({ error: 'Could not load shop levels' }, 500)
  }
  const shop = (profile?.echo_shop ?? {}) as Record<string, number>
  const currentLevel = shop[nodeKey] ?? 0
  const cost = nodeCost(node, currentLevel)

  const { data: result, error: rpcErr } = await admin.rpc('purchase_echo_shop_node', {
    p_player: playerId,
    p_node_key: nodeKey,
    p_cost: cost,
  })
  if (rpcErr) {
    console.error('echo-shop-purchase: purchase_echo_shop_node failed', rpcErr)
    const reason = rpcErr.message.replace(/^.*purchase_echo_shop_node:\s*/, '')
    return json({ error: reason || 'Could not purchase upgrade' }, 409)
  }

  return json(result, 200)
})
```

- [ ] **Step 2: Verify**

As Task 8: read-verify the `admin.rpc('purchase_echo_shop_node', {...})` object has exactly
`p_player, p_node_key, p_cost` matching Task 1's signature; `npm run build` passes. Not executed
— say so.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/echo-shop-purchase/index.ts
git commit -m "feat: add echo-shop-purchase Edge Function"
```

---

### Task 10: `mission-claim` — apply Echo Shop bonuses, retire the flat bonus

**Files:**
- Modify: `supabase/functions/mission-claim/index.ts`

**Interfaces:**
- Consumes: `resolveShopBonus` from `../../../src/lib/echoShop.ts` (Task 3).

- [ ] **Step 1: Remove the flat-bonus constant**

Delete this line near the top of the file:

```typescript
const TRANSCENDENCE_BONUS_PER_COUNT = 0.1 // ADR-0014/design: transcendence_count × 10% to all rewards.
```

- [ ] **Step 2: Add the import**

Add, alongside the existing `src/lib/*.ts` imports:

```typescript
import { resolveShopBonus } from '../../../src/lib/echoShop.ts'
```

- [ ] **Step 3: Read `echo_shop` instead of `transcendence_count`**

Replace:

```typescript
  // 3. Player profile: transcendence multiplier + map progress (for the first-clear check).
  const { data: profile } = await admin
    .from('profiles')
    .select('transcendence_count, map_progress, lifetime_stats, unlocked_characters')
    .eq('player_id', playerId)
    .maybeSingle()
  const transcendenceCount = profile?.transcendence_count ?? 0
  const mapProgress = (profile?.map_progress ?? {}) as Record<string, number>
```

with:

```typescript
  // 3. Player profile: Echo Shop levels (ADR-0053) + map progress (for the first-clear check).
  const { data: profile } = await admin
    .from('profiles')
    .select('map_progress, lifetime_stats, unlocked_characters, echo_shop')
    .eq('player_id', playerId)
    .maybeSingle()
  const shop = (profile?.echo_shop ?? {}) as Record<string, number>
  const mapProgress = (profile?.map_progress ?? {}) as Record<string, number>
```

(the `lifetimeStats`/`unlockedCharacters` lines right after these stay exactly as they are —
only the `select()` string and the line assigning `transcendenceCount`/`shop` change.)

- [ ] **Step 4: Remove the retired modifier**

Replace:

```typescript
  const mods = {
    marginBonus: marginBonus(result.survivingHpPct),
    levelBonus: levelRewardBonus(chars.map((c) => c.level)),
    partyBonus: (chars.length - 1) * PARTY_BONUS_PER_EXTRA_MEMBER,
    transcendenceBonus: transcendenceCount * TRANSCENDENCE_BONUS_PER_COUNT,
  }
```

with:

```typescript
  const mods = {
    marginBonus: marginBonus(result.survivingHpPct),
    levelBonus: levelRewardBonus(chars.map((c) => c.level)),
    partyBonus: (chars.length - 1) * PARTY_BONUS_PER_EXTRA_MEMBER,
  }
```

- [ ] **Step 5: Apply the shop bonus in the reward loop**

Replace:

```typescript
    for (const r of mission.rewards ?? []) {
      const isGold = r.kind === 'currency' && r.code === 'gold'
      const amount = Math.round(finalReward(r.amount, mods) * (isGold ? goldMult : 1) * firstClearMult)
      if (amount <= 0) continue
      const bucket = r.kind === 'resource' ? resources : currencies
      bucket[r.code] = (bucket[r.code] ?? 0) + amount
    }
```

with:

```typescript
    for (const r of mission.rewards ?? []) {
      const isGold = r.kind === 'currency' && r.code === 'gold'
      // Echo Shop bonus (ADR-0053), applied AFTER finalReward — goldGain/resourceGain aren't
      // uniform across coins/resources/XP the way margin/level/party are, so they don't fold
      // into `mods` (src/lib/stats.ts's finalReward doc comment explains why).
      const shopMult = isGold
        ? resolveShopBonus(shop, 'goldGain')
        : r.kind === 'resource'
          ? resolveShopBonus(shop, 'resourceGain', r.code)
          : 1
      const amount = Math.round(finalReward(r.amount, mods) * (isGold ? goldMult : 1) * firstClearMult * shopMult)
      if (amount <= 0) continue
      const bucket = r.kind === 'resource' ? resources : currencies
      bucket[r.code] = (bucket[r.code] ?? 0) + amount
    }
```

- [ ] **Step 6: Verify**

Run: `npm run build` (confirms the shared `src/lib` imports still type-check; this file itself
isn't executed here — no Deno runtime available). Read through the diff once more to confirm no
other reference to `transcendenceCount`/`TRANSCENDENCE_BONUS_PER_COUNT`/`transcendenceBonus`
remains in this file: `grep -n "transcendence" supabase/functions/mission-claim/index.ts`
should return nothing.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/mission-claim/index.ts
git commit -m "feat: apply Echo Shop gold/resource bonuses in mission-claim, retire flat transcendence bonus"
```

---

### Task 11: `group-claim-stage` — apply Echo Shop bonuses, retire the flat bonus

**Files:**
- Modify: `supabase/functions/group-claim-stage/index.ts`

**Interfaces:**
- Consumes: `resolveShopBonus` from `../../../src/lib/echoShop.ts` (Task 3).

Unlike `mission-claim`, this file currently fetches NO `profiles` row at all — one needs to be
added.

- [ ] **Step 1: Add the import**

```typescript
import { resolveShopBonus } from '../../../src/lib/echoShop.ts'
```

- [ ] **Step 2: Fetch `echo_shop` and remove the placeholder bonus**

Replace:

```typescript
  const mods = {
    marginBonus: marginBonus(result.survivingHpPct),
    levelBonus: levelRewardBonus(chars.map((c) => c.level)),
    partyBonus: (chars.length - 1) * PARTY_BONUS_PER_EXTRA_MEMBER,
    transcendenceBonus: 0, // group content doesn't fold in transcendence (spec is silent; kept simple for v1)
  }
```

with:

```typescript
  // Echo Shop levels (ADR-0053) — this retires the old "group content doesn't fold in
  // transcendence" workaround entirely: there is no more count-based bonus for it to skip, so
  // dungeons/raids and missions are on equal footing again.
  const { data: profile } = await admin
    .from('profiles')
    .select('echo_shop')
    .eq('player_id', playerId)
    .maybeSingle()
  const shop = (profile?.echo_shop ?? {}) as Record<string, number>

  const mods = {
    marginBonus: marginBonus(result.survivingHpPct),
    levelBonus: levelRewardBonus(chars.map((c) => c.level)),
    partyBonus: (chars.length - 1) * PARTY_BONUS_PER_EXTRA_MEMBER,
  }
```

- [ ] **Step 3: Apply the shop bonus in the reward loop**

Replace:

```typescript
    for (const r of stage.rewards ?? []) {
      const isGold = r.kind === 'currency' && r.code === 'gold'
      const amount = Math.round(finalReward(r.amount, mods) * (isGold ? goldMult : 1))
      if (amount <= 0) continue
      const bucket = r.kind === 'resource' ? resources : currencies
      bucket[r.code] = (bucket[r.code] ?? 0) + amount
    }
```

with:

```typescript
    for (const r of stage.rewards ?? []) {
      const isGold = r.kind === 'currency' && r.code === 'gold'
      const shopMult = isGold
        ? resolveShopBonus(shop, 'goldGain')
        : r.kind === 'resource'
          ? resolveShopBonus(shop, 'resourceGain', r.code)
          : 1
      const amount = Math.round(finalReward(r.amount, mods) * (isGold ? goldMult : 1) * shopMult)
      if (amount <= 0) continue
      const bucket = r.kind === 'resource' ? resources : currencies
      bucket[r.code] = (bucket[r.code] ?? 0) + amount
    }
```

- [ ] **Step 4: Verify**

Run: `npm run build`. Confirm `grep -n "transcendence" supabase/functions/group-claim-stage/index.ts`
returns nothing.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/group-claim-stage/index.ts
git commit -m "feat: apply Echo Shop gold/resource bonuses in group-claim-stage, retire flat transcendence bonus"
```

---

### Task 12: `mission-start` + `group-start-stage` — apply Mission Speed

**Files:**
- Modify: `supabase/functions/mission-start/index.ts`
- Modify: `supabase/functions/group-start-stage/index.ts`

**Interfaces:**
- Consumes: `resolveShopBonus` from `../../../src/lib/echoShop.ts` (Task 3).

Both files set a fixed `ends_at` timer and are edited identically in shape: fetch `echo_shop`,
divide the resolved duration by the `missionSpeed` multiplier (a speed bonus SHORTENS duration —
`1 / multiplier`, not `× multiplier`) right before calling the RPC that opens the run.

- [ ] **Step 1: `mission-start/index.ts`** — add the import:

```typescript
import { resolveShopBonus } from '../../../src/lib/echoShop.ts'
```

Replace:

```typescript
  // Party missionSpeedDecrease (traits/gear/blessings, ADR-0035) shortens the wait — summed
  // across members, capped 30% (src/lib/traits.ts). Stat lookup failure = unmodified duration
  // (the RPC still owns ownership/busy validation; this is a bonus, not a gate).
  let durationSeconds = def.durationSeconds
  try {
    const { data: partyRows } = await admin
      .from('player_characters')
      .select('id, character_def_id, level, blessings, equipped')
      .in('id', party as string[])
      .eq('player_id', playerId)
    if (partyRows && partyRows.length === party.length) {
      const stats = await statsByCharacter(partyRows, { mapKey: def.map?.mapKey ?? null })
      const mult = missionDurationMultiplier(partyRows.map((r) => stats[r.id]))
      durationSeconds = Math.max(1, Math.round(def.durationSeconds * mult))
    }
  } catch (e) {
    console.error('party stats lookup failed — using authored duration', e)
  }
```

with:

```typescript
  // Party missionSpeedDecrease (traits/gear/blessings, ADR-0035) shortens the wait — summed
  // across members, capped 30% (src/lib/traits.ts). Stat lookup failure = unmodified duration
  // (the RPC still owns ownership/busy validation; this is a bonus, not a gate).
  let durationSeconds = def.durationSeconds
  try {
    const { data: partyRows } = await admin
      .from('player_characters')
      .select('id, character_def_id, level, blessings, equipped')
      .in('id', party as string[])
      .eq('player_id', playerId)
    if (partyRows && partyRows.length === party.length) {
      const stats = await statsByCharacter(partyRows, { mapKey: def.map?.mapKey ?? null })
      const mult = missionDurationMultiplier(partyRows.map((r) => stats[r.id]))
      durationSeconds = Math.max(1, Math.round(def.durationSeconds * mult))
    }
  } catch (e) {
    console.error('party stats lookup failed — using authored duration', e)
  }

  // Echo Shop Mission Speed (ADR-0053) — a separate multiplier layered on top of the
  // trait/gear/blessing one above, applied last.
  const { data: profile } = await admin
    .from('profiles')
    .select('echo_shop')
    .eq('player_id', playerId)
    .maybeSingle()
  const shop = (profile?.echo_shop ?? {}) as Record<string, number>
  durationSeconds = Math.max(1, Math.round(durationSeconds / resolveShopBonus(shop, 'missionSpeed')))
```

- [ ] **Step 2: `group-start-stage/index.ts`** — add the import:

```typescript
import { resolveShopBonus } from '../../../src/lib/echoShop.ts'
```

Replace:

```typescript
  if (!def || !def.stages) return json({ error: 'Unknown dungeon or raid' }, 404)
  const stage = def.stages[stageIndex]
  if (!stage || typeof stage.durationSeconds !== 'number' || stage.durationSeconds < 1) {
    return json({ error: 'Stage has no valid duration' }, 500)
  }

  const { data: groupRun, error: rpcErr } = await admin.rpc('start_group_stage', {
    p_player: playerId,
    p_kind: kind,
    p_def_key: defKey,
    p_party: party,
    p_stage_index: stageIndex,
    p_total_stages: def.stages.length,
    p_duration_seconds: stage.durationSeconds,
    p_lockout: GROUP_LOCKOUT[kind as GroupKind],
    p_map_gate: def.gateKey ?? null,
  })
```

with:

```typescript
  if (!def || !def.stages) return json({ error: 'Unknown dungeon or raid' }, 404)
  const stage = def.stages[stageIndex]
  if (!stage || typeof stage.durationSeconds !== 'number' || stage.durationSeconds < 1) {
    return json({ error: 'Stage has no valid duration' }, 500)
  }

  // Echo Shop Mission Speed (ADR-0053) — same lane mission-start applies for missions.
  const { data: profile } = await admin
    .from('profiles')
    .select('echo_shop')
    .eq('player_id', playerId)
    .maybeSingle()
  const shop = (profile?.echo_shop ?? {}) as Record<string, number>
  const durationSeconds = Math.max(1, Math.round(stage.durationSeconds / resolveShopBonus(shop, 'missionSpeed')))

  const { data: groupRun, error: rpcErr } = await admin.rpc('start_group_stage', {
    p_player: playerId,
    p_kind: kind,
    p_def_key: defKey,
    p_party: party,
    p_stage_index: stageIndex,
    p_total_stages: def.stages.length,
    p_duration_seconds: durationSeconds,
    p_lockout: GROUP_LOCKOUT[kind as GroupKind],
    p_map_gate: def.gateKey ?? null,
  })
```

- [ ] **Step 3: Verify**

Run: `npm run build`. Confirm `gather-start/index.ts` is untouched (it has no `durationSeconds`/
`ends_at` concept at all — this task does not modify it, per the Global Constraints note).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/mission-start/index.ts supabase/functions/group-start-stage/index.ts
git commit -m "feat: apply Echo Shop Mission Speed to mission-start and group-start-stage"
```

---

### Task 13: `gather-collect` — apply Gather Rate

**Files:**
- Modify: `supabase/functions/gather-collect/index.ts`

**Interfaces:**
- Consumes: `resolveShopBonus` from `../../../src/lib/echoShop.ts` (Task 3).

- [ ] **Step 1: Add the import**

```typescript
import { resolveShopBonus } from '../../../src/lib/echoShop.ts'
```

- [ ] **Step 2: Fetch `echo_shop`**

Replace:

```typescript
  const { data: profile } = await admin
    .from('profiles')
    .select('lifetime_stats, unlocked_characters')
    .eq('player_id', playerId)
    .maybeSingle()
  const lifetimeStats = (profile?.lifetime_stats ?? {}) as Record<string, number>
  const unlockedCharacters = (profile?.unlocked_characters ?? {}) as Record<string, string>
```

with:

```typescript
  const { data: profile } = await admin
    .from('profiles')
    .select('lifetime_stats, unlocked_characters, echo_shop')
    .eq('player_id', playerId)
    .maybeSingle()
  const lifetimeStats = (profile?.lifetime_stats ?? {}) as Record<string, number>
  const unlockedCharacters = (profile?.unlocked_characters ?? {}) as Record<string, string>
  const shop = (profile?.echo_shop ?? {}) as Record<string, number>
```

- [ ] **Step 3: Apply the bonus to `gained`**

Replace:

```typescript
  const lastMs = new Date(assignment.last_collected_at).getTime()
  const { gained, consumedSec } = accrue(
    Date.now() - lastMs,
    mine.intervalSec,
    mine.yieldPerTick,
    gatherSpeed,
    gatherYield,
  )
```

with:

```typescript
  const lastMs = new Date(assignment.last_collected_at).getTime()
  const { gained: baseGained, consumedSec } = accrue(
    Date.now() - lastMs,
    mine.intervalSec,
    mine.yieldPerTick,
    gatherSpeed,
    gatherYield,
  )
  // Echo Shop Gather Rate (ADR-0053), applied on top of the character-derived accrual above —
  // a separate multiplier, same "applied after the core calc" pattern as mission-claim's shop
  // bonuses.
  const gained = Math.floor(baseGained * resolveShopBonus(shop, 'gatherRate', assignment.resource_id))
```

Every later use of `gained` in this file (the `lifetimeStatsDelta` computation, the RPC call's
`p_gained: gained`, and the final JSON response's `{ gained, ... }`) is unchanged — they now
correctly read the shop-boosted value since it's the same variable name.

- [ ] **Step 4: Verify**

Run: `npm run build`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/gather-collect/index.ts
git commit -m "feat: apply Echo Shop Gather Rate in gather-collect"
```

---

### Task 14: `src/features/reset/` — the Prestige page

**Files:**
- Create: `src/features/reset/index.ts`
- Create: `src/features/reset/hooks.ts`
- Create: `src/features/reset/PrestigePage.tsx`
- Create: `src/features/reset/components/ResetTab.tsx`
- Create: `src/features/reset/components/EchoShopGrid.tsx`
- Create: `src/features/reset/components/ResetAction.tsx`
- Delete: `src/pages/TranscendencePage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/organisms/GameHeader.tsx`

**Interfaces:**
- Consumes: `useProfile` (`@/hooks/useProfile`); `fetchGateMap`/`resetPlayer`/
  `purchaseEchoShopNode` (`@/services/reset`, Task 7); `ECHO_SHOP_NODES`/`nodeCost`/
  `effectPercent` (`@/lib/echoShop`, Task 3); `computeEchoesAward`/`sumStagesCleared`/
  `isResetGateMet` (`@/lib/reset`, Task 4); `Alert` (`@/components/atoms/Alert`);
  `PrimaryButton`/`SecondaryButton` (`@/components/atoms/Button`); `SegmentedControl`
  (`@/components/atoms/SegmentedControl`); `Modal` (`@/components/organisms/Modal`).
- Produces: `PrestigePage` (default export re-exported named from `index.ts`).

Built as a **tab shell**, not a single-purpose page — this is deliberate (spec §6): the future
Transcendence tier is "the same shop, a second tab," appearing once that tier is unlocked. Today
there is exactly one tab, "Reset," always present.

- [ ] **Step 1: `hooks.ts`**

```typescript
// src/features/reset/hooks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchGateMap, resetPlayer, purchaseEchoShopNode } from '@/services/reset'

export function useGateMap() {
  return useQuery({ queryKey: ['resetGateMap'], queryFn: fetchGateMap })
}

export function useResetPlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: resetPlayer,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export function usePurchaseEchoShopNode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (nodeKey: string) => purchaseEchoShopNode(nodeKey),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
```

- [ ] **Step 2: `components/EchoShopGrid.tsx`**

```typescript
// src/features/reset/components/EchoShopGrid.tsx
import { Alert } from '@/components/atoms/Alert'
import { PrimaryButton } from '@/components/atoms/Button'
import { ECHO_SHOP_NODES, nodeCost, effectPercent } from '@/lib/echoShop'
import { usePurchaseEchoShopNode } from '../hooks'

// The permanent purchase grid (ADR-0053) — levels persist across every Reset; this is the
// "visual cue" that past investment survives (spec §6).
export function EchoShopGrid({ echoes, echoShop }: { echoes: number; echoShop: Record<string, number> }) {
  const purchase = usePurchaseEchoShopNode()
  const nodes = Object.values(ECHO_SHOP_NODES)

  return (
    <div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
        Echo Shop — {echoes.toLocaleString()} Echoes
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {nodes.map((node) => {
          const level = echoShop[node.key] ?? 0
          const cost = nodeCost(node, level)
          const canAfford = echoes >= cost
          return (
            <div key={node.key} className="atom-heavy" style={{
              borderRadius: 8, border: '2px solid var(--color-gold-dark)', padding: 14,
              display: 'flex', flexDirection: 'column', gap: 8,
              background: 'linear-gradient(180deg, #1c080a 0%, #110305 100%)',
            }}>
              <p style={{ color: 'var(--color-gold-light)', fontSize: 13, fontWeight: 'bold' }}>{node.label}</p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{node.description}</p>
              <p style={{ color: 'var(--color-text-primary)', fontSize: 12 }}>
                Level {level} <span style={{ color: 'var(--color-text-gold)' }}>(+{effectPercent(node.effect.kind, level)}%)</span>
              </p>
              <PrimaryButton disabled={!canAfford || purchase.isPending} onClick={() => purchase.mutate(node.key)}>
                {purchase.isPending ? 'Buying...' : `Buy — ${cost} Echoes`}
              </PrimaryButton>
            </div>
          )
        })}
      </div>
      {purchase.error && (
        <div style={{ marginTop: 12 }}>
          <Alert variant="error">{purchase.error instanceof Error ? purchase.error.message : 'Could not purchase upgrade'}</Alert>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: `components/ResetAction.tsx`**

```typescript
// src/features/reset/components/ResetAction.tsx
import { useState } from 'react'
import { Alert } from '@/components/atoms/Alert'
import { PrimaryButton, SecondaryButton } from '@/components/atoms/Button'
import { Modal } from '@/components/organisms/Modal'
import { computeEchoesAward, sumStagesCleared, isResetGateMet } from '@/lib/reset'
import { useGateMap, useResetPlayer } from '../hooks'

// The rare/irreversible action (spec §6) — visually separated from the shop above. Shows the
// live formula preview before the player commits.
export function ResetAction({ mapProgress, lifetimeGoldEarned }: { mapProgress: Record<string, number>; lifetimeGoldEarned: number }) {
  const gateMap = useGateMap()
  const reset = useResetPlayer()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [justDone, setJustDone] = useState<number | null>(null)

  const gateStageCleared = gateMap.data ? (mapProgress[gateMap.data.mapKey] ?? 0) : 0
  const gateMet = isResetGateMet(gateStageCleared)
  const totalStagesCleared = sumStagesCleared(mapProgress)
  const projectedEchoes = computeEchoesAward(totalStagesCleared, lifetimeGoldEarned)

  const disabledReason = !gateMap.data
    ? 'Loading...'
    : !gateMet
      ? `Clear ${gateMap.data.name}'s boss (stage 7) first.`
      : null

  return (
    <div className="atom-heavy" style={{
      marginTop: 24, borderRadius: 8, border: '2px solid var(--color-gold-mid)', padding: 20,
      display: 'flex', flexDirection: 'column', gap: 14,
      background: 'linear-gradient(180deg, #1c080a 0%, #110305 100%)',
    }}>
      <p style={{ color: 'var(--color-gold-light)', fontSize: 15, fontWeight: 'bold' }}>Reset</p>
      <p style={{ color: 'var(--color-text-primary)', fontSize: 13 }}>
        Stages cleared: {totalStagesCleared} · Lifetime gold earned: {Math.round(lifetimeGoldEarned).toLocaleString()}
      </p>
      <p style={{ color: 'var(--color-text-gold)', fontSize: 13 }}>Projected award: {projectedEchoes} Echoes</p>

      {disabledReason && <Alert variant="warning">{disabledReason}</Alert>}
      {reset.error && <Alert variant="error">{reset.error instanceof Error ? reset.error.message : 'Could not reset'}</Alert>}
      {justDone !== null && !reset.error && <Alert variant="success">{`Reset complete — ${justDone} Echoes earned.`}</Alert>}

      <div>
        <PrimaryButton disabled={!!disabledReason || reset.isPending} onClick={() => setConfirmOpen(true)}>
          Reset
        </PrimaryButton>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <div className="atom-heavy" style={{
          borderRadius: 8, border: '2px solid var(--color-gold-mid)', padding: 24, maxWidth: 420,
          background: 'linear-gradient(180deg, #1c080a 0%, #110305 100%)',
        }}>
          <p style={{ color: 'var(--color-gold-light)', fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>Confirm Reset</p>
          <p style={{ color: 'var(--color-text-primary)', fontSize: 13, marginBottom: 10 }}>
            This wipes your gold, resources, map progress, dungeon/raid progress, and infirmary
            level. It keeps your characters, their gear and blessings, and every Echo Shop level
            you&apos;ve bought.
          </p>
          <p style={{ color: 'var(--color-text-gold)', fontSize: 13, marginBottom: 16 }}>
            You&apos;ll earn {projectedEchoes} Echoes.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <SecondaryButton onClick={() => setConfirmOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton
              disabled={reset.isPending}
              onClick={() => reset.mutate(undefined, {
                onSuccess: (data) => { setJustDone(data.echoesAwarded); setConfirmOpen(false) },
              })}
            >
              {reset.isPending ? 'Resetting...' : 'Confirm Reset'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 4: `components/ResetTab.tsx`**

```typescript
// src/features/reset/components/ResetTab.tsx
import { useProfile } from '@/hooks/useProfile'
import { EchoShopGrid } from './EchoShopGrid'
import { ResetAction } from './ResetAction'

export function ResetTab() {
  const profile = useProfile()
  if (!profile.data) {
    return <p style={{ color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic' }}>Loading...</p>
  }

  return (
    <div>
      <EchoShopGrid echoes={profile.data.echoes} echoShop={profile.data.echoShop} />
      <ResetAction mapProgress={profile.data.mapProgress} lifetimeGoldEarned={profile.data.lifetimeStats.goldEarned ?? 0} />
    </div>
  )
}
```

- [ ] **Step 5: `PrestigePage.tsx`**

```typescript
// src/features/reset/PrestigePage.tsx
import { SegmentedControl } from '@/components/atoms/SegmentedControl'
import { ResetTab } from './components/ResetTab'

// The prestige hub: one shell, one tab per tier (ADR-0053). Today only "Reset" exists — the
// future Transcendence tier adds a second tab here, revealed once unlocked, rather than a new
// page (docs/superpowers/specs/2026-09-11-reset-echoes-design.md §6/§9).
const TABS = ['Reset']

export default function PrestigePage() {
  return (
    <div>
      <h1 style={{ color: 'var(--color-gold-light)', fontSize: '22px', letterSpacing: '1px', textShadow: '0 0 12px rgba(240,208,96,0.35)', marginBottom: 14 }}>
        Prestige
      </h1>
      <SegmentedControl options={TABS} />
      <div style={{ marginTop: 20 }}>
        <ResetTab />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: `index.ts`**

```typescript
// src/features/reset/index.ts
// Public API of the Reset/Prestige feature. Import from '@/features/reset' — never reach into
// the feature's internals (./components/*) from outside the feature.
export { default as PrestigePage } from './PrestigePage'
```

- [ ] **Step 7: Wire the route and delete the stub**

In `src/App.tsx`, replace:

```typescript
const TranscendencePage = lazy(() => import('./pages/TranscendencePage'))
```

with:

```typescript
const PrestigePage = lazy(() => import('./features/reset').then((m) => ({ default: m.PrestigePage })))
```

and replace:

```typescript
            <Route path="/transcendence" element={<TranscendencePage />} />
```

with:

```typescript
            <Route path="/reset" element={<PrestigePage />} />
```

Then:

```bash
git rm src/pages/TranscendencePage.tsx
```

- [ ] **Step 8: Rename the nav entry**

In `src/components/organisms/GameHeader.tsx`, in the `NAV` array, replace:

```typescript
  { label: 'Transcendence', to: '/transcendence' },
```

with:

```typescript
  { label: 'Reset', to: '/reset' },
```

- [ ] **Step 9: Verify**

Run: `npm run lint && npm run build && npx vitest run`
Expected: all PASS. Then confirm `grep -rn "TranscendencePage\|/transcendence" src` returns
nothing.

- [ ] **Step 10: Commit**

```bash
git add -A src/features/reset src/pages/TranscendencePage.tsx src/App.tsx src/components/organisms/GameHeader.tsx
git commit -m "feat: add the Reset/Prestige page, retire the Transcendence stub"
```

---

### Task 15: ADR-0053, TODO.md, GAME.md

**Files:**
- Modify: `docs/DECISIONS.md` (append after the last ADR)
- Modify: `TODO.md`
- Modify: `docs/GAME.md`

- [ ] **Step 1: Confirm the ADR number**

`grep -n "^## ADR-" docs/DECISIONS.md | tail -1` — expected to show `ADR-0052`. If it shows a
higher number, use the next integer instead and note the change in your report; do not create a
duplicate number.

- [ ] **Step 2: Append ADR-0053**

```markdown
## ADR-0053 — Reset (ADR-0023's soft tier): Echoes + the Echo Shop, built

**Date:** 2026-09-11 · **Status:** Accepted (Alex)

**Context.** ADR-0023 (2026-07-09) split the original single "transcendence" idea into a soft
**Reset** (keeps characters, wipes current-run progress) and a hard **Transcendence** (wipes
everything, characters included) — but the split was never carried into code.
`profiles.transcendence_count` existed with nothing ever incrementing it; `mission-claim` applied
a flat `transcendenceCount × 10%` bonus to every reward; `group-claim-stage` hardcoded that bonus
to 0 (ADR-0050); `TranscendencePage.tsx` was a 5-line stub. Design worked out in
`docs/superpowers/specs/2026-09-11-reset-echoes-design.md`.

**Decision.**
- **`transcendence_count` renamed `reset_count`** — the column IS what ADR-0023 calls "Reset,"
  just never renamed. The flat `transcendenceCount × 10%` bonus is **retired**, not kept
  alongside the new mechanic — the Echo Shop's explicit, player-chosen bonuses replace it.
- **`echoes` (currency) and `echo_shop` (permanent purchase levels) are separate `profiles`
  columns, deliberately kept OUT of the `currencies` JSONB** — `reset_player` wipes `currencies`
  wholesale, and if Echoes lived inside that map the reward a reset just earned would be wiped in
  the same statement.
- **`reset_player` RPC**: busy-checked across mission/gather/dungeon-raid/infirmary/craft
  activity, gated on the order-1 map's boss cleared (content-driven via Sanity `mapDef.order`),
  wipes `currencies`/`resources`/`map_progress`/`group_runs`/`infirmary_level`, credits Echoes via
  `floor(totalStagesCleared × 10) + floor(sqrt(lifetimeGoldEarned) × 2)` (provisional constants).
  `group_runs` and `infirmary_level` were added to the reset scope during the spec's self-review
  — not originally discussed live, flagged for Alex, confirmed on PR review.
- **Echo Shop is a code registry** (`src/lib/echoShop.ts`), not Sanity content — mechanical,
  account-wide multipliers (ADR-0004's pattern), not narrative content. 20 nodes: Mission Speed,
  Gold Gain, and Gather Rate + Resource Gain per resource in `RESOURCE_SOURCE` (9 resources × 2
  lanes). Character-power nodes are explicitly reserved for the future Transcendence tier.
- **Built as a tab shell** (`src/features/reset/`'s `PrestigePage`) — one "Reset" tab today; the
  future Transcendence tier adds a second tab to this same shell once unlocked, rather than a
  new page.

**Consequences.**
- `RewardModifiers.transcendenceBonus` removed from `src/lib/stats.ts`'s `finalReward` pipeline.
- Nav/route renamed "Transcendence"/`/transcendence` → "Reset"/`/reset`;
  `src/pages/TranscendencePage.tsx` deleted.
- No automated Edge Function coverage for `reset-player`/`echo-shop-purchase` (same accepted gap
  as every other Edge Function here), but the pure formula/registry (`src/lib/reset.ts`,
  `src/lib/echoShop.ts`) and the services layer are unit-tested.
- Follow-ups: the Transcendence tier itself (own spec — currency name, tree, what survives it,
  the unlock condition for its tab), more Echo Shop categories, real balance tuning of the
  formula/cost-curve/per-level-bonus constants once there's playtest data.
```

(The `gather-start` has-no-duration correction to the spec was already made and committed
directly to `docs/superpowers/specs/2026-09-11-reset-echoes-design.md` before this plan was
written — it ships in the same PR as this plan, so the spec text this ADR references is already
accurate. No separate corrections note is needed.)

- [ ] **Step 3: Close the TODO.md item and add a Transcendence follow-up**

Find the existing entry (`grep -n "Transcendence-reset logic" TODO.md`) and replace it and its
`↳ context` line:

```markdown
- [ ] **Transcendence-reset logic** (keep characters, reset level → 1 + blessings) — the counter
  (`transcendence_count`) exists in `stats.ts`/`currencies.ts`/`mission-claim`, but
  `src/pages/TranscendencePage.tsx` is a 5-line stub. No reset RPC built at all.
  `↳ context: project-design-decisions (transcendence), project-undecided (reset scope) · supabase/functions/, src/pages/TranscendencePage.tsx`
```

with:

```markdown
- [x] **Reset tier** (ADR-0053) — `reset_player`/`purchase_echo_shop_node` RPCs, the
  `reset-player`/`echo-shop-purchase` Edge Functions, the 20-node Echo Shop registry
  (`src/lib/echoShop.ts`), and the `src/features/reset/` page (nav renamed "Transcendence" →
  "Reset"). The harder Transcendence tier (full wipe including characters) is its own follow-up,
  not built here.
  `↳ context: project-reset · docs/DECISIONS.md ADR-0053, docs/superpowers/specs/2026-09-11-reset-echoes-design.md`
- [ ] **Transcendence tier** (ADR-0023's hard-wipe half) — full wipe including characters, its
  own currency and tree focused on character power, appearing as a second tab in the Reset
  page's `PrestigePage` shell once unlocked. Needs its own spec.
  `↳ context: project-reset · docs/DECISIONS.md ADR-0023/ADR-0053`
```

- [ ] **Step 4: Fix the stale line in GAME.md**

In `docs/GAME.md`, replace:

```markdown
- **History/activity log**, **transcendence flow**, and **character art** (sprites are
  currently a gap) round out the near-term list.
```

with:

```markdown
- **History/activity log** and **character art** (sprites are currently a gap) round out the
  near-term list; the Reset tier (ADR-0053) is built — the harder Transcendence tier remains
  open.
```

- [ ] **Step 5: Commit**

```bash
git add docs/DECISIONS.md TODO.md docs/GAME.md
git commit -m "docs: record ADR-0053 (Reset + Echo Shop), close the reset TODO item"
```

---

## Self-Review Notes

- **Spec coverage:** §4a (columns) → Task 1/2; §4b (registry) → Task 3; §5a (retire flat bonus)
  → Task 5, 10, 11; §5b (`reset_player`) → Task 1, 8; §5c (`purchase_echo_shop_node`) → Task 1,
  9; §5d (bonus application sites, corrected for `gather-start`) → Task 10–13; §6 (UI, tab
  shell) → Task 14; §7 (error handling) → Tasks 1, 8, 9 (raises/status codes match); §8
  (testing) → Tasks 3, 4, 6, 7 (unit), Task 1 Step 3 (migration policy); §9 (follow-ups) → Task
  15's ADR.
- **Decisions made while planning, not fully spelled out in the spec:** exact node descriptions/
  costs (`costBase`/`costGrowth` = 20/1.15 flat, 15/1.12 per-resource; `PER_LEVEL_BONUS` = 2%/3%)
  — the spec left these as "provisional," this plan picks concrete first-pass numbers so there's
  something real to ship and tune later, per the same convention `combat.ts`'s `COMBAT` block
  uses. The `ResetAction`/`EchoShopGrid` component split (three files instead of one) — the
  spec's §6 described sections, not file boundaries; split here follows CLAUDE.md's "~200 lines,
  one responsibility" guidance.
- **Type consistency:** `ShopEffectKind`/`ShopNode` (Task 3) are used identically by Tasks 8–14
  (`resolveShopBonus(shop, kind, resource?)`, `nodeCost(node, level)`, `effectPercent(kind,
  level)`) — same parameter names and order everywhere. `GateMap = { mapKey, name }` (Task 7) is
  what `useGateMap()` (Task 14) reads. `PlayerProfile.echoes`/`echoShop`/`lifetimeStats`/
  `resetCount` (Task 6) match every consumer in Task 14 exactly (`profile.data.echoes`, `.echoShop`,
  `.lifetimeStats.goldEarned`, no consumer reads `.resetCount` in this plan — it's exposed for
  future display, consistent with the spec calling it "a display/achievement counter").
  `resetPlayer(): Promise<{ echoesAwarded: number }>` (Task 7) matches what `reset-player`
  returns (Task 8: `return json(result, 200)` where `result = { echoesAwarded: v_awarded }` from
  the RPC) and what `ResetAction`'s `onSuccess: (data) => setJustDone(data.echoesAwarded)` reads
  (Task 14).
