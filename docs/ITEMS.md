# ITEMS.md — authoring guideline for equippable items

> Companion to ADR-0043 (level-requirement gate) and ADR-0044 (wave-1 content). How to author
> itemDefs and wire them into a map's loot tables in Sanity **drafts**. Mirrors docs/MAPS.md's
> shape — read that first for how a map's 7 missions/enemies are structured; this covers the
> loot side.

## The shape of the item system

- One `itemDef` per distinct item: `name`, `itemKey` (stable, never change), `slot` (one of the
  10 slot types: head/shoulders/chest/hands/legs/feet/weapon/offhand/ring/trinket),
  `statBonuses[]` ({stat, kind: flat|pct, value} — the registry in `src/lib/statDefinitions.ts`),
  `minLevel` (ADR-0043).
- **Rarity is never authored on the item.** It's rolled at loot time from the mission's
  `rarityWeights`, and `RARITY_MULT` (`src/lib/stats.ts`: Common ×1 / Uncommon ×1.2 / Rare ×1.45
  / Epic ×1.75 / Legendary ×2.25) scales every `statBonuses` value at equip time. One itemDef
  covers all 5 rarities — author the **Common** baseline only.
- 14 equip slot **keys** (`src/lib/equipment.ts`) exist for the 10 slot **types**: the 8 unique
  slots map 1:1, `ring` fills any of `ring1..ring4`, `trinket` fills either `trinket1`/`trinket2`.
  A player can equip up to 4 copies of one ring itemDef, or mix different ring itemDefs across
  the 4 slots — author with that flexibility in mind (a single strong ring is a valid build).

## Level requirement (ADR-0043)

Each itemDef's `minLevel` is the level required to equip it **at Common rarity**. A rarer roll
adds a flat step on top (`LEVEL_REQ_STEP_BY_RARITY`, `src/lib/equipment.ts`):

```
Common +0 · Uncommon +2 · Rare +5 · Epic +9 · Legendary +14
requiredLevel = minLevel + step
```

**Level-cap ceiling — respect this for every future map.** The level cap is 50. Since Legendary
adds +14, any itemDef's `minLevel` must stay **≤ 36** or its Legendary roll becomes permanently
unequippable. Anchor `minLevel` to a map's *early-to-mid* expected level, not its top — e.g. a
map whose content expects L45–50 should still author items around `minLevel` 30–36, not 45+.
(Wave 1's anchors — Gravemarch 1–5, Embercrag 6–9, Frosthollow 12–15 — are all safely under this;
the constraint starts to bind by map 5+.)

## The wave-1 pattern: universal fill + per-map identity slots

With only 4 pre-wave-1 itemDefs, 6 of the 10 slot types (head/shoulders/hands/legs/feet/offhand)
had **zero items** — those equip slots were dead on every character sheet. Wave 1 fixed this in
two passes, which is the template for extending itemization to new maps:

1. **Universal fill** — one item per then-empty slot type, tagged to whichever map is "first" at
   the time (Gravemarch for wave 1), at that map's low power band. Only needed once; new maps
   don't need to re-fill slot types that already have items.
2. **Per-map build-defining slots** — `weapon`, `offhand`, `chest`, `ring`, `trinket` get their
   own itemDef(s) **per map**, power-scaled to that map's expected level band (docs/MAPS.md's
   tier table + docs/BALANCE.md's "power budget per map"). This is what gives each map a reason
   to keep farming it and a distinct itemization identity. A new map should author its own
   weapon/offhand/chest/ring/trinket set; it does NOT need new armor-slot (head/shoulders/hands/
   legs/feet) items unless deliberately introducing another power step for those slots.

## Per-map stat identity (the "flavor" layer)

Items are **damage-school-agnostic** by design (schools live on character/enemy/trait layers
only — no `fireDamage` or `iceResistance` item stats). A map's identity instead comes from name
theming plus which stats its items lean into:

| Map | Lean | Why |
|---|---|---|
| Gravemarch | balanced/utility (small secondary health/resistance/healthRegen) | early map, no build should feel wrong yet |
| Embercrag | aggressive offense (attack/crit/critDamage) | fire = pressure |
| Frosthollow | defensive attrition (defense/resistance/dodge/block) | ice = survive-the-grind |

**Slot-to-stat lane, held constant across maps (avoids accidentally re-stacking one stat on
every slot — see the gotcha below):** `weapon` = the offense lane (attack, flat). `offhand` = the
defense lane (flat defense, the "shield" slot). `chest` = the one armor piece allowed a small
defense secondary on top of its health. The other 5 armor slots (head/shoulders/hands/legs/feet)
carry **health only** — no secondary stat. `ring` = light offense/defense utility (crit, dodge,
resistance, healthRegen — pick one flavor per ring, don't stack three). `trinket` = the
magic/support lane (spellPower or healingPower, `pct`) — see the caster/healer gap below.

**Gotcha this wave hit and fixed:** an early draft put a small `defense` bonus on *every* armor
slot "for flavor." Because a character wears 14 slots simultaneously, six small per-slot bonuses
compounded into a +105% defense increase for a tank — wildly over the intended +30–40% "geared"
target. The fix was concentrating defense into exactly two lanes (`offhand` primary, `chest`
secondary) and leaving the other armor slots to carry only health. **Lesson: before finalizing
stat values, count how many slots in the FULL 14-slot loadout touch the same stat — a bonus that
looks small on one item can be large in aggregate.**

**Known gap, not yet fixed:** wave 1's `weapon` lane is attack-only (physical). Casters and
healers get no dedicated weapon-equivalent item — their only itemization this wave is the
`trinket` lane (spellPower/healingPower `pct`), which the verification script measured at
roughly +23% vs. physical's +32%. This is an accepted, scoped-down v1 limitation, not an
oversight — see the TODO entry ("caster/healer weapon-equivalent itemization").

## Sizing methodology (how wave 1's numbers were derived)

Don't guess values in a vacuum — ground them in real character baselines and verify against the
harness's power-tier proxy (ADR-0040) before writing to Sanity:

1. Pull 2–3 representative characters' authored `baseStats`/`growth` (Sanity query or
   `scripts/balance/roster.ts`) at the map's expected level (docs/BALANCE.md's power-budget
   table) — a physical DPS, a tank, and a caster/healer at minimum.
2. Draft stat values per the slot-to-stat lane above, sized so a **full 14-slot loadout** (best
   available item per slot, ~Rare average rarity) lifts each character's primary stat roughly
   **+30–40%** over naked — the harness's `geared ×1.35` proxy target for the map that's "the
   first real gear check" (map 3 in wave 1's case), scaled proportionally for earlier/later maps.
3. **Verify with a real calc, not arithmetic by hand.** Write a throwaway script (scratchpad, not
   committed) that imports `effectiveStats`/`collectGearBonuses` from `src/lib/stats.ts` directly
   — the same function the client and `mission-claim` both use — and compares naked vs. full-geared
   for each representative character. Iterate the draft values until the numbers land in band.
   This caught both problems in the "gotcha" above and the caster/healer gap — trust the
   calculation over intuition; 14 slots compound in ways that are easy to misjudge by eye.
4. Only then write the itemDefs to Sanity and wire the loot tables.

## Loot table wiring

- Each `missionDef` draft's `loot[]` (`lootDrop` objects: `item` ref, `dropChance`,
  `rarityWeights[]`, `quantityMin`/`quantityMax`) is independent per line — a mission can hand out
  several items at different odds on the same clear (2026-07-05 decision).
- Follow the existing per-stage escalation shape: early stages = one item, moderate `dropChance`,
  Common/Uncommon weights only. Mid stages (5–6) introduce a second line and a Rare weight. The
  stage-7 boss gets every one of that map's items at high `dropChance` and the deepest rarity
  ladder — this is where a map's rarity ceiling should extend (Epic first, Legendary reserved for
  the map that represents the current "first real gear check," per ADR-0044).
- **Sanity reference gotcha for drafts-only content:** a `lootDrop.item` reference from one draft
  document to another must be written as `{"_type": "reference", "_ref": "item.<key>", "_weak":
  true}` — the **base** id (no `drafts.` prefix), with `_weak: true`. Without the weak flag, the
  write is rejected ("references non-existent document") because no *published* copy of the
  itemDef exists. With the weak flag, the drafts-perspective query-time dereference (`item->`)
  resolves through to the draft content correctly, exactly like every other cross-reference in
  this drafts-only project.

## Checklist per new map's item wave

1. Confirm which slot types already have items (query `*[_type=="itemDef"]{slot}` in drafts) —
   only author new armor-slot items if introducing a genuinely new power step for them.
2. Author the map's weapon/offhand/chest/ring/trinket set (5 items, or fewer if reusing a
   previous map's for a slot that doesn't need a fresh entry yet), following the slot-to-stat
   lane + the map's stat-identity lean.
3. Set `minLevel` anchored to the map's expected level band (docs/BALANCE.md), respecting the
   level-cap ceiling (≤36) above.
4. Run the verification calc script against 2–3 representative characters at the map's expected
   power tier; adjust values until the primary-stat lift lands in the target band.
5. Create the itemDefs in Sanity (drafts only) via `create_documents`.
6. Wire the map's 7 missionDef loot arrays: repoint or add lines per the escalation shape above,
   using weak refs. Re-query to confirm every new item resolves at least once.
7. Extend the boss's rarity ceiling one step further than the previous map's boss (Epic → deeper
   Epic → first Legendary → deeper Legendary, following ADR-0044's progression).
8. Update `docs/BALANCE.md`'s power-budget note and memory with the wave's verification result.
