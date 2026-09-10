# Crafting (`create` recipes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the crafting page from a UI mockup over `src/lib/mockRecipes.ts` into a real, server-authoritative feature: authored `recipeDef`s, a timed craft (spend reagents → wait → claim a rarity-rolled result), and the page migrated into `src/features/crafting/`.

**Architecture:** A new `recipeDef` Sanity document (result + every reagent are plain references to `itemDef`/the resource registry — nothing hardcoded), a `craft_runs` table keyed on `player_id` (one craft at a time, structurally), and two Edge Functions (`craft-start`/`craft-claim`) mirroring `mission-start`/`mission-claim`: the Edge Function resolves authored content from Sanity, a `SECURITY DEFINER` RPC owns atomicity. Pure logic (reagent resolution, affordability, rarity-chance display) lives in `src/lib/crafting.ts` with real tests; the UI is recipe-driven — selecting a recipe fills the circle's slots.

**Tech Stack:** React 19 + TypeScript strict, TanStack Query, Sanity (drafts perspective, weak refs), Supabase (Postgres + Deno Edge Functions), Vitest.

**Spec:** [`docs/superpowers/specs/2026-09-09-crafting-create-recipes-design.md`](../specs/2026-09-09-crafting-create-recipes-design.md) — the binding authority; this plan argues from it.

## Global Constraints

- **Reagents** are `kind: 'resource' | 'item'`. Resource keys are the LIVE `profiles.resources` wallet keys, **capitalized**: `Wood`/`Copper`/`Stone`/`Coal`/`Iron`/`Silver`/`Bronze`/`Gold`/`Platinum` (`src/lib/resources.ts` `RESOURCE_SOURCE`). Not the lowercase currency codes.
- **Item-reagent rarity is the player's choice at craft time** (spec §2) — never authored, never fixed to Common.
- **Result rarity is rolled** from authored `resultRarityWeights` via `rollRarity` from `src/lib/loot.ts` (spec §5). Result quantity is always 1.
- **Reagents are spent at start, not claim** (spec §5). All-or-nothing: any insufficient line aborts the whole transaction.
- **One active craft per player** — `craft_runs.player_id` is the primary key (spec §4c).
- **Crafting is player-level**, not character-bound: no party, no `useRoster` busy-state involvement.
- **No discovery, no `infuse`, no multiple slots** (spec §3). Every `recipeDef` is visible and craftable.
- A recipe has **1–6 reagent lines** (the crafting circle has exactly 6 slots — `src/features/crafting/CraftingPage.tsx` `COUNT = 6`).
- Every SQL function: `security definer`, `set search_path = public, pg_temp`, `revoke all ... from public, anon, authenticated`, `grant execute ... to service_role`. Every new table: RLS on, owner-read policy, `grant select ... to authenticated`, `grant select, insert, update, delete ... to service_role`. `src/test/migration-policy.test.ts` enforces all of this automatically.
- Sanity references between drafts-only documents are written `{ _type: 'reference', _ref: '<base id>', _weak: true }` (`docs/ITEMS.md` "Sanity reference gotcha").
- `npm run lint`, `npm run build`, `npx vitest run` pass before every commit (repo CLAUDE.md). The pre-commit hook runs lint.
- Commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 1: Sanity schema — `rarityWeight` promoted, `reagentLine`, `recipeDef`

**Files:**
- Create: `studio/schemaTypes/objects/rarityWeight.ts`
- Modify: `studio/schemaTypes/objects/lootDrop.ts:30-61`
- Create: `studio/schemaTypes/objects/reagentLine.ts`
- Create: `studio/schemaTypes/recipeDef.ts`
- Modify: `studio/schemaTypes/index.ts`

**Interfaces:**
- Consumes: existing `lootDrop` inline array member named `rarityWeight` (fields `rarity`, `weight`); `RESOURCE_SOURCE` from `src/lib/resources.ts`.
- Produces: Sanity types `rarityWeight` (object), `reagentLine` (object: `kind`, `resource?`, `item?`, `quantity`), `recipeDef` (document: `name`, `recipeKey`, `description?`, `result` ref→itemDef, `resultRarityWeights: rarityWeight[]`, `durationSeconds`, `reagents: reagentLine[]` 1–6).

`lootDrop` currently defines `rarityWeight` as an *inline* array member (`defineArrayMember({ type: 'object', name: 'rarityWeight', ... })`), so `recipeDef` can't reference it by name. Promote it to a shared object type. Existing content already stores `_type: 'rarityWeight'` on those array items, so this is content-compatible.

- [ ] **Step 1: Create the shared `rarityWeight` object**

```typescript
// studio/schemaTypes/objects/rarityWeight.ts
import { defineType, defineField } from 'sanity'

// One line of a weighted rarity roll — shared by lootDrop (mission loot) and recipeDef (crafted
// result). Promoted out of lootDrop's inline array member so both can reference one definition.
// The five rarities match the player_inventory CHECK constraint exactly (Common…Legendary).
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] as const

export const rarityWeight = defineType({
  name: 'rarityWeight',
  title: 'Rarity weight',
  type: 'object',
  fields: [
    defineField({
      name: 'rarity',
      title: 'Rarity',
      type: 'string',
      options: { list: RARITIES.map((r) => ({ title: r, value: r })) },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'weight',
      title: 'Weight',
      type: 'number',
      validation: (rule) => rule.required().min(0),
    }),
  ],
  preview: {
    select: { rarity: 'rarity', weight: 'weight' },
    prepare: ({ rarity, weight }) => ({ title: `${rarity ?? '?'} · w${weight ?? 0}` }),
  },
})
```

- [ ] **Step 2: Point `lootDrop` at it**

In `studio/schemaTypes/objects/lootDrop.ts`, replace the whole `rarityWeights` field's `of: [ defineArrayMember({ type: 'object', name: 'rarityWeight', fields: [...], preview: {...} }) ]` block with:

```typescript
      of: [defineArrayMember({ type: 'rarityWeight' })],
```

Then delete the now-unused `const RARITIES = [...]` at the top of `lootDrop.ts` (it was only used by the inline member). Keep the field's `name`, `title`, `description`, and `type: 'array'` exactly as they are.

- [ ] **Step 3: Create `reagentLine`**

```typescript
// studio/schemaTypes/objects/reagentLine.ts
import { defineType, defineField } from 'sanity'
import { RESOURCE_SOURCE } from '../../../src/lib/resources'

// One reagent a recipe consumes (docs/superpowers/specs/2026-09-09-crafting-create-recipes-
// design.md §4a): either N of a raw resource (the gather-loop registry — keys are the LIVE
// profiles.resources wallet keys, capitalized) or N copies of an item from the player's inventory.
// Item reagents never pin a rarity — the player picks which owned rarity to spend at craft time.
const RESOURCE_OPTIONS = Object.keys(RESOURCE_SOURCE).map((key) => ({ title: key, value: key }))

export const reagentLine = defineType({
  name: 'reagentLine',
  title: 'Reagent',
  type: 'object',
  fields: [
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      options: { list: [{ title: 'Resource', value: 'resource' }, { title: 'Item', value: 'item' }], layout: 'radio' },
      initialValue: 'resource',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'resource',
      title: 'Resource',
      type: 'string',
      options: { list: RESOURCE_OPTIONS },
      hidden: ({ parent }) => (parent as { kind?: string } | undefined)?.kind !== 'resource',
      validation: (rule) =>
        rule.custom((value: string | undefined, context) => {
          const kind = (context.parent as { kind?: string } | undefined)?.kind
          if (kind !== 'resource') return true
          return value ? true : 'A resource reagent needs a resource.'
        }),
    }),
    defineField({
      name: 'item',
      title: 'Item',
      type: 'reference',
      to: [{ type: 'itemDef' }],
      hidden: ({ parent }) => (parent as { kind?: string } | undefined)?.kind !== 'item',
      validation: (rule) =>
        rule.custom((value, context) => {
          const kind = (context.parent as { kind?: string } | undefined)?.kind
          if (kind !== 'item') return true
          return value ? true : 'An item reagent needs an item.'
        }),
    }),
    defineField({
      name: 'quantity',
      title: 'Quantity',
      type: 'number',
      initialValue: 1,
      validation: (rule) => rule.required().integer().min(1),
    }),
  ],
  preview: {
    select: { kind: 'kind', resource: 'resource', itemName: 'item.name', quantity: 'quantity' },
    prepare({ kind, resource, itemName, quantity }) {
      return { title: `${quantity ?? '?'}× ${kind === 'item' ? (itemName ?? '(item)') : (resource ?? '(resource)')}` }
    },
  },
})
```

- [ ] **Step 4: Create `recipeDef`**

```typescript
// studio/schemaTypes/recipeDef.ts
import { defineType, defineField, defineArrayMember } from 'sanity'
import { CogIcon } from '@sanity/icons'

// A `create` crafting recipe (docs/superpowers/specs/2026-09-09-crafting-create-recipes-
// design.md §4b): spend the reagents up front, wait durationSeconds (real-world), claim ONE copy
// of `result` at a rarity rolled from resultRarityWeights. Result and reagents are plain
// references — a new item or recipe is pure content, never a code change (ADR-0004).
// No discovery gating and no `infuse` kind in v1 — both are follow-ups.
export const recipeDef = defineType({
  name: 'recipeDef',
  title: 'Recipe',
  type: 'document',
  icon: CogIcon,
  fields: [
    defineField({ name: 'name', type: 'string', validation: (rule) => rule.required() }),
    defineField({
      name: 'recipeKey',
      title: 'Recipe key',
      description: 'Stable id (craft_runs.recipe_def_id). Lowercase letters, numbers and hyphens. NEVER change once live.',
      type: 'string',
      validation: (rule) =>
        rule.required().custom((value) => {
          if (!value) return 'Required'
          if (!/^[a-z0-9-]+$/.test(value)) return 'Lowercase letters, numbers and hyphens only'
          return true
        }),
    }),
    defineField({ name: 'description', type: 'text', rows: 2 }),
    defineField({
      name: 'result',
      title: 'Result item',
      type: 'reference',
      to: [{ type: 'itemDef' }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'resultRarityWeights',
      title: 'Result rarity weights',
      description: 'The crafted copy\'s rarity is a weighted roll among these lines (same roll loot uses). Leave empty to always produce Common.',
      type: 'array',
      of: [defineArrayMember({ type: 'rarityWeight' })],
    }),
    defineField({
      name: 'durationSeconds',
      title: 'Duration (real-world wait, seconds)',
      description: 'Same meaning as missionDef.durationSeconds — reagents are spent when the craft starts; the result is claimable after this wait.',
      type: 'number',
      validation: (rule) => rule.required().integer().min(1),
    }),
    defineField({
      name: 'reagents',
      title: 'Reagents (1–6)',
      description: 'The crafting circle has 6 slots — one per line.',
      type: 'array',
      of: [defineArrayMember({ type: 'reagentLine' })],
      validation: (rule) => rule.required().min(1).max(6),
    }),
  ],
  preview: {
    select: { title: 'name', result: 'result.name', duration: 'durationSeconds' },
    prepare({ title, result, duration }) {
      return { title, subtitle: [result, duration != null ? `${duration}s` : null].filter(Boolean).join(' · ') }
    },
  },
})
```

- [ ] **Step 5: Register all three**

In `studio/schemaTypes/index.ts` add the imports:

```typescript
import { rarityWeight } from './objects/rarityWeight'
import { reagentLine } from './objects/reagentLine'
import { recipeDef } from './recipeDef'
```

and add `rarityWeight, reagentLine, recipeDef,` to the `schemaTypes` array — `rarityWeight` must appear (anywhere) since both `lootDrop` and `recipeDef` now reference it by name.

- [ ] **Step 6: Verify the studio schema**

Run: `cd studio && npm run build` (`sanity build` — type-checks and bundles the schema; `studio/package.json` has the script). If it can't run in your environment (missing `studio/node_modules`), say so explicitly and instead verify by reading: every `type:` string used in the four files names a registered type (`rarityWeight`, `reagentLine`, `itemDef`, `reference`, `string`, `number`, `array`, `text`), and `lootDrop.ts` no longer defines an inline `rarityWeight`. The `../../../src/lib/resources` import from `objects/` follows the existing studio pattern (`characterDef.ts` imports `../../src/lib/roles`).

- [ ] **Step 7: Commit**

```bash
git add studio/schemaTypes/objects/rarityWeight.ts studio/schemaTypes/objects/lootDrop.ts studio/schemaTypes/objects/reagentLine.ts studio/schemaTypes/recipeDef.ts studio/schemaTypes/index.ts
git commit -m "feat: add recipeDef/reagentLine Sanity schema, promote rarityWeight to a shared object"
```

---

### Task 2: `craft_runs` table + `start_craft`/`claim_craft` RPCs

**Files:**
- Create: `supabase/migrations/20260910110000_craft_runs.sql`
- Test: `src/test/migration-policy.test.ts` (existing — it lints this file automatically)

**Interfaces:**
- Produces: table `public.craft_runs(player_id pk, recipe_def_id, started_at, ends_at)`; RPC `start_craft(p_player uuid, p_recipe_def_id text, p_resource_reagents jsonb, p_item_reagents jsonb, p_duration_seconds int) returns public.craft_runs` where `p_resource_reagents = [{ code, quantity }]` and `p_item_reagents = [{ item_def_id, rarity, quantity }]`; RPC `claim_craft(p_player uuid, p_recipe_def_id text, p_result_item_def_id text, p_result_rarity text) returns jsonb` → `{ item_def_id, rarity }`.

- [ ] **Step 1: Write the migration**

```sql
-- Crafting (create recipes): craft_runs + the two atomic RPCs (docs/superpowers/specs/
-- 2026-09-09-crafting-create-recipes-design.md §4c/§5). Crafting is player-level (no character
-- is dispatched), so unlike mission_runs there is no party and no cross-table busy check — the
-- only concurrency rule is "one craft at a time", made structural by keying the table on
-- player_id. The Edge Functions decide the numbers (which reagents, which rolled rarity); these
-- functions own atomicity, same split as start_mission/claim_mission (ADR-0016).

create table public.craft_runs (
  player_id     uuid primary key references auth.users(id) on delete cascade,
  recipe_def_id text not null,
  started_at    timestamptz not null default now(),
  ends_at       timestamptz not null
);

comment on table public.craft_runs is
  'The player''s single in-progress craft (recipe_def_id = Sanity recipeKey). Reagents are already spent; claim after ends_at grants the result. One row per player, by primary key.';

alter table public.craft_runs enable row level security;

create policy "craft_runs_select_own"
  on public.craft_runs
  for select
  to authenticated
  using (player_id = (select auth.uid()));

-- Writes go through the RPCs below (service_role) only.
grant select on public.craft_runs to authenticated;
grant select, insert, update, delete on public.craft_runs to service_role;

-- ---------------------------------------------------------------------------------------------
-- start_craft: spend every reagent and open the run, atomically. p_resource_reagents and
-- p_item_reagents are already resolved by the Edge Function from the authored recipeDef (the
-- client is never trusted for costs); this function only verifies the player can pay and pays.
--   p_resource_reagents : [{ code, quantity }]                 -- deducted from profiles.resources
--   p_item_reagents     : [{ item_def_id, rarity, quantity }]  -- deducted from player_inventory
-- ---------------------------------------------------------------------------------------------
create or replace function public.start_craft(
  p_player             uuid,
  p_recipe_def_id      text,
  p_resource_reagents  jsonb,
  p_item_reagents      jsonb,
  p_duration_seconds   integer
) returns public.craft_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line      jsonb;
  v_code      text;
  v_need      integer;
  v_have      numeric;
  v_item      text;
  v_rarity    text;
  v_run       public.craft_runs;
begin
  if p_recipe_def_id is null or length(p_recipe_def_id) = 0 then
    raise exception 'start_craft: recipe required';
  end if;
  if p_duration_seconds is null or p_duration_seconds < 1 then
    raise exception 'start_craft: invalid duration';
  end if;

  -- One craft at a time. Lock the profile row first so two concurrent starts serialize here
  -- (and so the resource deductions below can't race a claim_mission payout).
  perform 1 from public.profiles where player_id = p_player for update;
  if exists (select 1 from public.craft_runs where player_id = p_player) then
    raise exception 'start_craft: a craft is already in progress';
  end if;

  -- Resource reagents: verify then deduct each from the JSONB wallet.
  for v_line in select * from jsonb_array_elements(coalesce(p_resource_reagents, '[]'::jsonb))
  loop
    v_code := v_line->>'code';
    v_need := (v_line->>'quantity')::integer;
    if v_code is null or v_need is null or v_need < 1 then
      raise exception 'start_craft: invalid resource reagent';
    end if;
    select coalesce((resources->>v_code)::numeric, 0) into v_have
      from public.profiles where player_id = p_player;
    if v_have < v_need then
      raise exception 'start_craft: not enough % (have %, need %)', v_code, v_have, v_need;
    end if;
    update public.profiles
       set resources = jsonb_set(resources, array[v_code], to_jsonb(v_have - v_need))
     where player_id = p_player;
  end loop;

  -- Item reagents: lock each chosen (item, rarity) stack, verify, deduct (delete at zero) —
  -- the same consume idiom upgrade_items uses (20260709000000_upgrade_items_rpc.sql).
  for v_line in select * from jsonb_array_elements(coalesce(p_item_reagents, '[]'::jsonb))
  loop
    v_item   := v_line->>'item_def_id';
    v_rarity := v_line->>'rarity';
    v_need   := (v_line->>'quantity')::integer;
    if v_item is null or v_rarity is null or v_need is null or v_need < 1 then
      raise exception 'start_craft: invalid item reagent';
    end if;
    select quantity into v_have
      from public.player_inventory
     where player_id = p_player and item_def_id = v_item and rarity = v_rarity
     for update;
    if not found or v_have < v_need then
      raise exception 'start_craft: not enough % (%) — have %, need %', v_item, v_rarity, coalesce(v_have, 0), v_need;
    end if;
    if v_have = v_need then
      delete from public.player_inventory
       where player_id = p_player and item_def_id = v_item and rarity = v_rarity;
    else
      update public.player_inventory
         set quantity = quantity - v_need
       where player_id = p_player and item_def_id = v_item and rarity = v_rarity;
    end if;
  end loop;

  insert into public.craft_runs (player_id, recipe_def_id, started_at, ends_at)
  values (p_player, p_recipe_def_id, now(), now() + make_interval(secs => p_duration_seconds))
  returning * into v_run;

  return v_run;
end;
$$;

revoke all on function public.start_craft(uuid, text, jsonb, jsonb, integer) from public, anon, authenticated;
grant execute on function public.start_craft(uuid, text, jsonb, jsonb, integer) to service_role;

-- ---------------------------------------------------------------------------------------------
-- claim_craft: grant the rolled result and close the run. The atomic conditional DELETE is the
-- double-claim guard (same shape as claim_mission): only one caller can match the row, and only
-- once now() >= ends_at; everyone else gets NOT FOUND and the transaction aborts.
-- ---------------------------------------------------------------------------------------------
create or replace function public.claim_craft(
  p_player             uuid,
  p_recipe_def_id      text,
  p_result_item_def_id text,
  p_result_rarity      text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_result_rarity not in ('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary') then
    raise exception 'claim_craft: invalid rarity';
  end if;

  delete from public.craft_runs
   where player_id = p_player and recipe_def_id = p_recipe_def_id and now() >= ends_at;
  if not found then
    raise exception 'claim_craft: not claimable (no craft, wrong recipe, not finished, or already claimed)';
  end if;

  insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
  values (p_player, p_result_item_def_id, p_result_rarity, 1)
  on conflict (player_id, item_def_id, rarity)
    do update set quantity = public.player_inventory.quantity + excluded.quantity;

  return jsonb_build_object('item_def_id', p_result_item_def_id, 'rarity', p_result_rarity);
end;
$$;

revoke all on function public.claim_craft(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_craft(uuid, text, text, text) to service_role;
```

- [ ] **Step 2: Run the migration policy test**

Run: `npx vitest run src/test/migration-policy.test.ts`
Expected: PASS (5 tests) — it checks the new table's grants and both RPCs' revoke/grant pairs. A failure here names exactly what's missing.

- [ ] **Step 3: Verify the file has no BOM and is well-formed**

Run: `head -c 3 supabase/migrations/20260910110000_craft_runs.sql | od -c | head -1`
Expected: the first bytes are `-` `-` ` ` (not `357 273 277`). No local Supabase stack is available in this environment (no CLI, Docker daemon down), so applying the migration is a deploy-time step for the maintainer — say so in your report rather than fabricating an apply.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260910110000_craft_runs.sql
git commit -m "feat: add craft_runs table and start_craft/claim_craft RPCs"
```

---

### Task 3: Hand-patch `database.types.ts` for `craft_runs`

**Files:**
- Modify: `src/types/database.types.ts` (the `Tables` object; `group_runs` is at ~line 52 — insert `craft_runs` alphabetically before `gather_assignments`)

**Interfaces:**
- Produces: `Tables<'craft_runs'>` = `{ player_id: string; recipe_def_id: string; started_at: string; ends_at: string }`.

- [ ] **Step 1: Add the entry**

Match the exact style of the existing `group_runs` entry (hand-patched the same way — this repo has no live DB to run `supabase gen types`):

```typescript
      craft_runs: {
        Row: {
          player_id: string
          recipe_def_id: string
          started_at: string
          ends_at: string
        }
        Insert: never // all writes go through the RPCs — no direct client insert (ADR-0003)
        Update: never
        Relationships: []
      }
```

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/types/database.types.ts
git commit -m "chore: hand-patch database.types.ts for craft_runs"
```

---

### Task 4: `src/lib/crafting.ts` — reagent resolution, affordability, rarity chances

**Files:**
- Create: `src/lib/crafting.ts`
- Create: `src/lib/crafting.test.ts`

**Interfaces:**
- Produces (all pure, no imports beyond `./rarity`):
  - `type ReagentLine = { kind: 'resource'; resource: string; quantity: number } | { kind: 'item'; itemKey: string; quantity: number }`
  - `type OwnedStack = { itemDefId: string; rarity: string; quantity: number }` (structurally satisfied by `InventoryStack` from `src/services/inventory.ts`)
  - `type ItemRarityChoice = { reagentIndex: number; rarity: string }`
  - `type ResolvedReagent = { index: number; kind: 'resource'; code: string; quantity: number; have: number; ok: boolean } | { index: number; kind: 'item'; itemKey: string; rarity: string | null; quantity: number; have: number; ok: boolean; owned: { rarity: string; have: number }[] }` (`owned` = every rarity the player holds of that item, low → high, with quantities — feeds the rarity picker)
  - `resolveReagents(lines: ReagentLine[], resources: Record<string, number>, stacks: OwnedStack[], choices: ItemRarityChoice[]): ResolvedReagent[]`
  - `canAfford(resolved: ResolvedReagent[]): boolean`
  - `defaultRarityChoice(line, stacks): string | null` — the lowest-rarity owned stack that covers the quantity, else the lowest-rarity owned stack, else null.
  - `rarityChances(weights: { rarity: string; weight: number }[] | undefined): { rarity: string; chance: number }[]` — percentages, `[{ Common, 100 }]` when empty.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/crafting.test.ts
import { describe, it, expect } from 'vitest'
import { resolveReagents, canAfford, defaultRarityChoice, rarityChances, type ReagentLine, type OwnedStack } from './crafting'

const RES = { Iron: 5, Coal: 2 }
const STACKS: OwnedStack[] = [
  { itemDefId: 'rusted-blade', rarity: 'Common', quantity: 1 },
  { itemDefId: 'rusted-blade', rarity: 'Rare', quantity: 3 },
  { itemDefId: 'iron-band', rarity: 'Common', quantity: 2 },
]

describe('resolveReagents', () => {
  it('resource-only recipe: reports have/need and ok per line', () => {
    const lines: ReagentLine[] = [
      { kind: 'resource', resource: 'Iron', quantity: 3 },
      { kind: 'resource', resource: 'Coal', quantity: 4 },
    ]
    const r = resolveReagents(lines, RES, [], [])
    expect(r).toEqual([
      { index: 0, kind: 'resource', code: 'Iron', quantity: 3, have: 5, ok: true },
      { index: 1, kind: 'resource', code: 'Coal', quantity: 4, have: 2, ok: false },
    ])
  })

  it('missing resource key counts as zero', () => {
    const r = resolveReagents([{ kind: 'resource', resource: 'Platinum', quantity: 1 }], RES, [], [])
    expect(r[0]).toMatchObject({ have: 0, ok: false })
  })

  it('item line with a rarity choice checks that stack', () => {
    const lines: ReagentLine[] = [{ kind: 'item', itemKey: 'rusted-blade', quantity: 2 }]
    const r = resolveReagents(lines, RES, STACKS, [{ reagentIndex: 0, rarity: 'Rare' }])
    expect(r[0]).toEqual({
      index: 0, kind: 'item', itemKey: 'rusted-blade', rarity: 'Rare', quantity: 2, have: 3, ok: true,
      owned: [{ rarity: 'Common', have: 1 }, { rarity: 'Rare', have: 3 }],
    })
  })

  it('item line with a rarity choice the player lacks enough of is not ok', () => {
    const lines: ReagentLine[] = [{ kind: 'item', itemKey: 'rusted-blade', quantity: 2 }]
    const r = resolveReagents(lines, RES, STACKS, [{ reagentIndex: 0, rarity: 'Common' }])
    expect(r[0]).toMatchObject({ rarity: 'Common', have: 1, ok: false })
  })

  it('item line with no choice yet is not ok and has rarity null', () => {
    const r = resolveReagents([{ kind: 'item', itemKey: 'rusted-blade', quantity: 1 }], RES, STACKS, [])
    expect(r[0]).toMatchObject({ rarity: null, have: 0, ok: false, owned: [{ rarity: 'Common', have: 1 }, { rarity: 'Rare', have: 3 }] })
  })

  it('mixed recipe resolves both kinds in line order', () => {
    const lines: ReagentLine[] = [
      { kind: 'item', itemKey: 'iron-band', quantity: 1 },
      { kind: 'resource', resource: 'Iron', quantity: 1 },
    ]
    const r = resolveReagents(lines, RES, STACKS, [{ reagentIndex: 0, rarity: 'Common' }])
    expect(r.map((x) => x.ok)).toEqual([true, true])
    expect(r.map((x) => x.kind)).toEqual(['item', 'resource'])
  })
})

describe('canAfford', () => {
  it('is true only when every line is ok', () => {
    expect(canAfford([{ index: 0, kind: 'resource', code: 'Iron', quantity: 1, have: 1, ok: true }])).toBe(true)
    expect(canAfford([
      { index: 0, kind: 'resource', code: 'Iron', quantity: 1, have: 1, ok: true },
      { index: 1, kind: 'resource', code: 'Coal', quantity: 9, have: 2, ok: false },
    ])).toBe(false)
  })
  it('is false for an empty recipe', () => {
    expect(canAfford([])).toBe(false)
  })
})

describe('defaultRarityChoice', () => {
  it('prefers the lowest-rarity stack that covers the quantity', () => {
    expect(defaultRarityChoice({ kind: 'item', itemKey: 'rusted-blade', quantity: 2 }, STACKS)).toBe('Rare')
  })
  it('falls back to the lowest owned rarity when nothing covers the quantity', () => {
    expect(defaultRarityChoice({ kind: 'item', itemKey: 'rusted-blade', quantity: 99 }, STACKS)).toBe('Common')
  })
  it('is null when the item is not owned at all', () => {
    expect(defaultRarityChoice({ kind: 'item', itemKey: 'hollow-ward', quantity: 1 }, STACKS)).toBeNull()
  })
})

describe('rarityChances', () => {
  it('converts weights to percentages', () => {
    expect(rarityChances([{ rarity: 'Common', weight: 3 }, { rarity: 'Uncommon', weight: 1 }])).toEqual([
      { rarity: 'Common', chance: 75 },
      { rarity: 'Uncommon', chance: 25 },
    ])
  })
  it('ignores zero weights and defaults to Common 100 when empty', () => {
    expect(rarityChances([{ rarity: 'Epic', weight: 0 }, { rarity: 'Rare', weight: 2 }])).toEqual([{ rarity: 'Rare', chance: 100 }])
    expect(rarityChances(undefined)).toEqual([{ rarity: 'Common', chance: 100 }])
    expect(rarityChances([])).toEqual([{ rarity: 'Common', chance: 100 }])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/crafting.test.ts`
Expected: FAIL with "Cannot find module './crafting'".

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/crafting.ts
// Pure crafting logic shared by the crafting feature's UI (enable/disable Craft, drive the
// rarity picker) and its service layer (docs/superpowers/specs/2026-09-09-crafting-create-
// recipes-design.md §6). Framework-agnostic and tested, same reasoning as loot.ts.

import { RARITY_ORDER } from './rarity'

export type ReagentLine =
  | { kind: 'resource'; resource: string; quantity: number }
  | { kind: 'item'; itemKey: string; quantity: number }

/** Structurally satisfied by src/services/inventory.ts's InventoryStack. */
export type OwnedStack = { itemDefId: string; rarity: string; quantity: number }

/** The player's pick of which owned rarity to spend for an item-typed reagent line. */
export type ItemRarityChoice = { reagentIndex: number; rarity: string }

export type ResolvedReagent =
  | { index: number; kind: 'resource'; code: string; quantity: number; have: number; ok: boolean }
  | {
      index: number
      kind: 'item'
      itemKey: string
      rarity: string | null
      quantity: number
      have: number
      ok: boolean
      /** Every rarity the player holds of this item, low → high, with quantities (feeds the picker). */
      owned: { rarity: string; have: number }[]
    }

const rarityRank = (r: string) => (RARITY_ORDER as readonly string[]).indexOf(r)

function ownedStacksFor(itemKey: string, stacks: OwnedStack[]): OwnedStack[] {
  return stacks
    .filter((s) => s.itemDefId === itemKey && s.quantity > 0)
    .sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity))
}

/** Resolves every authored reagent line against what the player holds. Item lines use the
 *  player's rarity choice for that line index (null = not chosen yet → never ok). */
export function resolveReagents(
  lines: ReagentLine[],
  resources: Record<string, number>,
  stacks: OwnedStack[],
  choices: ItemRarityChoice[],
): ResolvedReagent[] {
  return lines.map((line, index) => {
    if (line.kind === 'resource') {
      const have = resources[line.resource] ?? 0
      return { index, kind: 'resource', code: line.resource, quantity: line.quantity, have, ok: have >= line.quantity }
    }
    const owned = ownedStacksFor(line.itemKey, stacks)
    const rarity = choices.find((c) => c.reagentIndex === index)?.rarity ?? null
    const have = rarity ? (owned.find((s) => s.rarity === rarity)?.quantity ?? 0) : 0
    return {
      index,
      kind: 'item',
      itemKey: line.itemKey,
      rarity,
      quantity: line.quantity,
      have,
      ok: rarity !== null && have >= line.quantity,
      owned: owned.map((s) => ({ rarity: s.rarity, have: s.quantity })),
    }
  })
}

/** Craft is allowed only when every line is satisfied (and there is at least one line). */
export function canAfford(resolved: ResolvedReagent[]): boolean {
  return resolved.length > 0 && resolved.every((r) => r.ok)
}

/** Default pick for an item line: the lowest-rarity stack that covers the quantity (so a
 *  hard-won Epic isn't spent by accident), else the lowest owned rarity, else null. */
export function defaultRarityChoice(line: Extract<ReagentLine, { kind: 'item' }>, stacks: OwnedStack[]): string | null {
  const owned = ownedStacksFor(line.itemKey, stacks)
  return owned.find((s) => s.quantity >= line.quantity)?.rarity ?? owned[0]?.rarity ?? null
}

/** Weighted rarity list → display percentages. Mirrors rollRarity's rules (src/lib/loot.ts):
 *  zero weights are ignored, an empty list means "always Common". */
export function rarityChances(weights: { rarity: string; weight: number }[] | undefined): { rarity: string; chance: number }[] {
  const list = (weights ?? []).filter((w) => w.weight > 0)
  if (list.length === 0) return [{ rarity: 'Common', chance: 100 }]
  const total = list.reduce((s, w) => s + w.weight, 0)
  return list.map((w) => ({ rarity: w.rarity, chance: Math.round((w.weight / total) * 100) }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/crafting.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/crafting.ts src/lib/crafting.test.ts
git commit -m "feat: add src/lib/crafting.ts reagent resolution and rarity-chance helpers"
```

---

### Task 5: `src/services/crafting.ts` — data layer

**Files:**
- Create: `src/services/crafting.ts`
- Create: `src/services/crafting.test.ts`

**Interfaces:**
- Consumes: `sanity` from `./sanity`; `supabase` from `@/lib/supabase`; `invokeError` from `./_invoke`; `Tables` from `@/types/database.types` (Task 3); `ReagentLine`, `ItemRarityChoice` from `@/lib/crafting` (Task 4).
- Produces: `type CraftRun = Tables<'craft_runs'>`; `type RecipeView = { recipeKey: string; name: string; description?: string; durationSeconds: number; result: { itemKey: string; name: string; slot: string }; resultRarityWeights: { rarity: string; weight: number }[]; reagents: ReagentLine[]; reagentNames: Record<string, string> }`; `fetchRecipes(): Promise<RecipeView[]>`; `fetchCraftRun(): Promise<CraftRun | null>`; `startCraft(recipeDefId: string, itemReagentChoices: ItemRarityChoice[]): Promise<CraftRun>`; `claimCraft(recipeDefId: string): Promise<CraftClaimResponse>` where `CraftClaimResponse = { itemDefId: string; rarity: string }`.

- [ ] **Step 1: Write the failing tests** (mocking pattern from `src/services/groupContent.test.ts`)

```typescript
// src/services/crafting.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./sanity', () => ({ sanity: { fetch: vi.fn() } }))
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(), functions: { invoke: vi.fn() } },
}))

import { sanity } from './sanity'
import { supabase } from '@/lib/supabase'
import { fetchRecipes, fetchCraftRun, startCraft } from './crafting'

describe('fetchRecipes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps a raw recipeDef into RecipeView, normalising reagent lines and dropping broken refs', async () => {
    vi.mocked(sanity.fetch).mockResolvedValue([
      {
        recipeKey: 'forge-rusted-blade',
        name: 'Forge a Rusted Blade',
        description: 'x',
        durationSeconds: 300,
        result: { itemKey: 'rusted-blade', name: 'Rusted Blade', slot: 'weapon' },
        resultRarityWeights: [{ rarity: 'Common', weight: 3 }],
        reagents: [
          { kind: 'resource', resource: 'Iron', quantity: 3, item: null },
          { kind: 'item', resource: null, quantity: 1, item: { itemKey: 'iron-band', name: 'Iron Band', slot: 'ring' } },
          { kind: 'item', resource: null, quantity: 1, item: null }, // dangling ref → dropped
        ],
      },
      { recipeKey: 'broken', name: 'No result', durationSeconds: 1, result: null, reagents: [] }, // no result → dropped
    ] as never)

    const result = await fetchRecipes()

    expect(result).toEqual([{
      recipeKey: 'forge-rusted-blade',
      name: 'Forge a Rusted Blade',
      description: 'x',
      durationSeconds: 300,
      result: { itemKey: 'rusted-blade', name: 'Rusted Blade', slot: 'weapon' },
      resultRarityWeights: [{ rarity: 'Common', weight: 3 }],
      reagents: [
        { kind: 'resource', resource: 'Iron', quantity: 3 },
        { kind: 'item', itemKey: 'iron-band', quantity: 1 },
      ],
      reagentNames: { 'iron-band': 'Iron Band' },
    }])
    const [query] = vi.mocked(sanity.fetch).mock.calls[0]
    expect(query).toContain('recipeDef')
  })
})

describe('fetchCraftRun', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when there is no row', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue({ select: vi.fn().mockReturnValue({ maybeSingle }) } as never)
    expect(await fetchCraftRun()).toBeNull()
  })
})

describe('startCraft', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invokes craft-start with recipeDefId and the rarity choices', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { run: { recipe_def_id: 'x' } }, error: null } as never)
    const result = await startCraft('x', [{ reagentIndex: 1, rarity: 'Rare' }])
    expect(supabase.functions.invoke).toHaveBeenCalledWith('craft-start', {
      body: { recipeDefId: 'x', itemReagentChoices: [{ reagentIndex: 1, rarity: 'Rare' }] },
    })
    expect(result).toEqual({ recipe_def_id: 'x' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/crafting.test.ts`
Expected: FAIL with "Cannot find module './crafting'".

- [ ] **Step 3: Write the implementation**

```typescript
// src/services/crafting.ts
import { supabase } from '@/lib/supabase'
import { sanity } from './sanity'
import type { Tables } from '@/types/database.types'
import type { ReagentLine, ItemRarityChoice } from '@/lib/crafting'
import { invokeError } from './_invoke'

// Crafting data layer (docs/superpowers/specs/2026-09-09-crafting-create-recipes-design.md §6) —
// same three-layer shape as src/services/missions.ts: authored recipes from Sanity, the single
// in-progress craft from Supabase (RLS owner-read), writes through the Edge Functions (ADR-0003).

export type CraftRun = Tables<'craft_runs'>

export type RecipeView = {
  recipeKey: string
  name: string
  description?: string
  durationSeconds: number
  result: { itemKey: string; name: string; slot: string }
  resultRarityWeights: { rarity: string; weight: number }[]
  reagents: ReagentLine[]
  /** itemKey → display name for the item-typed reagent lines (resource lines display their key). */
  reagentNames: Record<string, string>
}

const RECIPES_QUERY = `*[_type == "recipeDef" && defined(recipeKey)]{
  recipeKey, name, description, durationSeconds,
  "result": result->{ itemKey, name, slot },
  resultRarityWeights[]{ rarity, weight },
  reagents[]{ kind, resource, quantity, "item": item->{ itemKey, name, slot } }
} | order(name asc)`

type RawRecipe = {
  recipeKey: string
  name: string
  description?: string | null
  durationSeconds: number
  result: { itemKey: string; name?: string; slot?: string } | null
  resultRarityWeights?: { rarity: string; weight: number }[] | null
  reagents?: {
    kind: 'resource' | 'item'
    resource?: string | null
    quantity: number
    item?: { itemKey: string; name?: string; slot?: string } | null
  }[] | null
}

export async function fetchRecipes(): Promise<RecipeView[]> {
  const raw = await sanity.fetch<RawRecipe[]>(RECIPES_QUERY)
  return raw.flatMap((r) => {
    if (!r.result?.itemKey) return [] // dangling result reference — unauthorable, skip
    const reagentNames: Record<string, string> = {}
    const reagents: ReagentLine[] = []
    for (const line of r.reagents ?? []) {
      if (line.kind === 'resource' && line.resource) {
        reagents.push({ kind: 'resource', resource: line.resource, quantity: line.quantity })
      } else if (line.kind === 'item' && line.item?.itemKey) {
        reagents.push({ kind: 'item', itemKey: line.item.itemKey, quantity: line.quantity })
        reagentNames[line.item.itemKey] = line.item.name ?? line.item.itemKey
      }
      // a line missing its resource/item is an authoring error — dropped rather than crashing the page
    }
    return [{
      recipeKey: r.recipeKey,
      name: r.name,
      description: r.description ?? undefined,
      durationSeconds: r.durationSeconds,
      result: { itemKey: r.result.itemKey, name: r.result.name ?? r.result.itemKey, slot: r.result.slot ?? '' },
      resultRarityWeights: r.resultRarityWeights ?? [],
      reagents,
      reagentNames,
    }]
  })
}

/** The player's single in-progress craft, or null. */
export async function fetchCraftRun(): Promise<CraftRun | null> {
  const { data, error } = await supabase.from('craft_runs').select('*').maybeSingle()
  if (error) throw error
  return data
}

export type CraftClaimResponse = { itemDefId: string; rarity: string }

export async function startCraft(recipeDefId: string, itemReagentChoices: ItemRarityChoice[]): Promise<CraftRun> {
  const { data, error } = await supabase.functions.invoke('craft-start', { body: { recipeDefId, itemReagentChoices } })
  if (error) await invokeError(error, 'Could not start crafting')
  return data.run as CraftRun
}

export async function claimCraft(recipeDefId: string): Promise<CraftClaimResponse> {
  const { data, error } = await supabase.functions.invoke('craft-claim', { body: { recipeDefId } })
  if (error) await invokeError(error, 'Could not claim the craft')
  return data as CraftClaimResponse
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/crafting.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/crafting.ts src/services/crafting.test.ts
git commit -m "feat: add src/services/crafting.ts data layer"
```

---

### Task 6: `craft-start` Edge Function

**Files:**
- Create: `supabase/functions/craft-start/index.ts`

**Interfaces:**
- Consumes: `sanityQuery` from `../_shared/sanity.ts`, `createAdminClient` from `../_shared/supabaseAdmin.ts`, `corsHeaders` from `../_shared/cors.ts`; RPC `start_craft` (Task 2).
- Produces: `POST /craft-start` `{ recipeDefId: string, itemReagentChoices: { reagentIndex: number, rarity: string }[] }` → `{ run: CraftRun }` (201).

- [ ] **Step 1: Write the function**

```typescript
// supabase/functions/craft-start/index.ts
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'

// craft-start: spend a recipe's reagents and open the timed craft (ADR-0003 server-authoritative
// write; docs/superpowers/specs/2026-09-09-crafting-create-recipes-design.md §5). Mirrors
// mission-start: validate the caller, resolve the authored recipe from Sanity (the client is NOT
// trusted for costs or duration), hand off to the atomic start_craft RPC. The only thing the
// client contributes is WHICH owned rarity to spend for each item-typed reagent line.

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']

type RecipeDef = {
  durationSeconds?: number
  reagents?: { kind?: string; resource?: string | null; quantity?: number; itemKey?: string | null }[]
} | null

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  const admin = createAdminClient()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
  const playerId = userData.user.id

  let body: { recipeDefId?: unknown; itemReagentChoices?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const recipeDefId = body.recipeDefId
  if (typeof recipeDefId !== 'string' || recipeDefId.length === 0) return json({ error: 'recipeDefId is required' }, 400)
  const rawChoices = Array.isArray(body.itemReagentChoices) ? body.itemReagentChoices : []
  const choices = new Map<number, string>()
  for (const c of rawChoices as unknown[]) {
    const idx = (c as Record<string, unknown>)?.reagentIndex
    const rarity = (c as Record<string, unknown>)?.rarity
    if (typeof idx !== 'number' || !Number.isInteger(idx) || typeof rarity !== 'string' || !RARITIES.includes(rarity)) {
      return json({ error: 'Invalid itemReagentChoices entry' }, 400)
    }
    choices.set(idx, rarity)
  }

  let def: RecipeDef
  try {
    def = await sanityQuery<RecipeDef>(
      `*[_type == "recipeDef" && recipeKey == $key][0]{
        durationSeconds,
        reagents[]{ kind, resource, quantity, "itemKey": item->itemKey }
      }`,
      { key: recipeDefId },
    )
  } catch (e) {
    console.error('Sanity recipe lookup failed', e)
    return json({ error: 'Could not validate recipe' }, 502)
  }
  if (!def || !def.reagents || def.reagents.length === 0) return json({ error: 'Unknown recipe' }, 404)
  if (typeof def.durationSeconds !== 'number' || def.durationSeconds < 1) return json({ error: 'Recipe has no valid duration' }, 500)

  // Resolve each authored line to a concrete requirement. Costs come from Sanity; the client only
  // supplies the rarity choice for item lines.
  const resourceReagents: { code: string; quantity: number }[] = []
  const itemReagents: { item_def_id: string; rarity: string; quantity: number }[] = []
  for (const [index, line] of def.reagents.entries()) {
    const quantity = line.quantity ?? 0
    if (!Number.isInteger(quantity) || quantity < 1) return json({ error: `Recipe reagent ${index} has an invalid quantity` }, 500)
    if (line.kind === 'resource') {
      if (!line.resource) return json({ error: `Recipe reagent ${index} has no resource` }, 500)
      resourceReagents.push({ code: line.resource, quantity })
    } else if (line.kind === 'item') {
      if (!line.itemKey) return json({ error: `Recipe reagent ${index} has no item` }, 500)
      const rarity = choices.get(index)
      if (!rarity) return json({ error: `Pick a rarity for reagent ${index}` }, 400)
      itemReagents.push({ item_def_id: line.itemKey, rarity, quantity })
    } else {
      return json({ error: `Recipe reagent ${index} has an unknown kind` }, 500)
    }
  }

  const { data: run, error: rpcErr } = await admin.rpc('start_craft', {
    p_player: playerId,
    p_recipe_def_id: recipeDefId,
    p_resource_reagents: resourceReagents,
    p_item_reagents: itemReagents,
    p_duration_seconds: def.durationSeconds,
  })
  if (rpcErr) {
    const reason = rpcErr.message.replace(/^.*start_craft:\s*/, '')
    return json({ error: reason || 'Could not start crafting' }, 409)
  }

  return json({ run }, 201)
})
```

- [ ] **Step 2: Verify**

This repo has no automated Deno Edge Function tests (accepted gap, spec §8) and no local Supabase stack in this environment. Verify by: (a) `npm run build` still passes (this file isn't in the tsc project, so this confirms nothing here broke `src/`), and (b) a careful read confirming the `admin.rpc('start_craft', {...})` object has exactly the five keys `p_player, p_recipe_def_id, p_resource_reagents, p_item_reagents, p_duration_seconds` matching Task 2's signature, and that every `reagentIndex` refers to the position in the AUTHORED `reagents[]` array (the same indexing `resolveReagents` in `src/lib/crafting.ts` uses). Say explicitly in your report that the function was not executed.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/craft-start/index.ts
git commit -m "feat: add craft-start Edge Function"
```

---

### Task 7: `craft-claim` Edge Function

**Files:**
- Create: `supabase/functions/craft-claim/index.ts`

**Interfaces:**
- Consumes: `rollRarity` from `../../../src/lib/loot.ts`; `makeRng` from `../../../src/lib/combat.ts`; the `_shared` helpers; RPC `claim_craft` (Task 2).
- Produces: `POST /craft-claim` `{ recipeDefId: string }` → `{ itemDefId: string, rarity: string }` (200).

- [ ] **Step 1: Write the function**

```typescript
// supabase/functions/craft-claim/index.ts
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'
import { makeRng } from '../../../src/lib/combat.ts'
import { rollRarity } from '../../../src/lib/loot.ts'

// craft-claim: close a finished craft and grant ONE copy of the recipe's result at a rarity rolled
// from the authored weights (docs/superpowers/specs/2026-09-09-crafting-create-recipes-design.md
// §5). Mirrors mission-claim: guard on ends_at, decide the numbers here (the roll), let the
// claim_craft RPC own atomicity and the double-claim guard. The roll is seeded from the run so a
// retry of the same claim can't re-roll.

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type RecipeDef = { resultItemKey?: string | null; resultRarityWeights?: { rarity: string; weight: number }[] | null } | null

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  const admin = createAdminClient()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
  const playerId = userData.user.id

  let body: { recipeDefId?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const recipeDefId = body.recipeDefId
  if (typeof recipeDefId !== 'string' || recipeDefId.length === 0) return json({ error: 'recipeDefId is required' }, 400)

  // 1. The player's craft (owner-scoped) — friendly early-out; the RPC re-guards atomically.
  const { data: run, error: runErr } = await admin
    .from('craft_runs')
    .select('recipe_def_id, started_at, ends_at')
    .eq('player_id', playerId)
    .maybeSingle()
  if (runErr) return json({ error: 'Could not load craft' }, 500)
  if (!run || run.recipe_def_id !== recipeDefId) return json({ error: 'No such craft in progress' }, 404)
  if (new Date(run.ends_at).getTime() > Date.now()) return json({ error: 'Craft not finished' }, 409)

  // 2. Authored result + weights (server-trusted).
  let def: RecipeDef
  try {
    def = await sanityQuery<RecipeDef>(
      `*[_type == "recipeDef" && recipeKey == $key][0]{ "resultItemKey": result->itemKey, resultRarityWeights[]{ rarity, weight } }`,
      { key: recipeDefId },
    )
  } catch (e) {
    console.error('Sanity recipe lookup failed', e)
    return json({ error: 'Could not load recipe' }, 502)
  }
  if (!def?.resultItemKey) return json({ error: 'Recipe has no result item' }, 500)

  // 3. Roll the rarity — deterministic per run, so a retried claim can't re-roll.
  const rng = makeRng(`${playerId}:${recipeDefId}:${run.started_at}:craft`)
  const rarity = rollRarity(def.resultRarityWeights ?? undefined, rng)

  // 4. Apply atomically (the RPC owns the double-claim guard).
  const { data: claimData, error: claimErr } = await admin.rpc('claim_craft', {
    p_player: playerId,
    p_recipe_def_id: recipeDefId,
    p_result_item_def_id: def.resultItemKey,
    p_result_rarity: rarity,
  })
  if (claimErr) {
    const reason = claimErr.message.replace(/^.*claim_craft:\s*/, '')
    return json({ error: reason || 'Could not claim the craft' }, 409)
  }

  const granted = claimData as { item_def_id: string; rarity: string }
  return json({ itemDefId: granted.item_def_id, rarity: granted.rarity }, 200)
})
```

- [ ] **Step 2: Verify**

As Task 6: `npm run build` passes; careful read confirms the `admin.rpc('claim_craft', {...})` object has exactly `p_player, p_recipe_def_id, p_result_item_def_id, p_result_rarity` (Task 2's signature), and that `rollRarity`'s import path resolves to the existing `src/lib/loot.ts` export. Not executed — say so.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/craft-claim/index.ts
git commit -m "feat: add craft-claim Edge Function"
```

---

### Task 8: Move crafting into `src/features/crafting/` (no behavior change)

**Files:**
- Move: `src/pages/CraftingPage.tsx` → `src/features/crafting/CraftingPage.tsx`
- Move: `src/components/organisms/CraftingCircle.tsx` → `src/features/crafting/components/CraftingCircle.tsx`
- Move: `src/components/organisms/CraftingInventory.tsx` → `src/features/crafting/components/CraftingInventory.tsx`
- Move: `src/components/organisms/RecipeBook.tsx` → `src/features/crafting/components/RecipeBook.tsx`
- Create: `src/features/crafting/index.ts`
- Modify: `src/App.tsx:22`

**Interfaces:**
- Produces: barrel `@/features/crafting` exporting `CraftingPage` (default-export re-exported as named, matching `src/features/missions/index.ts`).

All three organisms have exactly one consumer (`CraftingPage`) — verified by grep — so they move with the page (CLAUDE.md: "used by one feature → lives inside it"). This task is a pure move: mocks stay in place, the page still renders identically.

- [ ] **Step 1: Move the files with git**

```bash
mkdir -p src/features/crafting/components
git mv src/pages/CraftingPage.tsx src/features/crafting/CraftingPage.tsx
git mv src/components/organisms/CraftingCircle.tsx src/features/crafting/components/CraftingCircle.tsx
git mv src/components/organisms/CraftingInventory.tsx src/features/crafting/components/CraftingInventory.tsx
git mv src/components/organisms/RecipeBook.tsx src/features/crafting/components/RecipeBook.tsx
```

- [ ] **Step 2: Fix the imports**

`src/features/crafting/CraftingPage.tsx` — replace its import block with:

```typescript
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SecondaryButton } from '@/components/atoms/Button'
import { RECIPES } from '@/lib/mockRecipes'
import type { Item } from '@/types/item'
import { CraftingCircle } from './components/CraftingCircle'
import { CraftingInventory } from './components/CraftingInventory'
import { RecipeBook } from './components/RecipeBook'
```

`src/features/crafting/components/CraftingCircle.tsx` — replace its imports with:

```typescript
import { RARITY_STYLES } from '@/lib/rarity'
import { IconSlot } from '@/components/atoms/IconSlot'
import { PrimaryButton, SecondaryButton } from '@/components/atoms/Button'
import type { Item } from '@/types/item'
```

`src/features/crafting/components/CraftingInventory.tsx` — replace its imports with:

```typescript
import { ItemTile } from '@/components/molecules/ItemTile'
import { ItemTooltip } from '@/components/organisms/ItemTooltip'
import { MOCK_INVENTORY } from '@/lib/mockInventory'
import type { Item } from '@/types/item'
```

`src/features/crafting/components/RecipeBook.tsx` — replace its imports with:

```typescript
import { useState } from 'react'
import { IconButton } from '@/components/atoms/IconButton'
import { IconSlot } from '@/components/atoms/IconSlot'
import { SegmentedControl } from '@/components/atoms/SegmentedControl'
import { ResourceTooltip } from '@/components/organisms/ResourceTooltip'
import { RESOURCE_COLOR } from '@/lib/resources'
import type { Recipe } from '@/types/recipe'
```

- [ ] **Step 3: Barrel and route**

```typescript
// src/features/crafting/index.ts
// Public API of the Crafting feature. Import from '@/features/crafting' — never reach into the
// feature's internals (./components/*) from outside the feature.
export { default as CraftingPage } from './CraftingPage'
```

In `src/App.tsx`, change line 22 from `const CraftingPage = lazy(() => import('./pages/CraftingPage'))` to:

```typescript
const CraftingPage = lazy(() => import('./features/crafting').then((m) => ({ default: m.CraftingPage })))
```

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run build && npx vitest run`
Expected: all PASS. Then `grep -rn "organisms/CraftingCircle\|organisms/CraftingInventory\|organisms/RecipeBook\|pages/CraftingPage" src` returns nothing.

- [ ] **Step 5: Commit**

```bash
git add -A src/features/crafting src/pages/CraftingPage.tsx src/components/organisms/CraftingCircle.tsx src/components/organisms/CraftingInventory.tsx src/components/organisms/RecipeBook.tsx src/App.tsx
git commit -m "refactor: move crafting page and its organisms into src/features/crafting"
```

---

### Task 9: Hooks + real recipe book

**Files:**
- Create: `src/features/crafting/hooks.ts`
- Rewrite: `src/features/crafting/components/RecipeBook.tsx`
- Delete: `src/lib/mockRecipes.ts`, `src/types/recipe.ts`
- Modify: `src/features/crafting/CraftingPage.tsx` (temporarily — see Step 3)

**Interfaces:**
- Consumes: `fetchRecipes`, `fetchCraftRun`, `startCraft`, `claimCraft`, `RecipeView` from `@/services/crafting` (Task 5); `rarityChances` from `@/lib/crafting` (Task 4); `RarityChancePill` from `@/components/molecules/RarityChancePill` (existing: props `{ rarity: string; chance: number }`).
- Produces: `useRecipes()`, `useCraftRun()`, `useStartCraft()`, `useClaimCraft()`; `RecipeBook({ recipes, selectedKey, onSelect, onClose })`.

- [ ] **Step 1: `hooks.ts`** (same shape as `src/features/missions/hooks.ts`)

```typescript
// src/features/crafting/hooks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchRecipes, fetchCraftRun, startCraft, claimCraft } from '@/services/crafting'
import type { ItemRarityChoice } from '@/lib/crafting'

export function useRecipes() {
  return useQuery({ queryKey: ['recipes'], queryFn: fetchRecipes })
}

export function useCraftRun() {
  return useQuery({ queryKey: ['craftRun'], queryFn: fetchCraftRun })
}

export function useStartCraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ recipeDefId, choices }: { recipeDefId: string; choices: ItemRarityChoice[] }) =>
      startCraft(recipeDefId, choices),
    onSuccess: () => {
      // Reagents were spent: wallet + stacks changed, and there is now a run.
      void qc.invalidateQueries({ queryKey: ['craftRun'] })
      void qc.invalidateQueries({ queryKey: ['profile'] })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}

export function useClaimCraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (recipeDefId: string) => claimCraft(recipeDefId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['craftRun'] })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}
```

- [ ] **Step 2: Rewrite `RecipeBook.tsx`** — real recipes, selectable rows, no kind filter, no discovery (spec §3)

```typescript
// src/features/crafting/components/RecipeBook.tsx
import { IconButton } from '@/components/atoms/IconButton'
import { IconSlot } from '@/components/atoms/IconSlot'
import { RarityChancePill } from '@/components/molecules/RarityChancePill'
import { ResourceTooltip } from '@/components/organisms/ResourceTooltip'
import { RESOURCE_COLOR } from '@/lib/resources'
import { rarityChances } from '@/lib/crafting'
import { formatRemaining } from '@/lib/time'
import type { RecipeView } from '@/services/crafting'

// The recipe collection panel. Every recipeDef is shown (no discovery gating in v1, spec §3);
// selecting a row is what fills the crafting circle's reagent slots.
export function RecipeBook({ recipes, selectedKey, onSelect, onClose }: {
  recipes: RecipeView[]
  selectedKey: string | null
  onSelect: (recipeKey: string) => void
  onClose?: () => void
}) {
  return (
    <div style={{
      width: '100%', borderRadius: 8, overflow: 'hidden',
      border: '2px solid var(--color-gold-mid)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', '0 6px 18px rgba(0,0,0,0.75)'].join(', '),
    }}>
      <div style={{ padding: '10px 14px', borderBottom: '2px solid var(--color-gold-dark)', background: 'linear-gradient(180deg, rgba(200,145,42,0.16) 0%, rgba(200,145,42,0.03) 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--color-gold-light)', fontSize: 14, fontWeight: 'bold', letterSpacing: 0.5, textShadow: '0 0 10px rgba(240,208,96,0.35)' }}>
          <IconSlot size={14} />Recipe Book
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{recipes.length} recipes</span>
          {onClose && <IconButton label="Close recipe book" onClick={onClose}>✕</IconButton>}
        </span>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {recipes.length === 0
          ? <p style={{ color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>No recipes authored yet.</p>
          : recipes.map((r) => (
            <RecipeRow key={r.recipeKey} recipe={r} selected={r.recipeKey === selectedKey} onSelect={() => onSelect(r.recipeKey)} />
          ))}
      </div>
    </div>
  )
}

function RecipeRow({ recipe, selected, onSelect }: { recipe: RecipeView; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} style={{
      textAlign: 'left', width: '100%', borderRadius: 6, padding: 10, cursor: 'pointer', fontFamily: 'Georgia, serif',
      border: `1px solid ${selected ? 'var(--color-gold-mid)' : 'var(--color-gold-dark)'}`,
      background: selected ? 'rgba(200,145,42,0.12)' : 'rgba(255,255,255,0.02)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
        <span style={{ color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{recipe.name}</span>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 10, whiteSpace: 'nowrap' }}>{formatRemaining(recipe.durationSeconds * 1000)}</span>
      </div>
      <p style={{ color: '#5b9bd5', fontSize: 11, marginTop: 4 }}>{recipe.result.name} <span style={{ color: 'var(--color-text-muted)' }}>({recipe.result.slot})</span></p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
        {rarityChances(recipe.resultRarityWeights).map((c) => <RarityChancePill key={c.rarity} rarity={c.rarity} chance={c.chance} />)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
        {recipe.reagents.map((line, i) => line.kind === 'resource'
          ? (
            <ResourceTooltip key={i} resource={line.resource}>
              <ReagentChip label={line.resource} qty={line.quantity} color={RESOURCE_COLOR[line.resource] ?? '200,145,42'} />
            </ResourceTooltip>
          )
          : <ReagentChip key={i} label={recipe.reagentNames[line.itemKey] ?? line.itemKey} qty={line.quantity} color="176,111,212" />)}
      </div>
    </button>
  )
}

function ReagentChip({ label, qty, color }: { label: string; qty: number; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 4, fontSize: 11, border: `1px solid rgba(${color},0.5)`, background: `rgba(${color},0.12)`, color: 'var(--color-text-primary)' }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: `rgb(${color})` }} />
      {label} <span style={{ color: 'var(--color-text-gold)', fontWeight: 'bold' }}>×{qty}</span>
    </span>
  )
}
```

- [ ] **Step 3: Keep the page compiling, delete the mocks**

`RecipeBook`'s props changed, so `CraftingPage.tsx` must stop passing `RECIPES`. Make the minimal edit now (Task 12 rewrites the page fully): replace `import { RECIPES } from '@/lib/mockRecipes'` with `import { useRecipes } from './hooks'`, add `const recipes = useRecipes()` and `const [selectedKey, setSelectedKey] = useState<string | null>(null)` inside the component, and change the `<RecipeBook ... />` element to:

```tsx
<RecipeBook recipes={recipes.data ?? []} selectedKey={selectedKey} onSelect={setSelectedKey} onClose={() => setBookOpen(false)} />
```

Then delete the orphans your change created:

```bash
git rm src/lib/mockRecipes.ts src/types/recipe.ts
```

(`grep -rn "mockRecipes\|types/recipe" src` must return nothing afterwards.)

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run build && npx vitest run`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src/features/crafting src/lib/mockRecipes.ts src/types/recipe.ts
git commit -m "feat: crafting hooks and a real recipe book"
```

---

### Task 10: Real inventory grid

**Files:**
- Rewrite: `src/features/crafting/components/CraftingInventory.tsx`
- Delete: `src/lib/mockInventory.ts`
- Modify: `src/features/crafting/CraftingPage.tsx` (the `<CraftingInventory>` call)

**Interfaces:**
- Consumes: `useInventory` from `@/hooks/useInventory` (→ `InventoryStack[]`), `useItemDefs` from `@/hooks/useRoster` (→ `Record<string, ItemDefMeta>`), `scaledItemStats` from `@/lib/itemStats`.
- Produces: `CraftingInventory({ resources, stacks, itemDefs })` — a read-only view of what the player can spend (placement is recipe-driven, so the old `onPlace/filled/count` props go).

- [ ] **Step 1: Rewrite the component**

The stack→`Item` mapping below is the same inline shape `src/pages/InventoryPage.tsx:28-40` and `UpgradingPage.tsx:75-88` use — keep it inline to match them.

```typescript
// src/features/crafting/components/CraftingInventory.tsx
import { ItemTile } from '@/components/molecules/ItemTile'
import { ItemTooltip } from '@/components/organisms/ItemTooltip'
import { ResourceTooltip } from '@/components/organisms/ResourceTooltip'
import { RESOURCE_COLOR } from '@/lib/resources'
import { scaledItemStats } from '@/lib/itemStats'
import type { InventoryStack } from '@/services/inventory'
import type { ItemDefMeta } from '@/services/items'
import type { Item } from '@/types/item'

// What the player can spend on a recipe: resource balances up top, item stacks below. Read-only —
// selecting a recipe (RecipeBook) is what fills the circle, so nothing here is clickable.
export function CraftingInventory({ resources, stacks, itemDefs }: {
  resources: Record<string, number>
  stacks: InventoryStack[]
  itemDefs: Record<string, ItemDefMeta>
}) {
  const owned = Object.entries(resources).filter(([, v]) => v > 0)
  const items: Item[] = stacks.map((stack) => {
    const def = itemDefs[stack.itemDefId]
    return {
      itemDefId: stack.itemDefId,
      name: def?.name ?? stack.itemDefId,
      rarity: stack.rarity,
      slot: def?.slot ?? '',
      stats: scaledItemStats(def?.statBonuses, stack.rarity),
      value: 0,
      quantity: stack.quantity,
    }
  })

  return (
    <div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Materials</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
        {owned.length === 0 && <span style={{ color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic' }}>No materials yet — send someone to the mines.</span>}
        {owned.map(([code, qty]) => {
          const c = RESOURCE_COLOR[code] ?? '200,145,42'
          return (
            <ResourceTooltip key={code} resource={code}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 4, fontSize: 12, border: `1px solid rgba(${c},0.5)`, background: `rgba(${c},0.12)`, color: 'var(--color-text-primary)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: `rgb(${c})` }} />
                {code} <span style={{ color: 'var(--color-text-gold)', fontWeight: 'bold' }}>×{qty}</span>
              </span>
            </ResourceTooltip>
          )
        })}
      </div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Inventory</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 10 }}>
        {items.map((item) => (
          <ItemTooltip key={`${item.itemDefId}-${item.rarity}`} item={item}>
            <ItemTile item={item} />
          </ItemTooltip>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire the page's call and delete the mock**

In `src/features/crafting/CraftingPage.tsx`: add `import { useInventory } from '@/hooks/useInventory'`, `import { useItemDefs } from '@/hooks/useRoster'`, `import { useProfile } from '@/hooks/useProfile'`; inside the component add `const profile = useProfile()`, `const inventory = useInventory()`, `const itemDefs = useItemDefs()`; replace the `<CraftingInventory onPlace={place} filled={filled} count={COUNT} />` element with:

```tsx
<CraftingInventory resources={profile.data?.resources ?? {}} stacks={inventory.data ?? []} itemDefs={itemDefs.data ?? {}} />
```

Remove the now-unused `place` function and `filled` const from the page (they only fed the old props). Then:

```bash
git rm src/lib/mockInventory.ts
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build && npx vitest run`
Expected: all PASS; `grep -rn "mockInventory" src` returns nothing.

- [ ] **Step 4: Commit**

```bash
git add -A src/features/crafting src/lib/mockInventory.ts
git commit -m "feat: crafting inventory shows real resources and stacks"
```

---

### Task 11: `RarityPicker` component

**Files:**
- Create: `src/features/crafting/components/RarityPicker.tsx`

**Interfaces:**
- Consumes: `RarityBadge` from `@/components/atoms/RarityBadge` (existing; props `{ rarity: string; size?: 'sm' }`), `RARITY_ORDER` from `@/lib/rarity`.
- Produces: `RarityPicker({ options, selected, onPick })` — `options: { rarity: string; have: number }[]`, `selected: string | null`, `onPick(rarity: string)`.

- [ ] **Step 1: Write the component**

```typescript
// src/features/crafting/components/RarityPicker.tsx
import { RarityBadge } from '@/components/atoms/RarityBadge'
import { RARITY_ORDER } from '@/lib/rarity'

// For an item-typed reagent the player owns at more than one rarity: which stack to spend
// (docs/superpowers/specs/2026-09-09-crafting-create-recipes-design.md §2 — the player picks at
// craft time). Rendered inside the reagent slot's popover; low → high.
export function RarityPicker({ options, selected, onPick }: {
  options: { rarity: string; have: number }[]
  selected: string | null
  onPick: (rarity: string) => void
}) {
  const order = RARITY_ORDER as readonly string[]
  const sorted = [...options].sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, minWidth: 150,
      borderRadius: 6, border: '2px solid var(--color-gold-dark)', background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: '0 0 0 1px #080101, 0 6px 18px rgba(0,0,0,0.75)' }}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Spend which?</span>
      {sorted.map((o) => (
        <button key={o.rarity} type="button" onClick={() => onPick(o.rarity)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '5px 8px', borderRadius: 4, cursor: 'pointer',
          fontFamily: 'Georgia, serif', textAlign: 'left',
          border: `1px solid ${o.rarity === selected ? 'var(--color-gold-mid)' : 'transparent'}`,
          background: o.rarity === selected ? 'rgba(200,145,42,0.15)' : 'transparent',
        }}>
          <RarityBadge rarity={o.rarity} size="sm" />
          <span style={{ color: 'var(--color-text-primary)', fontSize: 12, fontWeight: 'bold' }}>×{o.have}</span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `npm run lint && npm run build`
Expected: PASS (the component is unused until Task 12 — that's fine for `tsc`; ESLint's unused-export rules don't apply to module exports).

- [ ] **Step 3: Commit**

```bash
git add src/features/crafting/components/RarityPicker.tsx
git commit -m "feat: add RarityPicker for item reagents"
```

---

### Task 12: Circle + page lifecycle (select → craft → wait → claim)

**Files:**
- Rewrite: `src/features/crafting/components/CraftingCircle.tsx`
- Rewrite: `src/features/crafting/CraftingPage.tsx`

**Interfaces:**
- Consumes: `resolveReagents`, `canAfford`, `defaultRarityChoice`, `ResolvedReagent`, `ItemRarityChoice` from `@/lib/crafting`; `useRecipes`, `useCraftRun`, `useStartCraft`, `useClaimCraft` from `./hooks`; `RarityPicker` (Task 11); `formatRemaining` from `@/lib/time`; `RESOURCE_COLOR` from `@/lib/resources`; `RARITY_STYLES` from `@/lib/rarity`.
- Produces: `CraftingCircle({ reagents, resultName, rarityChoices, onPickRarity, inProgress, remainingMs, canCraft, pending, error, onCraft, onClaim, onClear })`.

Interaction model (spec §6 made concrete): selecting a recipe fills the 6 slots from its reagent lines (resource lines show `have/need`; item lines show the chosen rarity with a picker when more than one rarity is owned — default = `defaultRarityChoice`). Craft is enabled when `canAfford(resolved)`. Once a `craft_runs` row exists, the page locks to that run's recipe (`recipe_def_id`): the center shows a countdown, slots are inert, the button becomes Claim (enabled once `ends_at` passes).

- [ ] **Step 1: Rewrite `CraftingCircle.tsx`**

```typescript
// src/features/crafting/components/CraftingCircle.tsx
import { useState } from 'react'
import { IconSlot } from '@/components/atoms/IconSlot'
import { PrimaryButton, SecondaryButton } from '@/components/atoms/Button'
import { RARITY_STYLES } from '@/lib/rarity'
import { RESOURCE_COLOR } from '@/lib/resources'
import { formatRemaining } from '@/lib/time'
import type { ResolvedReagent, ItemRarityChoice } from '@/lib/crafting'
import { RarityPicker } from './RarityPicker'

// Six reagent slots on a ring around the result slot. Recipe-driven: the page resolves the
// selected recipe's lines against the wallet/inventory and hands them in; this component only
// renders state and raises intents (pick a rarity, craft, claim, clear).
const SLOT_COUNT = 6

export function CraftingCircle({ reagents, resultName, rarityChoices, onPickRarity, inProgress, remainingMs, canCraft, pending, error, onCraft, onClaim, onClear }: {
  reagents: ResolvedReagent[]
  resultName: string | null
  rarityChoices: ItemRarityChoice[]
  onPickRarity: (reagentIndex: number, rarity: string) => void
  inProgress: boolean
  remainingMs: number
  canCraft: boolean
  pending: boolean
  error: string | null
  onCraft: () => void
  onClaim: () => void
  onClear: () => void
}) {
  const [openPicker, setOpenPicker] = useState<number | null>(null)
  const SIZE = 300, RADIUS = 110, SLOT = 58, CENTER = 88
  const slots: (ResolvedReagent | null)[] = Array.from({ length: SLOT_COUNT }, (_, i) => reagents[i] ?? null)
  const ready = inProgress && remainingMs <= 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: 340, flexShrink: 0 }}>
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        <Ring d={RADIUS * 2} />
        <Ring d={CENTER + 30} faint />
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 150, height: 150, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,208,96,0.10) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {slots.map((r, i) => {
          const a = (-90 + i * 60) * Math.PI / 180
          const x = SIZE / 2 + RADIUS * Math.cos(a)
          const y = SIZE / 2 + RADIUS * Math.sin(a)
          const pickable = !inProgress && r?.kind === 'item' && r.owned.length > 1
          return (
            <div key={i} style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%,-50%)' }}>
              <ReagentSlot reagent={r} size={SLOT} onClick={pickable ? () => setOpenPicker(openPicker === i ? null : i) : undefined} />
              {openPicker === i && r?.kind === 'item' && (
                <div style={{ position: 'absolute', top: SLOT + 6, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                  <RarityPicker
                    options={r.owned}
                    selected={rarityChoices.find((c) => c.reagentIndex === r.index)?.rarity ?? null}
                    onPick={(rarity) => { onPickRarity(r.index, rarity); setOpenPicker(null) }}
                  />
                </div>
              )}
            </div>
          )
        })}

        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}>
          <CenterSlot size={CENTER} label={inProgress ? (ready ? 'Ready' : formatRemaining(remainingMs)) : (resultName ?? 'Result')} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
        <SecondaryButton onClick={onClear} disabled={inProgress || pending}>Clear</SecondaryButton>
        {inProgress
          ? <PrimaryButton disabled={!ready || pending} onClick={onClaim}>{pending ? 'Claiming…' : ready ? 'Claim' : 'Crafting…'}</PrimaryButton>
          : <PrimaryButton disabled={!canCraft || pending} onClick={onCraft}>{pending ? 'Starting…' : 'Craft'}</PrimaryButton>}
      </div>
      {error && <p style={{ color: '#e0635c', fontSize: 11, textAlign: 'center' }}>{error}</p>}
    </div>
  )
}

function Ring({ d, faint = false }: { d: number; faint?: boolean }) {
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%', width: d, height: d, transform: 'translate(-50%,-50%)',
      borderRadius: '50%', pointerEvents: 'none',
      border: `1px solid rgba(200,145,42,${faint ? 0.18 : 0.4})`,
      boxShadow: faint ? 'none' : '0 0 14px rgba(200,145,42,0.12), inset 0 0 14px rgba(200,145,42,0.08)',
    }} />
  )
}

// A filled reagent slot shows have/need; red border when short. Item slots use the chosen
// rarity's color; resource slots the resource's accent color.
function ReagentSlot({ reagent, size, onClick }: { reagent: ResolvedReagent | null; size: number; onClick?: () => void }) {
  const border = !reagent
    ? 'var(--color-gold-dark)'
    : !reagent.ok
      ? '#e0635c'
      : reagent.kind === 'item'
        ? (RARITY_STYLES[reagent.rarity ?? 'Common'] ?? RARITY_STYLES.Common).border
        : `rgb(${RESOURCE_COLOR[reagent.code] ?? '200,145,42'})`
  const title = !reagent
    ? undefined
    : reagent.kind === 'resource'
      ? `${reagent.code} — have ${reagent.have}, need ${reagent.quantity}`
      : `${reagent.itemKey} (${reagent.rarity ?? 'pick a rarity'}) — have ${reagent.have}, need ${reagent.quantity}${onClick ? ' · click to choose' : ''}`
  return (
    <div onClick={onClick} title={title} style={{
      width: size, height: size, borderRadius: 8, position: 'relative',
      border: `2px solid ${border}`,
      background: reagent ? 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)' : 'radial-gradient(circle at 50% 40%, #1a0608 0%, #0c0203 100%)',
      boxShadow: '0 0 0 1px #080101, inset 0 1px 0 rgba(255,255,255,0.05), 0 3px 8px rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      {reagent
        ? <>
            <IconSlot size={Math.round(size * 0.52)} />
            <span style={{ position: 'absolute', right: -6, bottom: -6, padding: '1px 5px', borderRadius: 4, fontSize: 10, fontWeight: 'bold',
              color: reagent.ok ? 'var(--color-gold-light)' : '#e0635c', border: '1.5px solid var(--color-gold-mid)',
              background: 'linear-gradient(180deg, #2a1a08 0%, #120a02 100%)' }}>{reagent.have}/{reagent.quantity}</span>
          </>
        : <span style={{ color: 'var(--color-text-muted)', fontSize: 22 }}>+</span>}
    </div>
  )
}

function CenterSlot({ size, label }: { size: number; label: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 8, padding: 6, textAlign: 'center',
      border: '3px solid var(--color-gold-mid)',
      background: 'radial-gradient(circle at 50% 40%, #1a0608 0%, #0c0203 100%)',
      boxShadow: '0 0 0 1px #080101, 0 0 18px rgba(240,208,96,0.35), 0 3px 8px rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ color: 'var(--color-gold-mid)', fontSize: 11, letterSpacing: 1, fontWeight: 'bold', textTransform: 'uppercase', lineHeight: 1.3 }}>{label}</span>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `CraftingPage.tsx`**

```typescript
// src/features/crafting/CraftingPage.tsx
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SecondaryButton } from '@/components/atoms/Button'
import { useInventory } from '@/hooks/useInventory'
import { useItemDefs } from '@/hooks/useRoster'
import { useProfile } from '@/hooks/useProfile'
import { resolveReagents, canAfford, defaultRarityChoice, type ItemRarityChoice } from '@/lib/crafting'
import { useRecipes, useCraftRun, useStartCraft, useClaimCraft } from './hooks'
import { CraftingCircle } from './components/CraftingCircle'
import { CraftingInventory } from './components/CraftingInventory'
import { RecipeBook } from './components/RecipeBook'

// Crafting (create recipes): pick a recipe → its reagents fill the circle → Craft spends them and
// starts the timer → Claim after ends_at grants the rolled result. One craft at a time (the
// craft_runs row); while one is running the page locks to that recipe. Desktop-only layout for
// now — mobile is a deferred follow-up.
export default function CraftingPage() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const profile = useProfile()
  const inventory = useInventory()
  const itemDefs = useItemDefs()
  const recipes = useRecipes()
  const run = useCraftRun()
  const startCraft = useStartCraft()
  const claimCraft = useClaimCraft()

  const [bookOpen, setBookOpen] = useState(true)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [choices, setChoices] = useState<ItemRarityChoice[]>([])

  // A running craft owns the selection.
  const activeKey = run.data?.recipe_def_id ?? selectedKey
  const recipe = recipes.data?.find((r) => r.recipeKey === activeKey) ?? null
  const inProgress = Boolean(run.data)
  const remainingMs = run.data ? new Date(run.data.ends_at).getTime() - now : 0

  const stacks = useMemo(() => inventory.data ?? [], [inventory.data])
  const resources = profile.data?.resources ?? {}

  // Default each item line's rarity when a recipe is picked (or the inventory changes).
  useEffect(() => {
    if (!recipe || inProgress) return
    setChoices(recipe.reagents.flatMap((line, index) => {
      if (line.kind !== 'item') return []
      const rarity = defaultRarityChoice(line, stacks)
      return rarity ? [{ reagentIndex: index, rarity }] : []
    }))
  }, [recipe, stacks, inProgress])

  const resolved = recipe ? resolveReagents(recipe.reagents, resources, stacks, choices) : []
  const pickRarity = (reagentIndex: number, rarity: string) =>
    setChoices((prev) => [...prev.filter((c) => c.reagentIndex !== reagentIndex), { reagentIndex, rarity }])
  const clear = () => { setSelectedKey(null); setChoices([]) }

  const mutationError = (startCraft.error ?? claimCraft.error) as Error | null

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 24, alignItems: 'start', marginBottom: 32 }}>
        <div style={{ gridColumn: '2' }}>
          <CraftingCircle
            reagents={resolved}
            resultName={recipe?.result.name ?? null}
            rarityChoices={choices}
            onPickRarity={pickRarity}
            inProgress={inProgress}
            remainingMs={remainingMs}
            canCraft={Boolean(recipe) && canAfford(resolved)}
            pending={startCraft.isPending || claimCraft.isPending}
            error={mutationError?.message ?? null}
            onCraft={() => { if (recipe) startCraft.mutate({ recipeDefId: recipe.recipeKey, choices }) }}
            onClaim={() => { if (run.data) claimCraft.mutate(run.data.recipe_def_id, { onSuccess: clear }) }}
            onClear={clear}
          />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {bookOpen ? (
            <motion.div
              key="book"
              initial={{ opacity: 0, x: 24, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.98 }}
              transition={{ duration: 0.17, ease: 'easeOut' }}
              style={{ gridColumn: '3', justifySelf: 'start', width: 280 }}
            >
              <RecipeBook
                recipes={recipes.data ?? []}
                selectedKey={activeKey}
                onSelect={(key) => { if (!inProgress) setSelectedKey(key) }}
                onClose={() => setBookOpen(false)}
              />
            </motion.div>
          ) : (
            <motion.div key="opener" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.11 }} style={{ gridColumn: '3', justifySelf: 'start' }}>
              <SecondaryButton onClick={() => setBookOpen(true)}>Show Recipe Book</SecondaryButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CraftingInventory resources={resources} stacks={stacks} itemDefs={itemDefs.data ?? {}} />
    </div>
  )
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build && npx vitest run`
Expected: all PASS. Then `npm run dev`, sign in, open `/crafting`: the recipe book lists real recipes (empty until Task 13 authors content — say so if you can't run a browser here). Confirm `src/features/crafting/CraftingPage.tsx` no longer imports `Item`, `COUNT`, `place`, `filled`, or anything from `@/lib/mock*`.

- [ ] **Step 4: Commit**

```bash
git add src/features/crafting/components/CraftingCircle.tsx src/features/crafting/CraftingPage.tsx
git commit -m "feat: crafting circle lifecycle — select, craft, wait, claim"
```

---

### Task 13: Reference recipes (Sanity content)

**Files:** none — Sanity content only, authored via the Sanity MCP `create_documents` tool (or Studio). Not a code task; the controller session authors this directly, as it did for dungeons/raids.

Three recipes proving every mechanic: resource-only, mixed resource+item (exercises the rarity picker), and a magic-weapon result with a non-Common weight. Result/item references use `_weak: true`; resource keys are the capitalized wallet keys. `_key`s are required on array items; `_type` on each is the schema object name.

- [ ] **Step 1: Create the three `recipeDef` documents**

| `_id` | recipeKey | name | reagents | result | resultRarityWeights | durationSeconds |
|---|---|---|---|---|---|---|
| `recipe.forge-rusted-blade` | `forge-rusted-blade` | Forge a Rusted Blade | 3× resource `Iron`, 2× resource `Coal` | `item.rusted-blade` | Common 3 / Uncommon 1 | 300 |
| `recipe.reforge-grave-iron-cleaver` | `reforge-grave-iron-cleaver` | Reforge a Grave-Iron Cleaver | 1× item `item.rusted-blade`, 4× resource `Iron`, 2× resource `Coal` | `item.grave-iron-cleaver` | Common 2 / Uncommon 2 / Rare 1 | 900 |
| `recipe.carve-femur-wand` | `carve-femur-wand` | Carve a Withered Femur Wand | 2× resource `Wood`, 1× resource `Stone` | `item.withered-femur-wand` | Common 3 / Uncommon 1 | 300 |

Descriptions (flavor only, one sentence, `docs/ITEMS.md` convention): "Every graverobber's first blade, hammered out of whatever the barrows give up." / "Fold a rusted blade back into grave-iron; the coffins remember the shape." / "Hollow a femur, whisper into it, wait for the whisper to come back."

Document shape (first recipe shown; the others follow it):

```json
{
  "_id": "recipe.forge-rusted-blade",
  "_type": "recipeDef",
  "name": "Forge a Rusted Blade",
  "recipeKey": "forge-rusted-blade",
  "description": "Every graverobber's first blade, hammered out of whatever the barrows give up.",
  "result": { "_type": "reference", "_ref": "item.rusted-blade", "_weak": true },
  "resultRarityWeights": [
    { "_key": "w1", "_type": "rarityWeight", "rarity": "Common", "weight": 3 },
    { "_key": "w2", "_type": "rarityWeight", "rarity": "Uncommon", "weight": 1 }
  ],
  "durationSeconds": 300,
  "reagents": [
    { "_key": "r1", "_type": "reagentLine", "kind": "resource", "resource": "Iron", "quantity": 3 },
    { "_key": "r2", "_type": "reagentLine", "kind": "resource", "resource": "Coal", "quantity": 2 }
  ]
}
```

For the item reagent line in the second recipe: `{ "_key": "r1", "_type": "reagentLine", "kind": "item", "item": { "_type": "reference", "_ref": "item.rusted-blade", "_weak": true }, "quantity": 1 }`.

- [ ] **Step 2: Read back through the client's exact query**

Run (Sanity MCP `query_documents`, `drafts` perspective) the `RECIPES_QUERY` from `src/services/crafting.ts`. Expected: 3 documents, every `result.itemKey` and every item-line `item.itemKey` resolved (not null), weights and reagents as authored.

---

### Task 14: ADR-0052, TODO, docs

**Files:**
- Modify: `docs/DECISIONS.md` (append after the last ADR — check the highest number first; it should be ADR-0051, so this is ADR-0052)
- Modify: `TODO.md` (the "Recipe schema" line, ~line 173)

- [ ] **Step 1: Append ADR-0052**

```markdown
## ADR-0052 — Crafting v1: `create` recipes as timed, server-authoritative crafts

**Date:** <ship date> · **Status:** Accepted (Alex)

**Context.** Crafting was a UI mockup over `src/lib/mockRecipes.ts` — no `recipeDef` type, no
runtime table, no Edge Function; the "Craft" button did nothing. The mock's `Recipe` type bundled
two mechanically different ideas (`create`: reagents → a new item; `infuse`: modify a specific
owned item). Design worked out in
`docs/superpowers/specs/2026-09-09-crafting-create-recipes-design.md`.

**Decision.**
- **`create` only, `infuse` deferred.** `player_inventory` stacks by `(item_def_id, rarity)` with
  no per-instance slot, so `infuse` needs an inventory-model change this ADR doesn't make.
- **Recipes are pure content.** `recipeDef`'s `result` and every `reagentLine.item` are Sanity
  references to `itemDef`; resource reagents name the resource registry. A new item or recipe is
  authoring, never code (ADR-0004). `rarityWeight` was promoted from `lootDrop`'s inline member to
  a shared object so both use one definition.
- **Reagents: resources + items; item rarity is the player's pick at craft time.** Never authored,
  never fixed to Common — the client sends `{ reagentIndex, rarity }` choices, the server resolves
  costs from Sanity and only trusts the client for that choice.
- **Timed, like missions; spent at start.** `craft-start` deducts every reagent atomically
  (`start_craft`, all-or-nothing) and opens a `craft_runs` row with `ends_at`; `craft-claim`
  rolls the result's rarity (`rollRarity`, seeded per run so a retry can't re-roll) and grants
  one copy (`claim_craft`, atomic conditional delete = the double-claim guard).
- **One craft at a time**, structurally: `craft_runs.player_id` is the primary key.
- **No discovery in v1** — every recipe is visible.
- **Page migrated** to `src/features/crafting/` with its three organisms (single consumer each);
  the recipe book drives the circle (select → slots fill).

**Consequences.**
- Closes the "Recipe schema" TODO line. `src/lib/mockRecipes.ts`, `src/lib/mockInventory.ts`,
  `src/types/recipe.ts` deleted.
- No automated coverage for `craft-start`/`craft-claim` (accepted Edge Function gap), but
  `src/test/migration-policy.test.ts` verifies the new table/RPC grants, and `src/lib/crafting.ts`
  + `src/services/crafting.ts` are unit-tested.
- Follow-ups: `infuse` (own spec), recipe discovery (could reuse ADR-0048's condition types),
  more recipes (content wave).
```

- [ ] **Step 2: Close the TODO line**

Replace the `- [ ] **Recipe schema** — never built. ...` entry (and its `↳ context` line) with:

```markdown
- [x] **Recipe schema** (ADR-0052) — `recipeDef`/`reagentLine` Sanity types, `craft_runs` +
  `start_craft`/`claim_craft`, `craft-start`/`craft-claim` Edge Functions, page migrated to
  `src/features/crafting/`, mocks deleted, 3 reference recipes authored. `infuse` recipes and
  discovery are separate follow-ups (spec §3).
  `↳ context: project-crafting · docs/DECISIONS.md ADR-0052, docs/superpowers/specs/2026-09-09-crafting-create-recipes-design.md`
```

- [ ] **Step 3: Commit**

```bash
git add docs/DECISIONS.md TODO.md
git commit -m "docs: record ADR-0052 (crafting v1, create recipes) and close the recipe-schema TODO"
```

---

## Self-Review Notes

- **Spec coverage:** §4a/4b → Task 1; §4c → Task 2 (+ Task 3 types); §5 → Tasks 2, 6, 7; §6 → Tasks 4, 5, 8–12; §7 error cases → Task 2's raises + Task 6/7's status codes + Task 12's error line; §8 testing → Tasks 4, 5 (unit), Task 2 (policy test), Task 13 (reference content); §9 follow-ups → Task 14's ADR.
- **Decisions made while planning, not in the spec:** the interaction model (recipe selection fills the circle; the inventory grid becomes read-only) — the spec listed the pieces but not the flow; reagents capped at 6 to match the circle; `defaultRarityChoice` prefers the lowest rarity that covers the quantity (the spec's "player picks" needs a sensible default); result quantity fixed at 1. All flagged here for visibility.
- **Type consistency:** `ReagentLine`/`ItemRarityChoice`/`ResolvedReagent` (Task 4) are used by Tasks 5, 9, 12 with the same field names; `RecipeView.reagentNames` (Task 5) is read by Task 9; `start_craft`'s five params and `claim_craft`'s four (Task 2) match Tasks 6 and 7 exactly; `CraftRun` (Task 5) = `Tables<'craft_runs'>` (Task 3) and Task 12 reads `recipe_def_id`/`ends_at` from it.
