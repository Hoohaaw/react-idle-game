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
growth rate revised by ADR-0036): T1 base 120 HP / 12 atk / 5 def, everything ×1.25 per tier,
**speed flat**. Rule of thumb for map *m* (first map = 1):

| Stage | Tier | Shape |
|---|---|---|
| 1–2 | m | solo / small pack |
| 3–4 | m (+ pack pressure) | pack, introduce the map's school |
| 5–6 | m+1 | pack / elite duo |
| 7 (boss) | m+1, `boss` archetype | boss (HP ×5, atk ×1.5) ± adds |

Boss missions: bigger `baseXp` + gold, extra loot lines, rarity weights shifted up — the best
payout on the map, priced against being genuinely harder.

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
   resource rewards on-theme, loot lines (boss = extra + better weights).
5. Everything stays a **draft** (drafts-only rule) — the client reads the drafts perspective.
6. No sweep needed if enemies follow template values; material deviations → sweep first
   (docs/BALANCE.md).
