# Profession System — Design Spec

**Date:** 2026-10-16 · **Status:** Draft, pending review

## Context

ADR-0061 (mission-prep-consumables) named five follow-on professions — **Alchemy**, **Carving**,
**Prospecting**, **Tempering**, **Arcane Writing** — each meant to deepen one mechanic the
consumables/totem framework introduced, built one at a time as separate specs. This spec defines
the **shared leveling/acquisition system** all five professions sit on top of, before any
individual profession's content is authored. It does not author Alchemy, Carving, or any other
profession's actual recipes/quests — that's each profession's own follow-up spec, using the
system this spec builds.

Modeled loosely on WoW Classic's profession structure (trainer-taught recipes, a skill-tier gate,
recipe-color skill-up feedback) but substantially simplified for this game's scale: a 10-level
cap instead of 300, flat per-craft XP instead of a probabilistic skill-up chance, and account-wide
rather than per-character (see Decision 1).

## Decision 1 — Account-wide, not per-character

Professions live on `profiles`, not `player_characters`. This is a deliberate difference from the
existing Skills system (`SKILL_DEFS`/`skill_assignments`, ADR-0056), which **is** per-character and
passive (assign a character, XP accrues over time, no action required). Professions are the
opposite shape: active (XP is earned by crafting, not by waiting) and shared across the whole
account rather than tied to any one character — matching how Echo Shop/Ascendant Shop are
account-wide, not character-specific.

**Schema:** `profiles.professions jsonb not null default '{}'::jsonb`, shaped:

```json
{
  "alchemy": { "level": 3, "xp": 140, "knownRecipes": ["minor-healing-potion", "..."] },
  "carving": { "level": 1, "xp": 0, "knownRecipes": [] }
}
```

Five independent entries (one per profession), each with its own level/xp/knownRecipes — not one
shared "crafting level." A profession absent from the jsonb (a player who's never touched it)
implicitly means level 0, 0 xp, no known recipes — same "absent key = zero" convention
`currencies`/`resources` already use (ADR-0004).

**Reset tier:** confirmed against `transcend_player`'s actual current migration
(`supabase/migrations/20260914110300_transcend_reset_skill_busy_check.sql`) — `currencies`,
`resources`, `map_progress`, `echo_shop`, and `infirmary_level` all reset to their zero state on
Transcendence but survive a soft Reset (`reset_player`, ADR-0053). `professions` joins that exact
tier: add `professions = '{}'::jsonb` to `transcend_player`'s existing `update public.profiles`
statement; `reset_player` needs no change (it already doesn't touch any of that tier).
`lifetime_stats`/`achievements`/`ascendant_shards` are the *other* tier (permanent, survive even
Transcendence) — professions are explicitly NOT that tier.

## Decision 2 — Leveling: active, craft-triggered, linear curve

Crafting a recipe grants that recipe's authored XP value to the profession it belongs to
(Decision 3). XP banks into `professions.<key>.xp`; crossing a level's threshold increments
`level` (possibly more than once per craft, for a very high-XP recipe — same "apply and check
repeatedly" pattern `applyXp`, `src/lib/leveling.ts`, already uses for character XP, though this
needs its own function since the curve differs).

**Curve:** level *L* → *L+1* costs `100 × L` XP. Linear, not exponential — confirmed explicitly
after a back-and-forth where an exponential (doubling) reading of the same two example numbers
was raised and rejected. Cumulative XP from level 1 to the level-10 cap: 100+200+...+900 = 4,500.

**Per-recipe XP value is authored, not universal** — explicitly left open, not a flat constant
(e.g. not "every craft gives 10 XP"). A new `recipeDef.xpAwarded` field (number, required,
min 1) added per recipe, authored per the same "first-pass, tune later" convention this project
uses for reagent costs/rarity weights (`docs/ITEMS.md`, `src/lib/itemBudget.ts`).

**Level cap:** 10. A profession at level 10 cannot gain further XP from crafting (same
"already at cap" handling other leveled systems use — compute-on-read, no stored "capped" flag
needed, just clamp).

## Decision 3 — Recipes belong to a profession; crafting them grants that profession's XP

`recipeDef` gains a required `professionKey` field (string, one of the 5 profession keys) and the
`xpAwarded` field from Decision 2. `claim_craft` (or the `craft-claim` Edge Function layer, which
already resolves the full `recipeDef` via GROQ to build the result) reads both fields and grants
`xpAwarded` to `professions.<professionKey>` in the same generic-increment style every other
`p_lifetime_stats`-accepting RPC already uses — a drop/recreate for a new param, same established
pattern.

A player cannot craft a recipe whose profession they haven't unlocked (Decision 4's acquisition
channels are *how* a recipe enters `knownRecipes`; `start_craft` needs to check the recipe's key is
in the caller's `professions.<professionKey>.knownRecipes` before allowing the craft at all — this
is new validation, since `start_craft` today has no concept of "do you know this recipe," only
reagent/currency checks).

## Decision 4 — Four recipe-acquisition channels

1. **Profession-expert purchase.** Pay gold, learn immediately. Gated by the profession's current
   level (a recipe can require, say, level 3 to buy — `recipeDef` needs a `requiredLevel` field,
   separate from `xpAwarded`/`professionKey`).
2. **Quest reward.** A new `professionQuestDef` Sanity type: `professionKey`, `requiredLevel`,
   a reagent-line-shaped cost (Decision 5), and a `rewardRecipe` reference. Turning the cost in to
   the profession expert unlocks `rewardRecipe` once; the quest is then permanently complete for
   that player (no repeat). **Level-10-exclusive quests are not a separate mechanism** — they're
   just `professionQuestDef` entries authored with `requiredLevel: 10`, confirmed explicitly.
3. **Level-up reward.** Reaching a new level can itself grant a recipe directly — an optional
   `recipeDef` reference on... (needs a home; simplest is a `grantedAtLevel` field directly on
   `recipeDef` rather than a separate per-level table, since it's a 1:1 "this recipe unlocks at
   level N of profession X" relationship already covered by `professionKey` + a level field).
4. **World/dungeon drop.** Flagged as an **open implementation detail, not a design decision**:
   `lootDrop` (missions) currently only references `itemDef`, never `consumableDef`/`totemDef`/a
   recipe-unlock — widening it to support a recipe-kind drop is mechanical plumbing, not a feel
   decision, and can be resolved at plan-writing time rather than blocking this spec.

## Decision 5 — Quest costs reuse `reagentLine`, extended with a currency kind; ordinary crafting
stays item/resource-only

The user wants quest turn-ins to mix "gold, Steel, a specific helmet, and so on" — `reagentLine`
(`studio/schemaTypes/objects/reagentLine.ts`) already covers `resource` and `item` kinds but has
**no currency kind today** (confirmed by reading the schema — recipes have never been able to cost
gold). Adding a third `kind: 'currency'` option (referencing `CURRENCY_DEFS`,
`src/lib/currencies.ts`) to `reagentLine` itself — not a separate quest-only cost type — means
quests get exactly the mix-and-match cost the user asked for. **Explicitly confirmed scope:**
crafting from the profession menu stays item/resource-only, same as today — the new currency kind
exists on the shared type for quest turn-ins to use, but regular `recipeDef` reagent costs are not
expected to start using it.

## Decision 6 — The profession expert is a UI concept, not a located NPC

This game has no world-traversal/location concept (everything is menu-driven dispatch) — the
"profession expert" (the role you buy recipes from and turn quest items in to — one role, not a
separate trainer-vs-quest-giver split) is a panel inside each profession's section listing that
profession's buyable recipes (channel 1) and available quests (channel 2), not an NPC to travel
to. Exact page placement (a new `/professions` route vs. folding into the existing Crafting page)
is deferred to the implementation plan, not a design decision this spec needs to settle.

## UI requirement: show XP before crafting

The crafting picker must show a recipe's `xpAwarded` value before the player commits to crafting
it (explicit ask) — the same "know the cost/reward before you commit" principle the mission
dispatch screen's win-chance estimate already follows.

## Scope — what this spec builds vs. defers

**This spec's system (shared infrastructure):**
- `profiles.professions` schema + its place in the Reset/Transcendence tier split
- The leveling curve + XP-on-craft grant
- `recipeDef`'s new fields (`professionKey`, `xpAwarded`, `requiredLevel`, optional
  `grantedAtLevel`) and `reagentLine`'s new currency kind
- `professionQuestDef` (the quest/turn-in type) and its claim RPC
- `start_craft`'s new "do you know this recipe" gate
- The UI requirement to show XP pre-craft

**Explicitly deferred to each profession's own follow-up spec** (per ADR-0061's original
sequencing): Alchemy/Carving/Prospecting/Tempering/Arcane Writing's actual recipes, quest content,
specific XP/cost numbers, and what each profession mechanically deepens.

**Explicitly deferred as implementation detail, not design:** the recipe-drop loot mechanism
(Decision 4, channel 4), exact profession-expert UI placement (Decision 6).

## Self-review notes

- No placeholders left unresolved beyond what's explicitly scoped out above.
- Checked against the existing reset-tier split in `transcend_player`'s real current migration,
  not assumed.
- Checked `reagentLine`'s and `lootDrop`'s actual current schemas before claiming a gap (currency
  kind, recipe-kind drop) rather than guessing one existed.
- `start_craft`'s new recipe-known gate is a real new validation path, called out explicitly
  rather than left implicit — this is the one genuinely new server-authoritative check this spec
  introduces beyond "extend an existing jsonb bucket."
