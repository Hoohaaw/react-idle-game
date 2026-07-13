# TRAITS.md — character traits

> **Status: ACCEPTED + BUILT (ADR-0035, 2026-07-14).** Alex's amendments applied: trait counts
> **1/2/3/4/5** by rarity, economy bands 5–15%, Scholar self-only. Built across PRs #56 (core
> lib + schema) and #57 (consumption wiring); 19 traitDefs + all 19 character assignments live
> as drafts. Remaining: estimator context + roster/dispatch trait chips (UI branch, needs #54).
> §9's unanswered questions took the stated defaults (no auras, no negative traits, count-only
> scaling, recruit reveal deferred) — reopen any of them by editing here.

The idea, in Alex's words: characters carry a handful of **traits** that increase or decrease a
party's chance of succeeding at specific missions — a Common character has ~2, and the count
grows with character rarity, so a Legendary (~5 traits) is valuable far beyond its stat budget.

---

## 1. The core rule — traits change inputs, never outcomes

Success chance is not a stat in this game: it's the *output* of the deterministic combat sim
(ADR-0012/0013). A literal "+5% win chance" dial would have to flip losses post-hoc — no ending
HP for the margin bonus, no honest replay, and it would falsify the dispatch estimator.

**So: a trait is a *conditional modifier on the sim's inputs*** (stats, timers, yields). The
"+5% success" experience still happens — visibly — because the dispatch screen's estimator
(PR #54) runs the real engine with traits applied: pick the right character for the right map
and the estimated-success number jumps. Honest, transparent, and it makes trait value *felt*
at the exact moment of the squad decision.

## 2. Trait anatomy

A trait is `condition + effect`:

```
WHEN <condition>            APPLY <effect>
map = gravemarch            attack +12%
enemy archetype = boss      damage +15%
always                      fire resist +40 (character-side, flat)
always                      mission duration −10%
resource = ore              gather yield +25%
```

- **Conditions (v1, static only):** a specific `map`, an enemy `archetype` (boss/caster/tank/
  swarm/basic), an enemy `damage school`, a `resource` kind, or `always`. Conditions that change
  *during* a fight (ally downed, below 50% HP…) are **v2** — they'd live inside the engine loop.
- **Effects (v1):** percentage or flat modifiers to existing registry stats, mission duration,
  or reward/gather multipliers. No new stats invented — traits reuse the 23-stat registry
  (ADR-0004/0009).

## 3. Proposed trait vocabulary (~12 types, reused everywhere)

Small on purpose: 19 characters × 5 bespoke snowflakes is unreadable; a dozen named types that
recur ("oh, she's a *Gravehand* too") build player literacy. Parameters in brackets are what
the author picks per character.

### Combat — conditional power
| Type | Condition | Effect (proposed magnitude) |
|---|---|---|
| **Mapborn** ("Gravehand", "Cragborn"…) | on map [X] | +[10–15]% attack & spell power |
| **Slayer** ("Giantslayer", "Swarmbane"…) | vs archetype [X] | +[10–15]% damage |
| **Warded** ("Flamewalker", "Frostblood"…) | always | +[30–50] resist vs school [X] — this is the character-side resist layer deferred in ADR-0033 |
| **Bulwark** | vs damage school [X] | +[10–15]% defense |

### Tempo & economy — idle-game value
| Type | Condition | Effect |
|---|---|---|
| **Pathfinder** | always | mission duration −[5–10]% |
| **Goldtouched** | always | +[511–15]% gold from missions |
| **Fortunate** | always | +[5–15] Magic Find / Luck |
| **Scholar** | always | +[5–15]% XP for self only |

### Gathering — the specialization system we've had queued
| Type | Condition | Effect |
|---|---|---|
| **Prospector** ("Lumberjack", "Coalseeker"…) | resource [X] | +[20–30]% gather yield |
| **Quickhand** | resource [X] or always | +[15–25]% gather speed |

### Recovery
| Type | Condition | Effect |
|---|---|---|
| **Ironblood** | always | infirmary recovery +[20–30]% faster |

*(Add/strike types here — this table is the main thing to amend.)*

## 4. Rarity → trait count

| Rarity | Traits |
|---|---|
| Common | 1 |
| Uncommon | 2 |
| Rare | 3 |
| Epic | 4 |
| Legendary | 5 |

**Guardrails (keeps ADR-0031's "rarity is never a different game" law intact):**
- Traits are **free of the point-buy budget** — they're conditional, so they don't raise the
  always-on power floor. What rarity buys is *versatility*, not raw strength.
- At most **1 always-on combat trait** (Warded) per character; the rest must be conditional or
  non-combat. Prevents 5 traits from silently becoming +50% permanent power.
- Magnitudes are fixed per trait type (the bands above). Rarity increases the *count*, never
  the size. *(Alternative — rarer characters get bigger versions, e.g. Slayer II — is an open
  question in §9.)*

## 5. Data model

- **`traitDef`** (new Sanity document, registry-style per ADR-0004): `traitKey`, `name`,
  `description` (player-facing), `condition {type, value?}`, `effect {target, kind flat|pct,
  value}`. ~15–20 documents total; adding a trait = one document, no code.
- **`characterDef.traits[]`**: array of references. Studio validation (like the budget
  validator): count must match the character's rarity table, max one always-on combat trait.
- **No runtime state** — traits are innate authored identity (like role, ADR-0008), not
  chosen or respecced. Blessings stay the *choice* system; traits are the *identity* system.

## 6. Engine & code integration

One new shared layer, used identically by server and client (ADR-0016 pattern):

- **`src/lib/traits.ts`** — `applyTraits(stats, traits, context)` where context =
  `{ mapKey?, enemyArchetypes?, enemySchools? }`. Pure, tested.
- **mission-claim** builds context from the mission it already fetched and applies before the
  sim; **mission-start** applies Pathfinder to duration; the reward pipeline applies economy
  traits; the gather engine applies gather traits.
- **Win-chance estimator** applies the same function — trait value shows up as real
  percentage points on the dispatch screen with zero extra work.
- Compute-on-read intact: nothing derived is stored anywhere.

## 7. What the player sees

- **Character card / roster:** trait chips (IconSlot placeholders + name; tooltip = plain
  description). Rarity shows as "more chips".
- **Dispatch modal:** only the traits **active for this mission** light up on each character
  tile ("Gravehand ✓ active") — the anti-spreadsheet measure. Inactive traits stay quiet.
- **Estimator:** the number moves — that's the headline surface.
- **/game-stats:** new "Traits" entry, same-branch rule.

## 8. Balance process

Traits are stat-bearing content → BALANCE.md applies. The harness gains a trait-aware probe
(same comp with/without a Mapborn trait on its map = the discriminating pair); full sweep
before the content merges. Magnitude bands above are first-pass — tune vs sim like everything
else (ADR-0015 tradition).

## 9. Open questions for Alex (annotate here)

1. **Vocabulary** — §3 table: types to add/cut? (Party-aura traits — one character buffing the
   whole party — deliberately left OUT of v1: stacking rules get messy fast. Want them anyway?)
2. **Magnitude bands** — ±10–15% conditional feel right? Bigger for drama, smaller for safety?
3. **Count vs size** — rarity = more traits (current draft) or also *stronger* trait versions
   (Slayer I/II/III)?
4. **Scholar scope** — party-wide XP trait or self-only?
5. **Trait visibility before recruit** — do recruit screens show traits (informed purchase) or
   are they revealed on acquisition (gacha thrill)?
6. **Negative traits** — you said "increase/decrease". Do some characters carry a malus
   ("Sunblind — −10% attack in holy-school maps")? Adds texture + pricing room; also more
   authoring surface.
7. **Sequencing** — build traits before blessing trees (recommended: smaller system, trees
   layer cleanly on top) or after?

## 10. Build plan (when accepted → ADR)

1. `traitDef` schema + studio validation + `src/lib/traits.ts` + tests.
2. `applyTraits` wired into: mission-claim, mission-start (duration), reward pipeline, gather,
   win-chance estimator. Edge Function redeploys.
3. Author traitDefs + assign to all 19 characters per rarity table (drafts).
4. Trait-aware balance probe + sweep.
5. UI: roster chips, dispatch active-trait highlight, /game-stats entry.

Estimated: one focused session for 1–2, one for 3–5.
