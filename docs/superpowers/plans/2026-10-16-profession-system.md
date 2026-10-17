# Profession System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared account-wide profession leveling/recipe-acquisition system (5
independent professions, craft-triggered XP, a linear leveling curve, and recipes acquired via
profession-expert purchase, quest turn-in, level-up reward, or loot drop) that the five
ADR-0061 follow-on professions will sit on top of.

**Architecture:** Extends the existing `recipeDef`/`craft_runs` crafting system (ADR-0052) rather
than building a parallel one. `profiles.professions jsonb` is the new account-wide state, in the
same reset tier as `currencies`/`resources`/`echo_shop` (survives Reset, wiped at Transcendence).
TS computes the leveling math (mirroring `src/lib/leveling.ts`'s existing `applyXp` shape exactly);
Postgres just persists what TS computed — the same compute/persist split every other server-write
in this codebase already uses.

**Tech Stack:** Sanity (schema), Supabase/Postgres (migrations, RPCs), Deno Edge Functions,
React/TanStack Query (client).

**Spec:** `docs/superpowers/specs/2026-10-16-profession-system-design.md`

## Global Constraints

- Professions are account-wide (`profiles.professions`), NOT per-character — do not touch
  `player_characters`.
- 5 independent profession keys, each with its own `{ level, xp, knownRecipes }`:
  `alchemy`, `carving`, `prospecting`, `tempering`, `arcaneWriting`. Use these exact string keys
  everywhere (Sanity field options, TS registry, jsonb keys).
- Level cap is 10. Leveling curve: level *L* → *L+1* costs `100 × L` XP (linear). XP resets to
  the remainder on each level-up (mirrors `src/lib/leveling.ts`'s `applyXp`, not a cumulative
  total).
- `recipeDef.professionKey` is OPTIONAL, not required (a real backward-compatibility decision
  this plan makes that the spec left open: the 3 existing reference recipes have no profession
  and must keep working unchanged — absence of `professionKey` means "generic recipe," no
  profession gate, no XP grant).
- Ordinary crafting reagent costs stay item/resource-only. The new `currency` kind on
  `reagentLine` is for profession-quest turn-ins only — do not add currency reagents to any
  existing or new `recipeDef`.
- `professions` resets to `{}` on Transcendence, survives a soft Reset — add it to
  `transcend_player`'s existing reset list; do not touch `reset_player`.
- Every new RPC follows this project's standing rule: award/credit logic that reads a value to
  decide a grant locks that row with `for update` in the same read, not inherited from
  surrounding code.

## Review Focus

- A craft for a recipe the player hasn't learned (no `professionKey` entry, or
  `professionKey` present but recipe not in `knownRecipes`) — `start_craft` must reject it, not
  silently allow it (Task 3).
- A profession XP grant that crosses MULTIPLE levels in one craft (a very high-`xpAwarded`
  recipe) — `applyProfessionXp` must loop, not just add one level (Task 2, mirrors
  `applyXp`'s own loop).
- A profession already at level 10 (cap) receiving more XP — must discard the XP, not overflow
  past the cap or divide-by-zero in the curve function (Task 2).
- A quest turn-in where the player doesn't actually have the required reagents/currency —
  `claim_profession_quest` must reject before consuming anything, matching `start_craft`'s
  verify-then-deduct order (Task 3).
- A profession-expert recipe purchase below the recipe's `requiredLevel` — must be rejected
  server-side, not just hidden in the UI (Task 3, Task 6).

---

### Task 1: Sanity schema — profession fields on recipeDef, currency kind on reagentLine, the professionQuestDef type

**Files:**
- Modify: `studio/schemaTypes/recipeDef.ts`
- Modify: `studio/schemaTypes/objects/reagentLine.ts`
- Create: `studio/schemaTypes/professionQuestDef.ts`
- Modify: `studio/schemaTypes/index.ts`

**Interfaces:**
- Produces: `recipeDef.professionKey` (string, optional, one of the 5 keys), `recipeDef.xpAwarded`
  (number, required when `professionKey` is set), `recipeDef.requiredLevel` (number, optional,
  default 1 — the level needed to buy/craft it), `recipeDef.grantedAtLevel` (number, optional —
  "this recipe is auto-granted the moment the profession reaches this level"),
  `recipeDef.learnCost` (number, default 0 — gold cost to buy from the profession expert).
  `reagentLine.kind` gains a third option `'currency'` with a new `currency` field.
  `professionQuestDef` (new document type): `name`, `questKey`, `professionKey`,
  `requiredLevel`, `cost` (array of `reagentLine`), `rewardRecipe` (reference to `recipeDef`).

- [ ] **Step 1: Add the profession fields to `recipeDef.ts`**

In `studio/schemaTypes/recipeDef.ts`, add a `PROFESSION_OPTIONS` constant and four new fields to
the `fields` array (after `reagents`):

```ts
const PROFESSION_OPTIONS = [
  { title: 'Alchemy', value: 'alchemy' },
  { title: 'Carving', value: 'carving' },
  { title: 'Prospecting', value: 'prospecting' },
  { title: 'Tempering', value: 'tempering' },
  { title: 'Arcane Writing', value: 'arcaneWriting' },
]
```

```ts
    defineField({
      name: 'professionKey',
      title: 'Profession',
      description: 'Leave empty for a generic recipe with no profession gate or XP grant (e.g. the existing reference recipes).',
      type: 'string',
      options: { list: PROFESSION_OPTIONS },
    }),
    defineField({
      name: 'xpAwarded',
      title: 'Profession XP awarded',
      description: 'Granted to professionKey\'s level on each claim. Required when professionKey is set.',
      type: 'number',
      hidden: ({ parent }) => !(parent as { professionKey?: string } | undefined)?.professionKey,
      validation: (rule) =>
        rule.custom((value: number | undefined, context) => {
          const professionKey = (context.parent as { professionKey?: string } | undefined)?.professionKey
          if (!professionKey) return true
          return typeof value === 'number' && value >= 1 ? true : 'Required (min 1) when a profession is set.'
        }),
    }),
    defineField({
      name: 'requiredLevel',
      title: 'Required profession level',
      description: 'The profession level needed to buy or craft this recipe. Only meaningful when professionKey is set.',
      type: 'number',
      initialValue: 1,
      hidden: ({ parent }) => !(parent as { professionKey?: string } | undefined)?.professionKey,
      validation: (rule) => rule.integer().min(1).max(10),
    }),
    defineField({
      name: 'grantedAtLevel',
      title: 'Auto-granted at level',
      description: 'Optional. If set, this recipe is unlocked automatically the moment professionKey reaches this level — no purchase or quest needed.',
      type: 'number',
      hidden: ({ parent }) => !(parent as { professionKey?: string } | undefined)?.professionKey,
      validation: (rule) => rule.integer().min(1).max(10),
    }),
    defineField({
      name: 'learnCost',
      title: 'Gold cost to learn (profession expert)',
      description: 'Only meaningful when professionKey is set and the recipe is meant to be purchasable, not quest/level-only.',
      type: 'number',
      initialValue: 0,
      hidden: ({ parent }) => !(parent as { professionKey?: string } | undefined)?.professionKey,
      validation: (rule) => rule.integer().min(0),
    }),
```

- [ ] **Step 2: Add the `currency` kind to `reagentLine.ts`**

In `studio/schemaTypes/objects/reagentLine.ts`, import the currency registry and widen the
`kind` options list and add a `currency` field, mirroring the existing `resource` field exactly:

```ts
import { CURRENCY_DEFS } from '../../../src/lib/currencies'
```

Change the `kind` field's options list:

```ts
      options: { list: [{ title: 'Resource', value: 'resource' }, { title: 'Item', value: 'item' }, { title: 'Currency', value: 'currency' }], layout: 'radio' },
```

Add a new field after the existing `resource` field:

```ts
    defineField({
      name: 'currency',
      title: 'Currency',
      type: 'string',
      options: { list: CURRENCY_DEFS.map((c) => ({ title: c.label, value: c.key })) },
      hidden: ({ parent }) => (parent as { kind?: string } | undefined)?.kind !== 'currency',
      validation: (rule) =>
        rule.custom((value: string | undefined, context) => {
          const kind = (context.parent as { kind?: string } | undefined)?.kind
          if (kind !== 'currency') return true
          return value ? true : 'A currency reagent needs a currency.'
        }),
    }),
```

And update the `preview.select`/`prepare` at the bottom to handle the new kind:

```ts
  preview: {
    select: { kind: 'kind', resource: 'resource', itemName: 'item.name', currency: 'currency', quantity: 'quantity' },
    prepare({ kind, resource, itemName, currency, quantity }) {
      const label = kind === 'item' ? (itemName ?? '(item)') : kind === 'currency' ? (currency ?? '(currency)') : (resource ?? '(resource)')
      return { title: `${quantity ?? '?'}× ${label}` }
    },
  },
```

- [ ] **Step 3: Create `professionQuestDef.ts`**

```ts
import { defineType, defineField, defineArrayMember } from 'sanity'
import { ClipboardIcon } from '@sanity/icons'

// A profession-expert quest (docs/superpowers/specs/2026-10-16-profession-system-design.md
// Decision 4 channel 2): turn in `cost` (reagentLine's resource/item/currency mix) once, get
// rewardRecipe unlocked permanently. Level-10-exclusive quests are NOT a separate mechanism —
// they're just entries authored with requiredLevel: 10.
const PROFESSION_OPTIONS = [
  { title: 'Alchemy', value: 'alchemy' },
  { title: 'Carving', value: 'carving' },
  { title: 'Prospecting', value: 'prospecting' },
  { title: 'Tempering', value: 'tempering' },
  { title: 'Arcane Writing', value: 'arcaneWriting' },
]

export const professionQuestDef = defineType({
  name: 'professionQuestDef',
  title: 'Profession Quest',
  type: 'document',
  icon: ClipboardIcon,
  fields: [
    defineField({ name: 'name', type: 'string', validation: (rule) => rule.required() }),
    defineField({
      name: 'questKey',
      title: 'Quest key',
      description: 'Stable id. Lowercase letters, numbers and hyphens. NEVER change once live.',
      type: 'string',
      validation: (rule) =>
        rule.required().custom((value) => {
          if (!value) return 'Required'
          if (!/^[a-z0-9-]+$/.test(value)) return 'Lowercase letters, numbers and hyphens only'
          return true
        }),
    }),
    defineField({
      name: 'professionKey',
      title: 'Profession',
      type: 'string',
      options: { list: PROFESSION_OPTIONS },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'requiredLevel',
      title: 'Required profession level',
      type: 'number',
      initialValue: 1,
      validation: (rule) => rule.required().integer().min(1).max(10),
    }),
    defineField({
      name: 'description',
      type: 'text',
      rows: 2,
    }),
    defineField({
      name: 'cost',
      title: 'Turn-in cost (1-6)',
      type: 'array',
      of: [defineArrayMember({ type: 'reagentLine' })],
      validation: (rule) => rule.required().min(1).max(6),
    }),
    defineField({
      name: 'rewardRecipe',
      title: 'Reward recipe',
      type: 'reference',
      to: [{ type: 'recipeDef' }],
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { title: 'name', profession: 'professionKey', level: 'requiredLevel' },
    prepare({ title, profession, level }) {
      return { title, subtitle: `${profession} · requires level ${level}` }
    },
  },
})
```

- [ ] **Step 4: Register `professionQuestDef` in `index.ts`**

Find the import/export list in `studio/schemaTypes/index.ts` (the same list `recipeDef` is
already in) and add:

```ts
import { professionQuestDef } from './professionQuestDef'
```

and add `professionQuestDef` to the exported array alongside `recipeDef`.

- [ ] **Step 5: Verify the Studio builds**

Run: `cd studio && npm run build`
Expected: builds with no errors (TypeScript + Sanity schema validation).

- [ ] **Step 6: Commit**

```bash
git add studio/schemaTypes/recipeDef.ts studio/schemaTypes/objects/reagentLine.ts studio/schemaTypes/professionQuestDef.ts studio/schemaTypes/index.ts
git commit -m "feat: add profession fields to recipeDef, currency reagent kind, professionQuestDef"
```

---

### Task 2: `src/lib/professions.ts` — the registry and leveling math

**Files:**
- Create: `src/lib/professions.ts`
- Test: `src/lib/professions.test.ts`

**Interfaces:**
- Produces: `PROFESSION_DEFS: ProfessionDef[]`, `PROFESSION_KEYS: string[]`,
  `PROFESSION_LABELS: Record<string, string>`, `PROFESSION_LEVEL_CAP = 10`,
  `xpToNextProfessionLevel(level: number): number`,
  `applyProfessionXp(level: number, xp: number, gained: number): { level: number; xp: number }`.
- Consumes: nothing (pure, Deno-safe — no sibling imports, so no `.ts` extension concern; see
  `src/lib/leveling.ts`'s own doc comment for why this module stays import-free).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import {
  PROFESSION_DEFS,
  PROFESSION_KEYS,
  PROFESSION_LABELS,
  PROFESSION_LEVEL_CAP,
  xpToNextProfessionLevel,
  applyProfessionXp,
} from './professions'

describe('PROFESSION_DEFS', () => {
  it('has exactly the 5 planned professions', () => {
    expect(PROFESSION_KEYS).toEqual(['alchemy', 'carving', 'prospecting', 'tempering', 'arcaneWriting'])
    expect(PROFESSION_LABELS.alchemy).toBe('Alchemy')
    expect(PROFESSION_LABELS.arcaneWriting).toBe('Arcane Writing')
    expect(PROFESSION_DEFS.length).toBe(5)
  })
})

describe('xpToNextProfessionLevel', () => {
  it('is 100 × level, Infinity at the cap', () => {
    expect(xpToNextProfessionLevel(1)).toBe(100)
    expect(xpToNextProfessionLevel(2)).toBe(200)
    expect(xpToNextProfessionLevel(9)).toBe(900)
    expect(xpToNextProfessionLevel(PROFESSION_LEVEL_CAP)).toBe(Infinity)
  })
})

describe('applyProfessionXp', () => {
  it('accumulates xp without leveling until the threshold', () => {
    expect(applyProfessionXp(1, 0, 50)).toEqual({ level: 1, xp: 50 })
  })

  it('levels up and carries the remainder', () => {
    expect(applyProfessionXp(1, 90, 30)).toEqual({ level: 2, xp: 20 })
  })

  it('rolls over multiple levels from one large gain', () => {
    // level 1: needs 100. level 2: needs 200. 0 + 350 = 350 → level1 (−100=250) → level2 (−200=50) → level 3, xp 50.
    expect(applyProfessionXp(1, 0, 350)).toEqual({ level: 3, xp: 50 })
  })

  it('discards xp once the level cap is reached', () => {
    // level 9, xp 850, gained 100 → crosses into level 10 (cap), remainder discarded to 0.
    expect(applyProfessionXp(9, 850, 100)).toEqual({ level: 10, xp: 0 })
  })

  it('a profession already at the cap gains nothing further', () => {
    expect(applyProfessionXp(10, 0, 9999)).toEqual({ level: 10, xp: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/professions.test.ts`
Expected: FAIL — `src/lib/professions.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// The profession registry + leveling math — mirrors src/lib/leveling.ts's applyXp shape exactly
// (xp is progress toward the NEXT level, resets to the remainder on each level-up), but with a
// linear curve (100 × level) and a 10-level cap instead of character leveling's 50-level power
// curve. See docs/superpowers/specs/2026-10-16-profession-system-design.md Decision 2.
//
// Account-wide (profiles.professions), not per-character — do not confuse with src/lib/skills.ts
// (SKILL_DEFS), which is per-character and passive.

export type ProfessionDef = {
  professionKey: string
  label: string
}

export const PROFESSION_DEFS: ProfessionDef[] = [
  { professionKey: 'alchemy', label: 'Alchemy' },
  { professionKey: 'carving', label: 'Carving' },
  { professionKey: 'prospecting', label: 'Prospecting' },
  { professionKey: 'tempering', label: 'Tempering' },
  { professionKey: 'arcaneWriting', label: 'Arcane Writing' },
]

export const PROFESSION_KEYS: string[] = PROFESSION_DEFS.map((p) => p.professionKey)

export const PROFESSION_LABELS: Record<string, string> = Object.fromEntries(
  PROFESSION_DEFS.map((p) => [p.professionKey, p.label]),
)

/** Hard level ceiling for every profession. */
export const PROFESSION_LEVEL_CAP = 10

/** XP required to advance FROM `level` to `level + 1`. Linear: 100, 200, 300... 900. */
export function xpToNextProfessionLevel(level: number): number {
  if (level >= PROFESSION_LEVEL_CAP) return Infinity
  return 100 * level
}

/**
 * Apply earned XP to a profession's (level, xp). Same shape as leveling.ts's applyXp: xp resets
 * to the remainder on each level-up, rolls over as many levels as the gain covers, discards any
 * XP earned once the cap is reached.
 */
export function applyProfessionXp(level: number, xp: number, gained: number): { level: number; xp: number } {
  let lvl = level
  let cur = xp + gained
  while (lvl < PROFESSION_LEVEL_CAP && cur >= xpToNextProfessionLevel(lvl)) {
    cur -= xpToNextProfessionLevel(lvl)
    lvl += 1
  }
  if (lvl >= PROFESSION_LEVEL_CAP) cur = 0
  return { level: lvl, xp: cur }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/professions.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/professions.ts src/lib/professions.test.ts
git commit -m "feat: add the profession registry and leveling math"
```

---

### Task 3: Migration — `profiles.professions`, the reset-tier hookup, the recipe-known gate, and 3 RPCs

**Files:**
- Create: `supabase/migrations/20261016110000_professions.sql`
- Test: `supabase/tests/database/professions.sql`

**Interfaces:**
- Consumes: nothing new from earlier tasks (pure SQL).
- Produces: `profiles.professions jsonb` column. `start_craft` gains a 6th param
  `p_profession_key text default null` and rejects the craft if that profession doesn't know
  the recipe. `claim_craft` gains 3 new params (`p_profession_key text default null`,
  `p_profession_level int default null`, `p_profession_xp int default null`,
  `p_newly_known_recipes text[] default array[]::text[]`) and merges the computed level/xp/newly-
  known recipes into `professions.<key>`. New `learn_profession_recipe(p_player uuid,
  p_profession_key text, p_recipe_key text, p_cost int, p_required_level int) returns jsonb`.
  New `claim_profession_quest(p_player uuid, p_profession_key text, p_quest_key text,
  p_required_level int, p_reward_recipe_key text, p_resource_cost jsonb, p_item_cost jsonb,
  p_currency_cost jsonb) returns jsonb`. `transcend_player` redefined with `professions =
  '{}'::jsonb` added to its reset list — every other line copied verbatim from
  `supabase/migrations/20260914110300_transcend_reset_skill_busy_check.sql`.

- [ ] **Step 1: Write the migration**

```sql
-- Profession system (docs/superpowers/specs/2026-10-16-profession-system-design.md). Account-
-- wide (profiles.professions), NOT per-character — see Decision 1 for why this differs from the
-- per-character, passive Skills system (skill_assignments, ADR-0056).
alter table public.profiles
  add column professions jsonb not null default '{}'::jsonb;

comment on column public.profiles.professions is
  'Account-wide profession progress: { "<professionKey>": { "level": int, "xp": int, "knownRecipes": [recipeKey, ...] } }. Absent key = level 0, no recipes known. Same reset tier as currencies/resources/echo_shop — survives Reset, wiped at Transcendence.';

-- ---------------------------------------------------------------------------------------------
-- start_craft: unchanged 5-param signature plus a new 6th param, so existing callers (the 3
-- reference recipes with no profession) keep working with p_profession_key omitted/null. When
-- it IS set, the caller must know the recipe already — Decision 3's new server-authoritative
-- gate. Every other line copied verbatim from 20260923100000_craft_cancel.sql.
-- ---------------------------------------------------------------------------------------------
create or replace function public.start_craft(
  p_player             uuid,
  p_recipe_def_id      text,
  p_resource_reagents  jsonb,
  p_item_reagents      jsonb,
  p_duration_seconds   integer,
  p_profession_key     text default null
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
  v_known     jsonb;
begin
  if p_recipe_def_id is null or length(p_recipe_def_id) = 0 then
    raise exception 'start_craft: recipe required';
  end if;
  if p_duration_seconds is null or p_duration_seconds < 1 then
    raise exception 'start_craft: invalid duration';
  end if;

  if p_profession_key is not null then
    select professions -> p_profession_key -> 'knownRecipes' into v_known
      from public.profiles
     where player_id = p_player;
    if v_known is null or not (v_known ? p_recipe_def_id) then
      raise exception 'start_craft: recipe not known for this profession';
    end if;
  end if;

  -- One craft at a time: the primary key is the mutex. A concurrent second start conflicts
  -- here and raises before anything is spent; craft_runs is touched by no other RPC, so this
  -- introduces no lock-order dependency.
  insert into public.craft_runs (player_id, recipe_def_id, started_at, ends_at, resource_reagents, item_reagents)
  values (p_player, p_recipe_def_id, now(), now() + make_interval(secs => p_duration_seconds),
          coalesce(p_resource_reagents, '[]'::jsonb), coalesce(p_item_reagents, '[]'::jsonb))
  on conflict (player_id) do nothing
  returning * into v_run;
  if v_run.player_id is null then
    raise exception 'start_craft: a craft is already in progress';
  end if;

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

  -- Lock the wallet (inventory was locked above — same inventory-before-profiles order as
  -- claim_mission / claim_group_stage). A missing profile must fail loudly, not skip the charge.
  perform 1 from public.profiles where player_id = p_player for update;
  if not found then
    raise exception 'start_craft: no profile';
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

  return v_run;
end;
$$;

revoke all on function public.start_craft(uuid, text, jsonb, jsonb, integer, text) from public, anon, authenticated;
grant execute on function public.start_craft(uuid, text, jsonb, jsonb, integer, text) to service_role;

-- The old 5-arg start_craft is a different overload now that a 6th param was added via create or
-- replace (Postgres treats a differing arg list as a NEW overload, not a replacement — the
-- upgrade_items precedent, CLAUDE.md). Drop it explicitly so only the 6-arg version remains.
drop function if exists public.start_craft(uuid, text, jsonb, jsonb, integer);

-- ---------------------------------------------------------------------------------------------
-- claim_craft: drop + recreate for the new params (genuine signature change, same upgrade_items
-- precedent). Every line through the lifetime_stats loop is copied verbatim from
-- 20260916130000_claim_craft_lifetime_stats.sql; the profession block is new.
-- ---------------------------------------------------------------------------------------------
drop function if exists public.claim_craft(uuid, text, text, text, jsonb);

create or replace function public.claim_craft(
  p_player                uuid,
  p_recipe_def_id         text,
  p_result_item_def_id    text,
  p_result_rarity         text,
  p_lifetime_stats        jsonb default '{}'::jsonb,
  p_profession_key        text default null,
  p_profession_level      int default null,
  p_profession_xp         int default null,
  p_newly_known_recipes   text[] default array[]::text[]
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text;
  v_val numeric;
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

  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_lifetime_stats, '{}'::jsonb))
  loop
    update public.profiles
       set lifetime_stats = jsonb_set(lifetime_stats, array[v_key],
             to_jsonb(coalesce((lifetime_stats->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;

  -- Profession XP + newly-known recipes (level-up rewards, Decision 4 channel 3). The caller
  -- (craft-claim Edge Function) already computed the new level/xp via applyProfessionXp (TS) and
  -- resolved any grantedAtLevel recipes from Sanity — this just persists what was computed,
  -- merged onto the existing knownRecipes array (duplicates are harmless: knownRecipes is
  -- checked with `?` containment, never counted).
  if p_profession_key is not null then
    update public.profiles
       set professions = jsonb_set(
             professions,
             array[p_profession_key],
             coalesce(professions -> p_profession_key, jsonb_build_object('level', 0, 'xp', 0, 'knownRecipes', '[]'::jsonb))
               || jsonb_build_object(
                    'level', p_profession_level,
                    'xp', p_profession_xp,
                    'knownRecipes', coalesce(professions -> p_profession_key -> 'knownRecipes', '[]'::jsonb) || to_jsonb(p_newly_known_recipes)
                  )
           )
     where player_id = p_player;
  end if;

  return jsonb_build_object('item_def_id', p_result_item_def_id, 'rarity', p_result_rarity);
end;
$$;

revoke all on function public.claim_craft(uuid, text, text, text, jsonb, text, int, int, text[]) from public, anon, authenticated;
grant execute on function public.claim_craft(uuid, text, text, text, jsonb, text, int, int, text[]) to service_role;

-- ---------------------------------------------------------------------------------------------
-- learn_profession_recipe: buy a recipe from the profession expert for gold (Decision 4 channel
-- 1). p_cost/p_required_level are resolved server-side by the Edge Function from Sanity — the
-- client is never trusted for either. Locks profiles in the same read that checks both gold and
-- current level (this project's for-update-on-read rule).
-- ---------------------------------------------------------------------------------------------
create or replace function public.learn_profession_recipe(
  p_player         uuid,
  p_profession_key text,
  p_recipe_key     text,
  p_cost           int,
  p_required_level int
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_gold  numeric;
  v_level int;
  v_known jsonb;
begin
  select coalesce((currencies->>'gold')::numeric, 0),
         coalesce((professions -> p_profession_key ->> 'level')::int, 0),
         coalesce(professions -> p_profession_key -> 'knownRecipes', '[]'::jsonb)
    into v_gold, v_level, v_known
    from public.profiles
   where player_id = p_player
   for update;

  if not found then
    raise exception 'learn_profession_recipe: no profile';
  end if;
  if v_level < p_required_level then
    raise exception 'learn_profession_recipe: profession level too low (needs %, has %)', p_required_level, v_level;
  end if;
  if v_known ? p_recipe_key then
    raise exception 'learn_profession_recipe: recipe already known';
  end if;
  if v_gold < p_cost then
    raise exception 'learn_profession_recipe: insufficient gold (needs %, has %)', p_cost, v_gold;
  end if;

  update public.profiles
     set currencies = jsonb_set(currencies, array['gold'], to_jsonb(v_gold - p_cost)),
         professions = jsonb_set(
           professions,
           array[p_profession_key],
           coalesce(professions -> p_profession_key, jsonb_build_object('level', 0, 'xp', 0, 'knownRecipes', '[]'::jsonb))
             || jsonb_build_object('knownRecipes', v_known || to_jsonb(array[p_recipe_key]))
         )
   where player_id = p_player;

  return jsonb_build_object('recipeKey', p_recipe_key, 'goldSpent', p_cost);
end;
$$;

revoke all on function public.learn_profession_recipe(uuid, text, text, int, int) from public, anon, authenticated;
grant execute on function public.learn_profession_recipe(uuid, text, text, int, int) to service_role;

-- ---------------------------------------------------------------------------------------------
-- claim_profession_quest: turn in a reagent-line-shaped cost (resources + items + currency) at
-- the profession expert, once, for a recipe reward (Decision 4 channel 2; level-10-exclusive
-- quests are just entries with p_required_level = 10, not a separate mechanism). Verify-then-
-- deduct order mirrors start_craft: item reagents first (locked, deducted), then the profile
-- wallet (locked once, gold AND resources deducted from that same lock) — never partially spend
-- before confirming every line is payable.
-- ---------------------------------------------------------------------------------------------
create or replace function public.claim_profession_quest(
  p_player            uuid,
  p_profession_key    text,
  p_quest_key         text,
  p_required_level    int,
  p_reward_recipe_key text,
  p_resource_cost     jsonb default '[]'::jsonb,
  p_item_cost         jsonb default '[]'::jsonb,
  p_currency_cost     jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line     jsonb;
  v_item     text;
  v_rarity   text;
  v_need     integer;
  v_code     text;
  v_have     numeric;
  v_level    int;
  v_known    jsonb;
  v_completed jsonb;
begin
  select coalesce((professions -> p_profession_key ->> 'level')::int, 0),
         coalesce(professions -> p_profession_key -> 'knownRecipes', '[]'::jsonb),
         coalesce(professions -> p_profession_key -> 'completedQuests', '[]'::jsonb)
    into v_level, v_known, v_completed
    from public.profiles
   where player_id = p_player
   for update;

  if not found then
    raise exception 'claim_profession_quest: no profile';
  end if;
  if v_level < p_required_level then
    raise exception 'claim_profession_quest: profession level too low (needs %, has %)', p_required_level, v_level;
  end if;
  if v_completed ? p_quest_key then
    raise exception 'claim_profession_quest: quest already completed';
  end if;

  -- Item reagents: verify first, deduct in the same loop (same idiom as start_craft).
  for v_line in select * from jsonb_array_elements(coalesce(p_item_cost, '[]'::jsonb))
  loop
    v_item   := v_line->>'item_def_id';
    v_rarity := v_line->>'rarity';
    v_need   := (v_line->>'quantity')::integer;
    select quantity into v_have
      from public.player_inventory
     where player_id = p_player and item_def_id = v_item and rarity = v_rarity
     for update;
    if not found or v_have < v_need then
      raise exception 'claim_profession_quest: not enough % (%) — have %, need %', v_item, v_rarity, coalesce(v_have, 0), v_need;
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

  -- Resource + currency cost: verify every line against the already-locked profile row before
  -- deducting any of them.
  for v_line in select * from jsonb_array_elements(coalesce(p_resource_cost, '[]'::jsonb))
  loop
    v_code := v_line->>'code';
    v_need := (v_line->>'quantity')::integer;
    select coalesce((resources->>v_code)::numeric, 0) into v_have from public.profiles where player_id = p_player;
    if v_have < v_need then
      raise exception 'claim_profession_quest: not enough resource % (have %, need %)', v_code, v_have, v_need;
    end if;
  end loop;
  for v_line in select * from jsonb_array_elements(coalesce(p_currency_cost, '[]'::jsonb))
  loop
    v_code := v_line->>'code';
    v_need := (v_line->>'quantity')::integer;
    select coalesce((currencies->>v_code)::numeric, 0) into v_have from public.profiles where player_id = p_player;
    if v_have < v_need then
      raise exception 'claim_profession_quest: not enough currency % (have %, need %)', v_code, v_have, v_need;
    end if;
  end loop;

  for v_line in select * from jsonb_array_elements(coalesce(p_resource_cost, '[]'::jsonb))
  loop
    v_code := v_line->>'code';
    v_need := (v_line->>'quantity')::integer;
    update public.profiles
       set resources = jsonb_set(resources, array[v_code], to_jsonb(coalesce((resources->>v_code)::numeric, 0) - v_need))
     where player_id = p_player;
  end loop;
  for v_line in select * from jsonb_array_elements(coalesce(p_currency_cost, '[]'::jsonb))
  loop
    v_code := v_line->>'code';
    v_need := (v_line->>'quantity')::integer;
    update public.profiles
       set currencies = jsonb_set(currencies, array[v_code], to_jsonb(coalesce((currencies->>v_code)::numeric, 0) - v_need))
     where player_id = p_player;
  end loop;

  update public.profiles
     set professions = jsonb_set(
           professions,
           array[p_profession_key],
           coalesce(professions -> p_profession_key, jsonb_build_object('level', 0, 'xp', 0, 'knownRecipes', '[]'::jsonb))
             || jsonb_build_object(
                  'knownRecipes', v_known || to_jsonb(array[p_reward_recipe_key]),
                  'completedQuests', v_completed || to_jsonb(array[p_quest_key])
                )
         )
   where player_id = p_player;

  return jsonb_build_object('rewardRecipeKey', p_reward_recipe_key);
end;
$$;

revoke all on function public.claim_profession_quest(uuid, text, text, int, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.claim_profession_quest(uuid, text, text, int, text, jsonb, jsonb, jsonb) to service_role;

-- ---------------------------------------------------------------------------------------------
-- transcend_player: redefined with professions added to the reset list. Every other line is
-- copied verbatim from 20260914110300_transcend_reset_skill_busy_check.sql.
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
  v_reset_count integer;
  v_shards_earned_total integer;
  v_days_played integer;
  v_achievement_counters jsonb;
  v_achievements jsonb;
  v_unlocked_characters jsonb;
  v_achievement_result jsonb;
begin
  select coalesce((echo_shop ->> 'protectedSlots')::int, 0), transcend_count, ascendant_milestones,
         lifetime_stats, reset_count, ascendant_shards_earned_total, days_played,
         achievement_counters, achievements, unlocked_characters
    into v_protected_slots, v_transcend_count, v_ascendant_milestones,
         v_lifetime_stats, v_reset_count, v_shards_earned_total, v_days_played,
         v_achievement_counters, v_achievements, v_unlocked_characters
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
    or exists (
      select 1 from public.skill_assignments sk
        join public.player_characters pc on pc.id = sk.player_character_id
       where pc.player_id = p_player
    )
  then
    raise exception 'transcend_player: a character is busy';
  end if;

  v_transcend_count := v_transcend_count + 1;
  v_milestones := check_ascendant_milestones(v_lifetime_stats, v_transcend_count, v_ascendant_milestones);
  v_awarded := (v_milestones ->> 'shards')::int;

  v_achievement_result := check_achievements(
    v_lifetime_stats,
    (select count(*) from jsonb_object_keys(v_unlocked_characters))::int,
    v_reset_count, v_transcend_count, v_shards_earned_total + v_awarded, v_days_played,
    v_achievement_counters, v_achievements
  );

  update public.profiles
     set currencies           = '{}'::jsonb,
         resources            = '{}'::jsonb,
         map_progress         = '{}'::jsonb,
         infirmary_level      = 1,
         echoes               = 0,
         echo_shop            = '{}'::jsonb,
         professions          = '{}'::jsonb,
         unlocked_characters  = (
           select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
           from jsonb_each(unlocked_characters)
           where key in (select character_def_id from public.player_characters
                         where id = any(p_protected_ids))
         ),
         transcend_count      = v_transcend_count,
         ascendant_shards     = ascendant_shards + v_awarded,
         ascendant_shards_earned_total = ascendant_shards_earned_total + v_awarded,
         ascendant_milestones = ascendant_milestones || (v_milestones -> 'newKeys'),
         achievements         = achievements || (v_achievement_result -> 'newKeys')
   where player_id = p_player;

  insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
  select p_player, item.value ->> 'itemDefId', item.value ->> 'rarity', count(*)::int
    from public.player_characters pc,
         jsonb_each(pc.equipped) as item
   where pc.player_id = p_player and not (pc.id = any(p_protected_ids))
   group by item.value ->> 'itemDefId', item.value ->> 'rarity'
  on conflict (player_id, item_def_id, rarity)
  do update set quantity = public.player_inventory.quantity + excluded.quantity;

  delete from public.group_runs where player_id = p_player;
  delete from public.player_characters where player_id = p_player and not (id = any(p_protected_ids));

  return jsonb_build_object('shardsAwarded', v_awarded, 'transcendCount', v_transcend_count);
end;
$$;

revoke all on function public.transcend_player(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.transcend_player(uuid, uuid[]) to service_role;
```

- [ ] **Step 2: Write the pgTAP test file**

```sql
-- Profession system: the recipe-known gate on start_craft, learn_profession_recipe,
-- claim_profession_quest, and the claim_craft profession-XP grant
-- (docs/superpowers/specs/2026-10-16-profession-system-design.md).
begin;
select plan(12);

insert into auth.users (id, email, raw_user_meta_data)
values ('90000000-0000-0000-0000-000000000001', 'professions-1@test.local', jsonb_build_object('username', 'professions_1'));

-- 1. start_craft rejects a profession-gated recipe the player doesn't know.
select throws_ok(
  $$ select public.start_craft('90000000-0000-0000-0000-000000000001'::uuid, 'unknown-potion', '[]'::jsonb, '[]'::jsonb, 60, 'alchemy') $$,
  'start_craft: recipe not known for this profession'
);

-- 2. start_craft with no professionKey (a generic recipe) is unaffected — still works with zero
-- reagents and succeeds.
select lives_ok(
  $$ select public.start_craft('90000000-0000-0000-0000-000000000001'::uuid, 'generic-recipe', '[]'::jsonb, '[]'::jsonb, 60) $$,
  'start_craft with no professionKey skips the recipe-known gate entirely'
);
delete from public.craft_runs where player_id = '90000000-0000-0000-0000-000000000001';

-- 3. learn_profession_recipe rejects a level too low.
update public.profiles set currencies = jsonb_build_object('gold', 500) where player_id = '90000000-0000-0000-0000-000000000001';
select throws_ok(
  $$ select public.learn_profession_recipe('90000000-0000-0000-0000-000000000001'::uuid, 'alchemy', 'greater-healing-potion', 100, 5) $$,
  'learn_profession_recipe: profession level too low (needs 5, has 0)'
);

-- 4. learn_profession_recipe succeeds at a level the player has, deducts gold, adds the recipe.
update public.profiles
   set professions = jsonb_build_object('alchemy', jsonb_build_object('level', 1, 'xp', 0, 'knownRecipes', '[]'::jsonb))
 where player_id = '90000000-0000-0000-0000-000000000001';
select public.learn_profession_recipe('90000000-0000-0000-0000-000000000001'::uuid, 'alchemy', 'minor-healing-potion', 100, 1);

select is(
  (select (currencies->>'gold')::int from public.profiles where player_id = '90000000-0000-0000-0000-000000000001'),
  400,
  'learn_profession_recipe deducts gold'
);

select is(
  (select professions->'alchemy'->'knownRecipes' ? 'minor-healing-potion' from public.profiles where player_id = '90000000-0000-0000-0000-000000000001'),
  true,
  'learn_profession_recipe adds the recipe to knownRecipes'
);

-- 5. learn_profession_recipe rejects learning the same recipe twice.
select throws_ok(
  $$ select public.learn_profession_recipe('90000000-0000-0000-0000-000000000001'::uuid, 'alchemy', 'minor-healing-potion', 100, 1) $$,
  'learn_profession_recipe: recipe already known'
);

-- 6. claim_profession_quest rejects a level too low.
select throws_ok(
  $$ select public.claim_profession_quest('90000000-0000-0000-0000-000000000001'::uuid, 'alchemy', 'alchemist-trial', 10, 'unique-elixir', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb) $$,
  'claim_profession_quest: profession level too low (needs 10, has 1)'
);

-- 7. claim_profession_quest rejects a turn-in the player can't afford (level is met, but no
-- Steel owned yet) — verify-before-deduct: nothing should be spent on a rejected attempt.
select throws_ok(
  $$ select public.claim_profession_quest('90000000-0000-0000-0000-000000000001'::uuid, 'alchemy', 'alchemist-trial', 1, 'unique-elixir',
       jsonb_build_array(jsonb_build_object('code', 'Steel', 'quantity', 5)), '[]'::jsonb,
       jsonb_build_array(jsonb_build_object('code', 'gold', 'quantity', 50))) $$,
  'claim_profession_quest: not enough resource Steel (have 0, need 5)'
);
select is(
  (select (currencies->>'gold')::int from public.profiles where player_id = '90000000-0000-0000-0000-000000000001'),
  400,
  'a rejected quest attempt deducts nothing, even the lines the player COULD afford'
);

-- 8. claim_profession_quest succeeds, deducts a mixed resource+currency cost, grants the recipe.
update public.profiles set resources = jsonb_build_object('Steel', 10) where player_id = '90000000-0000-0000-0000-000000000001';
select public.claim_profession_quest(
  '90000000-0000-0000-0000-000000000001'::uuid, 'alchemy', 'alchemist-trial', 1, 'unique-elixir',
  jsonb_build_array(jsonb_build_object('code', 'Steel', 'quantity', 5)),
  '[]'::jsonb,
  jsonb_build_array(jsonb_build_object('code', 'gold', 'quantity', 50))
);

select is(
  (select (resources->>'Steel')::int from public.profiles where player_id = '90000000-0000-0000-0000-000000000001'),
  5,
  'claim_profession_quest deducts the resource cost'
);

select is(
  (select professions->'alchemy'->'knownRecipes' ? 'unique-elixir' from public.profiles where player_id = '90000000-0000-0000-0000-000000000001'),
  true,
  'claim_profession_quest adds the reward recipe to knownRecipes'
);

-- 9. The same quest cannot be completed twice.
select throws_ok(
  $$ select public.claim_profession_quest('90000000-0000-0000-0000-000000000001'::uuid, 'alchemy', 'alchemist-trial', 1, 'unique-elixir', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb) $$,
  'claim_profession_quest: quest already completed'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Run `npx supabase db reset` then `npx supabase test db`**

Expected: migration applies clean, all 12 assertions pass.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261016110000_professions.sql supabase/tests/database/professions.sql
git commit -m "feat: add profiles.professions, the recipe-known gate, and 3 profession RPCs"
```

---

### Task 4: `craft-start` Edge Function — pass `professionKey` through to the gate

**Files:**
- Modify: `supabase/functions/craft-start/index.ts`

**Interfaces:**
- Consumes: `start_craft`'s new 6th param (Task 3).
- Produces: nothing new for later tasks — this is a leaf change.

- [ ] **Step 1: Widen the GROQ query and type**

In `supabase/functions/craft-start/index.ts`, change the `RecipeDef` type and the query to also
fetch `professionKey`:

```ts
type RecipeDef = {
  name?: string
  durationSeconds?: number
  professionKey?: string | null
  reagents?: { kind?: string; resource?: string | null; quantity?: number; itemKey?: string | null }[]
} | null
```

```ts
    def = await sanityQuery<RecipeDef>(
      `*[_type == "recipeDef" && recipeKey == $key][0]{
        name, durationSeconds, professionKey,
        reagents[]{ kind, resource, quantity, "itemKey": item->itemKey }
      }`,
      { key: recipeDefId },
    )
```

- [ ] **Step 2: Pass it to the RPC call**

```ts
  const { data: run, error: rpcErr } = await admin.rpc('start_craft', {
    p_player: playerId,
    p_recipe_def_id: recipeDefId,
    p_resource_reagents: resourceReagents,
    p_item_reagents: itemReagents,
    p_duration_seconds: def.durationSeconds,
    p_profession_key: def.professionKey ?? null,
  })
```

- [ ] **Step 3: Verify**

Run: `npm run build` (type-checks the Edge Function's TS alongside the rest, same as every other
session this project's touched Edge Functions — no separate Deno typecheck step exists).
Expected: builds clean.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/craft-start/index.ts
git commit -m "feat: pass professionKey through craft-start to the recipe-known gate"
```

---

### Task 5: `craft-claim` Edge Function — compute profession XP and level-up recipe grants

**Files:**
- Modify: `supabase/functions/craft-claim/index.ts`

**Interfaces:**
- Consumes: `applyProfessionXp` (Task 2), `claim_craft`'s new params (Task 3).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Widen the GROQ query and type, fetch the player's current profession state**

Replace the `RecipeDef` type and query:

```ts
type RecipeDef = {
  resultItemKey?: string | null
  resultItemName?: string | null
  resultRarityWeights?: { rarity: string; weight: number }[] | null
  professionKey?: string | null
  xpAwarded?: number | null
} | null
```

```ts
    def = await sanityQuery<RecipeDef>(
      `*[_type == "recipeDef" && recipeKey == $key][0]{ "resultItemKey": coalesce(result->itemKey, result->consumableKey, result->totemKey), "resultItemName": result->name, resultRarityWeights[]{ rarity, weight }, professionKey, xpAwarded }`,
      { key: recipeDefId },
    )
```

After the existing `if (!def?.resultItemKey) ...` check, add:

```ts
  // 2b. Profession XP (Decision 2/3). Fetch the player's CURRENT profession state before
  // computing the new level/xp — claim_craft just persists what we compute here, same
  // compute/persist split mission-claim already uses for character level-ups.
  let professionUpdate: { professionKey: string; level: number; xp: number; newlyKnownRecipes: string[] } | null = null
  if (def.professionKey && typeof def.xpAwarded === 'number' && def.xpAwarded > 0) {
    const { data: profileRow, error: profileErr } = await admin
      .from('profiles')
      .select('professions')
      .eq('player_id', playerId)
      .single()
    if (profileErr) {
      console.error('craft-claim: profile lookup failed', profileErr)
      return json({ error: 'Could not load profile' }, 500)
    }
    const professions = (profileRow?.professions ?? {}) as Record<string, { level?: number; xp?: number } | undefined>
    const current = professions[def.professionKey]
    const { level, xp } = applyProfessionXp(current?.level ?? 0, current?.xp ?? 0, def.xpAwarded)

    // A level-up may auto-grant recipes authored with grantedAtLevel in (oldLevel, newLevel].
    let newlyKnownRecipes: string[] = []
    const oldLevel = current?.level ?? 0
    if (level > oldLevel) {
      try {
        const granted = await sanityQuery<{ recipeKey: string }[]>(
          `*[_type == "recipeDef" && professionKey == $key && defined(grantedAtLevel) && grantedAtLevel > $oldLevel && grantedAtLevel <= $newLevel]{ recipeKey }`,
          { key: def.professionKey, oldLevel, newLevel: level },
        )
        newlyKnownRecipes = granted.map((g) => g.recipeKey)
      } catch (e) {
        console.error('craft-claim: grantedAtLevel lookup failed — continuing without it', e)
      }
    }

    professionUpdate = { professionKey: def.professionKey, level, xp, newlyKnownRecipes }
  }
```

Add the import at the top of the file:

```ts
import { applyProfessionXp } from '../../../src/lib/professions.ts'
```

- [ ] **Step 2: Pass the computed values to `claim_craft`**

```ts
  const { data: claimData, error: claimErr } = await admin.rpc('claim_craft', {
    p_player: playerId,
    p_recipe_def_id: recipeDefId,
    p_result_item_def_id: def.resultItemKey,
    p_result_rarity: rarity,
    p_lifetime_stats: { itemsCrafted: 1 },
    p_profession_key: professionUpdate?.professionKey ?? null,
    p_profession_level: professionUpdate?.level ?? null,
    p_profession_xp: professionUpdate?.xp ?? null,
    p_newly_known_recipes: professionUpdate?.newlyKnownRecipes ?? [],
  })
```

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/craft-claim/index.ts
git commit -m "feat: grant profession XP and level-up recipes on craft-claim"
```

---

### Task 6: Two new Edge Functions — `profession-learn-recipe` and `profession-claim-quest`

**Files:**
- Create: `supabase/functions/profession-learn-recipe/index.ts`
- Create: `supabase/functions/profession-claim-quest/index.ts`

**Interfaces:**
- Consumes: `learn_profession_recipe`, `claim_profession_quest` (Task 3).
- Produces: the two invoke names `src/services/professions.ts` (Task 7) calls.

- [ ] **Step 1: Write `profession-learn-recipe/index.ts`**

```ts
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'
import { withSentry } from '../_shared/sentry.ts'

// profession-learn-recipe: buy a recipe from the profession expert for gold (Decision 4 channel
// 1, docs/superpowers/specs/2026-10-16-profession-system-design.md). Cost and required level are
// resolved from the authored recipeDef here — the client only supplies which recipe it wants.

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type RecipeDef = { professionKey?: string | null; requiredLevel?: number | null; learnCost?: number | null } | null

Deno.serve(withSentry(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  const admin = createAdminClient()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
  const playerId = userData.user.id

  let body: { recipeKey?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const recipeKey = body.recipeKey
  if (typeof recipeKey !== 'string' || recipeKey.length === 0) return json({ error: 'recipeKey is required' }, 400)

  let def: RecipeDef
  try {
    def = await sanityQuery<RecipeDef>(
      `*[_type == "recipeDef" && recipeKey == $key][0]{ professionKey, requiredLevel, "learnCost": coalesce(learnCost, 0) }`,
      { key: recipeKey },
    )
  } catch (e) {
    console.error('Sanity recipe lookup failed', e)
    return json({ error: 'Could not load recipe' }, 502)
  }
  if (!def?.professionKey) return json({ error: 'Recipe is not a profession recipe' }, 404)

  const { data, error: rpcErr } = await admin.rpc('learn_profession_recipe', {
    p_player: playerId,
    p_profession_key: def.professionKey,
    p_recipe_key: recipeKey,
    p_cost: def.learnCost ?? 0,
    p_required_level: def.requiredLevel ?? 1,
  })
  if (rpcErr) {
    const reason = rpcErr.message.replace(/^.*learn_profession_recipe:\s*/, '')
    return json({ error: reason || 'Could not learn recipe' }, 409)
  }

  return json(data, 201)
}))
```

- [ ] **Step 2: Write `profession-claim-quest/index.ts`**

```ts
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'
import { withSentry } from '../_shared/sentry.ts'

// profession-claim-quest: turn in a professionQuestDef's cost at the profession expert (Decision
// 4 channel 2). The cost lines and reward recipe are resolved from Sanity here — the client only
// supplies which quest it's completing and, for item-typed cost lines, which owned rarity to
// spend (mirrors craft-start's itemReagentChoices).

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']

type QuestDef = {
  professionKey?: string | null
  requiredLevel?: number | null
  rewardRecipeKey?: string | null
  cost?: { kind?: string; resource?: string | null; currency?: string | null; quantity?: number; itemKey?: string | null }[] | null
} | null

Deno.serve(withSentry(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  const admin = createAdminClient()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
  const playerId = userData.user.id

  let body: { questKey?: unknown; itemCostChoices?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const questKey = body.questKey
  if (typeof questKey !== 'string' || questKey.length === 0) return json({ error: 'questKey is required' }, 400)
  const rawChoices = Array.isArray(body.itemCostChoices) ? body.itemCostChoices : []
  const choices = new Map<number, string>()
  for (const c of rawChoices as unknown[]) {
    const idx = (c as Record<string, unknown>)?.costIndex
    const rarity = (c as Record<string, unknown>)?.rarity
    if (typeof idx !== 'number' || !Number.isInteger(idx) || typeof rarity !== 'string' || !RARITIES.includes(rarity)) {
      return json({ error: 'Invalid itemCostChoices entry' }, 400)
    }
    choices.set(idx, rarity)
  }

  let def: QuestDef
  try {
    def = await sanityQuery<QuestDef>(
      `*[_type == "professionQuestDef" && questKey == $key][0]{
        professionKey, requiredLevel, "rewardRecipeKey": rewardRecipe->recipeKey,
        cost[]{ kind, resource, currency, quantity, "itemKey": item->itemKey }
      }`,
      { key: questKey },
    )
  } catch (e) {
    console.error('Sanity quest lookup failed', e)
    return json({ error: 'Could not load quest' }, 502)
  }
  if (!def?.professionKey || !def.rewardRecipeKey || !def.cost) return json({ error: 'Unknown quest' }, 404)

  const resourceCost: { code: string; quantity: number }[] = []
  const itemCost: { item_def_id: string; rarity: string; quantity: number }[] = []
  const currencyCost: { code: string; quantity: number }[] = []
  for (const [index, line] of def.cost.entries()) {
    const quantity = line.quantity ?? 0
    if (!Number.isInteger(quantity) || quantity < 1) return json({ error: `Quest cost line ${index} has an invalid quantity` }, 500)
    if (line.kind === 'resource') {
      if (!line.resource) return json({ error: `Quest cost line ${index} has no resource` }, 500)
      resourceCost.push({ code: line.resource, quantity })
    } else if (line.kind === 'currency') {
      if (!line.currency) return json({ error: `Quest cost line ${index} has no currency` }, 500)
      currencyCost.push({ code: line.currency, quantity })
    } else if (line.kind === 'item') {
      if (!line.itemKey) return json({ error: `Quest cost line ${index} has no item` }, 500)
      const rarity = choices.get(index)
      if (!rarity) return json({ error: `Pick a rarity for cost line ${index}` }, 400)
      itemCost.push({ item_def_id: line.itemKey, rarity, quantity })
    } else {
      return json({ error: `Quest cost line ${index} has an unknown kind` }, 500)
    }
  }

  const { data, error: rpcErr } = await admin.rpc('claim_profession_quest', {
    p_player: playerId,
    p_profession_key: def.professionKey,
    p_quest_key: questKey,
    p_required_level: def.requiredLevel ?? 1,
    p_reward_recipe_key: def.rewardRecipeKey,
    p_resource_cost: resourceCost,
    p_item_cost: itemCost,
    p_currency_cost: currencyCost,
  })
  if (rpcErr) {
    const reason = rpcErr.message.replace(/^.*claim_profession_quest:\s*/, '')
    return json({ error: reason || 'Could not complete quest' }, 409)
  }

  return json(data, 201)
}))
```

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/profession-learn-recipe supabase/functions/profession-claim-quest
git commit -m "feat: add profession-learn-recipe and profession-claim-quest Edge Functions"
```

---

### Task 7: Client services — `src/services/professions.ts`, extend `crafting.ts`

**Files:**
- Create: `src/services/professions.ts`
- Modify: `src/services/crafting.ts`

**Interfaces:**
- Consumes: the two Edge Functions from Task 6.
- Produces: `fetchProfessionState(): Promise<Record<string, ProfessionState>>`,
  `learnProfessionRecipe(recipeKey: string): Promise<void>`,
  `claimProfessionQuest(questKey: string, itemCostChoices: {costIndex: number; rarity: string}[]): Promise<void>`.
  `RecipeView` gains `professionKey?: string` and `xpAwarded?: number` for Task 8's UI.

- [ ] **Step 1: Write `src/services/professions.ts`**

```ts
import { supabase } from '@/lib/supabase'
import { invokeError } from './_invoke'

// Profession-expert writes (docs/superpowers/specs/2026-10-16-profession-system-design.md) —
// same Edge-Function-invoke pattern as every other server-authoritative write (ADR-0003).
// Profession STATE (level/xp/knownRecipes) is read directly off the profile row — see
// src/hooks/useProfile.ts — not fetched here; this file only owns the two write paths.

export type ProfessionState = {
  level: number
  xp: number
  knownRecipes: string[]
  completedQuests: string[]
}

export async function learnProfessionRecipe(recipeKey: string): Promise<void> {
  const { error } = await supabase.functions.invoke('profession-learn-recipe', {
    body: { recipeKey },
  })
  if (error) await invokeError(error, 'Could not learn recipe')
}

export async function claimProfessionQuest(
  questKey: string,
  itemCostChoices: { costIndex: number; rarity: string }[] = [],
): Promise<void> {
  const { error } = await supabase.functions.invoke('profession-claim-quest', {
    body: { questKey, itemCostChoices },
  })
  if (error) await invokeError(error, 'Could not complete quest')
}
```

- [ ] **Step 2: Extend `RecipeView`/`RawRecipe`/`RECIPES_QUERY` in `src/services/crafting.ts`**

Add to `RECIPES_QUERY`'s projection (alongside `recipeKey, name, description, durationSeconds`):

```
  professionKey, xpAwarded,
```

Add to `RawRecipe` and `RecipeView`:

```ts
  professionKey?: string | null
  xpAwarded?: number | null
```

In `fetchRecipes`'s mapping, pass both through onto the returned `RecipeView` object (alongside
the other already-mapped fields):

```ts
      professionKey: r.professionKey ?? undefined,
      xpAwarded: r.xpAwarded ?? undefined,
```

- [ ] **Step 3: Write the failing test for the new fields, then verify it passes**

Add to `src/services/crafting.test.ts` (find the existing `fetchRecipes` test block and add
alongside it):

```ts
it('passes professionKey and xpAwarded through when authored', async () => {
  mockSanityFetch.mockResolvedValueOnce([
    {
      recipeKey: 'minor-healing-potion',
      name: 'Minor Healing Potion',
      durationSeconds: 60,
      professionKey: 'alchemy',
      xpAwarded: 15,
      result: { itemKey: 'minor-healing-potion', name: 'Minor Healing Potion' },
      reagents: [{ kind: 'resource', resource: 'Wood', quantity: 1 }],
    },
  ])
  const recipes = await fetchRecipes()
  expect(recipes[0].professionKey).toBe('alchemy')
  expect(recipes[0].xpAwarded).toBe(15)
})
```

(Match the exact mock setup — `mockSanityFetch` — already used by the neighboring tests in that
file; if the existing tests use a different mock variable name, use that name instead.)

Run: `npx vitest run src/services/crafting.test.ts`
Expected: FAIL first (fields not yet added), then PASS after Step 2.

- [ ] **Step 4: Commit**

```bash
git add src/services/professions.ts src/services/crafting.ts src/services/crafting.test.ts
git commit -m "feat: add profession client services, extend RecipeView with profession fields"
```

---

### Task 8: UI — show XP on the recipe card; the profession-expert page

**Files:**
- Modify: `src/features/crafting/components/RecipeBook.tsx`
- Create: `src/pages/ProfessionsPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/organisms/GameHeader.tsx`

**Interfaces:**
- Consumes: `RecipeView.xpAwarded`/`professionKey` (Task 7), `learnProfessionRecipe`/
  `claimProfessionQuest` (Task 7), `PROFESSION_LABELS` (Task 2).
- Produces: nothing for later tasks — this is the last task.

- [ ] **Step 1: Show XP on the recipe card (the explicit UI ask)**

In `src/features/crafting/components/RecipeBook.tsx`'s `RecipeRow`, add the XP display next to
the existing duration span (same row, so it's visible before the player commits to crafting):

```tsx
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
        <span style={{ color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{recipe.name}</span>
        {recipe.xpAwarded != null && (
          <span style={{ color: 'var(--color-text-gold)', fontSize: 10, whiteSpace: 'nowrap' }}>+{recipe.xpAwarded} XP</span>
        )}
        <span style={{ color: 'var(--color-text-muted)', fontSize: 10, whiteSpace: 'nowrap' }}>{formatRemaining(recipe.durationSeconds * 1000)}</span>
      </div>
```

- [ ] **Step 2: Create a minimal `ProfessionsPage.tsx`**

Page placement (Decision 6's deferred detail): a new standalone page, same tier as
`RespecPage`/`FeedbackPage` rather than folded into Crafting — professions have their own state
(level/XP/known recipes) distinct from "what's in the crafting circle right now."

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert } from '@/components/atoms/Alert'
import { PrimaryButton } from '@/components/atoms/Button'
import { PROFESSION_DEFS, xpToNextProfessionLevel, PROFESSION_LEVEL_CAP } from '@/lib/professions'
import { learnProfessionRecipe } from '@/services/professions'
import { useProfile } from '@/hooks/useProfile'

// Profession-expert page (docs/superpowers/specs/2026-10-16-profession-system-design.md Decision
// 6): shows each profession's level/XP and known recipes. Buying unlearned recipes is wired here;
// quest turn-ins follow in each profession's own content follow-up spec (ADR-0061 sequencing) —
// this page's quest section is intentionally a placeholder list until that content exists.

export default function ProfessionsPage() {
  const { data: profile } = useProfile()
  const [selected, setSelected] = useState(PROFESSION_DEFS[0].professionKey)
  const qc = useQueryClient()
  const learn = useMutation({
    mutationFn: learnProfessionRecipe,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['profile'] }),
  })

  const state = profile?.professions?.[selected] ?? { level: 0, xp: 0, knownRecipes: [] }
  const needed = xpToNextProfessionLevel(state.level)

  return (
    <div>
      <h1 style={{ color: 'var(--color-gold-light)', fontSize: '22px', letterSpacing: '1px', textShadow: '0 0 12px rgba(240,208,96,0.35)' }}>
        Professions
      </h1>
      <div style={{ display: 'flex', gap: '18px', marginTop: '16px' }}>
        <div style={{ width: '200px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {PROFESSION_DEFS.map((p) => (
            <button
              key={p.professionKey}
              onClick={() => setSelected(p.professionKey)}
              style={{
                textAlign: 'left', padding: '10px 12px', borderRadius: '6px', cursor: 'pointer',
                border: `2px solid ${selected === p.professionKey ? 'var(--color-gold-light)' : 'var(--color-gold-dark)'}`,
                background: selected === p.professionKey ? 'rgba(200,145,42,0.12)' : 'transparent',
                color: 'var(--color-text-primary)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ color: 'var(--color-text-primary)', fontSize: 14 }}>
            Level {state.level}{state.level >= PROFESSION_LEVEL_CAP ? ' (MAX)' : ` — ${state.xp} / ${needed} XP`}
          </p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: '8px' }}>
            Known recipes: {state.knownRecipes.length === 0 ? 'none yet' : state.knownRecipes.join(', ')}
          </p>
          {learn.error && (
            <Alert variant="error">{learn.error instanceof Error ? learn.error.message : 'Could not learn recipe'}</Alert>
          )}
          <p style={{ color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic', marginTop: '16px' }}>
            Buyable recipes and quests for this profession are authored per-profession — none
            exist yet (Alchemy/Carving/Prospecting/Tempering/Arcane Writing are each their own
            follow-up content spec).
          </p>
        </div>
      </div>
    </div>
  )
}
```

**Note on `useProfile`:** this assumes `profile.professions` exists on the shape `useProfile()`
returns. Check `src/services/profile.ts` and `src/hooks/useProfile.ts` — if `professions` isn't
already selected/typed there (it won't be, since it's a brand-new column), add it alongside how
`activeTotemId`/`totemCharges` were added in the mission-prep-consumables and totem-durability
work (same file, same pattern: add to the `select()` string and the returned object's type).

- [ ] **Step 3: Wire the route and nav link**

In `src/App.tsx`, add the lazy import alongside the other `src/pages/` lazy imports:

```ts
const ProfessionsPage = lazy(() => import('./pages/ProfessionsPage'))
```

Add the route inside the authenticated block, before the `"*"` catch-all:

```tsx
              <Route path="/professions" element={<ProfessionsPage />} />
```

In `src/components/organisms/GameHeader.tsx`'s `NAV` array, add an entry (near Crafting, since
they're related):

```ts
  { label: 'Professions', to: '/professions' },
```

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run build && npx vitest run --exclude ".superpowers/**" --exclude "node_modules/**"`
Expected: all clean, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/crafting/components/RecipeBook.tsx src/pages/ProfessionsPage.tsx src/App.tsx src/components/organisms/GameHeader.tsx src/services/profile.ts src/hooks/useProfile.ts
git commit -m "feat: show recipe XP pre-craft; add the Professions page"
```

---

### Task 9: ADR + TODO entry

**Files:**
- Modify: `docs/DECISIONS.md`
- Modify: `TODO.md`

- [ ] **Step 1: Add the ADR**

Append a new ADR (next number after the latest in `docs/DECISIONS.md`) summarizing: the
account-wide-not-per-character decision and why, the linear leveling curve, the four
acquisition channels, the `reagentLine` currency-kind extension and its scope (quest-only, not
regular crafting), and the `recipeDef.professionKey` optional-not-required backward-compatibility
call this plan made. Reference the spec and this plan file by path.

- [ ] **Step 2: Add a TODO.md entry**

Mark the shared profession system as shipped, and explicitly note that the 5 individual
professions (Alchemy, Carving, Prospecting, Tempering, Arcane Writing) still need their own
content authored (recipes, quests, XP/cost numbers) — this plan built the system, not the
content.

- [ ] **Step 3: Commit**

```bash
git add docs/DECISIONS.md TODO.md
git commit -m "docs: add ADR for the profession system"
```
