# Transcendence & Ascendant Shards — design spec

## 1. Problem

ADR-0023 (2026-07-09) split the original single "transcendence" idea into two tiers. The soft
**Reset** tier shipped as ADR-0053 (2026-09-11): Echoes, the Echo Shop, a `reset_player` RPC.
The hard **Transcendence** tier was explicitly deferred — `docs/DECISIONS.md` ADR-0053 and
`TODO.md` both carry it as an open follow-up. Today:

- No `transcend_player` RPC, no Transcendence currency, no Transcendence shop, no unlock gate.
- `src/features/reset/PrestigePage.tsx` is a tab shell with exactly one tab ("Reset"), built
  deliberately so a second tab could be added without restructuring (ADR-0053 §6).
- `lifetime_stats` currently tracks only `goldEarned`, `missionSecondsSent`, and
  `resourceGathered.<resource>` (`src/lib/lifetimeStats.ts`) — nothing about missions, dungeons,
  or raids cleared exists yet.
- `group-claim-stage` (dungeons/raids) does not read or write `lifetime_stats` at all today —
  confirmed by reading the function: no acquisition-ledger integration exists there (a scope cut
  made when dungeons/raids shipped, ADR-0050).
- `claim_group_stage` (the SQL RPC backing `group-claim-stage`) has no `p_lifetime_stats`
  parameter — unlike `claim_mission`/`collect_gather`, which already do.

This spec designs and builds the **Transcendence** tier: its currency (Ascendant Shards), its
shop, the wipe scope, the unlock gate, and the milestone system that earns the currency.

## 2. Goals

- A player can **Transcend** once every currently-authored raid has been cleared at least once,
  ever (a permanent, one-time-per-raid credential — not a live state a Reset can undo).
- Transcending wipes everything a Reset wipes, plus the Echo Shop, Echoes, and every character —
  except characters sitting in a **protected slot** (a new Echo Shop purchase, capped at 5),
  which come through completely untouched.
- **Ascendant Shards are earned continuously during ordinary play**, not as a lump sum computed
  at the moment of Transcending. Every trackable lifetime metric (gold, each resource, missions/
  dungeons/raids cleared, and Transcend count itself) has its own ladder of one-time thresholds;
  crossing one anywhere banks Shards and permanently retires that threshold. This rewards
  breadth (progress across many metrics) over depth in one metric, and means the currency keeps
  flowing between Transcends, not just at the moment of the wipe.
- Shards are spent in the **Ascendant Shop**: two per-character nodes (raw combat power, unlike
  the Echo Shop's explicit economy-only scope) plus five flat account-wide economy/QoL nodes and
  one genuinely new mechanic (rarity bias). Every node is far more impactful per level than its
  Echo Shop counterpart, at a much steeper cost curve.
- The whole system is built as an explicit, documented **extensibility pattern** (§4e) — adding a
  new trackable metric later (a new resource, a new activity type) is a fixed three-step recipe,
  not a bespoke change each time.

## 3. Non-goals (this spec)

- **Legendary class-specific quest-lines** (raised during this brainstorm, spun out as its own
  future TODO item — an item/content system, unrelated to the prestige-currency mechanic here).
- **Balance tuning** of every threshold/cost/percentage below — first-pass provisional numbers,
  same treatment as `combat.ts`'s `COMBAT` block and the Echo Shop's own constants. Shape is
  final; numbers are tuned later against real playtest data.
- **Deploying `group-start-stage`/`group-claim-stage` to the hosted project** — they aren't live
  there yet at all (a pre-existing gap, unrelated to this spec). This spec's changes to
  `group-claim-stage`/`claim_group_stage` ship in the same not-yet-deployed state; deploying the
  whole dungeons/raids feature is tracked separately.
- **A UI for browsing which milestone thresholds exist / are claimed** beyond a simple progress
  indicator (§6). A full achievement-gallery page is a future enhancement, not required to ship
  the mechanic.
- **Retroactively crediting Shards for lifetime totals a player already has** before this ships.
  Milestone thresholds only evaluate going forward, from whatever `lifetime_stats`/new counters
  read at deploy time — a player who already has 50,000 lifetime gold does not get every
  threshold under 50,000 backfilled the moment this ships. (This falls out naturally from how the
  check works — see §5c — but is worth stating as a deliberate non-goal, not an oversight.)

## 4. Data model

### 4a. `profiles` columns (new migration)

```sql
alter table public.profiles
  add column ascendant_shards integer not null default 0 check (ascendant_shards >= 0);
alter table public.profiles
  add column ascendant_shop   jsonb   not null default '{}'::jsonb;
alter table public.profiles
  add column ascendant_milestones jsonb not null default '{}'::jsonb;
alter table public.profiles
  add column transcend_count integer not null default 0 check (transcend_count >= 0);
```

- **`ascendant_shards`** — the spendable currency. A dedicated column, same reasoning as
  `echoes`: `transcend_player` wipes `currencies`/`echoes` wholesale, so the reward a Transcend
  (or, more often, an ordinary mission/gather/raid) just earned must live somewhere that wipe
  never touches.
- **`ascendant_shop`** — `{ "<nodeKey>": <levelPurchased> }`, same "absent key = level 0"
  convention as `echo_shop`. Node keys: `missionSpeed`, `goldFind`, `magicFind`, `xpGain`,
  `resourceGain` (the five flat nodes), `rarityBias`, and `<charKey>.power` / `<charKey>.vitality`
  for every character (§4d). **Never touched by `transcend_player`.**
- **`ascendant_milestones`** — `{ "<metricKey>.<thresholdIndex>": true }` — the permanent record
  of which milestone thresholds have ever been claimed (§4e). Once a key is present, that
  threshold can never award again, for the life of the account. **Never touched by
  `transcend_player`** — this is what makes "spread your investment across metrics" a real
  incentive instead of something a Transcend could reset and let a player re-farm.
- **`transcend_count`** — how many times the player has Transcended. Survives everything
  (including Transcend itself incrementing it, obviously) — it's also one of the metrics with its
  own milestone ladder (§4e).

`reset_count` and `lifetime_stats` (already existing, ADR-0053) are **not** touched by this
migration and are **not** wiped by `transcend_player` (§4b) — both are explicitly permanent,
account-lifetime records now, surviving both Reset and Transcend.

### 4b. `transcend_player` wipe scope

| Field | Reset already wipes it? | Transcend wipes it? |
|---|---|---|
| `currencies`, `resources`, `map_progress` | yes | yes |
| `infirmary_level` (→ 1) | yes | yes |
| `group_runs` (all rows deleted) | yes | yes |
| `echoes` (→ 0) | no (survives Reset) | **yes** |
| `echo_shop` (→ `{}`) | no (survives Reset) | **yes** |
| `unlocked_characters` (→ `{}`) | no (survives Reset) | **yes, except** charKeys in a protected slot |
| `player_characters` (rows deleted) | no (survives Reset) | **yes, except** rows in a protected slot |
| `lifetime_stats` | no (survives) | no (survives) |
| `reset_count` | no (survives — it's the counter Reset itself increments) | no (survives) |
| `ascendant_shards`, `ascendant_shop`, `ascendant_milestones` | n/a (didn't exist) | **no — never touched** |

**Protected slots** (§4c's `echo_shop.protectedSlots` node, max level 5) are read by
`transcend_player` at the moment of the call — the Edge Function passes the caller's chosen
`player_characters.id`s (up to their current slot count) as `p_protected_ids`. Those rows are
excluded from the delete and their charKeys are excluded from the `unlocked_characters` wipe.
Everything else in the table above proceeds exactly as listed, including `echo_shop` itself
wiping out from under the very slots that just did their job — buying slots again is a cost every
future Transcend pays fresh, by design (confirmed with Alex: this is deliberate, not an
oversight).

### 4c. Echo Shop gains one node: `protectedSlots` (modifies already-shipped code)

This is a change to the ALREADY-SHIPPED, ALREADY-DEPLOYED `src/lib/echoShop.ts` and
`purchase_echo_shop_node` RPC (ADR-0053), not new-only code:

```typescript
// echoShop.ts: ShopEffectKind grows one member that is NOT a resolveShopBonus multiplier — it's
// a bare counter transcend_player reads directly. resolveShopBonus() is never called with
// 'protectedSlots'; a level IS the slot count, full stop.
export type ShopEffectKind = 'missionSpeed' | 'goldGain' | 'gatherRate' | 'resourceGain' | 'protectedSlots'

export const MAX_PROTECTED_SLOTS = 5

// Added to FLAT_NODES, priced well above every existing node (Alex: "one of the more expensive
// items") — costBase/costGrowth here are provisional like every other cost curve in this system,
// but should land noticeably steeper than missionSpeed/goldGain's 20/1.15.
protectedSlots: {
  key: 'protectedSlots',
  label: 'Protected Slot',
  description: 'A character in a protected slot survives your next Transcend completely untouched.',
  effect: { kind: 'protectedSlots' },
  costBase: 500,
  costGrowth: 1.8,
},
```

`purchase_echo_shop_node` gains one guard, specific to this node key: reject the purchase if
`node_key = 'protectedSlots'` and the player's current level is already `MAX_PROTECTED_SLOTS`
(the RPC already reads `echo_shop` under `for update` for the balance check — the cap check reads
the same locked row, no extra query). Every other node keeps its uncapped, buy-forever behavior.

### 4d. `src/lib/ascendantShop.ts` (new code registry)

Two different node shapes live in one registry, mirroring how `echoShop.ts` already mixes flat
nodes and per-resource nodes:

```typescript
export type FlatAscendantKind = 'missionSpeed' | 'goldFind' | 'magicFind' | 'xpGain' | 'resourceGain' | 'rarityBias'
export type CharAscendantKind = 'power' | 'vitality'

export type FlatAscendantNode = {
  key: FlatAscendantKind
  label: string
  description: string
  costBase: number
  costGrowth: number
}

/** +%/level for each flat node. Provisional (§3) — an order of magnitude bigger than the Echo
 *  Shop's equivalents (2-3%/level) since Shards are meant to be far rarer than Echoes. */
const FLAT_PER_LEVEL_BONUS: Record<FlatAscendantKind, number> = {
  missionSpeed: 0.05,
  goldFind: 0.08,
  magicFind: 0.08,
  xpGain: 0.08,
  resourceGain: 0.06,
  rarityBias: 0.04, // see resolveRarityBias (§5d) for exactly what this number means
}

export const FLAT_ASCENDANT_NODES: Record<FlatAscendantKind, FlatAscendantNode> = {
  missionSpeed: { key: 'missionSpeed', label: 'Ascendant Haste', description: '...', costBase: 200, costGrowth: 1.35 },
  goldFind:     { key: 'goldFind',     label: 'Ascendant Fortune', description: '...', costBase: 200, costGrowth: 1.35 },
  magicFind:    { key: 'magicFind',    label: 'Ascendant Sight', description: '...', costBase: 200, costGrowth: 1.35 },
  xpGain:       { key: 'xpGain',       label: 'Ascendant Wisdom', description: '...', costBase: 200, costGrowth: 1.35 },
  resourceGain: { key: 'resourceGain', label: 'Ascendant Bounty', description: '...', costBase: 200, costGrowth: 1.35 },
  rarityBias:   { key: 'rarityBias',   label: 'Ascendant Fate', description: '...', costBase: 250, costGrowth: 1.4 },
}

/** Cost to buy the NEXT level of a flat node (same formula shape as Echo Shop's `nodeCost`). */
export function flatNodeCost(node: FlatAscendantNode, currentLevel: number): number {
  return Math.floor(node.costBase * node.costGrowth ** currentLevel)
}

export function resolveFlatAscendantBonus(shop: Record<string, number>, kind: FlatAscendantKind): number {
  const level = shop[kind] ?? 0
  return 1 + level * FLAT_PER_LEVEL_BONUS[kind]
}

/** Per-character nodes: NOT a static registry (characters are Sanity content, not a code list —
 *  unlike RESOURCE_SOURCE, there's no fixed array to derive keys from). The cost formula and
 *  effect size are the same for every character; only the LEVEL (read from `ascendant_shop`)
 *  varies. Callers validate a given `charKey` against Sanity (`characterDefExists`, already used
 *  elsewhere) at purchase time — this registry never enumerates valid characters itself. */
const CHAR_COST_BASE = 500
const CHAR_COST_GROWTH = 1.5
const CHAR_PER_LEVEL_BONUS = 0.10 // +10%/level to the bundled stat group — see §5d for exactly which stats

export function charNodeKey(charKey: string, kind: CharAscendantKind): string {
  return `${charKey}.${kind}`
}

export function charNodeCost(currentLevel: number): number {
  return Math.floor(CHAR_COST_BASE * CHAR_COST_GROWTH ** currentLevel)
}

export function resolveCharAscendantBonus(shop: Record<string, number>, charKey: string, kind: CharAscendantKind): number {
  const level = shop[charNodeKey(charKey, kind)] ?? 0
  return level * CHAR_PER_LEVEL_BONUS // a fraction (pct-style, e.g. 0.30 = +30%), NOT "1 + ..." — see §5d
}
```

**Why `resolveCharAscendantBonus` returns a bare fraction, not `1 + ...`:** the Echo Shop's flat
nodes multiply a reward number directly (`amount * resolveShopBonus(...)`). Ascendant Power/
Vitality instead feed the existing `{flat, pct}` stat-stacking engine (`src/lib/stats.ts`'s
`effectiveStats`) as one more `StatBonus` contributor, alongside traits/gear/blessings/capstones
— see §5d. That engine already expects a bare `pct` number to add into the bonus map, not a
pre-multiplied factor.

**8 flat-node kinds + 2 per-character kinds × every character in the roster (19 today, growing).**
This is a genuinely different registry shape from Echo Shop's fully-static 20-node object — flag
this explicitly for whoever builds the shop UI: it renders the 6 flat rows from
`FLAT_ASCENDANT_NODES` the same way Echo Shop renders its grid, but renders the Power/Vitality
rows from the player's own character roster (already fetched for the roster page), not from a
static import.

### 4e. `src/lib/ascendantMilestones.ts` (new code registry) — the extensibility pattern

This is the piece Alex explicitly asked to be a documented pattern, not a one-off: **adding a new
trackable metric to the milestone system is always these three steps.**

1. **Add the key to a lifetime-tracked stat registry** — either `LIFETIME_STAT_KEYS`
   (`src/lib/lifetimeStats.ts`, for numeric running totals: gold, resources, mission/dungeon/raid
   clear counts) or a dedicated `profiles` column for a non-`lifetime_stats` counter
   (`transcend_count` is the one exception this spec introduces, because it's already its own
   column for other reasons — every future metric should default to `lifetime_stats` unless
   there's a similarly strong reason not to).
2. **Have the relevant Edge Function increment it** — the same place that already writes
   `lifetime_stats` deltas today (`mission-claim`, `gather-collect`) or, for this spec, a place
   being taught to for the first time (`group-claim-stage`, §5b).
3. **Add its threshold ladder to `ASCENDANT_MILESTONES`** below. Nothing else — the checking logic
   (§5c) is generic over every entry in this registry; it never special-cases a metric by name.

```typescript
export type MilestoneLadder = {
  metricKey: string        // must match a LIFETIME_STAT_KEYS entry, or 'transcendCount'
  label: string
  /** Threshold VALUES, ascending. Crossing thresholds[i] for the first time awards shardsPerStep. */
  thresholds: number[]
  shardsPerStep: number
}

// STAGE placeholder values below are a first-pass curve (§3 non-goal on tuning): each ladder
// roughly 10x's between steps for the unbounded metrics, keeping early Shards frequent and later
// ones rare — same "shape now, tune later" treatment as everything else provisional here.
export const ASCENDANT_MILESTONES: MilestoneLadder[] = [
  { metricKey: 'goldEarned', label: 'Gold Earned', thresholds: [1_000, 10_000, 100_000, 1_000_000, 10_000_000], shardsPerStep: 1 },
  ...Object.keys(RESOURCE_SOURCE).map((resource) => ({
    metricKey: resourceGatheredKey(resource), // 'resourceGathered.<Resource>'
    label: `${resource} Gathered`,
    thresholds: [500, 5_000, 50_000, 500_000],
    shardsPerStep: 1,
  })),
  { metricKey: 'missionsCleared', label: 'Missions Cleared', thresholds: [50, 500, 5_000], shardsPerStep: 1 },
  { metricKey: 'dungeonsCleared', label: 'Dungeons Cleared', thresholds: [10, 100, 1_000], shardsPerStep: 1 },
  { metricKey: 'raidsCleared', label: 'Raids Cleared', thresholds: [5, 50, 500], shardsPerStep: 1 },
  {
    metricKey: 'transcendCount',
    label: 'Times Transcended',
    // every 2, per Alex: 2, 4, 6, 8, 10, ... — generated, not hand-typed, so extending the ladder
    // later is a range-bound change, not a hand-maintained list.
    thresholds: Array.from({ length: 25 }, (_, i) => (i + 1) * 2),
    shardsPerStep: 1,
  },
]
```

`missionsCleared`, `dungeonsCleared`, `raidsCleared` are **new** `LIFETIME_STAT_KEYS` entries this
spec adds — none of the three currently exist (confirmed: `mission-claim` and `gather-collect`
only ever write `goldEarned`/`missionSecondsSent`/`resourceGathered.<R>`; `group-claim-stage`
writes no lifetime stats at all today).

## 5. Runtime flow

### 5a. The unlock gate: "every raid cleared, ever"

This cannot be checked against `group_runs.status = 'complete'` — Reset already deletes every
`group_runs` row (ADR-0053 §4a), so a player who Resets after clearing every raid would
immediately re-lock the gate, forcing endless re-clearing. That's a live-state table, not a
credential.

Instead, `group-claim-stage` writes a **permanent** flag into `lifetime_stats` the first time a
given raid is fully cleared, reusing the exact dotted-key convention `resourceGathered.<R>`
already established:

```
lifetime_stats["raidCleared.<raidKey>"] = 1   // written once; never incremented again
```

Since `lifetime_stats` already survives both Reset and Transcend, this flag is permanent by
construction — no new "survives everything" column needed, no new wipe-scope rule to get wrong.

The **`transcend-player`** Edge Function (new) checks the gate by querying Sanity for every
currently-authored `raidKey` (`*[_type == "raidDef"].raidKey`) and confirming
`lifetime_stats["raidCleared.<raidKey>"]` is set for every one of them. A raid authored *after* a
player has already cleared everything else simply re-locks the gate until that new raid is
cleared too — the bar can move forward as content grows, which is correct: "all raids" means all
raids that currently exist, the same living-gate behavior ADR-0034's map-order gates already have.

### 5b. New lifetime-stat deltas: `missionsCleared`, `dungeonsCleared`, `raidsCleared`

`mission-claim` already builds a `lifetimeStatsDelta` object (`goldEarned`,
`missionSecondsSent`) and already knows `win` — it gains one more line: on `win`, increment
`lifetimeStatsDelta.missionsCleared` by 1. No other change needed there; `claim_mission` already
merges arbitrary keys from `p_lifetime_stats` into the column, so a new key needs no RPC change.

`group-claim-stage`/`claim_group_stage` need the plumbing built first, below.

### `group-claim-stage` / `claim_group_stage` gain lifetime-stat plumbing

Neither the Edge Function nor the RPC touches `lifetime_stats` today. This spec adds it, mirroring
`mission-claim`'s existing shape exactly:

- `claim_group_stage`'s SQL signature gains `p_lifetime_stats jsonb` (same merge-into-
  `lifetime_stats` logic `claim_mission`/`collect_gather` already have — this is a signature
  change to an existing RPC, not a new one).
- `group-claim-stage/index.ts` builds a `lifetimeStatsDelta` the same way `mission-claim` does
  (it only ever contributes `dungeonsCleared`/`raidsCleared`, never `missionsCleared`):
  - On `win && isLastStage` (the existing `runComplete` signal, already computed): increment
    `lifetimeStatsDelta[kind === 'dungeon' ? 'dungeonsCleared' : 'raidsCleared']` by 1, and — for
    raids only — set `lifetimeStatsDelta[`raidCleared.${defKey}`] = 1` **only if** that key isn't
    already `1` in the player's current `lifetime_stats` (read once at the top of the function,
    same place `echo_shop` is already fetched) — the permanent flag from §5a, written at most once
    per raid per player, never re-written.

### 5c. Milestone checking — computed server-side, under the lock, not passed in from the caller

**This cannot follow the acquisition ledger's "TS computes, RPC just applies" split.** That split
is exactly the shape `reset_player`'s original design used for its award — and it shipped a real
double-award race, caught in Reset's own final review: two concurrent calls could both read a
stale total before either committed, then both award off it. The fix there was to move the
computation inside the RPC, under its row lock, reading the locked row's own state instead of
trusting caller-supplied numbers. Milestones need the same fix, from the start, not discovered
during review a second time.

So: `src/lib/ascendantMilestones.ts`'s `checkAscendantMilestones` (shown below) is a **client-preview
mirror only** — same relationship `src/lib/reset.ts`'s `computeEchoesAward` already has to
`reset_player`'s SQL (a tested parallel implementation for the UI's progress list, §6, never the
source of truth for an actual award). The AUTHORITATIVE check is a new SQL function,
`check_ascendant_milestones`, that duplicates the same ladder data in PL/pgSQL — the identical
"Postgres can't import TypeScript" tradeoff `reset_player` already accepts for its own formula:

```typescript
// src/lib/ascendantMilestones.ts — client-preview mirror of check_ascendant_milestones (SQL).
// Never call this to compute an actual award; it exists so the UI can show live progress toward
// the next unclaimed threshold without a round trip.
export function checkAscendantMilestones(
  lifetimeStats: Record<string, number>,
  transcendCount: number,
  claimed: Record<string, boolean>,
): { newlyClaimedKeys: string[]; shardsAwarded: number } {
  const newlyClaimedKeys: string[] = []
  let shardsAwarded = 0
  for (const ladder of ASCENDANT_MILESTONES) {
    const value = ladder.metricKey === 'transcendCount' ? transcendCount : (lifetimeStats[ladder.metricKey] ?? 0)
    ladder.thresholds.forEach((threshold, i) => {
      const key = `${ladder.metricKey}.${i}`
      if (value >= threshold && !claimed[key]) {
        newlyClaimedKeys.push(key)
        shardsAwarded += ladder.shardsPerStep
      }
    })
  }
  return { newlyClaimedKeys, shardsAwarded }
}
```

```sql
-- Shared by every RPC that can move a tracked metric (claim_mission, collect_gather,
-- claim_group_stage, transcend_player). Mirrors ASCENDANT_MILESTONES exactly — when a new metric
-- is added there (§4e step 3), add its ladder here too, in the same commit. Takes the CALLING
-- RPC's own locked, POST-delta state (never re-queries — the caller already holds the row lock
-- and already computed the merged lifetime_stats for its own update), so two concurrent claims
-- serialize on the same row lock and can never both see a threshold as unclaimed.
create or replace function public.check_ascendant_milestones(
  p_lifetime_stats  jsonb,    -- the POST-delta merged value, not the pre-delta one
  p_transcend_count integer,
  p_claimed         jsonb     -- the row's current ascendant_milestones, read under the same lock
) returns jsonb               -- { shards: integer, newKeys: jsonb }
language plpgsql
as $$
declare
  v_shards   integer := 0;
  v_new_keys jsonb := '{}'::jsonb;
  v_ladder   record;
  v_key      text;
  v_value    numeric;
begin
  for v_ladder in
    select * from (values
      ('goldEarned',            array[1000,10000,100000,1000000,10000000]),
      ('resourceGathered.Wood', array[500,5000,50000,500000]),
      -- one row per RESOURCE_SOURCE key (§4e generates the TS array the same way; this table is
      -- hand-written in the migration, kept in sync manually — same tradeoff reset_player's SQL
      -- constants already accept)
      ('missionsCleared',       array[50,500,5000]),
      ('dungeonsCleared',       array[10,100,1000]),
      ('raidsCleared',          array[5,50,500])
    ) as t(metric_key, thresholds)
  loop
    v_value := coalesce((p_lifetime_stats ->> v_ladder.metric_key)::numeric, 0);
    for i in 1..array_length(v_ladder.thresholds, 1) loop
      v_key := v_ladder.metric_key || '.' || (i - 1);
      if v_value >= v_ladder.thresholds[i] and not coalesce(p_claimed ? v_key, false) then
        v_shards := v_shards + 1;
        v_new_keys := v_new_keys || jsonb_build_object(v_key, true);
      end if;
    end loop;
  end loop;

  -- transcendCount's ladder: every 2, up to 50 (§4e) — its value isn't in lifetime_stats.
  for i in 1..25 loop
    v_key := 'transcendCount.' || (i - 1);
    if p_transcend_count >= i * 2 and not coalesce(p_claimed ? v_key, false) then
      v_shards := v_shards + 1;
      v_new_keys := v_new_keys || jsonb_build_object(v_key, true);
    end if;
  end loop;

  return jsonb_build_object('shards', v_shards, 'newKeys', v_new_keys);
end;
$$;

-- check_ascendant_milestones is only ever called from inside another SECURITY DEFINER function
-- (never invoked directly by a client via PostgREST), but src/test/migration-policy.test.ts
-- enumerates every non-trigger function definition in the migrations, helper or not — it needs
-- the same revoke/grant pair as a real RPC or that test fails.
revoke all on function public.check_ascendant_milestones(jsonb, integer, jsonb) from public, anon, authenticated;
grant execute on function public.check_ascendant_milestones(jsonb, integer, jsonb) to service_role;
```

Every RPC that already merges a `lifetime_stats` delta under its own lock (`claim_mission`,
`collect_gather`, and `claim_group_stage` once §5b adds that plumbing) gains one more step in the
same `update` statement: call `check_ascendant_milestones(<its own post-delta lifetime_stats>,
transcend_count, ascendant_milestones)` and fold the result into `ascendant_shards += (result->>
'shards')::int, ascendant_milestones = ascendant_milestones || (result->'newKeys')`. No new
Edge-Function-supplied parameters are needed for this — every input the SQL function needs is
already inside the RPC's own locked row and its own already-computed delta. The Edge Functions
themselves don't change for this piece at all (beyond `group-claim-stage` gaining the
`lifetimeStatsDelta` plumbing §5b already covers). **`mission-start`/`gather-start`/
`group-start-stage` are untouched** — nothing about starting an activity moves a tracked lifetime
metric, only claiming/collecting does.

The acquisition ledger's existing "TS reads once, computes, RPC applies" shape stays exactly as-is
for character unlocks — that check only ever grants a one-time character unlock, not a repeatable
currency, so its race window (a double-unlock) is harmless in a way a double-award of currency
isn't. Milestones get the stricter, server-computed treatment above specifically because they mint
currency.

### 5d. Where Ascendant Shop bonuses get read

**Per-character (Power/Vitality)** — folded into the existing stat-stacking pipeline as one more
`extraBonuses` contributor, alongside traits/gear/blessings/capstones, in every place that already
calls `effectiveStats()`: `charMaxHp.ts` (mission-start's duration-relevant stats), `mission-claim`,
`group-claim-stage`.

```typescript
// New: resolves a character's ascendant_shop investment into a StatBonus map, same shape as
// collectTraitBonuses/resolveCapstoneBonuses.
export function resolveCharAscendantBonuses(shop: Record<string, number>, charKey: string): Record<string, StatBonus> {
  const power = resolveCharAscendantBonus(shop, charKey, 'power') * 100    // pct points
  const vitality = resolveCharAscendantBonus(shop, charKey, 'vitality') * 100
  const out: Record<string, StatBonus> = {}
  if (power > 0) for (const stat of OFFENSE_STATS) out[stat] = { flat: 0, pct: power }
  if (vitality > 0) for (const stat of VITALITY_STATS) out[stat] = { flat: 0, pct: vitality }
  return out
}

const OFFENSE_STATS = ['attack', 'strength', 'agility', 'speed', 'intelligence', 'spellPower', 'haste']
const VITALITY_STATS = ['health', 'defense']
```

Every call site's `extraBonuses: mergeBonuses(collectTraitBonuses(...), resolveCapstoneBonuses(...))`
becomes `mergeBonuses(collectTraitBonuses(...), resolveCapstoneBonuses(...), resolveCharAscendantBonuses(shop, def.charKey))`
— each site already fetches `def.charKey` (the Sanity character def) and will now also fetch
`ascendant_shop` from the profile alongside `echo_shop` (one extra column in an already-existing
`select`, no new query).

**Flat account-wide nodes:**
- `goldFind` / `magicFind` / `xpGain` — these ALREADY exist as character stats, currently fed
  only by traits/gear/blessings and, for `xpGain`, applied self-only (a survivor's own stat scales
  their own XP). The Ascendant node folds its bonus in as an **additional flat contributor to
  every character's effective stat**, the same mechanism as Power/Vitality above — meaning
  `xpGain` in particular changes in kind, not just size: it becomes something every character
  benefits from account-wide, because the bonus is added to every combatant's `extraBonuses`, not
  just applied post-hoc to one character.
- `missionSpeed` — a separate multiplier layered on top of Echo Shop's own `missionSpeed` lane,
  same "compose multiple multipliers in sequence" pattern `mission-start` already does for
  trait/gear/blessing speed vs. Echo Shop speed: `durationSeconds / resolveShopBonus(echoShop,
  'missionSpeed') / resolveFlatAscendantBonus(ascendantShop, 'missionSpeed')` — one more division,
  same shape, since `resolveFlatAscendantBonus` already returns the full `1 + level × bonus`
  multiplier (§4d), not a bare fraction.
- `resourceGain` — one combined lever multiplying EVERY resource reward line in
  `mission-claim`/`group-claim-stage`, applied after Echo Shop's own per-resource `resourceGain.*`
  multiplier (the two compose: Echo Shop's granular per-resource control, Ascendant's blanket
  top-up).
- **`rarityBias`** — genuinely new mechanic, no existing hook. `src/lib/loot.ts`'s `rollRarity`
  gains an optional `bias` parameter: a multiplier applied to every weight EXCEPT the lowest-listed
  rarity tier before the weighted roll, so higher tiers become proportionally more likely without
  making Common impossible. `resolveFlatAscendantBonus(shop, 'rarityBias')` (already `1 + level ×
  0.04`) is passed straight through as that multiplier. `rollItemLoot`'s signature grows one
  optional parameter; every existing call site that doesn't pass it behaves exactly as before
  (bias defaults to 1 = no change) — this is the one node whose engine change touches shared,
  already-tested code, so it's called out explicitly for the implementer to test carefully (§8).

### 5e. `transcend_player` RPC

```sql
create or replace function public.transcend_player(
  p_player uuid,
  p_protected_ids uuid[]  -- player_characters.id[] chosen by the player at Transcend time,
                          -- length <= their current echo_shop.protectedSlots level
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_protected_slots integer;
  v_transcend_count integer;
  v_ascendant_milestones jsonb;
  v_milestones jsonb;
  v_awarded integer;
begin
  select coalesce((echo_shop ->> 'protectedSlots')::int, 0), transcend_count, ascendant_milestones
    into v_protected_slots, v_transcend_count, v_ascendant_milestones
    from public.profiles
   where player_id = p_player
   for update;

  if not found then
    raise exception 'transcend_player: player not found';
  end if;

  if cardinality(p_protected_ids) > v_protected_slots then
    raise exception 'transcend_player: too many protected characters (have % slots, chose %)', v_protected_slots, cardinality(p_protected_ids);
  end if;
  if exists (
    select 1 from unnest(p_protected_ids) as pid
    where not exists (select 1 from public.player_characters where id = pid and player_id = p_player)
  ) then
    raise exception 'transcend_player: a protected character does not belong to this player';
  end if;

  -- same busy check reset_player uses (mission/gather/group/infirmary/craft), unchanged in shape.
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
    raise exception 'transcend_player: a character is busy';
  end if;

  v_transcend_count := v_transcend_count + 1;
  v_milestones := check_ascendant_milestones(
    (select lifetime_stats from public.profiles where player_id = p_player), -- unchanged by this RPC, read for the check only
    v_transcend_count,
    v_ascendant_milestones
  );
  v_awarded := (v_milestones ->> 'shards')::int;

  update public.profiles
     set currencies           = '{}'::jsonb,
         resources            = '{}'::jsonb,
         map_progress         = '{}'::jsonb,
         infirmary_level      = 1,
         echoes               = 0,
         echo_shop            = '{}'::jsonb,
         unlocked_characters  = (
           select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
           from jsonb_each(unlocked_characters)
           where key in (select character_def_id from public.player_characters
                         where id = any(p_protected_ids))
         ),
         transcend_count      = v_transcend_count,
         ascendant_shards     = ascendant_shards + v_awarded,
         ascendant_milestones = ascendant_milestones || (v_milestones -> 'newKeys')
   where player_id = p_player;

  delete from public.group_runs where player_id = p_player;
  delete from public.player_characters where player_id = p_player and not (id = any(p_protected_ids));

  return jsonb_build_object('shardsAwarded', v_awarded, 'transcendCount', v_transcend_count);
end;
$$;

revoke all on function public.transcend_player(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.transcend_player(uuid, uuid[]) to service_role;
```

Follows the exact "lock first, validate, busy-check, compute under the lock, then wipe" shape
`reset_player` was fixed to use — the milestone award here is computed from the SAME already-locked
row `check_ascendant_milestones` needs, before any wipe statement runs, so there's no window where
a concurrent call could see stale data.

## 6. Client data layer & UI

- `PlayerProfile` (`src/services/profile.ts`) gains `ascendantShards`, `ascendantShop`,
  `ascendantMilestones`, `transcendCount`.
- `src/services/transcend.ts` (new): `fetchTranscendEligibility()` (queries every `raidKey` from
  Sanity + checks `lifetime_stats["raidCleared.<key>"]` for each), `transcendPlayer(protectedIds)`,
  `purchaseAscendantShopNode(nodeKey)`.
- **A second tab in the existing `PrestigePage` shell** (`src/features/reset/PrestigePage.tsx`) —
  the extension point ADR-0053 built for exactly this. The tab bar gains "Transcend", visible only
  once the raid-clear gate is met (mirrors how the Reset tab has always just been unconditionally
  present — the difference here is the tab's VISIBILITY itself is gated, which the tab-shell
  component needs to support: today it renders `TABS = ['Reset']` unconditionally).
  1. **Ascendant Shop grid**: the 6 flat nodes (same layout as Echo Shop's grid) plus a
     per-character section — one row per roster character (fetched via the same roster hook the
     Team page already uses) showing Power/Vitality level, current bonus %, next-level cost, Buy
     buttons. Current `ascendantShards` balance shown prominently.
  2. **Milestone progress**: a compact list (not a full gallery, §3 non-goal) showing each
     `ASCENDANT_MILESTONES` ladder's current value vs. its next unclaimed threshold — gives the
     player a reason to check in on metrics they aren't actively grinding.
  3. **Transcend action**: gate status (met/not met, with which raids are still missing if not),
     a protected-slot picker (checkboxes over the player's current roster, capped at their
     `protectedSlots` level), and a confirm modal spelling out plainly what survives vs. what's
     wiped — same shape as Reset's confirm modal, longer list.
- **Echo Shop grid** (`src/features/reset/components/EchoShopGrid.tsx`) gains one more row:
  **Protected Slots** — a counter display (`X / 5`) instead of a percentage effect, Buy button
  using the same `flatNodeCost`-style curve but counter-shaped (`level` IS the slot count
  directly, no `resolveShopBonus` involved — the purchase RPC (`purchase_echo_shop_node`) already
  just increments `echo_shop[nodeKey]`, which is exactly what a slot counter needs; no RPC change
  required there, only a UI treatment change for this one node).

## 7. Error handling / edge cases

- **Gate not met** → `transcend-player` returns 403 listing which raid(s) are still missing, same
  shape as Reset's gate-failure message.
- **`p_protected_ids` exceeds the player's slot count, or contains a character that isn't the
  player's own** → `transcend_player` raises; the Edge Function surfaces this as a 409. Checked
  under the same row lock as the busy-check, before any wipe statement runs.
- **A newly-authored raid re-locks an already-met gate** → not an error, expected behavior (§5a) —
  the UI's eligibility check simply reports the new raid as still needed.
- **Two concurrent claims both crossing the same milestone threshold** → closed by construction
  (§5c), not just documented: `check_ascendant_milestones` runs inside each awarding RPC, computed
  from that RPC's own already-locked row and its own already-computed post-delta state, never from
  a value an Edge Function read before any lock was taken. This is the exact bug `reset_player`
  shipped and had to be fixed for in Reset's launch review (caller-supplied numbers computed
  outside the lock) — worth restating here because it's the single easiest mistake to reintroduce
  when implementing this spec if `check_ascendant_milestones` is called from TypeScript instead of
  from inside the SQL RPC.
- **`ascendant_shards` can never go negative** — `check (ascendant_shards >= 0)` plus the shop
  purchase RPC's own pre-decrement balance check (same shape as `purchase_echo_shop_node`).
- **`rarityBias` at level 0** — `resolveFlatAscendantBonus` returns exactly `1`, so `rollRarity`'s
  new bias parameter is a no-op multiplier; every existing loot roll (missions, dungeons, raids)
  behaves byte-for-byte as before this ships, for a player who hasn't bought the node.

## 8. Testing

- `src/lib/ascendantShop.ts` — `flatNodeCost`/`charNodeCost` (growth curves), `resolveFlatAscendantBonus`/
  `resolveCharAscendantBonus` (missing key = 0), `resolveCharAscendantBonuses` (correct stat sets
  per kind, zero-bonus produces an empty map).
- `src/lib/ascendantMilestones.ts` — `checkAscendantMilestones`: crossing one threshold, crossing
  several at once, an already-claimed threshold never re-awarding, `transcendCount`'s ladder
  reading from the parameter not from `lifetimeStats`.
- `src/lib/loot.ts` — `rollRarity`/`rollItemLoot` with a `bias` parameter: bias of `1` reproduces
  every existing test's exact output (regression proof the change is additive), a bias `> 1`
  measurably shifts the distribution toward higher-weighted-after-bias rarities over many rolls.
- `src/services/transcend.test.ts` (services layer) — mocked Sanity/Supabase, same pattern as
  `reset.test.ts`.
- `src/test/migration-policy.test.ts` automatically covers the new migration's grants/RLS/RPC
  revoke-grant pairs.
- No automated Edge Function coverage for `transcend-player`/the milestone-checking additions to
  `mission-claim`/`gather-collect`/`group-claim-stage` — same accepted gap as every Edge Function
  in this codebase; verified by reading + manual smoke test, same discipline as Reset's launch.

## 9. Follow-ups (not this spec)

- **Legendary class-specific quest-lines** (TODO.md, added during this brainstorm) — an
  independent item/content system.
- **Real balance tuning** of every threshold/cost/percentage in §4d/§4e once there's playtest
  data.
- **A full milestone/achievement gallery UI** beyond the compact progress list in §6.
- **Deploying dungeons/raids to the hosted project at all** — a pre-existing gap this spec's
  changes to `group-claim-stage` inherit, not something this spec is responsible for closing.
- **`docs/DECISIONS.md` ADR** recording this as built (ADR-0054 or next available number) —
  written after this spec is approved, alongside the implementation plan.
