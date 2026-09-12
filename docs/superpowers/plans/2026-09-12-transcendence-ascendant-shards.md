# Transcendence & Ascendant Shards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ADR-0023's hard-wipe Transcendence tier — Ascendant Shards (earned continuously via lifetime-stat milestones, not a lump sum), the Ascendant Shop (per-character Power/Vitality + flat economy nodes + a new rarity-bias mechanic), the "every raid cleared, ever" unlock gate, and protected character slots (a new Echo Shop node) that let chosen characters survive the wipe.

**Architecture:** New `profiles` columns (`ascendant_shards`, `ascendant_shop`, `ascendant_milestones`, `transcend_count`) alongside the existing Reset columns. A shared SQL function (`check_ascendant_milestones`) runs INSIDE every RPC that can move a tracked lifetime metric (`claim_mission`, `collect_gather`, `claim_group_stage`, `transcend_player`), computed from that RPC's own already-locked row — never passed in from TypeScript — closing the exact double-award race `reset_player` had to be fixed for. Ascendant Power/Vitality plug into the existing `{flat, pct}` stat-stacking engine (`effectiveStats`'s `extraBonuses`) as one more contributor, the same mechanism traits/gear/blessings/capstones already use.

**Tech Stack:** Supabase Postgres (PL/pgSQL migrations), Deno Edge Functions, React 19 + TypeScript + Vitest, TanStack Query.

**Spec:** `docs/superpowers/specs/2026-09-12-transcendence-ascendant-shards-design.md`

## Global Constraints

- Currency name: **Ascendant Shards**. Shop: **Ascendant Shop**.
- Wipe scope (`transcend_player`): everything `reset_player` wipes, PLUS `echoes` → 0, `echo_shop` → `{}`, `unlocked_characters` → `{}` (except protected charKeys), every `player_characters` row deleted (except protected ids). NEVER touched: `lifetime_stats`, `reset_count`, `ascendant_shards`, `ascendant_shop`, `ascendant_milestones`.
- Protected slots: a new Echo Shop node `protectedSlots`, capped at `MAX_PROTECTED_SLOTS = 5`, priced steep (`costBase: 500, costGrowth: 1.8`). A bare counter — never fed through `resolveShopBonus`.
- Unlock gate: every currently-authored `raidDef.raidKey` has `lifetime_stats["raidCleared.<raidKey>"] >= 1` (a permanent flag, since `group_runs` itself is wiped by every Reset).
- Milestone awards are **computed inside the SQL RPC that owns the lock, never in TypeScript before calling it** — this is the single most important constraint in this plan; violating it reintroduces the exact bug `reset_player` shipped and had to fix.
- Ascendant Shop nodes: `missionSpeed`, `goldFind`, `magicFind`, `xpGain`, `resourceGain`, `rarityBias` (flat, `costBase: 200, costGrowth: 1.35`, `rarityBias` at `costBase: 250, costGrowth: 1.4`) and `<charKey>.power` / `<charKey>.vitality` (per-character, `costBase: 500, costGrowth: 1.5`, `+10%/level` to a bundled stat group). `FLAT_PER_LEVEL_BONUS`: `missionSpeed: 0.05, goldFind: 0.08, magicFind: 0.08, xpGain: 0.08, resourceGain: 0.06, rarityBias: 0.04`.
- Milestone ladders (`ASCENDANT_MILESTONES`): `goldEarned` `[1000,10000,100000,1000000,10000000]`, each resource `[500,5000,50000,500000]`, `missionsCleared` `[50,500,5000]`, `dungeonsCleared` `[10,100,1000]`, `raidsCleared` `[5,50,500]`, `transcendCount` every 2 up to 50. `shardsPerStep: 1` for every ladder.
- `group-start-stage`/`group-claim-stage` are not deployed to the hosted Supabase project at all — this plan's changes to them ship in that same not-yet-deployed state (spec §3 non-goal).

---

## Task 1: Ascendant Shards data model — migration

**Files:**
- Create: `supabase/migrations/20260912100000_transcendence_ascendant_shards.sql`

**Interfaces:**
- Produces: `profiles.ascendant_shards` (int), `profiles.ascendant_shop` (jsonb), `profiles.ascendant_milestones` (jsonb), `profiles.transcend_count` (int); `check_ascendant_milestones(p_lifetime_stats jsonb, p_transcend_count integer, p_claimed jsonb) returns jsonb` (`{shards: integer, newKeys: jsonb}`); `transcend_player(p_player uuid, p_protected_ids uuid[]) returns jsonb` (`{shardsAwarded: integer, transcendCount: integer}`); `purchase_ascendant_shop_node(p_player uuid, p_node_key text, p_cost integer) returns jsonb` (`{ascendantShop: jsonb}`, same shape as `purchase_echo_shop_node`).

- [ ] **Step 1: Write the migration**

```sql
-- Transcendence (ADR-0023's hard-wipe half, spec docs/superpowers/specs/2026-09-12-transcendence-
-- ascendant-shards-design.md). Ascendant Shards are earned continuously through milestone
-- thresholds on lifetime stats (check_ascendant_milestones, called from inside every RPC that can
-- move a tracked metric — never computed in TypeScript, to avoid the double-award race
-- reset_player was fixed for), not as a lump sum at the moment of Transcending.

alter table public.profiles
  add column ascendant_shards integer not null default 0 check (ascendant_shards >= 0);
alter table public.profiles
  add column ascendant_shop   jsonb   not null default '{}'::jsonb;
alter table public.profiles
  add column ascendant_milestones jsonb not null default '{}'::jsonb;
alter table public.profiles
  add column transcend_count integer not null default 0 check (transcend_count >= 0);

comment on column public.profiles.ascendant_shards is
  'Spendable currency earned via milestone thresholds on lifetime stats (ADR-0023/spec 2026-09-12). Never wiped by reset_player or transcend_player.';
comment on column public.profiles.ascendant_shop is
  '{ "<nodeKey>": <level> } for flat nodes (missionSpeed/goldFind/magicFind/xpGain/resourceGain/rarityBias) and "<charKey>.power"/"<charKey>.vitality" for per-character nodes. Never wiped.';
comment on column public.profiles.ascendant_milestones is
  '{ "<metricKey>.<thresholdIndex>": true } — permanent record of claimed milestone thresholds. A key present here can never award Shards again, account-lifetime. Never wiped.';
comment on column public.profiles.transcend_count is
  'How many times the player has Transcended. Never wiped — also has its own milestone ladder (every 2).';

-- ---------------------------------------------------------------------------------------------
-- check_ascendant_milestones: shared by every RPC that can move a tracked metric (claim_mission,
-- collect_gather, claim_group_stage, transcend_player). Mirrors src/lib/ascendantMilestones.ts's
-- ASCENDANT_MILESTONES exactly — when a new metric is added there, add its ladder here too, in the
-- same commit (src/lib/reset.ts's SQL/TS duplication is the same accepted tradeoff: Postgres can't
-- import TypeScript). Takes the CALLING RPC's own locked, POST-delta state (never re-queries), so
-- two concurrent claims serialize on the same row lock and can never both see a threshold as
-- unclaimed. Only ever called from inside another SECURITY DEFINER function — never invoked
-- directly via PostgREST — but src/test/migration-policy.test.ts enumerates every non-trigger
-- function regardless, so it still needs its own revoke/grant pair.
-- ---------------------------------------------------------------------------------------------
create or replace function public.check_ascendant_milestones(
  p_lifetime_stats  jsonb,
  p_transcend_count integer,
  p_claimed         jsonb
) returns jsonb
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
      ('goldEarned',              array[1000,10000,100000,1000000,10000000]),
      ('resourceGathered.Wood',   array[500,5000,50000,500000]),
      ('resourceGathered.Copper', array[500,5000,50000,500000]),
      ('resourceGathered.Stone',  array[500,5000,50000,500000]),
      ('resourceGathered.Coal',   array[500,5000,50000,500000]),
      ('resourceGathered.Iron',   array[500,5000,50000,500000]),
      ('resourceGathered.Silver', array[500,5000,50000,500000]),
      ('resourceGathered.Bronze', array[500,5000,50000,500000]),
      ('resourceGathered.Gold',   array[500,5000,50000,500000]),
      ('resourceGathered.Platinum', array[500,5000,50000,500000]),
      ('missionsCleared',        array[50,500,5000]),
      ('dungeonsCleared',        array[10,100,1000]),
      ('raidsCleared',           array[5,50,500])
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

revoke all on function public.check_ascendant_milestones(jsonb, integer, jsonb) from public, anon, authenticated;
grant execute on function public.check_ascendant_milestones(jsonb, integer, jsonb) to service_role;

-- ---------------------------------------------------------------------------------------------
-- transcend_player: the hard-reset action. Busy-checked the same as reset_player; the gate
-- (every raid cleared) is checked by the calling Edge Function, not here (a UX gate, not a
-- security boundary — same split reset_player uses). p_protected_ids are player_characters.id[]
-- the player chose at Transcend time; their rows and unlocked_characters entries survive.
-- ---------------------------------------------------------------------------------------------
create or replace function public.transcend_player(
  p_player uuid,
  p_protected_ids uuid[]
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_protected_slots integer;
  v_transcend_count integer;
  v_ascendant_milestones jsonb;
  v_lifetime_stats jsonb;
  v_milestones jsonb;
  v_awarded integer;
begin
  select coalesce((echo_shop ->> 'protectedSlots')::int, 0), transcend_count, ascendant_milestones, lifetime_stats
    into v_protected_slots, v_transcend_count, v_ascendant_milestones, v_lifetime_stats
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
  v_milestones := check_ascendant_milestones(v_lifetime_stats, v_transcend_count, v_ascendant_milestones);
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

-- ---------------------------------------------------------------------------------------------
-- purchase_ascendant_shop_node: buy the next level of one Ascendant Shop node. Same shape as
-- purchase_echo_shop_node (spec 2026-09-11's Echo Shop), pointed at ascendant_shards/ascendant_shop
-- instead. p_cost is resolved authoritatively by the calling Edge Function from the CODE registry
-- (src/lib/ascendantShop.ts) — no Sanity round-trip for flat nodes; per-character nodes still
-- validate the charKey against Sanity in the Edge Function before calling this.
-- ---------------------------------------------------------------------------------------------
create or replace function public.purchase_ascendant_shop_node(
  p_player   uuid,
  p_node_key text,
  p_cost     integer
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_shards integer;
  v_shop   jsonb;
begin
  if p_node_key is null or length(p_node_key) = 0 then
    raise exception 'purchase_ascendant_shop_node: node key required';
  end if;
  if p_cost is null or p_cost < 0 then
    raise exception 'purchase_ascendant_shop_node: invalid cost';
  end if;

  select ascendant_shards into v_shards
    from public.profiles where player_id = p_player for update;
  if coalesce(v_shards, 0) < p_cost then
    raise exception 'purchase_ascendant_shop_node: insufficient shards (have %, need %)', coalesce(v_shards, 0), p_cost;
  end if;

  update public.profiles
     set ascendant_shards = ascendant_shards - p_cost,
         ascendant_shop = jsonb_set(ascendant_shop, array[p_node_key], to_jsonb(coalesce((ascendant_shop->>p_node_key)::int, 0) + 1))
   where player_id = p_player
   returning ascendant_shop into v_shop;

  return jsonb_build_object('ascendantShop', v_shop);
end;
$$;

revoke all on function public.purchase_ascendant_shop_node(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.purchase_ascendant_shop_node(uuid, text, integer) to service_role;
```

- [ ] **Step 2: Apply and verify**

Apply via the Supabase MCP `apply_migration` tool (name: `transcendence_ascendant_shards`) against the hosted project, or `supabase db push` if working against a local stack. Then verify:

```sql
select column_name, data_type, column_default from information_schema.columns
where table_schema='public' and table_name='profiles'
and column_name in ('ascendant_shards','ascendant_shop','ascendant_milestones','transcend_count');
```
Expected: 4 rows, matching the types/defaults above.

- [ ] **Step 3: Run migration-policy compliance check**

Run: `npx vitest run src/test/migration-policy.test.ts`
Expected: PASS — every new function has a matching revoke/grant pair.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260912100000_transcendence_ascendant_shards.sql
git commit -m "feat: add Ascendant Shards data model, transcend_player, check_ascendant_milestones, purchase_ascendant_shop_node"
```

---

## Task 2: Echo Shop gains the `protectedSlots` node

**Files:**
- Modify: `src/lib/echoShop.ts`
- Modify: `src/lib/echoShop.test.ts`
- Create: `supabase/migrations/20260912100100_echo_shop_protected_slots_cap.sql`

**Interfaces:**
- Consumes: `ECHO_SHOP_NODES`, `ShopEffectKind` (existing, `src/lib/echoShop.ts`).
- Produces: `MAX_PROTECTED_SLOTS = 5` (exported constant), `ECHO_SHOP_NODES.protectedSlots` (a `ShopNode`).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/echoShop.test.ts`:

```typescript
describe('ECHO_SHOP_NODES.protectedSlots', () => {
  it('exists as a flat node with no resource', () => {
    expect(ECHO_SHOP_NODES.protectedSlots).toBeDefined()
    expect(ECHO_SHOP_NODES.protectedSlots.effect).toEqual({ kind: 'protectedSlots' })
  })

  it('is priced steeper than every other flat node', () => {
    expect(ECHO_SHOP_NODES.protectedSlots.costBase).toBeGreaterThan(ECHO_SHOP_NODES.missionSpeed.costBase)
    expect(ECHO_SHOP_NODES.protectedSlots.costGrowth).toBeGreaterThan(ECHO_SHOP_NODES.missionSpeed.costGrowth)
  })
})

describe('MAX_PROTECTED_SLOTS', () => {
  it('is 5', () => {
    expect(MAX_PROTECTED_SLOTS).toBe(5)
  })
})
```

Update the import line at the top of the test file to include `MAX_PROTECTED_SLOTS`:
```typescript
import { ECHO_SHOP_NODES, nodeCost, resolveShopBonus, effectPercent, MAX_PROTECTED_SLOTS } from './echoShop'
```

Also update the existing `'has exactly 20 nodes'` test — it's now 21:
```typescript
it('has exactly 21 nodes: missionSpeed, goldGain, protectedSlots, and 9 resources x 2 lanes', () => {
  expect(Object.keys(ECHO_SHOP_NODES)).toHaveLength(21)
  ...
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/echoShop.test.ts`
Expected: FAIL — `MAX_PROTECTED_SLOTS` is not exported, `ECHO_SHOP_NODES.protectedSlots` is undefined, node count is 20 not 21.

- [ ] **Step 3: Implement**

In `src/lib/echoShop.ts`, change the `ShopEffectKind` type and add the new node. `protectedSlots` is NOT a `resolveShopBonus` multiplier — it's a bare counter `transcend_player` reads directly (`echo_shop->>'protectedSlots'`) — but `PER_LEVEL_BONUS` is typed `Record<ShopEffectKind, number>`, so it needs an entry too (never actually consulted for this key; `0` documents that plainly):

```typescript
export type ShopEffectKind = 'missionSpeed' | 'goldGain' | 'gatherRate' | 'resourceGain' | 'protectedSlots'

export const MAX_PROTECTED_SLOTS = 5
```

In `PER_LEVEL_BONUS`, add:
```typescript
  protectedSlots: 0, // bare counter, not a resolveShopBonus multiplier — level IS the slot count
```

In `FLAT_NODES`, add:
```typescript
  protectedSlots: {
    key: 'protectedSlots',
    label: 'Protected Slot',
    description: 'A character in a protected slot survives your next Transcend completely untouched.',
    effect: { kind: 'protectedSlots' },
    costBase: 500,
    costGrowth: 1.8,
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/echoShop.test.ts`
Expected: PASS, all tests including the updated 21-node count.

- [ ] **Step 5: Write the migration adding the level cap**

```sql
-- purchase_echo_shop_node gains a cap specific to the new protectedSlots node (spec §4c,
-- ADR-0053's original node has no per-node cap concept — every other node stays uncapped).
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
  v_current_level integer;
begin
  if p_node_key is null or length(p_node_key) = 0 then
    raise exception 'purchase_echo_shop_node: node key required';
  end if;
  if p_cost is null or p_cost < 0 then
    raise exception 'purchase_echo_shop_node: invalid cost';
  end if;

  select echoes, echo_shop into v_echoes, v_shop
    from public.profiles where player_id = p_player for update;
  v_current_level := coalesce((v_shop ->> p_node_key)::int, 0);

  if p_node_key = 'protectedSlots' and v_current_level >= 5 then
    raise exception 'purchase_echo_shop_node: protected slots already at maximum (5)';
  end if;

  if coalesce(v_echoes, 0) < p_cost then
    raise exception 'purchase_echo_shop_node: insufficient echoes (have %, need %)', coalesce(v_echoes, 0), p_cost;
  end if;

  update public.profiles
     set echoes = echoes - p_cost,
         echo_shop = jsonb_set(echo_shop, array[p_node_key], to_jsonb(v_current_level + 1))
   where player_id = p_player
   returning echo_shop into v_shop;

  return jsonb_build_object('echoShop', v_shop);
end;
$$;

revoke all on function public.purchase_echo_shop_node(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.purchase_echo_shop_node(uuid, text, integer) to service_role;
```

Note: this uses `create or replace` (not drop+create) — the signature `(uuid, text, integer)` is unchanged from the original, only the body changes.

- [ ] **Step 6: Apply and verify**

Apply the migration. Then run `npx vitest run src/test/migration-policy.test.ts` — PASS (the function still has its revoke/grant pair; `create or replace` on an unchanged signature doesn't need a new one, but this migration re-issues it anyway for clarity, which the test tolerates — it just checks a pair exists at least once).

- [ ] **Step 7: Commit**

```bash
git add src/lib/echoShop.ts src/lib/echoShop.test.ts supabase/migrations/20260912100100_echo_shop_protected_slots_cap.sql
git commit -m "feat: add protectedSlots node to the Echo Shop, capped at 5"
```

---

## Task 3: `lifetime_stats` gains `missionsCleared`/`dungeonsCleared`/`raidsCleared`

**Files:**
- Modify: `src/lib/lifetimeStats.ts`
- Modify: `src/lib/lifetimeStats.test.ts`

**Interfaces:**
- Produces: three new entries in `LIFETIME_STAT_DEFS`/`LIFETIME_STAT_KEYS`/`LIFETIME_STAT_LABELS`: `missionsCleared`, `dungeonsCleared`, `raidsCleared`.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/lifetimeStats.test.ts` (read the existing file first to match its exact style/imports):

```typescript
it('includes missionsCleared, dungeonsCleared, and raidsCleared', () => {
  expect(LIFETIME_STAT_KEYS).toContain('missionsCleared')
  expect(LIFETIME_STAT_KEYS).toContain('dungeonsCleared')
  expect(LIFETIME_STAT_KEYS).toContain('raidsCleared')
  expect(LIFETIME_STAT_LABELS.missionsCleared).toBeTruthy()
  expect(LIFETIME_STAT_LABELS.dungeonsCleared).toBeTruthy()
  expect(LIFETIME_STAT_LABELS.raidsCleared).toBeTruthy()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/lifetimeStats.test.ts`
Expected: FAIL — the three keys aren't in `LIFETIME_STAT_KEYS` yet.

- [ ] **Step 3: Implement**

In `src/lib/lifetimeStats.ts`, add to `LIFETIME_STAT_DEFS` (after the `resourceGathered` spread, order doesn't matter functionally but keep it readable):

```typescript
export const LIFETIME_STAT_DEFS: LifetimeStatDef[] = [
  { key: 'goldEarned', label: 'Gold earned' },
  { key: 'missionSecondsSent', label: 'Time spent on missions' },
  { key: 'missionsCleared', label: 'Missions cleared' },
  { key: 'dungeonsCleared', label: 'Dungeons cleared' },
  { key: 'raidsCleared', label: 'Raids cleared' },
  ...Object.keys(RESOURCE_SOURCE).map((resource) => ({
    key: resourceGatheredKey(resource),
    label: `${resource} gathered`,
  })),
]
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/lifetimeStats.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/lifetimeStats.ts src/lib/lifetimeStats.test.ts
git commit -m "feat: track missionsCleared/dungeonsCleared/raidsCleared as lifetime stats"
```

---

## Task 4: `src/lib/loot.ts` gains a rarity-bias parameter

**Files:**
- Modify: `src/lib/loot.ts`
- Modify: `src/lib/loot.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `rollRarity(weights, rng, bias?)` (bias defaults to `1`), `rollItemLoot(lines, rng, opts)` where `opts` gains an optional `bias?: number` field, forwarded to `rollRarity`.

**This is the one node whose engine change touches shared, already-tested code — regression safety is the priority.**

- [ ] **Step 1: Write the failing tests**

Read `src/lib/loot.test.ts` first to match its exact mocking/RNG style (it likely uses a seeded or stub `rng`). Add:

```typescript
describe('rollRarity with bias', () => {
  it('bias of 1 (default) behaves exactly as before — every existing test still passes unchanged', () => {
    // no new assertion needed here beyond re-running the existing suite (Step 2's full run) —
    // this test documents the intent: rollRarity(weights, rng) === rollRarity(weights, rng, 1)
    const weights = [{ rarity: 'Common', weight: 70 }, { rarity: 'Rare', weight: 30 }]
    const rng = () => 0.8 // lands in the Rare band at bias 1
    expect(rollRarity(weights, rng)).toBe(rollRarity(weights, rng, 1))
  })

  it('a bias > 1 shifts weight toward every rarity except the lowest one present (by RARITY_ORDER)', () => {
    const weights = [{ rarity: 'Common', weight: 50 }, { rarity: 'Rare', weight: 50 }]
    // At bias 1, rng()=0.6 with total=100 lands past Common's 50 -> Rare.
    // At a high bias, Rare's effective weight grows relative to Common's (which is never biased,
    // being the lowest rarity in RARITY_ORDER), so a LOWER rng value should also land in Rare now.
    const rng = () => 0.3
    expect(rollRarity(weights, rng, 1)).toBe('Common')
    expect(rollRarity(weights, rng, 3)).toBe('Rare')
  })
})

describe('rollItemLoot with bias', () => {
  it('omitting bias reproduces the exact same result as passing bias: 1', () => {
    const lines = [{ itemKey: 'test-item', dropChance: 100, quantityMin: 1, quantityMax: 1, rarityWeights: [{ rarity: 'Common', weight: 100 }] }]
    const makeRng = () => { let calls = 0; const seq = [0.1, 0.1, 0.1]; return () => seq[calls++] ?? 0.1 }
    expect(rollItemLoot(lines, makeRng(), { magicFind: 0, luck: 0 }))
      .toEqual(rollItemLoot(lines, makeRng(), { magicFind: 0, luck: 0, bias: 1 }))
  })
})
```

Adjust the exact `rng`/expected-rarity values above once you've read the real `rollRarity` weighted-roll implementation (`src/lib/loot.ts:16-26`) — the intent is: same weights + same rng sequence + bias 1 must equal today's behavior exactly; a bias > 1 must measurably favor non-lowest rarities.

- [ ] **Step 2: Run the FULL existing loot test suite to confirm current baseline passes**

Run: `npx vitest run src/lib/loot.test.ts`
Expected: existing tests PASS (baseline), new tests FAIL (bias parameter doesn't exist yet).

- [ ] **Step 3: Implement**

In `src/lib/loot.ts`:

```typescript
// Canonical rarity ordering, lowest to highest — matches src/lib/stats.ts's RARITY_MULT key
// order. Array POSITION in an authored rarityWeights list is NOT a reliable "lowest tier" signal
// (confirmed by reading loot.test.ts's own fixtures: they list Legendary before Rare in one case)
// — only this explicit order is trustworthy.
const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']

/** Weighted rarity pick (independent per-item roll — ADR-0017). Empty/zero weights -> Common.
 *  `bias` (Ascendant Shop's rarityBias node, ADR-0023/spec 2026-09-12) multiplies every weight
 *  EXCEPT the lowest rarity actually present in this line (by RARITY_ORDER, not array position)
 *  before the roll, shifting probability toward higher tiers without making the lowest-tier
 *  outcome impossible. Defaults to 1 = no change (every existing caller that doesn't pass it
 *  behaves byte-for-byte as before this was added). An unrecognized rarity string sorts as
 *  "lowest" (index -1 loses every comparison), so a typo'd rarity is never accidentally biased up. */
export function rollRarity(weights: RarityWeight[] | undefined, rng: () => number, bias = 1): string {
  const list = (weights ?? []).filter((w) => (w.weight ?? 0) > 0)
  if (list.length === 0) return 'Common'
  const lowestRarity = list.reduce(
    (lowest, w) => (RARITY_ORDER.indexOf(w.rarity) < RARITY_ORDER.indexOf(lowest) ? w.rarity : lowest),
    list[0].rarity,
  )
  const biased = list.map((w) => ({ rarity: w.rarity, weight: w.rarity === lowestRarity ? w.weight : w.weight * bias }))
  const total = biased.reduce((s, w) => s + w.weight, 0)
  let r = rng() * total
  for (const w of biased) {
    r -= w.weight
    if (r < 0) return w.rarity
  }
  return biased[biased.length - 1].rarity
}

export function rollItemLoot(
  lines: LootLine[],
  rng: () => number,
  opts: { magicFind: number; luck: number; bias?: number },
): RolledLoot[] {
  const loot: RolledLoot[] = []
  for (const drop of lines) {
    if (!drop.itemKey) continue
    const chance = Math.min(100, (drop.dropChance ?? 0) * (1 + opts.magicFind / 100))
    if (rng() * 100 >= chance) continue
    const rarity = rollRarity(drop.rarityWeights, rng, opts.bias ?? 1)
    const qMin = drop.quantityMin ?? 1
    const qMax = Math.max(qMin, drop.quantityMax ?? qMin)
    let quantity = qMin + Math.floor(rng() * (qMax - qMin + 1))
    if (rng() * 100 < opts.luck) quantity += 1
    loot.push({ item_def_id: drop.itemKey, rarity, quantity })
  }
  return loot
}
```

- [ ] **Step 4: Run the full loot test suite**

Run: `npx vitest run src/lib/loot.test.ts`
Expected: PASS — every pre-existing test AND the new ones.

- [ ] **Step 5: Run the full test suite to catch any other caller**

Run: `npx vitest run`
Expected: PASS — `rollItemLoot`'s new optional `bias` field is additive; no existing call site breaks.

- [ ] **Step 6: Commit**

```bash
git add src/lib/loot.ts src/lib/loot.test.ts
git commit -m "feat: add an optional rarity-bias parameter to rollRarity/rollItemLoot"
```

---

## Task 5: `src/lib/ascendantShop.ts` (new registry)

**Files:**
- Create: `src/lib/ascendantShop.ts`
- Create: `src/lib/ascendantShop.test.ts`

**Interfaces:**
- Consumes: `RESOURCE_SOURCE` is NOT used here (unlike Echo Shop, there's no per-resource node) — no import from `resources.ts`. Consumes `StatBonus` type from `src/lib/stats.ts`.
- Produces: `FlatAscendantKind`, `CharAscendantKind`, `FLAT_ASCENDANT_NODES`, `flatNodeCost`, `resolveFlatAscendantBonus`, `resolveFlatAscendantStatBonuses`, `charNodeKey`, `charNodeCost`, `resolveCharAscendantBonus`, `resolveCharAscendantBonuses`.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from 'vitest'
import {
  FLAT_ASCENDANT_NODES, flatNodeCost, resolveFlatAscendantBonus, resolveFlatAscendantStatBonuses,
  charNodeKey, charNodeCost, resolveCharAscendantBonus, resolveCharAscendantBonuses,
} from './ascendantShop'

describe('FLAT_ASCENDANT_NODES', () => {
  it('has exactly 6 flat nodes', () => {
    expect(Object.keys(FLAT_ASCENDANT_NODES)).toHaveLength(6)
    expect(FLAT_ASCENDANT_NODES.missionSpeed).toBeDefined()
    expect(FLAT_ASCENDANT_NODES.goldFind).toBeDefined()
    expect(FLAT_ASCENDANT_NODES.magicFind).toBeDefined()
    expect(FLAT_ASCENDANT_NODES.xpGain).toBeDefined()
    expect(FLAT_ASCENDANT_NODES.resourceGain).toBeDefined()
    expect(FLAT_ASCENDANT_NODES.rarityBias).toBeDefined()
  })
})

describe('flatNodeCost', () => {
  it('grows by costGrowth per level, floored', () => {
    const node = FLAT_ASCENDANT_NODES.missionSpeed // costBase 200, costGrowth 1.35
    expect(flatNodeCost(node, 0)).toBe(200)
    expect(flatNodeCost(node, 1)).toBe(270) // floor(200 * 1.35)
  })
})

describe('resolveFlatAscendantBonus', () => {
  it('is 1 (no bonus) with an empty shop', () => {
    expect(resolveFlatAscendantBonus({}, 'missionSpeed')).toBe(1)
  })
  it('scales with level', () => {
    expect(resolveFlatAscendantBonus({ missionSpeed: 2 }, 'missionSpeed')).toBeCloseTo(1.10) // +5%/level
    expect(resolveFlatAscendantBonus({ resourceGain: 3 }, 'resourceGain')).toBeCloseTo(1.18) // +6%/level
  })
})

describe('resolveFlatAscendantStatBonuses', () => {
  it('returns an empty map with an empty shop', () => {
    expect(resolveFlatAscendantStatBonuses({})).toEqual({})
  })
  it('folds goldFind/magicFind/xpGain in as FLAT percentage-point stat bonuses, not multipliers', () => {
    const out = resolveFlatAscendantStatBonuses({ goldFind: 2, xpGain: 1 })
    expect(out.goldFind).toEqual({ flat: 16, pct: 0 }) // 2 levels * 8%/level * 100 = 16 points
    expect(out.xpGain).toEqual({ flat: 8, pct: 0 })
    expect(out.magicFind).toBeUndefined() // level 0 -> not included at all
  })
})

describe('charNodeKey / charNodeCost', () => {
  it('builds the dotted key', () => {
    expect(charNodeKey('lyra-swift', 'power')).toBe('lyra-swift.power')
    expect(charNodeKey('lyra-swift', 'vitality')).toBe('lyra-swift.vitality')
  })
  it('costs the same regardless of character', () => {
    expect(charNodeCost(0)).toBe(500)
    expect(charNodeCost(1)).toBe(750) // floor(500 * 1.5)
  })
})

describe('resolveCharAscendantBonus', () => {
  it('is 0 with no investment', () => {
    expect(resolveCharAscendantBonus({}, 'lyra-swift', 'power')).toBe(0)
  })
  it('scales with level, scoped to that character and kind only', () => {
    const shop = { 'lyra-swift.power': 3, 'lyra-swift.vitality': 1, 'brom-ironwall.power': 5 }
    expect(resolveCharAscendantBonus(shop, 'lyra-swift', 'power')).toBeCloseTo(0.30) // 3 * 10%
    expect(resolveCharAscendantBonus(shop, 'lyra-swift', 'vitality')).toBeCloseTo(0.10)
    expect(resolveCharAscendantBonus(shop, 'brom-ironwall', 'vitality')).toBe(0) // untouched
  })
})

describe('resolveCharAscendantBonuses', () => {
  it('returns an empty map when neither power nor vitality is invested', () => {
    expect(resolveCharAscendantBonuses({}, 'lyra-swift')).toEqual({})
  })
  it('bundles power into the 7 offense stats and vitality into health/defense', () => {
    const out = resolveCharAscendantBonuses({ 'lyra-swift.power': 2, 'lyra-swift.vitality': 1 }, 'lyra-swift')
    expect(out.attack).toEqual({ flat: 0, pct: 20 }) // 2 * 10% * 100
    expect(out.strength).toEqual({ flat: 0, pct: 20 })
    expect(out.agility).toEqual({ flat: 0, pct: 20 })
    expect(out.speed).toEqual({ flat: 0, pct: 20 })
    expect(out.intelligence).toEqual({ flat: 0, pct: 20 })
    expect(out.spellPower).toEqual({ flat: 0, pct: 20 })
    expect(out.haste).toEqual({ flat: 0, pct: 20 })
    expect(out.health).toEqual({ flat: 0, pct: 10 })
    expect(out.defense).toEqual({ flat: 0, pct: 10 })
    expect(Object.keys(out)).toHaveLength(9)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/ascendantShop.test.ts`
Expected: FAIL — the module doesn't exist yet.

- [ ] **Step 3: Implement**

```typescript
// src/lib/ascendantShop.ts
// The Ascendant Shop registry (ADR-0023, spec docs/superpowers/specs/2026-09-12-transcendence-
// ascendant-shards-design.md §4d) — spent with Ascendant Shards, far more impactful per level and
// far more expensive than the Echo Shop's equivalents. Two node shapes: 6 flat, account-wide
// nodes, and 2 per-character nodes (Power/Vitality) purchasable for any valid charKey.

import type { StatBonus } from './stats.ts'

export type FlatAscendantKind = 'missionSpeed' | 'goldFind' | 'magicFind' | 'xpGain' | 'resourceGain' | 'rarityBias'
export type CharAscendantKind = 'power' | 'vitality'

export type FlatAscendantNode = {
  key: FlatAscendantKind
  label: string
  description: string
  costBase: number
  costGrowth: number
}

/** +%/level for each flat node. Provisional (spec §3, tuned later) — an order of magnitude
 *  bigger than the Echo Shop's equivalents (2-3%/level) since Shards are far rarer than Echoes. */
const FLAT_PER_LEVEL_BONUS: Record<FlatAscendantKind, number> = {
  missionSpeed: 0.05,
  goldFind: 0.08,
  magicFind: 0.08,
  xpGain: 0.08,
  resourceGain: 0.06,
  rarityBias: 0.04,
}

export const FLAT_ASCENDANT_NODES: Record<FlatAscendantKind, FlatAscendantNode> = {
  missionSpeed: { key: 'missionSpeed', label: 'Ascendant Haste', description: 'Missions and dungeon/raid stages take even less real-world time to finish.', costBase: 200, costGrowth: 1.35 },
  goldFind:     { key: 'goldFind',     label: 'Ascendant Fortune', description: 'Every character gains Gold Find, account-wide.', costBase: 200, costGrowth: 1.35 },
  magicFind:    { key: 'magicFind',    label: 'Ascendant Sight', description: 'Every character gains Magic Find, account-wide.', costBase: 200, costGrowth: 1.35 },
  xpGain:       { key: 'xpGain',       label: 'Ascendant Wisdom', description: 'Every character gains XP Gain, account-wide.', costBase: 200, costGrowth: 1.35 },
  resourceGain: { key: 'resourceGain', label: 'Ascendant Bounty', description: 'More of every resource from mission and dungeon/raid loot.', costBase: 200, costGrowth: 1.35 },
  rarityBias:   { key: 'rarityBias',   label: 'Ascendant Fate', description: 'Loot rolls favor higher rarities.', costBase: 250, costGrowth: 1.4 },
}

/** Cost to buy the NEXT level of a flat node. */
export function flatNodeCost(node: FlatAscendantNode, currentLevel: number): number {
  return Math.floor(node.costBase * node.costGrowth ** currentLevel)
}

/** Multiplier form (1 + level*rate) for the three PURE multiplier nodes: missionSpeed (duration
 *  division), resourceGain (reward multiplication), rarityBias (passed straight to rollRarity). */
export function resolveFlatAscendantBonus(shop: Record<string, number>, kind: FlatAscendantKind): number {
  const level = shop[kind] ?? 0
  return 1 + level * FLAT_PER_LEVEL_BONUS[kind]
}

/** goldFind/magicFind/xpGain feed the STAT engine as FLAT percentage-point additions — the same
 *  consumption a trait/gear "+N goldFind" effect already uses — NOT the "1 + rate" multiplier
 *  form above, since those three are pure reward/duration multipliers, never stats. A level-0 node
 *  contributes nothing (omitted from the map entirely, matching collectTraitBonuses' convention). */
export function resolveFlatAscendantStatBonuses(shop: Record<string, number>): Record<string, StatBonus> {
  const out: Record<string, StatBonus> = {}
  for (const kind of ['goldFind', 'magicFind', 'xpGain'] as const) {
    const level = shop[kind] ?? 0
    if (level > 0) out[kind] = { flat: level * FLAT_PER_LEVEL_BONUS[kind] * 100, pct: 0 }
  }
  return out
}

/** Per-character nodes: NOT a static registry (characters are Sanity content, not a code list —
 *  unlike RESOURCE_SOURCE, there's no fixed array to derive keys from). Cost and effect size are
 *  the same for every character; only the LEVEL (read from ascendant_shop) varies. Callers
 *  validate a given charKey against Sanity (characterDefExists) at purchase time. */
const CHAR_COST_BASE = 500
const CHAR_COST_GROWTH = 1.5
const CHAR_PER_LEVEL_BONUS = 0.10 // +10%/level to the bundled stat group

export function charNodeKey(charKey: string, kind: CharAscendantKind): string {
  return `${charKey}.${kind}`
}

export function charNodeCost(currentLevel: number): number {
  return Math.floor(CHAR_COST_BASE * CHAR_COST_GROWTH ** currentLevel)
}

/** Bare fraction (e.g. 0.30 = +30%), NOT "1 + ..." — this feeds the {flat, pct} stat engine as a
 *  StatBonus.pct contribution (see resolveCharAscendantBonuses), which expects a bare number to
 *  add, not a pre-multiplied factor. */
export function resolveCharAscendantBonus(shop: Record<string, number>, charKey: string, kind: CharAscendantKind): number {
  const level = shop[charNodeKey(charKey, kind)] ?? 0
  return level * CHAR_PER_LEVEL_BONUS
}

const OFFENSE_STATS = ['attack', 'strength', 'agility', 'speed', 'intelligence', 'spellPower', 'haste']
const VITALITY_STATS = ['health', 'defense']

/** Resolves a character's Power/Vitality investment into a StatBonus map, same shape as
 *  collectTraitBonuses/resolveCapstoneBonuses — pass into effectiveStats' extraBonuses. */
export function resolveCharAscendantBonuses(shop: Record<string, number>, charKey: string): Record<string, StatBonus> {
  const power = resolveCharAscendantBonus(shop, charKey, 'power') * 100
  const vitality = resolveCharAscendantBonus(shop, charKey, 'vitality') * 100
  const out: Record<string, StatBonus> = {}
  if (power > 0) for (const stat of OFFENSE_STATS) out[stat] = { flat: 0, pct: power }
  if (vitality > 0) for (const stat of VITALITY_STATS) out[stat] = { flat: 0, pct: vitality }
  return out
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/ascendantShop.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ascendantShop.ts src/lib/ascendantShop.test.ts
git commit -m "feat: add the Ascendant Shop registry (src/lib/ascendantShop.ts)"
```

---

## Task 6: `src/lib/ascendantMilestones.ts` (new registry, client-preview only)

**Files:**
- Create: `src/lib/ascendantMilestones.ts`
- Create: `src/lib/ascendantMilestones.test.ts`

**Interfaces:**
- Consumes: `RESOURCE_SOURCE` (`src/lib/resources.ts`), `resourceGatheredKey` (`src/lib/lifetimeStats.ts`).
- Produces: `MilestoneLadder` type, `ASCENDANT_MILESTONES` array, `checkAscendantMilestones(lifetimeStats, transcendCount, claimed)`.

**This is a client-preview mirror only — never the source of truth for an actual award (Task 1's `check_ascendant_milestones` SQL function is authoritative).**

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from 'vitest'
import { ASCENDANT_MILESTONES, checkAscendantMilestones } from './ascendantMilestones'

describe('ASCENDANT_MILESTONES', () => {
  it('has one ladder per tracked metric: gold, 9 resources, missions/dungeons/raids cleared, transcend count', () => {
    const keys = ASCENDANT_MILESTONES.map((l) => l.metricKey)
    expect(keys).toContain('goldEarned')
    expect(keys).toContain('resourceGathered.Wood')
    expect(keys).toContain('resourceGathered.Platinum')
    expect(keys).toContain('missionsCleared')
    expect(keys).toContain('dungeonsCleared')
    expect(keys).toContain('raidsCleared')
    expect(keys).toContain('transcendCount')
    expect(keys).toHaveLength(14) // gold + 9 resources + 3 clear-counts + transcendCount
  })

  it("transcendCount's ladder is every 2, up to 50", () => {
    const ladder = ASCENDANT_MILESTONES.find((l) => l.metricKey === 'transcendCount')!
    expect(ladder.thresholds.slice(0, 5)).toEqual([2, 4, 6, 8, 10])
    expect(ladder.thresholds[ladder.thresholds.length - 1]).toBe(50)
  })
})

describe('checkAscendantMilestones', () => {
  it('claims nothing when every value is 0 and nothing was previously claimed', () => {
    const result = checkAscendantMilestones({}, 0, {})
    expect(result.newlyClaimedKeys).toEqual([])
    expect(result.shardsAwarded).toBe(0)
  })

  it('claims every threshold a value has newly crossed', () => {
    const result = checkAscendantMilestones({ goldEarned: 15000 }, 0, {})
    expect(result.newlyClaimedKeys).toEqual(expect.arrayContaining(['goldEarned.0', 'goldEarned.1']))
    expect(result.shardsAwarded).toBe(2)
  })

  it('never re-claims an already-claimed threshold', () => {
    const result = checkAscendantMilestones({ goldEarned: 15000 }, 0, { 'goldEarned.0': true, 'goldEarned.1': true })
    expect(result.newlyClaimedKeys).toEqual([])
    expect(result.shardsAwarded).toBe(0)
  })

  it("reads transcendCount from the parameter, not from lifetimeStats", () => {
    const result = checkAscendantMilestones({ transcendCount: 999 }, 2, {})
    // the lifetimeStats key "transcendCount" (if it ever existed) must be ignored — only the
    // explicit transcendCount parameter counts.
    expect(result.newlyClaimedKeys).toEqual(['transcendCount.0'])
    expect(result.shardsAwarded).toBe(1)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/ascendantMilestones.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

```typescript
// src/lib/ascendantMilestones.ts
// The milestone ladder registry (ADR-0023, spec §4e) — the documented extensibility pattern for
// adding a new Ascendant-Shard-earning metric: (1) add the key to LIFETIME_STAT_KEYS (or a
// dedicated profiles column for a non-lifetime_stats counter, like transcendCount), (2) have the
// relevant Edge Function increment it, (3) add its ladder here. Nothing else — checkAscendantMilestones
// is generic over every entry, never special-cases a metric by name.
//
// checkAscendantMilestones here is a CLIENT-PREVIEW MIRROR ONLY (same relationship src/lib/
// reset.ts's computeEchoesAward has to reset_player's SQL) — never call this to compute an actual
// award. The authoritative check is public.check_ascendant_milestones (SQL, same migration as
// transcend_player), computed inside the RPC that owns the row lock. See spec §5c for why this
// split is load-bearing, not incidental.

import { RESOURCE_SOURCE } from './resources.ts'
import { resourceGatheredKey } from './lifetimeStats.ts'

export type MilestoneLadder = {
  metricKey: string
  label: string
  thresholds: number[]
  shardsPerStep: number
}

export const ASCENDANT_MILESTONES: MilestoneLadder[] = [
  { metricKey: 'goldEarned', label: 'Gold Earned', thresholds: [1_000, 10_000, 100_000, 1_000_000, 10_000_000], shardsPerStep: 1 },
  ...Object.keys(RESOURCE_SOURCE).map((resource) => ({
    metricKey: resourceGatheredKey(resource),
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
    thresholds: Array.from({ length: 25 }, (_, i) => (i + 1) * 2),
    shardsPerStep: 1,
  },
]

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

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/ascendantMilestones.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ascendantMilestones.ts src/lib/ascendantMilestones.test.ts
git commit -m "feat: add the Ascendant Milestones registry (client-preview mirror)"
```

---

## Task 7: `claim_mission` and `collect_gather` gain the milestone check

**Files:**
- Create: `supabase/migrations/20260912100200_claim_mission_collect_gather_milestones.sql`
- Modify: `supabase/functions/mission-claim/index.ts`

**Interfaces:**
- Consumes: `check_ascendant_milestones` (Task 1, SQL).
- Produces: `claim_mission`/`collect_gather` now also apply `ascendant_shards`/`ascendant_milestones` atomically. `mission-claim` now also sends a `missionsCleared: 1` delta on a win.

**Both RPCs keep their EXISTING signatures — this is a body-only change, no `drop function` needed.**

- [ ] **Step 1: Write the migration**

```sql
-- claim_mission and collect_gather gain the Ascendant Milestone check (ADR-0023, spec §5c) —
-- computed from each RPC's own already-locked, post-delta lifetime_stats, inside the same
-- transaction, never passed in from TypeScript (see check_ascendant_milestones's own comment for
-- why). Every other line of both functions is preserved VERBATIM from their current definitions
-- (20260820120000_claim_mission_acquisition.sql / 20260820130000_collect_gather_acquisition.sql)
-- — only the new block is added, right before the final RETURN. Same signatures as today.

create or replace function public.claim_mission(
  p_player          uuid,
  p_run_id          uuid,
  p_char_updates    jsonb,
  p_loot            jsonb,
  p_currencies      jsonb,
  p_resources       jsonb,
  p_map_key         text    default null,
  p_stage           int     default null,
  p_won             boolean default false,
  p_lifetime_stats  jsonb   default '{}'::jsonb,
  p_newly_unlocked  text[]  default '{}'
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_party uuid[];
  v_char  jsonb;
  v_loot  jsonb;
  v_key   text;
  v_val   numeric;
  v_actually_unlocked text[] := '{}';
  v_lifetime_stats jsonb;
  v_transcend_count integer;
  v_ascendant_milestones jsonb;
  v_milestones jsonb;
begin
  delete from public.mission_runs
   where id = p_run_id and player_id = p_player and now() >= ends_at
   returning party into v_party;
  if not found then
    raise exception 'claim_mission: not claimable (already claimed, not owned, or not finished)';
  end if;

  for v_char in select * from jsonb_array_elements(coalesce(p_char_updates, '[]'::jsonb))
  loop
    update public.player_characters
       set level      = (v_char->>'level')::int,
           xp         = (v_char->>'xp')::int,
           current_hp = (v_char->>'current_hp')::int
     where id = (v_char->>'id')::uuid and player_id = p_player;
  end loop;

  for v_loot in select * from jsonb_array_elements(coalesce(p_loot, '[]'::jsonb))
  loop
    insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
    values (p_player, v_loot->>'item_def_id', v_loot->>'rarity', (v_loot->>'quantity')::int)
    on conflict (player_id, item_def_id, rarity)
      do update set quantity = public.player_inventory.quantity + excluded.quantity;
  end loop;

  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_currencies, '{}'::jsonb))
  loop
    update public.profiles
       set currencies = jsonb_set(currencies, array[v_key],
             to_jsonb(coalesce((currencies->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;
  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_resources, '{}'::jsonb))
  loop
    update public.profiles
       set resources = jsonb_set(resources, array[v_key],
             to_jsonb(coalesce((resources->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;

  if p_won and p_map_key is not null and p_stage is not null then
    update public.profiles
       set map_progress = jsonb_set(
             map_progress,
             array[p_map_key],
             to_jsonb(greatest(coalesce((map_progress ->> p_map_key)::int, 0), p_stage))
           )
     where player_id = p_player;
  end if;

  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_lifetime_stats, '{}'::jsonb))
  loop
    update public.profiles
       set lifetime_stats = jsonb_set(lifetime_stats, array[v_key],
             to_jsonb(coalesce((lifetime_stats->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;

  foreach v_key in array coalesce(p_newly_unlocked, '{}')
  loop
    update public.profiles
       set unlocked_characters = jsonb_set(unlocked_characters, array[v_key], to_jsonb(now()))
     where player_id = p_player and not (unlocked_characters ? v_key);
    if found then
      v_actually_unlocked := array_append(v_actually_unlocked, v_key);
    end if;
  end loop;

  -- Ascendant Milestones (ADR-0023): computed from the row's own state, AFTER every delta above
  -- has already been applied to it, so this sees the true post-claim lifetime_stats.
  select lifetime_stats, transcend_count, ascendant_milestones
    into v_lifetime_stats, v_transcend_count, v_ascendant_milestones
    from public.profiles where player_id = p_player;
  v_milestones := check_ascendant_milestones(v_lifetime_stats, v_transcend_count, v_ascendant_milestones);
  update public.profiles
     set ascendant_shards = ascendant_shards + (v_milestones->>'shards')::int,
         ascendant_milestones = ascendant_milestones || (v_milestones->'newKeys')
   where player_id = p_player;

  return jsonb_build_object('claimed', true, 'party', v_party, 'actually_unlocked', v_actually_unlocked);
end;
$$;

revoke all on function public.claim_mission(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, int, boolean, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.claim_mission(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, int, boolean, jsonb, text[]) to service_role;

create or replace function public.collect_gather(
  p_player                uuid,
  p_assignment_id         uuid,
  p_resource              text,
  p_gained                int,
  p_new_last_collected_at timestamptz,
  p_stop                  boolean,
  p_lifetime_stats        jsonb  default '{}'::jsonb,
  p_newly_unlocked        text[] default '{}'
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owned int;
  v_key   text;
  v_val   numeric;
  v_actually_unlocked text[] := '{}';
  v_lifetime_stats jsonb;
  v_transcend_count integer;
  v_ascendant_milestones jsonb;
  v_milestones jsonb;
begin
  select count(*) into v_owned
    from public.gather_assignments
   where id = p_assignment_id and player_id = p_player;
  if v_owned <> 1 then
    raise exception 'collect_gather: assignment not found or not owned';
  end if;

  if p_gained > 0 then
    update public.profiles
       set resources = jsonb_set(resources, array[p_resource],
             to_jsonb(coalesce((resources->>p_resource)::numeric, 0) + p_gained))
     where player_id = p_player;
  end if;

  if p_stop then
    delete from public.gather_assignments where id = p_assignment_id and player_id = p_player;
  else
    update public.gather_assignments
       set last_collected_at = p_new_last_collected_at
     where id = p_assignment_id and player_id = p_player;
  end if;

  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_lifetime_stats, '{}'::jsonb))
  loop
    update public.profiles
       set lifetime_stats = jsonb_set(lifetime_stats, array[v_key],
             to_jsonb(coalesce((lifetime_stats->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;

  foreach v_key in array coalesce(p_newly_unlocked, '{}')
  loop
    update public.profiles
       set unlocked_characters = jsonb_set(unlocked_characters, array[v_key], to_jsonb(now()))
     where player_id = p_player and not (unlocked_characters ? v_key);
    if found then
      v_actually_unlocked := array_append(v_actually_unlocked, v_key);
    end if;
  end loop;

  select lifetime_stats, transcend_count, ascendant_milestones
    into v_lifetime_stats, v_transcend_count, v_ascendant_milestones
    from public.profiles where player_id = p_player;
  v_milestones := check_ascendant_milestones(v_lifetime_stats, v_transcend_count, v_ascendant_milestones);
  update public.profiles
     set ascendant_shards = ascendant_shards + (v_milestones->>'shards')::int,
         ascendant_milestones = ascendant_milestones || (v_milestones->'newKeys')
   where player_id = p_player;

  return jsonb_build_object('gained', p_gained, 'resource', p_resource, 'stopped', p_stop, 'actually_unlocked', v_actually_unlocked);
end;
$$;

revoke all on function public.collect_gather(uuid, uuid, text, int, timestamptz, boolean, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.collect_gather(uuid, uuid, text, int, timestamptz, boolean, jsonb, text[]) to service_role;
```

- [ ] **Step 2: Apply and verify**

Apply the migration. Run `npx vitest run src/test/migration-policy.test.ts` — PASS.

- [ ] **Step 3: Add `mission-claim`'s `missionsCleared` delta**

In `supabase/functions/mission-claim/index.ts`, find the block building `lifetimeStatsDelta` (search for `lifetimeStatsDelta.goldEarned`) and add one line right after it:

```typescript
  const lifetimeStatsDelta: Record<string, number> = {}
  if (win) {
    const goldGranted = currencies['gold'] ?? 0
    if (goldGranted > 0) lifetimeStatsDelta.goldEarned = goldGranted
    lifetimeStatsDelta.missionsCleared = 1
  }
```

`collect_gather`'s caller (`gather-collect/index.ts`) needs NO change here — it never contributes `missionsCleared`/`dungeonsCleared`/`raidsCleared`, only `resourceGathered.<R>` (unchanged).

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260912100200_claim_mission_collect_gather_milestones.sql supabase/functions/mission-claim/index.ts
git commit -m "feat: check Ascendant Milestones in claim_mission and collect_gather; mission-claim tracks missionsCleared"
```

---

## Task 8: `charMaxHp.ts` gains Ascendant Power/Vitality (infirmary only)

**Files:**
- Modify: `supabase/functions/_shared/charMaxHp.ts`
- Modify: `supabase/functions/infirmary-admit/index.ts`
- Modify: `supabase/functions/infirmary-discharge/index.ts`
- Modify: `supabase/functions/infirmary-upgrade/index.ts`

**Interfaces:**
- Consumes: `resolveCharAscendantBonuses`, `resolveFlatAscendantStatBonuses` (Task 5).
- Produces: `statsByCharacter(chars, ctx, ascendantShop?)` and `maxHpByCharacter(chars, ascendantShop?)` — both gain a new OPTIONAL third parameter, defaulting to `{}` (no bonus, current behavior preserved for any caller that doesn't pass it).

**Scope note (read before starting): `mission-start` and `gather-collect` also call `statsByCharacter`, but neither reads any stat Ascendant Power/Vitality touches** (`mission-start` only reads `missionSpeedDecrease`; `gather-collect` only reads `gatherSpeed`/`gatherYield`) — **so they are deliberately NOT changed in this task.** Passing `ascendant_shop` through them would have zero observable effect; only Vitality's Health/Defense bonus matters here, and only the 3 infirmary functions read `stats.health`/`recoverySpeed` in a way Power/Vitality can move.

- [ ] **Step 1: Modify `charMaxHp.ts`**

In `supabase/functions/_shared/charMaxHp.ts`, add the import and thread the new parameter through both exported functions:

```typescript
import { resolveCharAscendantBonuses, resolveFlatAscendantStatBonuses } from '../../../src/lib/ascendantShop.ts'
```

Change `statsByCharacter`'s signature and body:

```typescript
export async function statsByCharacter(
  chars: CharRowForHp[],
  ctx: TraitContext,
  ascendantShop: Record<string, number> = {},
): Promise<Record<string, StatMap>> {
  // ... unchanged charDefs/itemDefs fetch ...

  const out: Record<string, StatMap> = {}
  for (const c of chars) {
    const def = charDefByKey.get(c.character_def_id)
    if (!def) throw new Error(`Missing character definition: ${c.character_def_id}`)
    const picks = c.blessings ?? {}
    out[c.id] = effectiveStats({
      level: c.level,
      baseStats: def.baseStats ?? [],
      growth: def.growth ?? [],
      blessingAllocations: resolveBlessingAllocations(picks),
      blessingNodes: flattenBlessingTree(def.blessingTree),
      equipped: c.equipped ?? {},
      itemDefs: itemDefById,
      extraBonuses: mergeBonuses(
        collectTraitBonuses(def.traits ?? [], ctx),
        resolveCapstoneBonuses(def.capstone, capstoneEarned(c.level, picks), ctx),
        resolveCharAscendantBonuses(ascendantShop, c.character_def_id),
        resolveFlatAscendantStatBonuses(ascendantShop),
      ),
    })
  }
  return out
}

export async function maxHpByCharacter(chars: CharRowForHp[], ascendantShop: Record<string, number> = {}): Promise<Record<string, number>> {
  const stats = await statsByCharacter(chars, {}, ascendantShop)
  return Object.fromEntries(
    chars.map((c) => [c.id, Math.max(1, Math.round(stats[c.id].health ?? 0))]),
  )
}
```

`mergeBonuses` already accepts any number of bonus maps (it's a rest-parameter function) — no change needed there.

- [ ] **Step 2: Wire `infirmary-admit/index.ts`**

Reorder: fetch the profile (now including `ascendant_shop`) BEFORE calling `maxHpByCharacter`, since the bonus needs to be available at that call:

```typescript
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('infirmary_level, ascendant_shop')
    .eq('player_id', playerId)
    .maybeSingle()
  if (profileErr || !profile) {
    console.error('profile lookup failed', profileErr)
    return json({ error: 'Could not load profile' }, 500)
  }
  const ascendantShop = (profile.ascendant_shop ?? {}) as Record<string, number>

  let maxHp: number
  try {
    maxHp = (await maxHpByCharacter([char], ascendantShop))[char.id]
  } catch (e) {
    console.error('Sanity fetch failed', e)
    return json({ error: 'Could not load character content' }, 502)
  }
  if (char.current_hp >= maxHp) return json({ error: 'Character is already at full health' }, 409)
```

Remove the now-duplicate later profile fetch (the original code fetched `profiles` a second time, after `maxHpByCharacter`, only for `infirmary_level` — that's now covered by the single fetch above). The rest of the function (the `admit_infirmary` RPC call using `profile.infirmary_level`) is unchanged.

- [ ] **Step 3: Wire `infirmary-discharge/index.ts`**

```typescript
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('infirmary_level, ascendant_shop')
    .eq('player_id', playerId)
    .maybeSingle()
  if (profileErr || !profile) {
    console.error('profile lookup failed', profileErr)
    return json({ error: 'Could not load profile' }, 500)
  }
  const ascendantShop = (profile.ascendant_shop ?? {}) as Record<string, number>

  let maxHp: number
  let recoverySpeedPct: number
  try {
    const stats = (await statsByCharacter([char], {}, ascendantShop))[char.id]
    maxHp = Math.max(1, Math.round(stats.health ?? 0))
    recoverySpeedPct = stats.recoverySpeed ?? 0
  } catch (e) {
    console.error('Sanity fetch failed', e)
    return json({ error: 'Could not load character content' }, 502)
  }
```

- [ ] **Step 4: Wire `infirmary-upgrade/index.ts`**

Read the file first to find its exact profile-select line (it already selects `infirmary_level` for a different purpose earlier in the function) and add `ascendant_shop` to that same select, then thread it into its `statsByCharacter(chars, {})` call as the third argument.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — this is an Edge Function change (no Deno test infra, per the accepted gap), so the check here is that nothing in the TS/Vitest suite broke (e.g. any shared-type tests).

- [ ] **Step 6: Verify build**

Run: `npm run build && npm run lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/charMaxHp.ts supabase/functions/infirmary-admit/index.ts supabase/functions/infirmary-discharge/index.ts supabase/functions/infirmary-upgrade/index.ts
git commit -m "feat: fold Ascendant Power/Vitality into charMaxHp.ts's effective stats (infirmary)"
```

---

## Task 9: `mission-claim` gains full Ascendant Shop wiring

**Files:**
- Modify: `supabase/functions/mission-claim/index.ts`

**Interfaces:**
- Consumes: `resolveCharAscendantBonuses`, `resolveFlatAscendantStatBonuses`, `resolveFlatAscendantBonus` (Task 5).

**Note:** this task's `missionsCleared` delta was already added in Task 7 — this task adds the STAT and REWARD wiring, a different concern in the same file.

- [ ] **Step 1: Add the import**

```typescript
import { resolveCharAscendantBonuses, resolveFlatAscendantStatBonuses, resolveFlatAscendantBonus } from '../../../src/lib/ascendantShop.ts'
```

- [ ] **Step 2: Fetch `ascendant_shop` alongside `echo_shop`**

Find the existing `.select('map_progress, lifetime_stats, unlocked_characters, echo_shop')` and add `ascendant_shop`:

```typescript
  const { data: profile } = await admin
    .from('profiles')
    .select('map_progress, lifetime_stats, unlocked_characters, echo_shop, ascendant_shop')
    .eq('player_id', playerId)
    .maybeSingle()
  const shop = (profile?.echo_shop ?? {}) as Record<string, number>
  const ascendantShop = (profile?.ascendant_shop ?? {}) as Record<string, number>
```

- [ ] **Step 3: Fold Power/Vitality/flat-stat bonuses into the combatant-building loop**

Find the `extraBonuses: mergeBonuses(...)` call inside the `for (const c of chars)` loop and add two more contributors:

```typescript
      extraBonuses: mergeBonuses(
        collectTraitBonuses(def.traits ?? [], traitCtx),
        resolveCapstoneBonuses(def.capstone, earnedCapstone, traitCtx),
        resolveCharAscendantBonuses(ascendantShop, def.charKey),
        resolveFlatAscendantStatBonuses(ascendantShop),
      ),
```

- [ ] **Step 4: Apply `resourceGain` to the reward loop**

Find the reward loop (`for (const r of mission.rewards ?? [])`) and layer the Ascendant `resourceGain` multiplier on top of the existing Echo Shop `resourceGain` multiplier:

```typescript
      const shopMult = isGold
        ? resolveShopBonus(shop, 'goldGain')
        : r.kind === 'resource'
          ? resolveShopBonus(shop, 'resourceGain', r.code) * resolveFlatAscendantBonus(ascendantShop, 'resourceGain')
          : 1
```

- [ ] **Step 5: Verify build**

Run: `npm run build && npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/mission-claim/index.ts
git commit -m "feat: apply Ascendant Power/Vitality and resourceGain in mission-claim"
```

---

## Task 10: `claim_group_stage`/`group-claim-stage` — full lifetime-stat plumbing + Ascendant wiring

**Files:**
- Create: `supabase/migrations/20260912100300_claim_group_stage_lifetime_stats.sql`
- Modify: `supabase/functions/group-claim-stage/index.ts`

**Interfaces:**
- Consumes: `check_ascendant_milestones` (Task 1), `resolveCharAscendantBonuses`, `resolveFlatAscendantStatBonuses`, `resolveFlatAscendantBonus` (Task 5).
- Produces: `claim_group_stage` gains a `p_lifetime_stats jsonb` parameter (signature change — needs `drop function` first, same as `claim_mission_acquisition.sql`'s precedent).

**This is the largest task in the plan** — `group-claim-stage`/`claim_group_stage` currently have ZERO lifetime-stat integration (confirmed by reading both: no acquisition-ledger hookup exists here at all, a scope cut from when dungeons/raids shipped).

- [ ] **Step 1: Write the migration**

```sql
-- claim_group_stage gains lifetime-stat plumbing it never had (dungeons/raids shipped without
-- acquisition-ledger integration, ADR-0050 scope cut) plus the Ascendant Milestone check — same
-- shape claim_mission/collect_gather just gained (Task 7). This is a genuine signature change
-- (new parameter), so the old 9-arg version must be dropped first, same pattern
-- 20260820120000_claim_mission_acquisition.sql used.
drop function public.claim_group_stage(uuid, text, text, boolean, jsonb, jsonb, jsonb, jsonb, boolean);

create or replace function public.claim_group_stage(
  p_player         uuid,
  p_kind           text,
  p_def_key        text,
  p_won            boolean,
  p_char_updates   jsonb,
  p_loot           jsonb,
  p_currencies     jsonb,
  p_resources      jsonb,
  p_is_last_stage  boolean,
  p_lifetime_stats jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run   public.group_runs;
  v_char  jsonb;
  v_loot  jsonb;
  v_key   text;
  v_val   numeric;
  v_lifetime_stats jsonb;
  v_transcend_count integer;
  v_ascendant_milestones jsonb;
  v_milestones jsonb;
begin
  select * into v_run from public.group_runs
   where player_id = p_player and kind = p_kind and def_key = p_def_key
     and now() >= stage_ends_at
   for update;
  if not found then
    raise exception 'claim_group_stage: not claimable (no run, not finished, or already claimed)';
  end if;

  for v_char in select * from jsonb_array_elements(coalesce(p_char_updates, '[]'::jsonb))
  loop
    update public.player_characters
       set level = (v_char->>'level')::int,
           xp = (v_char->>'xp')::int,
           current_hp = (v_char->>'current_hp')::int
     where id = (v_char->>'id')::uuid and player_id = p_player;
  end loop;

  if p_won then
    for v_loot in select * from jsonb_array_elements(coalesce(p_loot, '[]'::jsonb))
    loop
      insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
      values (p_player, v_loot->>'item_def_id', v_loot->>'rarity', (v_loot->>'quantity')::int)
      on conflict (player_id, item_def_id, rarity)
        do update set quantity = public.player_inventory.quantity + excluded.quantity;
    end loop;

    for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_currencies, '{}'::jsonb))
    loop
      update public.profiles
         set currencies = jsonb_set(currencies, array[v_key],
               to_jsonb(coalesce((currencies->>v_key)::numeric, 0) + v_val))
       where player_id = p_player;
    end loop;
    for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_resources, '{}'::jsonb))
    loop
      update public.profiles
         set resources = jsonb_set(resources, array[v_key],
               to_jsonb(coalesce((resources->>v_key)::numeric, 0) + v_val))
       where player_id = p_player;
    end loop;
  end if;

  if p_won and p_is_last_stage then
    update public.group_runs
       set status = 'complete', party = '{}', stage_started_at = null, stage_ends_at = null,
           last_cleared_at = now()
     where player_id = p_player and kind = p_kind and def_key = p_def_key;
  elsif p_won then
    update public.group_runs
       set current_stage_index = current_stage_index + 1, party = '{}',
           stage_started_at = null, stage_ends_at = null
     where player_id = p_player and kind = p_kind and def_key = p_def_key;
  else
    update public.group_runs
       set party = '{}', stage_started_at = null, stage_ends_at = null
     where player_id = p_player and kind = p_kind and def_key = p_def_key;
  end if;

  -- Lifetime stats: same generic atomic-increment loop claim_mission/collect_gather already use.
  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_lifetime_stats, '{}'::jsonb))
  loop
    update public.profiles
       set lifetime_stats = jsonb_set(lifetime_stats, array[v_key],
             to_jsonb(coalesce((lifetime_stats->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;

  select lifetime_stats, transcend_count, ascendant_milestones
    into v_lifetime_stats, v_transcend_count, v_ascendant_milestones
    from public.profiles where player_id = p_player;
  v_milestones := check_ascendant_milestones(v_lifetime_stats, v_transcend_count, v_ascendant_milestones);
  update public.profiles
     set ascendant_shards = ascendant_shards + (v_milestones->>'shards')::int,
         ascendant_milestones = ascendant_milestones || (v_milestones->'newKeys')
   where player_id = p_player;

  return jsonb_build_object('won', p_won, 'party', v_run.party);
end;
$$;

revoke all on function public.claim_group_stage(uuid, text, text, boolean, jsonb, jsonb, jsonb, jsonb, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.claim_group_stage(uuid, text, text, boolean, jsonb, jsonb, jsonb, jsonb, boolean, jsonb) to service_role;
```

- [ ] **Step 2: Apply and verify**

Apply the migration. Run `npx vitest run src/test/migration-policy.test.ts` — PASS.

- [ ] **Step 3: Modify `group-claim-stage/index.ts`**

Add the imports:

```typescript
import { resolveCharAscendantBonuses, resolveFlatAscendantStatBonuses, resolveFlatAscendantBonus } from '../../../src/lib/ascendantShop.ts'
```

Change the profile select (currently `.select('echo_shop')`) to also fetch `lifetime_stats` and `ascendant_shop`:

```typescript
  const { data: profile } = await admin
    .from('profiles')
    .select('echo_shop, ascendant_shop, lifetime_stats')
    .eq('player_id', playerId)
    .maybeSingle()
  const shop = (profile?.echo_shop ?? {}) as Record<string, number>
  const ascendantShop = (profile?.ascendant_shop ?? {}) as Record<string, number>
  const lifetimeStats = (profile?.lifetime_stats ?? {}) as Record<string, number>
```

Add `resolveCharAscendantBonuses`/`resolveFlatAscendantStatBonuses` to the combatant-building loop's `extraBonuses`:

```typescript
      extraBonuses: mergeBonuses(
        collectTraitBonuses(def.traits ?? [], traitCtx),
        resolveCapstoneBonuses(def.capstone, earnedCapstone, traitCtx),
        resolveCharAscendantBonuses(ascendantShop, def.charKey),
        resolveFlatAscendantStatBonuses(ascendantShop),
      ),
```

Layer `resourceGain` onto the reward loop, same as mission-claim's Task 9:

```typescript
      const shopMult = isGold
        ? resolveShopBonus(shop, 'goldGain')
        : r.kind === 'resource'
          ? resolveShopBonus(shop, 'resourceGain', r.code) * resolveFlatAscendantBonus(ascendantShop, 'resourceGain')
          : 1
```

Build the `lifetimeStatsDelta` — this is genuinely new code (the function has none today). Add right before the `claim_group_stage` RPC call:

```typescript
  const lifetimeStatsDelta: Record<string, number> = {}
  if (win && isLastStage) {
    lifetimeStatsDelta[kind === 'dungeon' ? 'dungeonsCleared' : 'raidsCleared'] = 1
    if (kind === 'raid' && !lifetimeStats[`raidCleared.${defKey}`]) {
      lifetimeStatsDelta[`raidCleared.${defKey}`] = 1
    }
  }
```

Pass it into the RPC call (add the new parameter to the existing `admin.rpc('claim_group_stage', {...})` call):

```typescript
  const { error: claimErr } = await admin.rpc('claim_group_stage', {
    p_player: playerId, p_kind: kind, p_def_key: defKey, p_won: win,
    p_char_updates: charUpdates, p_loot: loot, p_currencies: currencies, p_resources: resources,
    p_is_last_stage: isLastStage,
    p_lifetime_stats: lifetimeStatsDelta,
  })
```

- [ ] **Step 4: Verify build**

Run: `npm run build && npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260912100300_claim_group_stage_lifetime_stats.sql supabase/functions/group-claim-stage/index.ts
git commit -m "feat: give group-claim-stage lifetime-stat plumbing, the raid-cleared flag, and Ascendant Shop wiring"
```

---

## Task 11: `mission-start`/`group-start-stage` apply Ascendant `missionSpeed`

**Files:**
- Modify: `supabase/functions/mission-start/index.ts`
- Modify: `supabase/functions/group-start-stage/index.ts`

**Interfaces:**
- Consumes: `resolveFlatAscendantBonus` (Task 5).

- [ ] **Step 1: Modify `mission-start/index.ts`**

Add the import:
```typescript
import { resolveFlatAscendantBonus } from '../../../src/lib/ascendantShop.ts'
```

Change the profile select from `.select('echo_shop')` to also fetch `ascendant_shop`, and layer the second division onto the existing Echo Shop one:

```typescript
  const { data: profile } = await admin
    .from('profiles')
    .select('echo_shop, ascendant_shop')
    .eq('player_id', playerId)
    .maybeSingle()
  const shop = (profile?.echo_shop ?? {}) as Record<string, number>
  const ascendantShop = (profile?.ascendant_shop ?? {}) as Record<string, number>
  durationSeconds = Math.max(1, Math.round(
    durationSeconds / resolveShopBonus(shop, 'missionSpeed') / resolveFlatAscendantBonus(ascendantShop, 'missionSpeed')
  ))
```

- [ ] **Step 2: Modify `group-start-stage/index.ts`**

Same pattern — add the import, add `ascendant_shop` to the existing `.select('echo_shop')`, layer the division:

```typescript
  const { data: profile } = await admin
    .from('profiles')
    .select('echo_shop, ascendant_shop')
    .eq('player_id', playerId)
    .maybeSingle()
  const shop = (profile?.echo_shop ?? {}) as Record<string, number>
  const ascendantShop = (profile?.ascendant_shop ?? {}) as Record<string, number>
  const durationSeconds = Math.max(1, Math.round(
    stage.durationSeconds / resolveShopBonus(shop, 'missionSpeed') / resolveFlatAscendantBonus(ascendantShop, 'missionSpeed')
  ))
```

- [ ] **Step 3: Verify build**

Run: `npm run build && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/mission-start/index.ts supabase/functions/group-start-stage/index.ts
git commit -m "feat: apply Ascendant missionSpeed to mission-start and group-start-stage"
```

---

## Task 12: `transcend-player` Edge Function (new)

**Files:**
- Create: `supabase/functions/transcend-player/index.ts`

**Interfaces:**
- Consumes: `transcend_player` RPC (Task 1).
- Produces: `POST /transcend-player` with body `{ protectedIds: string[] }`, returns `{ shardsAwarded: number, transcendCount: number }` on success.

- [ ] **Step 1: Write the Edge Function**

```typescript
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'

// transcend-player: the hard-reset action (ADR-0023). Validates the caller, checks the gate
// (every currently-authored raid cleared at least once, ever — a permanent lifetime_stats flag,
// since group_runs itself is wiped by every Reset, spec §5a), then hands off to the atomic
// transcend_player RPC, which recomputes the Ascendant Shard award from the player's OWN locked
// profile row (never from numbers this function could pass in) and owns the wipe.

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

  let body: { protectedIds?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const protectedIds = body.protectedIds
  if (protectedIds !== undefined && (!Array.isArray(protectedIds) || !protectedIds.every((p) => typeof p === 'string'))) {
    return json({ error: 'protectedIds must be an array of character ids' }, 400)
  }

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('lifetime_stats')
    .eq('player_id', playerId)
    .maybeSingle()
  if (profileErr) {
    console.error('transcend-player: profile lookup failed', profileErr)
    return json({ error: 'Could not load profile' }, 500)
  }
  const lifetimeStats = (profile?.lifetime_stats ?? {}) as Record<string, number>

  let raidKeys: string[]
  try {
    raidKeys = await sanityQuery<string[]>(`*[_type == "raidDef"].raidKey`)
  } catch (e) {
    console.error('transcend-player: raid list lookup failed', e)
    return json({ error: 'Could not validate transcend eligibility' }, 502)
  }
  const missingRaids = raidKeys.filter((key) => !lifetimeStats[`raidCleared.${key}`])
  if (missingRaids.length > 0) {
    return json({ error: 'Clear every raid before Transcending', missingRaids }, 403)
  }

  const { data: result, error: rpcErr } = await admin.rpc('transcend_player', {
    p_player: playerId,
    p_protected_ids: protectedIds ?? [],
  })
  if (rpcErr) {
    console.error('transcend-player: transcend_player failed', rpcErr)
    const reason = rpcErr.message.replace(/^.*transcend_player:\s*/, '')
    return json({ error: reason || 'Could not transcend' }, 409)
  }

  return json(result, 200)
})
```

- [ ] **Step 2: Deploy and smoke test**

Deploy via the Supabase MCP `deploy_edge_function` tool (or `supabase functions deploy transcend-player` if working locally), including every local dependency file it transitively imports (`_shared/cors.ts`, `_shared/supabaseAdmin.ts`, `_shared/sanity.ts` — no `src/lib` imports here since this function has none beyond what's already in `_shared`). Verify with a manual call against a test account that hasn't cleared every raid: expect a 403 with a `missingRaids` list.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/transcend-player/index.ts
git commit -m "feat: add the transcend-player Edge Function"
```

---

## Task 13: `ascendant-shop-purchase` Edge Function (new)

**Files:**
- Create: `supabase/functions/ascendant-shop-purchase/index.ts`

**Interfaces:**
- Consumes: `FLAT_ASCENDANT_NODES`, `flatNodeCost`, `charNodeCost` (Task 5), `characterDefExists` (`_shared/sanity.ts`), `purchase_ascendant_shop_node` RPC (Task 1).
- Produces: `POST /ascendant-shop-purchase` with body `{ nodeKey: string }`, returns `{ ascendantShop: Record<string, number> }`.

**Node keys are either a flat key (`missionSpeed`, `goldFind`, etc.) or `<charKey>.power`/`<charKey>.vitality` — this function must distinguish the two and validate accordingly.**

- [ ] **Step 1: Write the Edge Function**

```typescript
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { characterDefExists } from '../_shared/sanity.ts'
import { FLAT_ASCENDANT_NODES, flatNodeCost, charNodeCost, type FlatAscendantKind } from '../../../src/lib/ascendantShop.ts'

// ascendant-shop-purchase: buy the next level of one Ascendant Shop node (ADR-0023). The cost is
// resolved authoritatively here — a flat node's cost comes straight from the CODE registry (no
// Sanity round-trip), a per-character node's cost is the same for every character (only the level
// varies) but the charKey itself is validated against Sanity, since it isn't enumerable from a
// static list the way flat nodes are.

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
  if (typeof nodeKey !== 'string' || nodeKey.length === 0) {
    return json({ error: 'nodeKey is required' }, 400)
  }

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('ascendant_shop')
    .eq('player_id', playerId)
    .maybeSingle()
  if (profileErr) {
    console.error('ascendant-shop-purchase: profile lookup failed', profileErr)
    return json({ error: 'Could not load shop levels' }, 500)
  }
  const shop = (profile?.ascendant_shop ?? {}) as Record<string, number>
  const currentLevel = shop[nodeKey] ?? 0

  let cost: number
  if (nodeKey in FLAT_ASCENDANT_NODES) {
    cost = flatNodeCost(FLAT_ASCENDANT_NODES[nodeKey as FlatAscendantKind], currentLevel)
  } else {
    const dot = nodeKey.lastIndexOf('.')
    const charKey = dot > 0 ? nodeKey.slice(0, dot) : ''
    const kind = dot > 0 ? nodeKey.slice(dot + 1) : ''
    if (kind !== 'power' && kind !== 'vitality') {
      return json({ error: 'Unknown shop node' }, 400)
    }
    let exists: boolean
    try {
      exists = await characterDefExists(charKey)
    } catch (e) {
      console.error('ascendant-shop-purchase: character lookup failed', e)
      return json({ error: 'Could not validate character' }, 502)
    }
    if (!exists) return json({ error: 'Unknown character' }, 400)
    cost = charNodeCost(currentLevel)
  }

  const { data: result, error: rpcErr } = await admin.rpc('purchase_ascendant_shop_node', {
    p_player: playerId,
    p_node_key: nodeKey,
    p_cost: cost,
  })
  if (rpcErr) {
    console.error('ascendant-shop-purchase: purchase_ascendant_shop_node failed', rpcErr)
    const reason = rpcErr.message.replace(/^.*purchase_ascendant_shop_node:\s*/, '')
    return json({ error: reason || 'Could not purchase upgrade' }, 409)
  }

  return json(result, 200)
})
```

- [ ] **Step 2: Deploy and smoke test**

Deploy via the Supabase MCP `deploy_edge_function` tool, including `_shared/cors.ts`, `_shared/supabaseAdmin.ts`, `_shared/sanity.ts`, and `src/lib/ascendantShop.ts` (which itself has no relative imports needing extra files, per Task 5). Verify a flat node purchase and a per-character node purchase both succeed against a test account with enough Shards, and that an invalid charKey returns 400.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/ascendant-shop-purchase/index.ts
git commit -m "feat: add the ascendant-shop-purchase Edge Function"
```

---

## Task 14: `src/services/transcend.ts` + `PlayerProfile` additions

**Files:**
- Create: `src/services/transcend.ts`
- Create: `src/services/transcend.test.ts`
- Modify: `src/services/profile.ts`

**Interfaces:**
- Produces: `fetchRaidKeys(): Promise<string[]>` (every currently-authored raid's key — the missing-raid computation happens client-side in Task 16's `useRaidEligibility` hook, against the already-fetched profile's `lifetimeStats`, same "services layer does the network call, computation happens where the data already is" split `reset.ts` uses for `fetchGateMap`), `transcendPlayer(protectedIds: string[]): Promise<{ shardsAwarded: number; transcendCount: number }>`, `purchaseAscendantShopNode(nodeKey: string): Promise<{ ascendantShop: Record<string, number> }>`. `PlayerProfile` gains `ascendantShards: number`, `ascendantShop: Record<string, number>`, `ascendantMilestones: Record<string, boolean>`, `transcendCount: number`.

- [ ] **Step 1: Write the failing test**

Read `src/services/reset.test.ts` first to match its exact mocking style (mocked `supabase.functions.invoke`, mocked `sanity.fetch`). Write `src/services/transcend.test.ts` mirroring it, with test cases covering:
- `fetchRaidKeys()` calls `sanity.fetch` with a query selecting `raidDef.raidKey` and returns whatever the mocked fetch resolves to, as a plain `string[]`.
- `transcendPlayer(protectedIds)` invokes `'transcend-player'` with `{ protectedIds }` and returns the parsed result.
- `purchaseAscendantShopNode(nodeKey)` invokes `'ascendant-shop-purchase'` with `{ nodeKey }` and returns the parsed result.

Write the actual test file now with real assertions, following `reset.test.ts`'s concrete mock structure (read that file's full content before writing this one — do not guess at the mock shape).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/services/transcend.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

```typescript
import { supabase } from '@/lib/supabase'
import { sanity } from './sanity'
import { invokeError } from './_invoke'

// Transcendence data layer (ADR-0023) — the one Sanity read (every authored raid's key, for the
// gate) plus the two Edge Function calls. The gate itself is computed client-side against the
// player's own lifetime_stats (already available via useProfile()) — this just supplies the full
// raid key list to compare against, same "services layer does the network call" split reset.ts uses.

export async function fetchRaidKeys(): Promise<string[]> {
  return sanity.fetch<string[]>(`*[_type == "raidDef"].raidKey`)
}

export async function transcendPlayer(protectedIds: string[]): Promise<{ shardsAwarded: number; transcendCount: number }> {
  const { data, error } = await supabase.functions.invoke('transcend-player', { body: { protectedIds } })
  if (error) await invokeError(error, 'Could not transcend')
  return data as { shardsAwarded: number; transcendCount: number }
}

export async function purchaseAscendantShopNode(nodeKey: string): Promise<{ ascendantShop: Record<string, number> }> {
  const { data, error } = await supabase.functions.invoke('ascendant-shop-purchase', { body: { nodeKey } })
  if (error) await invokeError(error, 'Could not purchase upgrade')
  return data as { ascendantShop: Record<string, number> }
}
```

In `src/services/profile.ts`, add the four new fields to `PlayerProfile`'s type and to `fetchProfile`'s select + return:

```typescript
export type PlayerProfile = {
  // ... existing fields ...
  /** Ascendant Shards currency (ADR-0023), earned via lifetime-stat milestones. Never wiped. */
  ascendantShards: number
  /** nodeKey -> level (ADR-0023, src/lib/ascendantShop.ts). Never wiped. */
  ascendantShop: Record<string, number>
  /** "<metricKey>.<i>" -> true for every permanently-claimed milestone. Never wiped. */
  ascendantMilestones: Record<string, boolean>
  /** How many times the player has Transcended. Never wiped. */
  transcendCount: number
}

export async function fetchProfile(): Promise<PlayerProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('currencies, resources, reset_count, infirmary_level, map_progress, unlocked_characters, echoes, echo_shop, lifetime_stats, ascendant_shards, ascendant_shop, ascendant_milestones, transcend_count')
    .maybeSingle()
  if (error) throw error
  return {
    // ... existing fields ...
    ascendantShards: data?.ascendant_shards ?? 0,
    ascendantShop: (data?.ascendant_shop ?? {}) as Record<string, number>,
    ascendantMilestones: (data?.ascendant_milestones ?? {}) as Record<string, boolean>,
    transcendCount: data?.transcend_count ?? 0,
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/services/transcend.test.ts src/services/profile.test.ts`
Expected: PASS (update `profile.test.ts`'s mocked Supabase response/expected object if it asserts the full shape — read it first).

- [ ] **Step 5: Commit**

```bash
git add src/services/transcend.ts src/services/transcend.test.ts src/services/profile.ts
git commit -m "feat: add src/services/transcend.ts, expose Ascendant fields on PlayerProfile"
```

---

## Task 15: `EchoShopGrid.tsx` gains a Protected Slots row

**Files:**
- Modify: `src/features/reset/components/EchoShopGrid.tsx`

**Interfaces:**
- Consumes: `MAX_PROTECTED_SLOTS` (Task 2).

**`effectPercent('protectedSlots', level)` would render `0%` (its `PER_LEVEL_BONUS` entry is a dummy `0`, Task 2) — this node needs a counter display instead, not the percentage line every other node gets.**

- [ ] **Step 1: Modify the component**

```typescript
import { ECHO_SHOP_NODES, nodeCost, effectPercent, MAX_PROTECTED_SLOTS } from '@/lib/echoShop'
```

In the `nodes.map((node) => { ... })` block, branch the level/effect display:

```typescript
              <p style={{ color: 'var(--color-text-primary)', fontSize: 12 }}>
                {node.key === 'protectedSlots'
                  ? <>Level {level} <span style={{ color: 'var(--color-text-gold)' }}>({level} / {MAX_PROTECTED_SLOTS} slots)</span></>
                  : <>Level {level} <span style={{ color: 'var(--color-text-gold)' }}>(+{Math.round(effectPercent(node.effect.kind, level))}%)</span></>}
              </p>
```

The Buy button already disables correctly once `canAfford` is false; add the max-level disable too:

```typescript
              <PrimaryButton
                disabled={!canAfford || purchase.isPending || (node.key === 'protectedSlots' && level >= MAX_PROTECTED_SLOTS)}
                onClick={() => purchase.mutate(node.key)}
              >
                {node.key === 'protectedSlots' && level >= MAX_PROTECTED_SLOTS
                  ? 'Maximum reached'
                  : purchase.isPending ? 'Buying...' : `Buy — ${cost.toLocaleString()} Echoes`}
              </PrimaryButton>
```

- [ ] **Step 2: Manual verification**

Start the dev server (`npm run dev`), navigate to `/reset`, confirm the Protected Slots row renders a slot counter instead of a percentage and disables at level 5. (This requires Task 1/2's migration to be live — if testing before deployment, verify visually against mocked data instead.)

- [ ] **Step 3: Verify build**

Run: `npm run build && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/features/reset/components/EchoShopGrid.tsx
git commit -m "feat: show Protected Slots as a counter, not a percentage, in the Echo Shop grid"
```

---

## Task 16: `PrestigePage` gains real tab-switching + the Transcend tab shell

**Files:**
- Modify: `src/features/reset/PrestigePage.tsx`
- Modify: `src/hooks/useRoster.ts`
- Create: `src/features/reset/components/TranscendTab.tsx`
- Modify: `src/features/reset/hooks.ts`

**Interfaces:**
- Consumes: `SegmentedControl` (existing, now used controlled), `useProfile` (existing), `fetchRaidKeys` (Task 14).
- Produces: `useRaidEligibility()` hook (`src/features/reset/hooks.ts`) returning `{ isLoading, error, missingRaids }`; `useCharacterDefs` exported from `useRoster.ts` (was module-private).

**`PrestigePage.tsx` currently renders `<SegmentedControl options={TABS} />` UNCONTROLLED, with a single hardcoded `<ResetTab />` below it — clicking the control changes nothing today (there's only one tab, so it was never wired). This task adds the actual controlled state + conditional rendering, not just a second tab label.**

- [ ] **Step 1: Export `useCharacterDefs` from `useRoster.ts`**

In `src/hooks/useRoster.ts`, change:
```typescript
function useCharacterDefs() {
```
to:
```typescript
export function useCharacterDefs() {
```

- [ ] **Step 2: Add `useRaidEligibility` to `src/features/reset/hooks.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchGateMap, resetPlayer, purchaseEchoShopNode } from '@/services/reset'
import { fetchRaidKeys, transcendPlayer, purchaseAscendantShopNode } from '@/services/transcend'
import { useProfile } from '@/hooks/useProfile'

// ... existing useGateMap/useResetPlayer/usePurchaseEchoShopNode unchanged ...

export function useRaidKeys() {
  return useQuery({ queryKey: ['raidKeys'], queryFn: fetchRaidKeys })
}

/** Every currently-authored raid the player has NOT cleared, ever — the Transcend gate (spec §5a).
 *  Computed here (not in the service layer) because it needs the player's own lifetime_stats,
 *  already available via useProfile(). */
export function useRaidEligibility() {
  const raidKeys = useRaidKeys()
  const profile = useProfile()
  const lifetimeStats = profile.data?.lifetimeStats ?? {}
  const missingRaids = (raidKeys.data ?? []).filter((key) => !lifetimeStats[`raidCleared.${key}`])
  return {
    isLoading: raidKeys.isLoading || profile.isLoading,
    error: raidKeys.error ?? profile.error ?? null,
    missingRaids,
    isEligible: (raidKeys.data?.length ?? 0) > 0 && missingRaids.length === 0,
  }
}

export function useTranscendPlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: transcendPlayer,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export function usePurchaseAscendantShopNode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (nodeKey: string) => purchaseAscendantShopNode(nodeKey),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
```

- [ ] **Step 3: Write `TranscendTab.tsx` as a shell (real content lands in Tasks 17-18)**

```typescript
// src/features/reset/components/TranscendTab.tsx
import { useProfile } from '@/hooks/useProfile'
import { Alert } from '@/components/atoms/Alert'

// Placeholder body — AscendantShopGrid (Task 17) and TranscendAction (Task 18) render here once
// built. Kept as its own component from the start (mirrors ResetTab.tsx's shape) so PrestigePage's
// tab-switching (this task) and the tab's real content (next two tasks) are separate, independently
// reviewable changes.
export function TranscendTab() {
  const profile = useProfile()
  if (profile.isPending) {
    return <p style={{ color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic' }}>Loading...</p>
  }
  if (profile.error || !profile.data) {
    return <Alert variant="error">Could not load your profile.</Alert>
  }
  return <div />
}
```

- [ ] **Step 4: Wire real tab-switching into `PrestigePage.tsx`**

```typescript
// src/features/reset/PrestigePage.tsx
import { useState } from 'react'
import { SegmentedControl } from '@/components/atoms/SegmentedControl'
import { ResetTab } from './components/ResetTab'
import { TranscendTab } from './components/TranscendTab'
import { useRaidEligibility } from './hooks'

export default function PrestigePage() {
  const { isEligible } = useRaidEligibility()
  const tabs = isEligible ? ['Reset', 'Transcend'] : ['Reset']
  const [active, setActive] = useState('Reset')
  // If the gate is lost/regained between renders (a raid re-locking it, spec §5a), never strand
  // the player on a tab that just disappeared.
  const visibleActive = tabs.includes(active) ? active : 'Reset'

  return (
    <div>
      <h1 style={{ color: 'var(--color-gold-light)', fontSize: '22px', letterSpacing: '1px', textShadow: '0 0 12px rgba(240,208,96,0.35)', marginBottom: 14 }}>
        Prestige
      </h1>
      <SegmentedControl options={tabs} value={visibleActive} onChange={setActive} />
      <div style={{ marginTop: 20 }}>
        {visibleActive === 'Reset' ? <ResetTab /> : <TranscendTab />}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Manual verification**

Run `npm run dev`, navigate to `/reset`. Before the gate is met: only "Reset" tab visible (unchanged from today). This can't be fully exercised until Task 1/12's backend is live — note that in the PR description.

- [ ] **Step 6: Verify build**

Run: `npm run build && npm run lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/features/reset/PrestigePage.tsx src/features/reset/hooks.ts src/features/reset/components/TranscendTab.tsx src/hooks/useRoster.ts
git commit -m "feat: wire real tab-switching into PrestigePage, add the gated Transcend tab shell"
```

---

## Task 17: `AscendantShopGrid` + `MilestoneProgressList` components

**Files:**
- Create: `src/features/reset/components/AscendantShopGrid.tsx`
- Create: `src/features/reset/components/MilestoneProgressList.tsx`
- Modify: `src/features/reset/components/TranscendTab.tsx`

**Interfaces:**
- Consumes: `FLAT_ASCENDANT_NODES`, `flatNodeCost`, `charNodeKey`, `charNodeCost` (Task 5), `ASCENDANT_MILESTONES`, `checkAscendantMilestones` (Task 6), `useCharacterDefs` (Task 16), `usePurchaseAscendantShopNode` (Task 16).

- [ ] **Step 1: Write `AscendantShopGrid.tsx`**

```typescript
// src/features/reset/components/AscendantShopGrid.tsx
import { Alert } from '@/components/atoms/Alert'
import { PrimaryButton } from '@/components/atoms/Button'
import { FLAT_ASCENDANT_NODES, flatNodeCost, charNodeKey, charNodeCost } from '@/lib/ascendantShop'
import { useCharacterDefs } from '@/hooks/useRoster'
import { usePurchaseAscendantShopNode } from '../hooks'

export function AscendantShopGrid({ ascendantShards, ascendantShop }: { ascendantShards: number; ascendantShop: Record<string, number> }) {
  const purchase = usePurchaseAscendantShopNode()
  const characterDefs = useCharacterDefs()
  const flatNodes = Object.values(FLAT_ASCENDANT_NODES)

  return (
    <div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
        Ascendant Shop — {ascendantShards.toLocaleString()} Ascendant Shards
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {flatNodes.map((node) => {
          const level = ascendantShop[node.key] ?? 0
          const cost = flatNodeCost(node, level)
          const canAfford = ascendantShards >= cost
          return (
            <div key={node.key} className="atom-heavy" style={{
              borderRadius: 8, border: '2px solid var(--color-gold-dark)', padding: 14,
              display: 'flex', flexDirection: 'column', gap: 8,
              background: 'linear-gradient(180deg, #1c080a 0%, #110305 100%)',
            }}>
              <p style={{ color: 'var(--color-gold-light)', fontSize: 13, fontWeight: 'bold' }}>{node.label}</p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{node.description}</p>
              <p style={{ color: 'var(--color-text-primary)', fontSize: 12 }}>Level {level}</p>
              <PrimaryButton disabled={!canAfford || purchase.isPending} onClick={() => purchase.mutate(node.key)}>
                {purchase.isPending ? 'Buying...' : `Buy — ${cost.toLocaleString()} Shards`}
              </PrimaryButton>
            </div>
          )
        })}
      </div>

      <p style={{ color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '20px 0 10px' }}>
        Character Power
      </p>
      {characterDefs.isLoading && <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Loading roster...</p>}
      {characterDefs.error && <Alert variant="error">Could not load characters.</Alert>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {(characterDefs.data ?? []).map((c) => {
          const powerLevel = ascendantShop[charNodeKey(c.charKey, 'power')] ?? 0
          const vitalityLevel = ascendantShop[charNodeKey(c.charKey, 'vitality')] ?? 0
          const powerCost = charNodeCost(powerLevel)
          const vitalityCost = charNodeCost(vitalityLevel)
          return (
            <div key={c.charKey} className="atom-heavy" style={{
              borderRadius: 8, border: '2px solid var(--color-gold-dark)', padding: 14,
              display: 'flex', flexDirection: 'column', gap: 8,
              background: 'linear-gradient(180deg, #1c080a 0%, #110305 100%)',
            }}>
              <p style={{ color: 'var(--color-gold-light)', fontSize: 13, fontWeight: 'bold' }}>{c.name}</p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{c.charClass}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-primary)', fontSize: 12 }}>Power (Lv {powerLevel})</span>
                <PrimaryButton
                  disabled={ascendantShards < powerCost || purchase.isPending}
                  onClick={() => purchase.mutate(charNodeKey(c.charKey, 'power'))}
                >
                  {powerCost.toLocaleString()}
                </PrimaryButton>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-primary)', fontSize: 12 }}>Vitality (Lv {vitalityLevel})</span>
                <PrimaryButton
                  disabled={ascendantShards < vitalityCost || purchase.isPending}
                  onClick={() => purchase.mutate(charNodeKey(c.charKey, 'vitality'))}
                >
                  {vitalityCost.toLocaleString()}
                </PrimaryButton>
              </div>
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

- [ ] **Step 2: Write `MilestoneProgressList.tsx`**

```typescript
// src/features/reset/components/MilestoneProgressList.tsx
import { ASCENDANT_MILESTONES } from '@/lib/ascendantMilestones'

// Compact progress list (spec §3 non-goal: not a full achievement gallery) — for each ladder,
// shows the current value and the next unclaimed threshold, so a player has a reason to check in
// on metrics they aren't actively grinding.
export function MilestoneProgressList({ lifetimeStats, transcendCount, ascendantMilestones }: {
  lifetimeStats: Record<string, number>
  transcendCount: number
  ascendantMilestones: Record<string, boolean>
}) {
  const rows = ASCENDANT_MILESTONES.map((ladder) => {
    const value = ladder.metricKey === 'transcendCount' ? transcendCount : (lifetimeStats[ladder.metricKey] ?? 0)
    const nextIndex = ladder.thresholds.findIndex((_, i) => !ascendantMilestones[`${ladder.metricKey}.${i}`])
    const next = nextIndex === -1 ? null : ladder.thresholds[nextIndex]
    return { label: ladder.label, value, next }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: 'var(--color-text-primary)' }}>{r.label}</span>
          <span style={{ color: 'var(--color-text-muted)' }}>
            {r.next === null ? `${r.value.toLocaleString()} (maxed)` : `${r.value.toLocaleString()} / ${r.next.toLocaleString()}`}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Wire both into `TranscendTab.tsx`**

```typescript
// src/features/reset/components/TranscendTab.tsx
import { useProfile } from '@/hooks/useProfile'
import { Alert } from '@/components/atoms/Alert'
import { AscendantShopGrid } from './AscendantShopGrid'
import { MilestoneProgressList } from './MilestoneProgressList'

export function TranscendTab() {
  const profile = useProfile()
  if (profile.isPending) {
    return <p style={{ color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic' }}>Loading...</p>
  }
  if (profile.error || !profile.data) {
    return <Alert variant="error">Could not load your profile.</Alert>
  }
  return (
    <div>
      <AscendantShopGrid ascendantShards={profile.data.ascendantShards} ascendantShop={profile.data.ascendantShop} />
      <p style={{ color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '24px 0 10px' }}>
        Milestones
      </p>
      <MilestoneProgressList
        lifetimeStats={profile.data.lifetimeStats}
        transcendCount={profile.data.transcendCount}
        ascendantMilestones={profile.data.ascendantMilestones}
      />
    </div>
  )
}
```

(Task 18 adds the Transcend action section below the milestone list, in the same file.)

- [ ] **Step 4: Verify build**

Run: `npm run build && npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/reset/components/AscendantShopGrid.tsx src/features/reset/components/MilestoneProgressList.tsx src/features/reset/components/TranscendTab.tsx
git commit -m "feat: add the Ascendant Shop grid and milestone progress list"
```

---

## Task 18: `TranscendAction` — protected-slot picker + confirm modal

**Files:**
- Create: `src/features/reset/components/TranscendAction.tsx`
- Modify: `src/features/reset/components/TranscendTab.tsx`

**Interfaces:**
- Consumes: `useRaidEligibility`, `useTranscendPlayer` (Task 16), `useCharacterDefs` (Task 16), `MAX_PROTECTED_SLOTS` (Task 2).

- [ ] **Step 1: Write `TranscendAction.tsx`**

Read `ResetAction.tsx` first (it's the closest precedent — gate status, disabled reasons, confirm modal) and mirror its structure:

```typescript
// src/features/reset/components/TranscendAction.tsx
import { useState } from 'react'
import { Alert } from '@/components/atoms/Alert'
import { PrimaryButton, SecondaryButton } from '@/components/atoms/Button'
import { Modal } from '@/components/organisms/Modal'
import { useCharacterDefs } from '@/hooks/useRoster'
import { useRaidEligibility, useTranscendPlayer } from '../hooks'

export function TranscendAction({ protectedSlots }: { protectedSlots: number }) {
  const eligibility = useRaidEligibility()
  const transcend = useTranscendPlayer()
  const characterDefs = useCharacterDefs()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [justDone, setJustDone] = useState<number | null>(null)

  const disabledReason = eligibility.isLoading
    ? 'Loading...'
    : eligibility.error
      ? 'Could not check Transcend eligibility.'
      : !eligibility.isEligible
        ? `Clear every raid first (${eligibility.missingRaids.length} remaining).`
        : null

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : prev.length < protectedSlots ? [...prev, id] : prev,
    )
  }

  return (
    <div className="atom-heavy" style={{
      marginTop: 24, borderRadius: 8, border: '2px solid var(--color-gold-mid)', padding: 20,
      display: 'flex', flexDirection: 'column', gap: 14,
      background: 'linear-gradient(180deg, #1c080a 0%, #110305 100%)',
    }}>
      <p style={{ color: 'var(--color-gold-light)', fontSize: 15, fontWeight: 'bold' }}>Transcend</p>

      {disabledReason && <Alert variant="warning">{disabledReason}</Alert>}
      {transcend.error && <Alert variant="error">{transcend.error instanceof Error ? transcend.error.message : 'Could not transcend'}</Alert>}
      {justDone !== null && !transcend.error && <Alert variant="success">{`Transcended — ${justDone} Ascendant Shards earned.`}</Alert>}

      {protectedSlots > 0 && (
        <div>
          <p style={{ color: 'var(--color-text-primary)', fontSize: 12, marginBottom: 6 }}>
            Choose up to {protectedSlots} characters to protect ({selected.length}/{protectedSlots}):
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(characterDefs.data ?? []).map((c) => (
              <label key={c.charKey} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-text-primary)' }}>
                <input type="checkbox" checked={selected.includes(c.charKey)} onChange={() => toggle(c.charKey)} />
                {c.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <PrimaryButton disabled={!!disabledReason || transcend.isPending} onClick={() => setConfirmOpen(true)}>
          Transcend
        </PrimaryButton>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <div className="atom-heavy" style={{
          borderRadius: 8, border: '2px solid var(--color-gold-mid)', padding: 24, maxWidth: 420,
          background: 'linear-gradient(180deg, #1c080a 0%, #110305 100%)',
        }}>
          <p style={{ color: 'var(--color-gold-light)', fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>Confirm Transcend</p>
          <p style={{ color: 'var(--color-text-primary)', fontSize: 13, marginBottom: 10 }}>
            This wipes your gold, resources, map progress, dungeon/raid progress, infirmary level,
            Echoes, the Echo Shop, and every character — except the {selected.length} you've chosen
            to protect. It keeps your lifetime stats, Reset count, and every Ascendant Shard and
            Ascendant Shop level you've earned.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <SecondaryButton onClick={() => setConfirmOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton
              disabled={transcend.isPending}
              onClick={() => transcend.mutate(selected, {
                onSuccess: (data) => { setJustDone(data.shardsAwarded); setConfirmOpen(false) },
              })}
            >
              {transcend.isPending ? 'Transcending...' : 'Confirm Transcend'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
```

Note the exact prop signature `useTranscendPlayer()`'s `mutate` expects — check `useMutation`'s `mutationFn: transcendPlayer` from Task 16: `transcendPlayer(protectedIds: string[])`, so `transcend.mutate(selected, {...})` matches directly (no wrapper needed, unlike `useResetPlayer` which takes no argument).

- [ ] **Step 2: Wire into `TranscendTab.tsx`**

```typescript
import { TranscendAction } from './TranscendAction'

// inside the component, after MilestoneProgressList:
      <TranscendAction protectedSlots={profile.data.echoShop.protectedSlots ?? 0} />
```

- [ ] **Step 3: Manual verification**

Run `npm run dev`, navigate to `/reset` → Transcend tab (once eligible). Confirm the character checkboxes cap at `protectedSlots`, the confirm modal lists what's wiped/kept accurately, and the button disables correctly when the gate isn't met.

- [ ] **Step 4: Verify build**

Run: `npm run build && npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/reset/components/TranscendAction.tsx src/features/reset/components/TranscendTab.tsx
git commit -m "feat: add the Transcend action — protected-slot picker and confirm modal"
```

---

## Task 19: ADR + TODO.md + docs close-out

**Files:**
- Modify: `docs/DECISIONS.md` (append after the last ADR)
- Modify: `TODO.md`

- [ ] **Step 1: Confirm the ADR number**

`grep -n "^## ADR-" docs/DECISIONS.md | tail -1` — expected to show `ADR-0053`. If higher, use the next integer and note the change in your report.

- [ ] **Step 2: Append the ADR**

```markdown
## ADR-0054 — Transcendence: Ascendant Shards, earned continuously via milestones

**Date:** 2026-09-12 · **Status:** Accepted (Alex)

**Context.** ADR-0023 (2026-07-09) split the original prestige idea into a soft Reset and a hard
Transcendence; Reset shipped as ADR-0053. Transcendence was deferred — no currency, no shop, no
unlock gate, no wipe RPC.

**Decision.**
- **Ascendant Shards, the Transcendence currency, are earned continuously through milestone
  thresholds on lifetime stats** (gold, each resource, missions/dungeons/raids cleared, Transcend
  count itself) — not a lump sum computed at the moment of Transcending. Crossing a threshold
  anywhere permanently retires it (`profiles.ascendant_milestones`), rewarding breadth of progress
  over depth in one metric.
- **The milestone check runs entirely inside the SQL RPC that already holds the row's lock**
  (`check_ascendant_milestones`, called from `claim_mission`/`collect_gather`/`claim_group_stage`/
  `transcend_player`), never computed in TypeScript beforehand — closing, by construction, the
  exact double-award race `reset_player` shipped and had to be fixed for during Reset's launch
  review.
- **The unlock gate — every currently-authored raid cleared, ever — is a permanent flag inside
  `lifetime_stats`** (`raidCleared.<raidKey>`), not a check against `group_runs`, since Reset
  already deletes every `group_runs` row and would otherwise re-lock an already-earned gate on
  every Reset.
- **Transcending wipes `echoes`/`echo_shop` on top of everything Reset wipes**, plus every
  character — except characters in a **protected slot**, a new Echo Shop node (Echoes currency,
  capped at 5, expensive) chosen at the moment of Transcending.
- **Ascendant Power/Vitality are per-character, account-wide investments** (keyed to `charKey`,
  surviving both Reset and Transcend, re-applying automatically when a character is recruited
  again) — the character-power lane the Reset spec explicitly reserved for this tier.

**Consequences.**
- `claim_mission`, `collect_gather`, and `claim_group_stage` (all pre-existing, already-shipped
  RPCs) gained a shared milestone-check block; `claim_group_stage` additionally gained
  `lifetime_stats` plumbing it never had at all (a scope cut from when dungeons/raids shipped,
  ADR-0050).
- `src/lib/loot.ts`'s `rollRarity`/`rollItemLoot` gained an optional `bias` parameter for the new
  Rarity Bias node — additive, defaults to no change.
- Follow-ups: real balance tuning of every threshold/cost/percentage; a full milestone/achievement
  gallery UI; the legendary class-specific quest-line idea raised during this feature's
  brainstorming, tracked as its own TODO item, unrelated to this mechanic.
```

- [ ] **Step 3: Close the TODO.md item**

Find (`grep -n "Transcendence tier" TODO.md`) and replace:

```markdown
- [ ] **Transcendence tier** (ADR-0023's hard-wipe half) — full wipe including characters, its
  own currency and tree focused on character power, appearing as a second tab in the Reset
  page's `PrestigePage` shell once unlocked. Needs its own spec.
  `↳ context: project-reset · docs/DECISIONS.md ADR-0023/ADR-0053`
```

with:

```markdown
- [x] **Transcendence tier** (ADR-0054) — Ascendant Shards (earned via milestone thresholds on
  lifetime stats, not a lump sum), the Ascendant Shop (per-character Power/Vitality + flat
  economy nodes + rarity bias), the all-raids-cleared unlock gate, and protected character slots
  (a new Echo Shop node). Second tab in the `PrestigePage` shell, gated on eligibility.
  `↳ context: project-reset · docs/DECISIONS.md ADR-0054, docs/superpowers/specs/2026-09-12-transcendence-ascendant-shards-design.md`
```

- [ ] **Step 4: Commit**

```bash
git add docs/DECISIONS.md TODO.md
git commit -m "docs: record ADR-0054 (Transcendence + Ascendant Shards), close the Transcendence TODO item"
```

---

## Self-Review Notes

- **Spec coverage:** §4a (columns) → Task 1; §4c (protectedSlots) → Task 2; §4d (Ascendant Shop
  registry) → Task 5; §4e (milestone registry/pattern) → Task 6; §5a (unlock gate) → Task 12; §5b
  (new lifetime deltas) → Tasks 7, 10; §5c (milestone checking, server-side) → Tasks 1, 7, 10; §5d
  (bonus application sites) → Tasks 8, 9, 10, 11; §5e (`transcend_player`) → Task 1; §6 (UI) →
  Tasks 15-18; §7 (error handling) → Tasks 1, 12, 13 (raises/status codes match); §8 (testing) →
  Tasks 2-6, 14 (unit), Task 1/7/10 Step re: migration-policy (compliance); §9 (follow-ups) →
  Task 19's ADR.
- **Gaps found and filled while planning (not fully spelled out in the spec):** the spec's §6
  mentioned `purchaseAscendantShopNode` in the services-layer bullet but never actually specified
  a `purchase_ascendant_shop_node` RPC or its Edge Function — added in Tasks 1/13, modeled directly
  on `purchase_echo_shop_node`. The spec's §5d described `goldFind`/`magicFind`/`xpGain` as
  "folding in as an additional flat contributor" without specifying the unit conversion from the
  multiplier-shaped `FLAT_PER_LEVEL_BONUS` rate to the percentage-POINT `StatBonus.flat` value the
  stat engine actually expects — resolved in Task 5 as `resolveFlatAscendantStatBonuses`, a
  separate function from `resolveFlatAscendantBonus` (which stays a pure multiplier for
  `missionSpeed`/`resourceGain`/`rarityBias`). The spec didn't address that `statsByCharacter`
  (`charMaxHp.ts`) is shared by 5 Edge Functions, only 3 of which (the infirmary ones) actually
  consume a stat Power/Vitality can move — Task 8 threads the new parameter through only those 3,
  explicitly leaving `mission-start`/`gather-collect` unchanged as a deliberate scope narrowing,
  not an oversight.
- **Type consistency:** `ShopNode`/`ShopEffectKind` (Task 2) match every Task-15 UI consumer
  exactly. `FlatAscendantNode`/`FlatAscendantKind`/`CharAscendantKind` (Task 5) are used
  identically by Tasks 8-13 and 17-18 (`resolveCharAscendantBonuses(shop, charKey)`,
  `resolveFlatAscendantBonus(shop, kind)`, `charNodeKey(charKey, kind)`, `charNodeCost(level)`,
  `flatNodeCost(node, level)` — same parameter names and order everywhere).
  `MilestoneLadder`/`ASCENDANT_MILESTONES` (Task 6) is read identically by `check_ascendant_milestones`
  (SQL, Task 1 — hand-duplicated data, same accepted tradeoff as `reset_player`'s formula) and
  `MilestoneProgressList` (Task 17). `PlayerProfile.ascendantShards`/`.ascendantShop`/
  `.ascendantMilestones`/`.transcendCount` (Task 14) match every consumer in Tasks 16-18 exactly.
  `transcendPlayer(protectedIds: string[])` (Task 14) matches what `transcend-player` returns
  (Task 12: `{shardsAwarded, transcendCount}`) and what `TranscendAction`'s
  `onSuccess: (data) => setJustDone(data.shardsAwarded)` reads (Task 18).
