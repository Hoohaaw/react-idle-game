# Utility Role — Conditional Proficiency — Design

**Date:** 2026-09-20
**Status:** Draft, approved by Alex section-by-section in chat
**TODO reference:** TODO.md "Utility role passive expression — OPEN (ADR-0013 fork 6)"

## 1. Problem

The Utility role (Druid/Bard/Engineer/Brewmaster/Painter) has never had a passive combat
expression. ADR-0013 fork 6 deliberately left this open; ADR-0014 confirmed Utility
characters fight as generic combatants (stats apply, no distinct role behavior) until a
kit is designed. This spec resolves fork 6.

The player's framing: Utility characters should be *conditional* — good at specific
things, not universally useful. A character proficient in Alchemy (herb/plant knowledge)
should meaningfully help on a mission where that knowledge applies (e.g. a forest), and
be an ordinary combatant everywhere else. This is a distinct identity from Tank (always
tanks), Damage (always deals), Healer (always heals) — Utility's value is situational.

## 2. Goals

- Give Utility characters a passive combat identity: a single authored **proficiency**
  that grants a stat bonus on missions tagged with a matching trait.
- Keep it registry-driven (ADR-0004): adding a new proficiency type is a one-line
  registry entry, no migration.
- Keep mission tagging opportunistic — most missions have no proficiency tag at all;
  only ones where it thematically fits get one. No forced retrofitting of the existing
  21 missions, no commitment to a fixed per-map or per-mission tagging scheme.
- Bonus must manifest as a real combat effect (stat modifier), so the client's
  probabilistic win-chance estimate and the server's deterministic authoritative
  outcome stay consistent — no direct probability tweaks anywhere.

## 3. Non-Goals

- **No hard content gating in this pass.** "You need a proficient character to even
  enter this dungeon" is an explicitly deferred fast-follow — different UX problem (what
  happens with no matching character, soft-lock messaging) and its own design pass.
- **No trained/leveled proficiency.** Proficiency is a fixed authored trait, decided at
  recruitment, like a character's class — not tied to the Skills system
  (`skills.ts`/`skill_assignments`). A character either has a proficiency or doesn't; it
  doesn't level up.
- **Not folded into `traitDef`.** Proficiency is a new, separate field/registry, not a
  new trait subtype. `traitDef`'s existing combat-stat traits are priced on the
  point-buy budget (ADR-0031) and driven by `conditionTrigger` (live combat-state
  conditions like HP thresholds). Proficiency is a different kind of thing — a static
  per-mission-attempt match, not a live combat condition — and mixing it into the trait
  budget would complicate a system that already works.
- **Not exclusive to any one mission-tagging granularity.** This spec does not mandate
  per-map or per-mission tagging as a rule going forward — `missionDef.proficiencyTags`
  is just an optional field, used wherever it fits.
- **No party-wide effect.** The bonus applies only to the proficient character's own
  stats for that fight, not the whole party. (A party-wide "bespoke ability" version was
  considered and rejected in favor of the simpler conditional-stat-bonus mechanism — see
  §4c.)
- Any role other than Utility carrying a proficiency — decided out of scope; proficiency
  is Utility-exclusive, reinforcing the role's identity.

## 4. Design

### 4a. Data model

- **`src/lib/proficiencies.ts`** (new, Deno-safe — imported by both client and Edge
  Functions, same constraint as `skills.ts`/`schools.ts`):

  ```ts
  export type ProficiencyDef = {
    proficiencyKey: string
    label: string              // UI display name, e.g. "Alchemy"
    statBonus: Partial<Record<StatKey, number>>  // flat stat modifiers, same shape traitDef effects use
  }

  export const PROFICIENCY_DEFS: ProficiencyDef[] = [
    { proficiencyKey: 'alchemy', label: 'Alchemy', statBonus: { /* placeholder, pending balance pass */ } },
  ]

  export const PROFICIENCY_BY_KEY: Record<string, ProficiencyDef> = Object.fromEntries(
    PROFICIENCY_DEFS.map((p) => [p.proficiencyKey, p]),
  )
  ```

- **`characterDef.ts`** — new optional `proficiency` field: a string select sourced from
  `PROFICIENCY_DEFS` (studio validation restricts this field to Utility-role characters
  only, same pattern as existing rarity-gated trait-count validation). Exactly one
  proficiency per character, or none. Not part of the point-buy budget (§3).
- **`missionDef.ts`** — new optional `proficiencyTags` field: array of proficiency keys
  (0 or more), default empty. Authored opportunistically, not systematically.

### 4b. Matching & bonus application

A character's proficiency bonus applies to a mission attempt when
`character.proficiency` is present in `mission.proficiencyTags`. This is a static
per-attempt check (evaluated once when assembling the party's combat stats for that
specific mission), not a live combat-state condition — so it does **not** reuse
`traitDef`'s `conditionTrigger` engine, which exists for a different kind of thing
(HP-threshold-style conditions evaluated mid-fight).

Each qualifying character in the party receives their own personal stat bonus
(`PROFICIENCY_DEFS[key].statBonus` added to their combat stats for that fight, same
composition point as gear/blessing/trait stat modifiers). Multiple Utility characters
with the same matching proficiency in one party each get their own bonus independently —
no special stacking logic needed, since the effect is per-character, not party-wide.

**Single shared computation** — a pure function (proposed name
`applyProficiencyBonus(character, mission)`) lives in `proficiencies.ts` or
`stats.ts` and is called from both:
- `src/features/missions/winChance.ts`'s `estimateWinChance()` (client-side probabilistic
  estimate, 200-run sim), and
- the server-authoritative `mission-start`/`mission-claim` Edge Functions' single
  deterministic `simulateCombat()` call.

Same function, same rule, both places — matches the "TS computes" half of the existing
"TS computes, SQL persists" split this codebase already uses elsewhere (e.g.
`skill-collect`), and avoids client/server drift the way every other stat-modifier
source (gear, blessings, Ascendant bonuses) already does.

### 4c. Why a conditional stat bonus, not a bespoke ability

Considered: a named special mechanic (like blessing capstones'
`partyBuffOnStart`) triggered on tag match. Rejected for v1 — more new combat-engine
surface area for no clear benefit over reusing the existing conditional-stat-modifier
pattern that `traitDef` already established. A bespoke-ability version remains a
possible future upgrade for specific proficiencies if the flat-bonus version proves too
flat in play.

### 4d. UI

Mission card gains a synergy indicator when a roster/dispatched Utility character's
proficiency matches the mission's `proficiencyTags` — same slot pattern as the existing
elemental strong/weak line (ADR-0033's mission-card resist line). No new page; no
Team/character-card surfacing beyond showing the character's proficiency label
somewhere sensible (exact placement decided at plan time).

## 5. Extensibility

Adding proficiency #2 (anything past Alchemy) requires:
1. One entry in `PROFICIENCY_DEFS` (`proficiencyKey`, `label`, `statBonus`).
2. Studio authors pick it for a Utility character via the existing `proficiency` select
   field — no schema change.
3. Studio authors opportunistically add the key to any `missionDef.proficiencyTags`
   where it fits.

No migration, no new RPC, no new Edge Function, no forced retrofit of existing content.

## 6. Testing

- `src/lib/proficiencies.ts`: Vitest coverage for the registry shape, mirroring
  `skills.ts`'s existing test file.
- `applyProficiencyBonus()`: unit tests for match/no-match cases, multiple qualifying
  party members, and a character with no proficiency authored.
- Per `docs/BALANCE.md`'s mandatory playbook (this is a combat-affecting change): a
  before/after sweep, a discriminating regression test, and an ADR are required before
  the initial `statBonus` placeholder values are treated as final. Ships with
  placeholder values first (same precedent `skills.ts`'s `intervalSec`/`xpPerTick` set),
  balance pass follows once playtested.
- Manual verification: dispatch a proficient Utility character on a tagged mission vs.
  an untagged one, confirm the win-chance estimate and mission-card synergy indicator
  both reflect the match correctly, and confirm the server-side claimed outcome used the
  same bonus (no client/server drift).

## 7. Open Questions (explicitly deferred, not decided)

- **Hard content gating** (§3) — hook point for this exists (`missionDef.proficiencyTags`
  already carries the same data a gate check would read) but the gate mechanism, soft-lock
  UX, and "what if no matching character exists" question are undesigned.
- Exact `statBonus` values, and which stat(s) each proficiency should favor — real
  balance-design work per `docs/BALANCE.md`, not decided here (§6).
- Where exactly a character's proficiency label surfaces in UI beyond the mission-card
  synergy indicator (Team page character card? Recruit preview?) — decided at plan time,
  not a design-level decision.
- Whether a bespoke-ability version (§4c) is worth building for any specific future
  proficiency, once the flat-bonus version has been playtested.
