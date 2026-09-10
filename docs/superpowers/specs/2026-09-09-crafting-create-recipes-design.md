# Crafting: `create` recipes — design spec

Date: 2026-09-09. Companion to the open TODO.md item "Recipe schema" (`project-crafting`).
Builds the `create` half of crafting only — turning `src/pages/CraftingPage.tsx` from a pure UI
mockup (`src/lib/mockRecipes.ts`) into a real, server-authoritative feature. `infuse` recipes
(adding/improving stats on a specific owned item instance) are explicitly a separate follow-up —
see Non-goals.

## 1. Problem

Crafting today is 100% mock: `RECIPES` is a hardcoded array, the "Craft" button in
`CraftingCircle.tsx` is disabled-by-fill-count but wired to nothing, and there is no `recipeDef`
Sanity type, no runtime table, no Edge Function. Nothing about crafting is real.

## 2. Goals

- A `recipeDef` Sanity type where both the **result** and every **reagent** reference existing
  content generically (itemDef/resource registry) — adding a new item to the game or authoring a
  new recipe never requires a code change, matching this repo's registry-driven philosophy
  (ADR-0004) and explicitly requested for future scalability (more recipes, more items, no new
  code path per addition).
- Reagents can be **raw resources** (the existing gather-loop registry, `src/lib/resources.ts`)
  **or other items** from the player's inventory — a recipe can require "3 Iron + 1 Rusted Blade".
- The crafted result's rarity is **rolled** from an authored `rarityWeights` list (reusing the
  existing `lootDrop`-style object), not fixed — crafting is a second rarity-roll source
  alongside loot, by design.
- Crafting takes **real-world time**, dispatched-and-claimed like a mission: spend reagents up
  front, wait `durationSeconds`, claim the rolled result later. Not character-bound — no
  character selection, no `useRoster` busy-state interaction.
- **One craft at a time per player** — a single crafting "slot", not a queue.
- When an item-typed reagent's rarity isn't fixed by the recipe, the **player picks which owned
  rarity to spend** at craft-start time.
- Migrate `CraftingPage` into `src/features/crafting/` as part of this work (this repo migrates
  one feature into the `src/features/<name>/` shape each time it's next substantially touched;
  crafting's entire data layer is being rebuilt here).

## 3. Non-goals (this spec)

- **`infuse` recipes** (add/improve stats on a specific existing item instance) — `player_inventory`
  stacks purely by `(item_def_id, rarity)` with no per-instance customization slot; supporting
  `infuse` needs an inventory schema change this spec doesn't make. Separate spec, separate plan.
- **Recipe discovery/unlocking** — every `recipeDef` is visible and craftable from the start
  (still gated by having the reagents). The mock's `discovered: boolean` "hidden until found"
  framing is dropped for v1; a future wave could reuse ADR-0048's unlock-condition pattern if
  wanted.
- **Multiple simultaneous crafts / upgradeable crafting slots** — one active craft per player,
  no slot-count concept (unlike mine assignments or infirmary beds).
- **Author-fixed reagent rarity** — item-typed reagents never pin a required rarity; the player
  always chooses at craft time from what they own.

## 4. Data model

### 4a. `reagentLine` (new Sanity object, shared by every `recipeDef`)

```
reagentLine: {
  kind: 'resource' | 'item'
  resource?: string            // RESOURCE_SOURCE key (src/lib/resources.ts) — required if kind = resource.
                                // NOTE exact casing: 'Wood'/'Copper'/'Stone'/'Coal'/'Iron'/'Silver'/
                                // 'Bronze'/'Gold'/'Platinum' — these are the LIVE profiles.resources
                                // wallet keys (confirmed via GameHeader.tsx's RESOURCE_COLOR-keyed
                                // read), NOT the lowercase example missionReward.ts's own description
                                // comment shows (that comment is for CURRENCY codes like 'gold',
                                // a different, lowercase registry — do not conflate the two).
  item?: reference -> itemDef  // required if kind = item
  quantity: number
}
```

### 4b. `recipeDef` (new Sanity document type)

```
recipeDef: {
  name: string
  recipeKey: string             // stable id, lowercase-hyphen, same convention as itemKey/missionKey
  description?: text
  result: reference -> itemDef
  resultRarityWeights: rarityWeight[]   // REUSES the existing rarityWeight object (studio/schemaTypes/
                                          // objects/lootDrop.ts's inline array-member type) — same
                                          // Common..Legendary weighted-roll shape loot already uses
  durationSeconds: number        // real-world wait, same meaning as missionDef.durationSeconds
  reagents: reagentLine[]        // 1+ lines, any mix of resource/item kinds
}
```

No `kind` field distinguishing create/infuse — this schema is create-only. When `infuse` is
designed later, its own spec decides whether it extends this document type or gets its own; this
spec does not guess.

### 4c. `craft_runs` (new migration)

```sql
create table public.craft_runs (
  player_id     uuid primary key references auth.users(id) on delete cascade,
  recipe_def_id text not null,
  started_at    timestamptz not null default now(),
  ends_at       timestamptz not null
);
-- RLS: owner-read only, no client write (ADR-0003) — all writes via the two RPCs below.
```

`player_id` as the primary key (not a generated `id`) is the "one craft at a time" rule made
structural — a second `start_craft` call for the same player can't insert a second row at all,
let alone race one.

## 5. Runtime flow

Two new Edge Functions, shaped like `mission-start`/`mission-claim`:

**`craft-start`** (`{ recipeDefId: string, itemReagentChoices: { reagentIndex: number, rarity: string }[] }`):
1. Fetch `recipeDef` from Sanity (`reagents[]`, `durationSeconds`) — client is not trusted for
   cost or duration, same posture as every other dispatch path.
2. Resolve each `reagentLine` to a concrete requirement: `kind: 'resource'` lines become
   `{ code, quantity }`; `kind: 'item'` lines become `{ item_def_id, rarity, quantity }`, with
   `rarity` taken from the matching `itemReagentChoices` entry (by `reagentIndex`) — reject if a
   choice is missing for any item-typed line.
3. Call `start_craft(p_player, p_recipe_def_id, p_resource_reagents jsonb, p_item_reagents jsonb, p_duration_seconds)`:
   - Locks the player's `profiles` row and every referenced `player_inventory` stack (`for update`).
   - Rejects if a `craft_runs` row already exists for this player (busy — the one-slot rule).
   - Verifies and deducts each resource amount from `profiles.resources`; verifies and deducts
     each item stack's quantity from `player_inventory` (delete the row at zero, else decrement —
     the exact pattern `equip_item`'s step 7 already uses for consuming an inventory stack) —
     insufficient funds/stock on ANY line aborts the whole transaction (all-or-nothing, no partial
     spend).
   - Inserts the `craft_runs` row.

**`craft-claim`** (`{ recipeDefId: string }`):
1. Fetch `recipeDef` again (`result->itemKey`, `resultRarityWeights`).
2. Load the `craft_runs` row (owner-scoped); reject if missing or `now() < ends_at` (mirrors
   `mission-claim`'s "not finished" guard).
3. Roll the result's rarity via `rollRarity` from `src/lib/loot.ts` (already built and tested for
   this exact purpose — no new rarity-roll logic needed), seeded from a deterministic string (e.g.
   `` `${playerId}:${recipeDefId}:${startedAt}` ``, mirroring `mission-claim`'s `run.id`-seeded
   `makeRng`).
4. Call `claim_craft(p_player, p_recipe_def_id, p_result_item_def_id, p_result_rarity)`:
   - Atomic conditional delete: `delete from craft_runs where player_id = p_player and recipe_def_id = p_recipe_def_id and now() >= ends_at returning *` — anyone else (a retry, a race) gets NOT FOUND, the whole tx aborts (identical shape to `claim_mission`'s guard).
   - Upserts the rolled item into `player_inventory` (same `on conflict (player_id, item_def_id, rarity) do update set quantity = quantity + 1` pattern `claim_mission` already uses for loot).
   - Returns the granted `{ item_def_id, rarity }`.

Both new SQL functions follow this repo's standing convention exactly: `security definer`,
`set search_path = public, pg_temp`, `revoke all ... from public, anon, authenticated`,
`grant execute ... to service_role`.

## 6. Client data layer & UI

- `src/services/crafting.ts`: `fetchRecipes()` (Sanity), `fetchCraftRun()` (Supabase, 0-or-1 row
  from `craft_runs`), `startCraft(recipeDefId, itemReagentChoices)`, `claimCraft(recipeDefId)` —
  same three-layer shape (`authored content / runtime state / Edge-Function writes`) every other
  service in this repo already follows.
- `src/lib/crafting.ts` (new, pure, tested): a `resolveReagentRequirement(line, chosenRarity?)`-style
  helper and a `canAffordReagents(reagents, resources, inventory)` checker the CLIENT uses to
  enable/disable the Craft button and drive the rarity-picker — mirrors how `src/lib/loot.ts` was
  extracted as a shared, tested pure-logic module rather than being duplicated inline.
- **Feature migration**: `src/pages/CraftingPage.tsx` + `src/components/organisms/{CraftingCircle,CraftingInventory,RecipeBook}.tsx`
  move into `src/features/crafting/` (`components/`, `CraftingPage.tsx`, `hooks.ts`, `index.ts`
  barrel), following the Missions shape exactly.
- **Reagent slots**: a slot displays a resource icon+count, or an item icon — for an item-typed
  reagent where the player owns more than one rarity, clicking the slot opens a small rarity
  picker (new UI, no precedent to reuse) instead of placing directly.
- **Craft lifecycle replaces the current disabled "Craft" button**: enabled once every reagent
  slot is validly filled → calls `craft-start`. Once a `craft_runs` row exists for this recipe,
  the circle enters an in-progress state: center slot shows a countdown (`formatRemaining`,
  `src/lib/time.ts`) instead of "Result", reagent slots lock, and the action button becomes
  "Claim" (disabled until `ends_at` passes) → calls `craft-claim`.
- No interaction with `useRoster`'s busy-state — crafting is player-level, not character-level.

## 7. Error handling / edge cases

- **Insufficient resources or items at start**: `start_craft` rejects the whole transaction —
  nothing is partially spent.
- **Already crafting**: a second `craft-start` call while a `craft_runs` row exists is rejected
  (the primary-key-on-`player_id` structural guard, surfaced as a clean error message, not a raw
  constraint violation).
- **Claim before ready**: rejected, same posture as `mission-claim`.
- **Double-claim race**: closed by the same atomic conditional-delete pattern `claim_mission`
  already uses — structurally can't double-grant.
- **Recipe content changes mid-craft** (renamed/edited `recipeDef` between start and claim): claim
  re-fetches by `recipeDefId` and resolves whatever the content currently says — same latent
  behavior `mission_runs` already has with `mission_def_id`, not a new risk this feature
  introduces.

## 8. Testing

- `src/lib/crafting.ts`'s reagent-resolution/afford-check functions get real unit tests (TDD) —
  cases: resource-only recipe, item-only recipe, mixed recipe, insufficient resource, insufficient
  item stack, an item-reagent the player owns at multiple rarities (choice required).
- The two new Edge Functions and the migration get **no automated test coverage** — the same
  accepted gap `recruit_character` and the dungeons/raids RPCs already carry (no pgTAP/Deno infra
  in this repo yet). Not silently skipped, just not newly invented here.
- **Reference content**: author 2–3 real `create` recipes proving the pattern end-to-end (e.g. a
  resource-only recipe crafting a Common-tier item, and a mixed resource+item recipe crafting one
  of the new caster/healer weapons from ADR-0051) — same "ship one working reference, not an empty
  schema" approach dungeons/raids used.

## 9. Follow-ups (not this spec)

- **`infuse` recipes** — needs its own spec once the inventory's per-instance-customization
  question is worked through.
- **Recipe discovery/unlocking** — could reuse ADR-0048's condition-type pattern.
- **Multiple crafting slots** — if ever wanted, needs its own upgrade-path design (mirrors how
  infirmary beds scale with `infirmary_level`).
