# MAPS.md — authoring guideline for world maps

> Companion to ADR-0034. How to author a map: 7 missions (stages 1–6 + boss), encounters, and
> enemies in Sanity **drafts**, on the tier template. Character-side pricing is not involved —
> maps are enemy content.

## The shape of a map

- One `mapDef`: `name`, `mapKey` (stable, never change), `order` (unique; position in the world
  sequence — drives the Missions-page toggle AND the unlock chain), `description`.
- Seven `missionDef`s referencing it, `stage` 1–7. **Stage 7 is the boss.**
- Stages unlock sequentially per player; the next map unlocks when this map's stage 7 is cleared.
  Cleared stages stay replayable — early stages are the map's farming spots.

## Difficulty ramp

Enemy stats come from the tier template (`scripts/balance/enemies.ts`, ADR-0015 §G + ADR-0024,
growth rate revised by ADR-0036 then ADR-0037): T1 base 120 HP / 12 atk / 5 def, everything
×1.8 per tier, **speed flat**. T1 is always exactly the base (tier exponent is tier−1) — the
first mission is meant to be soloable by any level-1 character. Rule of thumb for map *m*
(first map = 1):

| Stage | Tier | Shape |
|---|---|---|
| 1–2 | m | solo / small pack |
| 3–4 | m (+ pack pressure) | pack, introduce the map's school |
| 5–6 | m+1 | pack / elite duo |
| 7 (boss) | m+1, `boss` archetype | boss (HP ×5, atk ×1.5) ± adds |

Boss missions: bigger `baseXp` + gold, extra loot lines, rarity weights shifted up — the best
payout on the map, priced against being genuinely harder. Bosses carry the standard **spike
attack** (`spikeEverySeconds: 20`, `spikeMultiplier: 2.5`, ADR-0039) unless deliberately tuned —
a periodic heavy hit at a random member that the tank cannot cover.

Authored HP/attack values are **roll midpoints, not floors or ceilings** — every fight rolls each
enemy's HP and attack ±12% (`ENEMY_STAT_ROLL`, ADR-0038) around the number you write. Template
math targets the center of that band.

## Difficulty rhythm — where the 60/40 moments live (Alex, 2026-07-14)

A map is an oscillation, not a monotone ramp. Target win rates for a player at the map's
**expected power** (level band + power tier from the BALANCE.md "power budget per map" table),
with the party the map expects — per-fight rolls (ADR-0038) make these real probabilities the
dispatch estimator shows, not vibes:

| Stages | Target win rate at expected power | Feel |
|---|---|---|
| 1–4 | 85–95% | comfortable; the map's farming spots |
| 5–6 (tier bump) | 70–85% | first resistance — gear/comp questions start |
| 7 (boss) | **55–70% on the first attempt** | THE decision: push the 60/40 now, or farm stages 1–6 for levels/items and come back to clear it flawless |
| next map stage 1 | easier than the boss just beaten | relief valve — a fresh map opens gently |

Do NOT author stages that sit at 95–100% for the power band that unlocks them (no decision) or
below ~40% (a wall pretending to be a stage — walls are the boss's job). When authoring, sanity-
check targets against the harness (`trio-core` at the map's expected level/power) or the
dispatch estimator on a seeded account.

## Comp counters — every late stage asks a question (Alex, 2026-07-14)

Stages 5–7 must each pose at least one composition question, drawn from the archetype toolkit:

- **Boss = the spike check.** Random-target spikes bypass threat: the answer is party-wide
  toughness (HP/dodge/block), a healer who can react, or enough damage to end the fight before
  spikes stack. "Kill it faster" is a legitimate answer by design.
- **Swarm = the race.** Many low-HP attackers; total incoming damage punishes slow, defensive
  comps — bring damage breadth, not a turtle.
- **Caster = the armor bypass.** Magic damage ignores Defense; the counters are HP pools,
  Resistance, or killing the caster first (party focus already targets lowest-HP enemies).
- **Tank archetype = the clock check.** High HP + Defense stalls low-damage comps into the 180s
  limit; armor pen, magic damage, or raw attack answers it.

One question per stage is enough — stack two only on stage 7 (e.g. boss + swarm adds, the
existing shape). The dominant-school law below layers the "which damage school" question on top.

## School identity — the diversity law (Alex, 2026-07-13)

Each map has a **dominant** damage school, never a monoculture:

- **~4 of 7 stages**: enemies resist the dominant school (values per the ADR-0033 guideline —
  strong 100–150, broad 40, weakness = 0-entry).
- **~2 stages**: an off-school resist (a neighbor school) or physical-heavy enemies with real
  Defense instead of resistances.
- **1 early stage**: no resistances at all (the free hit; keeps tier-1–2 gating intact).
- **Boss**: leads with the dominant school, adds one secondary resist, and always has **one clear
  weakness** (the Bone Colossus pattern: shadow 120 / earth 60 / ice 40 / holy 0).

Net effect: one counter-school gets you ~70% of the map comfortably; full-clearing (and the boss)
rewards adapting the squad per stage. The mission cards' resist line (PR #48) is what makes this
legible — always author `resistances` so that line tells the truth.

## Checklist per map

1. `mapDef` draft (key, unique order).
2. ~4 `enemyDef` drafts on the tier template (archetypes: basic/caster/tank/swarm + one boss);
   set `damageType`, `tier`, and resistances per the diversity law.
3. 7 `encounterDef` drafts (`timeLimitSeconds`: 180 — ADR-0025).
4. 7 `missionDef` drafts: map ref + stage, `durationSeconds` (real-world wait), baseXp/gold ramp,
   resource rewards on-theme, loot lines (boss = extra + better weights). First clears pay a
   ×1.5 bonus automatically (ADR-0041) — no per-mission authoring needed.
5. Everything stays a **draft** (drafts-only rule) — the client reads the drafts perspective.
6. No sweep needed if enemies follow template values; material deviations → sweep first
   (docs/BALANCE.md).
7. Check the rhythm: stages 5–7 each pose a comp question, the boss lands 55–70% at the map's
   expected power (BALANCE.md power-budget table), and no stage is a freebie or a hidden wall.
8. Check trait coverage: does an existing traitDef counter this map's dominant school (see
   docs/TRAITS.md vocabulary)? Earth/wind/holy wards were pre-authored waiting for their maps
   (ADR-0042) — if the dominant school has no ward yet, note it as a small follow-up content
   wave; it does not block shipping the map.
