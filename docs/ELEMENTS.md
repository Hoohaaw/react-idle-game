# ELEMENTS.md — elemental damage schools

> **Status: ACCEPTED + BUILT (ADR-0033, 2026-07-11).** Alex's amendments applied: school list is
> fire/ice/earth/**wind**/holy/shadow + physical + plain "magic" as the neutral school (no
> "arcane" naming); resistances surface **mid/late game** (tier-gated, nothing before tier 3);
> healing is schoolless. Sections below updated to as-built. UI surfaces (mission resist pips,
> roster school badges) are the remaining follow-up.

The goal, in Alex's words: enemies get resistances and real defensive stats *so the player can
configure their squad to make smarter choices*. Picking WHO to send should depend on WHAT you're
fighting.

---

## 1. The schools

Seven damage schools — six elemental + physical:

| School | Icon idea | Identity | Typical wielder |
|---|---|---|---|
| **physical** | ⚔ | weapons, claws, arrows — mitigated by armor (Defense) | warriors, rogues, hunters, most enemies |
| **magic** | ✦ | plain magic, the neutral school | default for casters with no authored school |
| **fire** | 🔥 | burn it down | Callum (Mage) |
| **ice** | ❄ | frost and cold | — |
| **wind** | 🌪 | storm and gale | Tyla (Windcarrier) |
| **earth** | ⛰ | stone, nature | Yenna (Stonecall), Fenn (Druid) |
| **holy** | ✨ | light, radiance | Aldric (Priest) |
| **shadow** | 🌑 | decay, void | Mira (Warlock) |

Registry-driven (`src/lib/schools.ts`, same pattern as stats/resources): adding a school later
(lightning, poison…) = one registry line + content that uses it. Six is the starting set — enough
for identity, few enough that each appears often.

## 2. How damage resolves (engine)

Today: an attack is `physical` or `magic`; physical is mitigated by the defender's Defense, magic
by a single generic Resistance — and enemies were authored with resistance 0, so magic ignored
mitigation entirely.

**Draft rule — v1 keeps the asymmetry deliberately:**

- **Party attacking enemies:** the attack carries a school. The enemy mitigates with its
  **per-school resistance**, same DR curve as armor (`resist / (resist + 100)`). Physical attacks
  keep using the enemy's Defense. This is where squad choice lives.
- **Enemies attacking the party:** unchanged in v1 — enemy attacks stay physical-vs-Defense or
  magic-vs-Resistance on the character side. Character per-school resistances arrive **with gear
  affixes later** ("Frostguard Cloak: +40 ice resist"), which makes resist gear a real loot
  decision instead of five new base stats per character. Keeps the 23-stat sheet readable and the
  ADR-0031 budgets untouched.

No rock-paper-scissors auto-advantage table: matchups are AUTHORED per enemy (a fire imp resists
fire hard, fears ice — or doesn't; the author decides). More content freedom, less system dogma.

## 3. Data model

**Enemy (`enemyDef`)** — gains:
- `damageSchool` (replaces `damageType`; existing `magic` migrates to `arcane`)
- `resistances[]`: `{ school, value }` array — same units as Defense (DR curve, K=100).
  Unlisted school = 0. `physical` never appears here (that is what Defense is).

Enemies already have the defensive block Alex asked about — Defense, Block, Dodge, Crit fields all
exist in the sim and schema; the tier template simply authored most at 0. The template gets real
defaults (below) and mission UI starts SHOWING them (that's what enables smart squad choices).

**Character (`characterDef`)** — gains ONE optional field:
- `damageSchool`: the school of the character's magic damage (Callum → fire). Physical-routed
  characters are always `physical`. Casters without an authored school default to `arcane`.
- **Costs no budget points** — a school is a matchup axis, not raw power. (If sweeps later show a
  school is strictly better against the authored enemy pool, that's an enemy-authoring imbalance,
  not a price problem.)

**Healers** are unaffected — healing has no school in v1.

## 4. Tier template defaults (enemies get real defenses)

Per archetype, on top of existing HP/atk/def scaling (values first-pass, sweep-calibrated):

| Archetype | damageSchool | Resistances |
|---|---|---|
| basic | physical | own-biome school ~40 (≈29% DR), else 0 |
| caster | its authored school | own school ~100 (50% DR), one weakness 0 |
| tank | physical | broad ~40 across two schools |
| swarm | physical | none |
| boss | authored | own school ~120, broad ~40, one authored weakness 0 |

Authoring guideline: **strong resist ≈ 100–150** (50–60% DR vs the wrong squad), **weakness = 0**
(full damage — reward for bringing the right hero), immunity (≥1000) legal for gimmick encounters
(like the untouchable ghost). Target feel: right-school vs wrong-school ≈ **30–50% damage swing** —
enough to make dispatch a decision, not enough to hard-gate a mission.

## 5. What the player sees (the actual payoff)

- **Mission card / dispatch:** enemy school icon + resist pips ("Resists 🔥🔥🔥 · weak to ❄").
- **Character card / roster:** school badge next to the class for casters.
- **Claim/fight log (later):** damage numbers tinted by school.
- **/game-stats guide:** new "Damage Schools" section, plain words.

Without the UI surfaces the whole system is invisible — they ship in the same build.

## 6. Build plan (when accepted → ADR-0033)

1. `src/lib/schools.ts` registry + engine change in `combat.ts` (school on attack, per-school
   mitigation lookup for enemy defenders) + discriminating tests (fire mage vs fire-resistant
   enemy loses ~half its damage; vs its weakness, full).
2. `enemyDef`/`characterDef` schema fields + deploy; migrate `damageType` → `damageSchool`.
3. Author schools onto the existing casters (Callum fire, Mira shadow, Aldric holy, …) and both
   existing enemies; tier template defaults into `scripts/balance/enemies.ts`.
4. Harness: school-matchup probe comps (right-school vs wrong-school trio vs the same encounter);
   full sweep; calibrate resist magnitudes to the 30–50% swing target.
5. UI surfaces (mission card pips, roster badges) + guide entry + ADR-0033.

Estimated as one focused session, playbook rules apply (one branch, before/after sweeps, tests).

## 7. Open questions for Alex

1. **School list final?** physical + arcane + fire/ice/earth/holy/shadow. Lightning? Poison/nature
   split from earth?
2. **Who gets what school?** Draft: Callum fire, Mira shadow, Aldric holy, Tyla/Yenna earth
   (shamans), Fenn earth (druid), Lyra arcane (bard), Elia arcane (painter — or something weirder?).
3. **Enemy-side incoming schools on characters (v2)** — happy with gear-affix resists later, or do
   you want character base resists now (costs budget + 6 new stats)?
4. **Healing schools** — holy healing vs shadow drain flavor someday, or keep healing schoolless?
