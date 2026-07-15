# BLESSINGS.md — authoring guideline for character blessing trees

> Companion to ADR-0045 (mechanism + Phase B ability engine) and ADR-0046 (wave-1 content). How to
> author a character's 4-row blessing tree + capstone in Sanity **drafts**. Mirrors docs/ITEMS.md's
> shape — read that first for the sizing-methodology precedent this reuses.

## The shape of the blessing tree

- `characterDef.blessingTree`: exactly 4 `blessingRow` objects (`row` 1–4, unique), each with
  exactly 2 `blessingChoice` objects (`choiceId: 'a'|'b'`, `title`, `description`, `effects:
  nodeEffect[]`). `nodeEffect` is `{stat, kind: 'flat'|'pct', value}` — the same shape as an item's
  `statBonuses` or a trait's `effects` (`src/lib/statDefinitions.ts` registry).
- `characterDef.capstone`: one `capstoneBlessing` (`title`, `description`, `kind: 'stat'|
  'conditional'|'ability'`). `stat`/`conditional` use `effects: nodeEffect[]` (+ `condition:
  conditionTrigger` for conditional — reuses the trait condition engine verbatim). `ability` uses
  `abilityKind: 'surviveFatal'|'partyBuffOnStart'` (+ `abilityParams: {stat, kind, value}` for
  `partyBuffOnStart`, restricted to the allowlist below).
- Titles/descriptions ARE authored now (unlike items' deferred flavor text) — bespoke per-character
  identity is the whole point of this system.

## Row gating and permanence

Row *N* unlocks at character level *N*×10 (10/20/30/40) **and** only after row *N*-1 is already
picked (strict sequence, enforced server-side by `choose_blessing`). Picks are **permanent** — no
respec in v1 (a future respec option is a standing TODO, not built). The capstone is **earned, not
chosen**: granted once `level >= 50 AND row4 picked`, computed on read every time, never written to
`player_characters.blessings`.

## The five role-shape patterns

Each role gets a fixed fork template — a genuine build-defining choice per row, not just a bigger
number. "Offense" stats route to whichever of `attack+strength+agility` (physical) or
`spellPower+intelligence` (caster) is that character's real power source (`combat.ts`'s
`pAtk`/`mAtk` routing — whichever is higher wins, so author toward the one the character actually
uses).

| Role | Rows 1/2/4 (or all 4) | Row 3 (if distinct) |
|---|---|---|
| **Damage** (7 chars) | offense (attack/spellPower/critChance/critDamage/haste) vs bulk (health/defense/dodge) | armorPen (shred tanky enemies) vs crit (burst squishies) |
| **Tank** (2 chars) | pure-wall (defense/block/health) vs off-tank (attack/dodge, still tanky-priced) | — (all 4 rows use the same fork) |
| **Healer** (3 chars) | rows 1/3: burst (healingCrit) vs sustain (healPower) | rows 2/4: tankiness (health/defense) vs more healPower |
| **Utility** (4 chars) | throughput (missionSpeedDecrease) vs economy (goldFind/magicFind/luck) | — (all 4 rows use the same fork) |
| **Gatherer** (3 chars) | rows 1/2: resource-flavored gatherSpeed vs gatherYield (see gap below) | rows 3/4: keep-gathering vs combat (attack/damage) |

Healer's tankiness fork and Gatherer's hybrid-combat fork are both deliberate additions beyond the
"one axis per role" default — a healer should be able to build survivable instead of pure-output,
and a gatherer should be able to meaningfully dps in missions if specced that way.

**Auras are capstone-only, never row-level.** A regular row choice can only grant a *self* stat
bonus (`collectBlessingBonuses` has no cross-character effect) — a real party-wide buff only exists
via the Phase B `partyBuffOnStart` ability, and only at the capstone slot. Don't try to author a
row that claims to buff teammates; it silently wouldn't.

## The row-conditional schema gap (read before authoring gatherer rows)

`blessingChoice` has **no `condition` field** — only `capstoneBlessing` does. A literal "+yield
only while gathering Wood" row pick is not buildable today; `collectBlessingBonuses` applies every
picked choice's effects unconditionally, with no context check. **Resolution for this wave:**
gatherer rows 1/2 are unconditional, always-on bonuses, just titled/flavored toward the character's
signature resource (mirrors how the existing `Quickhand` trait is flavored "quick hands" under an
`always` condition, not resource-gated). True row-level conditions would need a new `condition`
field threaded through `collectBlessingBonuses`/`flattenBlessingTree`/`mission-claim`/`charMaxHp`/
gather-collect — a real engine PR, not scoped into content authoring.

Capstone conditionals work exactly as designed (no gap) — `conditionTrigger`'s `map`/
`enemyArchetype`/`enemySchool`/`resource` types are all live and wired through
`resolveCapstoneBonuses`. Only `gravemarch`/`embercrag`/`frosthollow` map keys exist today, and the
`map` field has zero runtime validation outside Studio — a typo silently never triggers.

## Per-character capstone flavor

Alex's explicit ask: build a real spread across all three flavors, weighted toward making sure
auras actually exist (not clustered on one role). See ADR-0046 for the full 19-character table;
the shape is roughly 6 `ability` / 6 `conditional` / 7 `stat`. `ability` capstones this wave:
Brom/Aldric/Lyra/Gort get `partyBuffOnStart`; Mordrek/Vex get `surviveFatal`.

## Sizing methodology (mirrors docs/ITEMS.md's approach)

Don't guess values in a vacuum:

1. **Budget rule:** 20 `STAT_PRICE` points (`src/lib/characterBudget.ts`) per row, 30 for a
   `stat`/`conditional` capstone — flat across rarity, matching ADR-0045's existing flat-pricing
   decision (blessing count/magnitude is the one lever that ISN'T rarity-scaled; rarity already
   buys trait count and base-budget size). `ability` capstones aren't priced — size by feel; a
   `partyBuffOnStart` should be discounted to roughly 40% of an equivalent solo `stat` grant, since
   it hits every party member at once (3–5× the value of a solo grant).
2. **Equal cost per row.** Both choices in a row must cost the same via `flatEffectsCost()` (sums
   `value × STAT_PRICE[stat]` for flat-kind effects, within `BUDGET_TOLERANCE` = 0.5). This is
   enforced by a Studio validator on `blessingRow` — **but only inside Sanity Studio's UI.**
   `create_documents`/`patch_documents` skip all Studio validators entirely (they're client-side
   React rules, not server-enforced) — a scratchpad calc-script must replicate this check manually
   before writing, and content should be read back and re-checked after.
3. **`flatEffectsCost()` returns `null` if either choice uses a `pct` effect** — pct scales with
   the character's own baseline, so it can't be priced the same flat-point way. When a row uses
   `pct`, verify with a real calc instead: import `computeBaselines`/`applyBonuses` from
   `src/lib/stats.ts` directly, compute each choice's actual point-equivalent value at the row's
   unlock level using that character's REAL `baseStats`/`growth` (`scripts/balance/roster.ts`).
   **Never mix `flat` and `pct` in the same row** — a flat value is frozen forever once picked,
   while pct keeps compounding with level, so the two only read as "equal" at one anchor level and
   drift apart by L50. Keep both choices in a row the same kind, and when pct is used, check cost
   at both the unlock level AND L50.
4. **A `pct` effect on a stat the character has no baseline in is worth exactly zero**
   (`effective = baseline + flat + baseline×pct/100`) — check the character's real baseStats/growth
   before ever authoring a pct choice on them.
5. **Translate a raw stat swing honestly.** A stat like `attack` may look like a huge percentage
   change in isolation (e.g. a character with 0 growth on it), but the number that reaches the sim
   is the routed total (`pAtk = attack + strength + agility`, or `mAtk = spellPower + intelligence`)
   — present both readings so a worked example doesn't overstate the effect.
6. **Verify against ADR-0040's power-curve target.** Map 6's boss needs ~×3.4 combined gear+
   blessings over naked at L50, map 7's needs ~×6 — blessings are the smaller, secondary
   contributor to that (gear does the larger climb across 14 slots × up to Legendary). The 20pt/
   row + 30pt/capstone rule is a single adjustable constant translating that target into a
   per-row budget — nothing else depends on its exact value, so revisit it if playtesting says the
   spread feels too flat or too swingy.

## Authoring mechanism

- All 19 characterDefs already exist as Sanity drafts (`drafts.char.<charKey>`, except Tyla
  Windcarrier who is `drafts.<uuid>` — fetch real `_id`s via `query_documents` first, never assume
  the `char.<key>` pattern holds for every character).
- Use `patch_documents` with a single `set` on exactly `blessingTree` + `capstone` — never a
  broader field set, so there's no risk of touching `baseStats`/`growth`/`traits`/`role`/`rarity`.
- Every nested array item needs a `_type` matching its schema name (`blessingRow`, `blessingChoice`,
  `nodeEffect`, `capstoneBlessing`) and a `_key` unique within its array.
- Batch ~5 documents per call (larger batches untested against this project's MCP).
- **Never call `publish_documents`** — this project keeps all content in drafts until the roster
  settles (`feedback_content_drafts_only.md`).
- After each batch: `query_documents` read-back to confirm what's actually stored (not just what
  was sent — Sanity performs zero validation on MCP writes), then a quick Studio UI spot-check for
  validator warnings as a free extra check.

## Checklist per character's blessing tree

1. Confirm the character's role-shape template (table above) and pull real `baseStats`/`growth`
   from `scripts/balance/roster.ts`.
2. Draft 4 rows following the template, same-kind (flat/flat or pct/pct) choices per row, run
   `flatEffectsCost()` (flat) or the manual two-level calc (pct) until both sides of every row
   match within `BUDGET_TOLERANCE`.
3. Assign the capstone flavor (ADR-0046's table) and draft its effects/condition/abilityKind
   per the sizing rule above.
4. `patch_documents` the character's `blessingTree` + `capstone`.
5. `query_documents` read-back; confirm the stored shape matches what was sent.
6. Spot-check in Studio (no validator warnings) and, for at least the pilot batch, load `/blessings`
   in the running app to confirm the rows/capstone actually render and gate correctly.
