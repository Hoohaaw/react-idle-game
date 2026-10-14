# Mission Prep & Consumables Framework — Design Spec

**Date:** 2026-10-12 · **Status:** Proposed (pending review)

**Scope note:** this spec covers sub-project 1 of a larger brainstorm — the generalized
framework for mission-prep consumables and party-wide totems, seeded with one proof-of-
concept item per category. It deliberately does **not** cover the five professions
(Alchemy, Carving, Prospecting, Tempering, Arcane Writing) that will eventually produce
the richer content on top of this framework — those are separate, sequential specs. See
"Sequencing" under Consequences.

## Context

Two things motivated this. First, `docs/QUALITY_HYBRID.md`'s E7 finding: combat today has
zero in-run resource management — no player-managed consumable, no scarcity decision
during a fight, nothing to prepare before committing. Second, the user's own framing: when
a party is sent on a mission, they should be able to *prepare* for it — bring items that
heal, buff, or grant resistances — the way an adventuring party would. This reuses the
"embark on an adventure" language from ADR-0020's planned Expeditions layer, but is
explicitly **not** scoped to that unbuilt system — it applies to every mission dispatch
today, using the mission/combat pipeline that already exists.

The design leans hard on precedent already in this codebase rather than inventing new
patterns: the Healer role's existing conditional "heal instead of attack" override
(`combat.ts`), the capstone `partyBuffOnStart` ability's party-wide buff application, the
`{flat, pct}`-per-stat effect shape gear/blessings/traits/proficiencies all already share,
and the registry-driven content pattern (ADR-0004) every other authored system uses.

## Decision

### A. Slot rules

Every character can carry consumables based on level:

```
slotsForCharacter(level) = level >= 21 ? 2 : 1
```

A third slot exists as a **studio-authored flag, not an earned mechanic**: a new optional
`characterDef.bonusConsumableSlot: boolean` field, studio-validated as Utility-role-
exclusive (same validation pattern as `characterDef.proficiency`, ADR-0059) — unset by
default for every character. The designer turns it on for a specific Utility character by
hand, whenever that decision gets made; nothing in code grants it automatically. This is
deliberately the same authoring pattern Proficiency already established, not a new one.

### B. Consumable categories

A new Sanity type, `consumableDef`, separate from `itemDef` (consumables don't have a slot
type or a rarity roll — they're flat, tiered items, e.g. "Minor Healing Potion" vs. a
hypothetical "Major Healing Potion" as two distinct itemDefs, not one item with a rarity
roll). Two categories, each with a different timing model:

- **`heal`** — mid-fight, HP-threshold-triggered, self-only. Fields: `healAmount` (flat
  int), `triggerHpPct` (0–1).
- **`buff`** — pre-fight, whole-encounter, self-only. Fields: `effects: [{stat, kind:
  'flat'|'pct', value}]` — the exact same shape gear/blessings/traits/proficiencies use.

**Why the split:** a resistance/stat buff is "always on" for the fight regardless of
what happens, so it needs no trigger — it folds into the same `extraBonuses`/resistances
merge that already carries traits/capstone/Ascendant bonuses into `effectiveStats`, zero
new sim logic. A heal only matters if you're actually about to need it — popping it at
full HP is a wasted resource — so it needs a real trigger condition, which is where the
new sim logic goes (see D).

### C. Anti-stacking rule

At most **one `heal`-category consumable per party per mission**, enforced in `start_mission`
(count submitted consumableDefIds by category across the whole party; reject if more than
one `heal`). `buff`-category items are uncapped per party for v1 — they're situational
(you need the *right* resistance for the *right* fight, same logic as elemental matchups
already reward) rather than a universal safety net, so the stacking risk is lower. Revisit
if that turns out wrong in practice.

**Why this exists:** per-character slots alone would let every party member carry a heal
item, and combined with the Tank role's existing threat-generation (it already soaks most
incoming damage via `TANK_THREAT_MULT`/`TANK_THREAT_STAT_RATE`), "Tank soaks + everyone
pops heals" would bypass the tactical layer (party comp, elemental matching, blessings)
the game already rewards. The cap forces "who's most at risk this mission" instead of
blanket stacking.

### D. Combat engine integration — heal triggers

`Combatant`/`Unit` in `src/lib/combat.ts` gains an optional field:
`consumable: { healAmount: number, triggerHpPct: number, used: boolean }`.

Checked at the **exact point the Healer role's existing conditional override already
fires** — on the holder's own action tick, before resolving a normal attack: if
`currentHp / maxHp <= triggerHpPct` and `!used`, apply `min(maxHp, currentHp + healAmount)`,
set `used = true`, and consume that action cycle (no attack that turn) — same cost model
as a Healer choosing to heal instead of attack, same overheal clamp every other heal path
in the sim already uses. This is a generalization of a pattern the sim already has, not a
new one.

**Accepted edge case:** a one-shot kill that lands before the holder's own turn comes
around bypasses the potion entirely. Not fixed — the `surviveFatal` capstone ability
already exists specifically for guaranteed-save scenarios; a potion doesn't need to
duplicate that job.

### E. Totems — durable, party-wide, account-level

Totems are explicitly **not** a per-mission consumable. A new Sanity type, `totemDef`
(`totemKey`, `name`, `effects: [{stat, kind, value}]`, small flat magnitudes — illustrative
target ~+3 to a stat/resistance, a placeholder pending a real balance pass), equips into a
**single slot on the player's profile**, not on any character: `profiles.active_totem_id`.
One totem active at a time, account-wide, applying to every mission until swapped — the
same "durable, like gear" ergonomics the user asked for, not a use-it-once-and-it's-gone
item.

Equip/unequip is a new atomic RPC pair mirroring `equip_item`/`unequip_item`'s shape, but
scoped to `profiles` instead of `player_characters`. **No busy-check** — `equip_item`'s
busy-check exists because it's scoped to one specific character being unavailable; a
totem isn't tied to any single character, so there's no equivalent entity to check against.
**Free to swap** (no gold cost, matching gear's convention, not blessing respec's paid
all-or-nothing model).

**Combat integration:** reuses the exact mechanism capstone's `partyBuffOnStart` ability
already uses — a flat/pct buff applied to every party member once at fight start,
restricted to the same allowlisted stats (`defense`, `resistance`, `critChance`,
`critDamage`, `dodge`, `block`, `healthRegen`) that ability already respects. This is
effectively zero new combat.ts code: the fight-start buff pass just also reads the
account's equipped totem alongside each character's capstone.

**Read-live, not locked-at-dispatch:** like equipped gear (which `mission-claim` already
re-fetches fresh at claim time, not frozen at dispatch), whichever totem is equipped *at
claim time* applies — swapping totems between dispatch and claim changes the outcome, same
as swapping gear would. Keeps the two systems consistent instead of inventing a new
"locked loadout" concept just for totems.

### F. Mission dispatch & claim flow

At `mission-start`, the client sends `{ characterId, consumableDefId }[]` for the party's
heal/buff loadout (never totems — those are read live at claim per E). The server
validates: each character carries at most `slotsForCharacter(level)` + the studio-flag
bonus items, the player owns ≥1 of each submitted item, and the healing-category cap (C).
**Items are consumed at dispatch, not claim** — the same timing `start_craft` already uses
for reagents — so a lost mission still spent the prep; that's the honest cost of
preparing, win or lose. The loadout is stored on the `mission_runs` row (new
`consumables_used jsonb` column) so `mission-claim` knows what to wire into each
`Combatant` when it builds the fight.

### G. v1 content (proof of concept, not profession content)

Three items, craftable via the **existing** generic crafting system (ADR-0052's `create`
recipes) with no profession gate — this is what makes the framework shippable and testable
standalone, before any of the five professions exist:

- One `heal`-category item (illustrative: "Minor Healing Potion").
- One `buff`-category item, a single elemental resistance (illustrative: "Fire Resistance
  Draught").
- One `totemDef` (illustrative: "Totem of Minor Warding").

All exact numbers (heal amount, trigger %, buff magnitude, resource costs) are
placeholders pending a `docs/BALANCE.md`-style pass, same convention this project already
uses for every other first-pass constant (Echo Shop costs, Infirmary upgrade costs,
Proficiency's `alchemy` placeholder effect).

## Alternatives considered

- **Shared party-wide consumable pool instead of per-character slots** — rejected per
  user preference; per-character slots keep the "who carries what" decision tied to
  individual characters, matching how gear/blessings are already personal.
- **Rarity-scaled consumables (like gear) instead of flat tiers** — rejected; the user's
  own examples ("heal 200 health points") are exact numbers, not a rolled range, and flat
  tiers match genre convention for potions better than reusing `RARITY_MULT`.
- **Mid-fight triggers for buff-type items too** — rejected for v1; buffs don't have the
  "wasted if used too early" problem heals do, so a trigger condition adds sim complexity
  for no real benefit yet.
- **Uncapped consumable stacking** — rejected once the Tank-threat interaction was flagged;
  see C.
- **Totems consumed per-mission like potions** — rejected; "carved" implies durability, and
  a durable account-level equip slot is a cleaner, more distinct niche next to the
  per-character consumed-per-use items than a third flavor of one-shot item would be.

## Consequences

**What this unlocks:** a real in-run resource-management decision (E7 from
`docs/QUALITY_HYBRID.md`) using entirely existing architecture — no new table beyond two
small additions (`consumables_used` on `mission_runs`, `active_totem_id` on `profiles`),
no new RNG model, no change to the deterministic-replay guarantee of the combat sim.

**Explicitly out of scope here, deferred to later specs:**
- All five professions' actual leveling/progression mechanics (Alchemy's level-gated and
  rare-drop-taught recipes, Carving's totem variety, Prospecting's crack-open-geode reveal
  mechanic, Tempering's physical-damage items, Arcane Writing's spell-damage items).
- Mid-fight triggers for buff-category items.
- More than the formula-driven 1–2 slots plus the studio-flagged 3rd slot (e.g. no
  additional slot-granting items/upgrades yet).
- Per-ally targeting for heal items (self-only is final for this spec).
- Any resource sourcing tied to the unbuilt Expeditions layer (ADR-0020) — geodes and
  other profession materials will be sourced from today's missions/loot, not a system that
  doesn't exist yet.

**Sequencing for the profession specs that follow, in build order:** Alchemy (deepens the
`heal`/`buff` categories this spec already seeded) → Carving (deepens totems, also already
seeded) → Prospecting (new crack-open-reveal mechanic) → Tempering (new physical-damage
category) → Arcane Writing (new spell-damage category). Alchemy and Carving come first
because their output categories already exist after this spec ships; Prospecting/
Tempering/Arcane Writing introduce genuinely new mechanics and content types.

## Testing plan

- pgTAP: `start_mission`'s new validation (slot-count enforcement including the studio
  flag, healing-category cap, ownership/quantity checks on submitted consumableDefIds),
  the new totem equip/unequip RPC pair (ownership, busy-checks, free-swap, no level gate).
- Vitest: the new heal-trigger branch in `combat.ts` (deterministic given a seed — assert
  it fires exactly once per fight, consumes the action cycle, respects `triggerHpPct`), the
  totem buff-application path (reusing capstone's allowlist, verify it's applied once at
  fight start to every party member), and a new `src/lib/consumables.ts`/`totems.ts`
  registry test file matching the pattern `traits.test.ts`/`proficiencies.test.ts` already
  establish.
