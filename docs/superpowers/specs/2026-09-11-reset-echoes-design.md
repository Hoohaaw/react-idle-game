# Reset & the Echo Shop — design spec

## 1. Problem

ADR-0023 (2026-07-09) split the original single "transcendence" idea into two tiers — a soft
**Reset** (keeps characters, wipes current-run progress) and a hard **Transcendence** (wipes
everything, characters included) — but the split was never carried into code. Today:

- `profiles.transcendence_count` exists, defaults to 0, and **nothing ever increments it** — no
  reset RPC was ever built.
- `mission-claim` reads it and applies a flat `transcendenceCount × 10%` bonus to every reward
  (`TRANSCENDENCE_BONUS_PER_COUNT`, `src/lib/stats.ts`'s `RewardModifiers.transcendenceBonus`).
- `group-claim-stage` (dungeons/raids) deliberately hardcodes this bonus to 0 (ADR-0050
  consequences) — a workaround for a mechanic that doesn't really exist yet.
- `src/pages/TranscendencePage.tsx` is a 5-line `PagePlaceholder` stub; the nav entry
  ("Transcendence", `/transcendence`) leads nowhere.

This spec designs and builds the **Reset** tier only. The harder **Transcendence** tier (full
wipe, its own currency/tree) is out of scope — see §3 and §9.

## 2. Goals

- A player can trigger a **Reset**: current-run wallet and world progress wipe; characters,
  their levels/gear/blessings, and every permanent ledger survive untouched.
- A Reset earns **Echoes** (the new currency) via a formula that rewards *how far* a player
  pushed (map stages cleared) blended with *how much* they earned (lifetime gold) — not a flat
  per-reset amount.
- Echoes are spent in the **Echo Shop**: permanent, repeatable-purchase upgrades to the game's
  economy/logistics — mission/gather/dungeon speed, gold gain, and per-resource gather rate +
  loot gain. Shop levels persist across every future Reset; only the wallet/progress being reset
  is spent.
- The shop is built as a **code registry** (ADR-0004 pattern, like `statDefinitions.ts`/
  `currencies.ts`), not Sanity content — it's mechanical, account-wide, not narrative — so a new
  node is a registry entry + redeploy, never a content-authoring pass.
- A Reset is gated (can't be spammed from a fresh account for free currency) and requires no
  character be mid-activity.

## 3. Non-goals (this spec)

- **The Transcendence tier itself** (full wipe including characters, its own currency, its own
  tree/shop). Deferred to its own spec once Reset ships and its shape is proven. This spec's
  design must not contradict Transcendence being built later — see §9's compatibility notes.
- **Character-power shop nodes** (flat/pct stat boosts). Explicitly reserved for the future
  Transcendence tier, not the Echo Shop — Reset is economy/logistics only, Transcendence is
  character power. This is a deliberate thematic split, not a temporary scope cut.
- **A map-progress catch-up mechanic** (e.g. "start every map at stage 2"). The Echo Shop only
  ever multiplies existing numbers (speed, gain); it never writes to `map_progress` directly.
- Re-tuning the formula's constants against real playtest data (same treatment as `combat.ts`'s
  `COMBAT` block — shape is final, numbers are provisional, tuned later against real numbers).
- More Echo Shop categories beyond the wave below (a "wave 1 then expand" pattern, same as items/
  blessings). The registry shape makes a later wave a pure addition, not a redesign.

## 4. Data model

### 4a. `profiles` columns (migration)

```sql
alter table public.profiles rename column transcendence_count to reset_count;
alter table public.profiles add column echoes    integer not null default 0 check (echoes >= 0);
alter table public.profiles add column echo_shop jsonb   not null default '{}'::jsonb;
```

- **`reset_count`** (renamed from `transcendence_count`) — how many times the player has Reset.
  No reward multiplier reads it anymore (§5's retirement of the flat bonus) — it's a display/
  achievement counter only, for now.
- **`echoes`** — the spendable currency. **A separate column, deliberately not a key inside
  `currencies`** — `reset_player` wipes `currencies` wholesale (`'{}'::jsonb`) as part of the
  reset; if Echoes lived inside that same map, the very reward a reset just earned would be wiped
  in the same statement. A dedicated column makes that class of bug structurally impossible.
- **`echo_shop`** — `{ "<nodeKey>": <levelPurchased> }`. A missing key = level 0 (same "absent
  key = zero" convention as `currencies`/`resources`). **Never touched by `reset_player`** — this
  is what makes shop levels visible and permanent across every future reset (the player's
  "visual cue" that their invested Echoes persist).

Untouched by this migration or by `reset_player`: `player_characters` (all columns —
level/xp/gear/blessings/current_hp), `lifetime_stats`, `unlocked_characters`. These already
exist and their semantics don't change.

**Self-review catch — two more tables belong in the reset scope, missed in the brainstorming
pass because they predate/postdate it:**
- **`group_runs`** (dungeons/raids progress) is exactly the same category as `map_progress` —
  world-content progression — and was simply never considered when this spec was first drafted.
  `reset_player` deletes every row for the player (§5b), the same semantic reset as
  `map_progress → '{}'`. This also clears any daily/weekly lockout (`last_cleared_at`) — a
  deliberate consequence of "progress reset," not a bug, and worth calling out because it's not
  obvious from the table name alone.
- **`profiles.infirmary_level`** (the upgradeable building, bought with the gold `reset_player`
  is about to wipe) resets to its default (**1**) alongside the wallet — it's economic
  progression bought with the currency being reset, not a character or its gear. This is a
  judgment call, not something explicitly settled during brainstorming — flagged here for you to
  confirm or override on review; the alternative (leave it untouched) is a one-line change if
  you'd rather it survive.

### 4b. `src/lib/echoShop.ts` (new code registry)

```typescript
export type ShopEffectKind = 'missionSpeed' | 'goldGain' | 'gatherRate' | 'resourceGain'

export type ShopNode = {
  key: string
  label: string
  description: string
  effect: { kind: ShopEffectKind; resource?: string } // resource set only for gatherRate/resourceGain
  costBase: number
  costGrowth: number
}

export const ECHO_SHOP_NODES: Record<string, ShopNode> = {
  missionSpeed: { key: 'missionSpeed', label: 'Mission Speed', description: '...', effect: { kind: 'missionSpeed' }, costBase: 20, costGrowth: 1.15 },
  goldGain:     { key: 'goldGain',     label: 'Gold Gain',     description: '...', effect: { kind: 'goldGain' },     costBase: 20, costGrowth: 1.15 },
  ...Object.fromEntries(
    Object.keys(RESOURCE_SOURCE).flatMap((resource) => [
      [`gatherRate.${resource}`,   { key: `gatherRate.${resource}`,   label: `${resource} Gather Rate`, description: '...', effect: { kind: 'gatherRate' as const, resource },   costBase: 15, costGrowth: 1.12 }],
      [`resourceGain.${resource}`, { key: `resourceGain.${resource}`, label: `${resource} Gain`,        description: '...', effect: { kind: 'resourceGain' as const, resource }, costBase: 15, costGrowth: 1.12 }],
    ]),
  ),
}
```

Deriving the 18 resource nodes from `RESOURCE_SOURCE`'s keys (`src/lib/resources.ts`) means a
future 10th resource automatically gets both shop lanes with zero shop-registry edits — the
registry-driven promise (ADR-0004) holds for resource growth, not just for adding an unrelated
new node.

**20 nodes for this wave:** `missionSpeed`, `goldGain`, and `gatherRate.<R>` / `resourceGain.<R>`
for each of Wood/Copper/Stone/Coal/Iron/Silver/Bronze/Gold/Platinum (9 resources × 2 lanes).

```typescript
/** cost to buy the NEXT level (i.e. going from `currentLevel` to `currentLevel + 1`). */
export function nodeCost(node: ShopNode, currentLevel: number): number {
  return Math.floor(node.costBase * node.costGrowth ** currentLevel)
}

/** Total multiplier from every node matching `kind` (+ `resource` when the kind is per-resource). */
export function resolveShopBonus(shop: Record<string, number>, kind: ShopEffectKind, resource?: string): number {
  const key = resource ? `${kind}.${resource}` : kind
  const level = shop[key] ?? 0
  return 1 + level * PER_LEVEL_BONUS[kind] // e.g. 0.02 = +2%/level, provisional like everything else here
}
```

Both `nodeCost` and `resolveShopBonus` are pure and unit-tested directly (§8) — no Sanity, no
Supabase, importable from both the client (to show costs/effects in the shop UI) and every Edge
Function that needs to resolve a bonus.

## 5. Runtime flow

### 5a. Retiring the flat count-based bonus

`RewardModifiers.transcendenceBonus` (`src/lib/stats.ts`) and `TRANSCENDENCE_BONUS_PER_COUNT`
(`supabase/functions/mission-claim/index.ts`) are **deleted**, not renamed — the Echo Shop's
explicit, player-chosen `goldGain`/`resourceGain` bonuses replace the old blanket "resets are
worth +10%/count to everything" mechanic with something expressive. This also retires the
`group-claim-stage` "hardcoded to 0" workaround (ADR-0050) — there is no more count-based bonus
for it to skip; it picks up the new shop bonuses the same way `mission-claim` does (§5c), so
dungeons/raids and missions are on equal footing again.

### 5b. `reset_player` RPC (new migration, mirrors `respec_blessings`'s shape)

```sql
create or replace function public.reset_player(
  p_player       uuid,
  p_total_stages int,     -- sum of every map's highestStageCleared, computed by the Edge Function from map_progress
  p_lifetime_gold numeric -- lifetime_stats.goldEarned, read by the Edge Function
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_awarded integer;
begin
  -- Busy check: no character may be mid-mission/gather/dungeon-raid/infirmary (same pattern
  -- every other cross-cutting RPC in this codebase already uses).
  if exists (select 1 from public.mission_runs where player_id = p_player)
    or exists (select 1 from public.gather_assignments ga join public.player_characters pc on pc.id = ga.player_character_id where pc.player_id = p_player)
    or exists (select 1 from public.group_runs where player_id = p_player and cardinality(party) > 0)
    or exists (select 1 from public.infirmary_admissions ia join public.player_characters pc on pc.id = ia.player_character_id where pc.player_id = p_player)
    or exists (select 1 from public.craft_runs where player_id = p_player)
  then
    raise exception 'reset_player: a character is busy';
  end if;

  -- STAGE_RATE=10, GOLD_RATE=2 — first-pass provisional constants (§3's non-goal on tuning),
  -- same treatment as combat.ts's COMBAT block: shape is final, numbers are tuned later against
  -- real playtest data via a calc-script pass (§9).
  v_awarded := floor(p_total_stages * 10) + floor(sqrt(p_lifetime_gold) * 2);

  update public.profiles
     set currencies     = '{}'::jsonb,
         resources      = '{}'::jsonb,
         map_progress   = '{}'::jsonb,
         infirmary_level = 1,
         echoes         = echoes + v_awarded,
         reset_count    = reset_count + 1
   where player_id = p_player;

  delete from public.group_runs where player_id = p_player;

  return jsonb_build_object('echoesAwarded', v_awarded);
end;
$$;

revoke all on function public.reset_player(uuid, int, numeric) from public, anon, authenticated;
grant execute on function public.reset_player(uuid, int, numeric) to service_role;
```

The **`reset-player` Edge Function** (new) does the gate check before calling the RPC at all —
queries Sanity for the map with `order == 1`, checks `map_progress[<that map's key>] >= 7`,
returns a 403 with a clear reason if not met (same "friendly early-out, RPC re-guards nothing
extra here since the gate is informational, not a security boundary" shape mission-claim-style
functions already use) — then computes `p_total_stages` (sum of `map_progress` values) and
`p_lifetime_gold` (`lifetime_stats.goldEarned ?? 0`) from the player's own profile row and calls
the RPC.

### 5c. `purchase_echo_shop_node` RPC (new, same migration)

```sql
create or replace function public.purchase_echo_shop_node(
  p_player   uuid,
  p_node_key text,
  p_cost     integer -- authoritative cost, computed server-side by the Edge Function from the
                      -- CODE registry (no Sanity round-trip needed — echoShop.ts is shared)
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_echoes numeric;
  v_shop   jsonb;
begin
  select echoes, echo_shop into v_echoes, v_shop
    from public.profiles where player_id = p_player for update;
  if v_echoes < p_cost then
    raise exception 'purchase_echo_shop_node: insufficient echoes (have %, need %)', v_echoes, p_cost;
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

The **`echo-shop-purchase`** Edge Function recomputes `p_cost` itself from
`nodeCost(ECHO_SHOP_NODES[nodeKey], currentLevel)` (never trusts the client's displayed cost —
ADR-0003) before calling the RPC; a stale client (someone else bought a level in another tab)
just gets a "cost changed, refresh" 409 from the RPC's `insufficient echoes`-style check failing
against the now-higher real cost, or succeeds if the client's number happened to still match.

### 5d. Where `resolveShopBonus` gets read

Each call site already fetches the player's `profiles` row once; this only adds `echo_shop` to
that same `select` — no extra query anywhere.

- **`gather-collect`**: `gained = Math.floor(baseGained * resolveShopBonus(shop, 'gatherRate', resource))`.
- **`mission-claim` / `group-claim-stage`**: after `finalReward()` computes the core gold amount
  (margin/level/party bonuses, unchanged), multiply by `resolveShopBonus(shop, 'goldGain')`
  before writing it. Each rolled loot line's resource amount (not gold, not items) is separately
  multiplied by `resolveShopBonus(shop, 'resourceGain', code)`. These are **applied after**
  `finalReward`, not folded into `RewardModifiers` — `goldGain`/`resourceGain` aren't uniform
  across coins/resources/XP the way margin/level/party are, so they don't fit that shared bag.
- **`mission-start` / `start_gather` / `start_group_stage`**: `durationSeconds` is divided by
  `resolveShopBonus(shop, 'missionSpeed')` (a speed bonus shortens duration — `1 / multiplier`,
  not `× multiplier`) before being passed to the RPC that opens the run.

## 6. Client data layer & UI

- `src/services/profile.ts`'s `PlayerProfile` gains `echoes: number` and
  `echoShop: Record<string, number>`, read the same way `mapProgress`/`unlockedCharacters` are.
- `src/services/reset.ts` (new): `fetchResetEligibility()` (GROQ for the order-1 map's key +
  stage-7 check against `map_progress`, plus the live formula preview numbers),
  `resetPlayer()` (invokes `reset-player`), `purchaseEchoShopNode(nodeKey)` (invokes
  `echo-shop-purchase`).
- **Nav rename**: `GameHeader.tsx`'s "Transcendence" entry → **"Reset"**, route `/transcendence`
  → `/reset`. Frees "Transcendence" as its own future nav entry.
- New feature module `src/features/reset/` (real functionality from the start, not a
  `src/pages/` stub — matches `missions/`'s reference shape), one page, two sections:
  1. **Echo Shop** (primary content): a grid of the 20 `ECHO_SHOP_NODES`, each showing label,
     current level (from `echoShop[key] ?? 0`), current effect at that level, `nodeCost()` for
     the next level, a Buy button (disabled if `echoes` balance is short). Current `echoes`
     balance shown prominently — this is the "visual cue" that persists across every reset.
  2. **Reset** (visually separated, rare/irreversible action): live preview of
     `totalStagesCleared`, `lifetimeGoldEarned`, and the projected Echoes award if reset right
     now; the gate status (disabled with a reason if the order-1 map's boss isn't cleared);
     a confirm button behind a modal stating plainly what's wiped (gold, resources, map
     progress, dungeon/raid progress, infirmary level) vs. what's kept (characters, gear,
     blessings, Echo Shop levels).

## 7. Error handling / edge cases

- **Busy character** → `reset_player` raises `reset_player: a character is busy`; the Edge
  Function surfaces this as a 409 before the player even reaches the confirm modal ideally (a
  pre-check), but the RPC re-guards regardless (never trust only the friendly early-out).
- **Gate not met** → `reset-player` Edge Function returns 403 with the specific reason (e.g.
  "Clear Gravemarch's boss first") before calling the RPC at all — the RPC itself doesn't
  re-check the gate (it's a UX gate, not a security boundary; nothing bad happens if it's
  bypassed beyond "reset with fewer stages cleared than intended," which only hurts the player
  who did it).
- **Insufficient Echoes on purchase** → `purchase_echo_shop_node` raises; the Edge Function
  surfaces the shortfall as a 409.
- **Stale cost on purchase** (another tab already bought a level) → the RPC's balance check runs
  against the CURRENT `echoes`/`echo_shop` under `for update`, so a stale `p_cost` either still
  succeeds (nothing changed) or fails cleanly with "insufficient echoes" — no double-charge, no
  double-level.
- **`echoes` can never go negative** — `check (echoes >= 0)` plus the RPC's own guard before the
  decrement.

## 8. Testing

- `src/lib/echoShop.ts` — `nodeCost` (cost growth curve, level 0 baseline), `resolveShopBonus`
  (missing key = 0 = no bonus; per-resource key lookup; unknown resource = 0). Pure, real
  assertions, same shape as `src/lib/crafting.ts`'s tests.
- `src/services/reset.test.ts` / `echoShop.test.ts` (services layer) — mocked Sanity/Supabase,
  same pattern as `src/services/crafting.test.ts`.
- `src/test/migration-policy.test.ts` automatically covers the new migration's grants/RLS/RPC
  revoke-grant pairs — no new test needed there, just compliance.
- No automated Edge Function coverage for `reset-player`/`echo-shop-purchase` themselves —
  same accepted gap as every other Edge Function in this codebase (no pgTAP/Deno test infra),
  verified by reading + manual smoke test against the hosted project, same as crafting was.

## 9. Follow-ups (not this spec)

- **The Transcendence tier itself** — full wipe (characters included), its own currency, its own
  tree focused on character power (explicitly reserved out of the Echo Shop, §3). Needs its own
  spec: what survives a Transcendence (does `echoes`/`echo_shop`/`reset_count` finally get wiped
  too, matching "resets everything back to how the game started"?), currency name, tree
  structure, the achievement formula for ITS currency, and whether it unlocks exclusive content.
- **More Echo Shop categories** beyond this wave (a content-adjacent-but-still-code wave, same
  pattern as items/blessings getting expanded over time).
- **Real balance tuning** of `STAGE_RATE`/`GOLD_RATE`/`PER_LEVEL_BONUS`/`costBase`/`costGrowth`
  once there's real playtest data — a calc-script pass, same discipline as `docs/ITEMS.md`'s
  sizing methodology.
- **`docs/DECISIONS.md` ADR** recording this as built (superseding ADR-0023's "not decided yet"
  list for the Reset tier specifically) — written after this spec is approved, alongside the
  implementation plan.
