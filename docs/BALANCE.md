# BALANCE.md — the combat balance harness and tuning process

How we turn ADR-0015's *"first-pass constants, tune vs sim"* into an actual, repeatable tuning
loop. Read [`docs/DECISIONS.md`](./DECISIONS.md) ADR-0012…0015 for the combat model itself.

---

## Why this exists

The combat sim ([`src/lib/combat.ts`](../src/lib/combat.ts)) is pure and deterministic: given a
party, an encounter, and a seed, it returns the same result everywhere. That makes it cheap to run
**offline at massive scale** — no server, no DB, no Sanity fetch. The `COMBAT` constants block was
shipped with deliberate first-pass values (ADR-0015); this harness is the instrument that measures
what those values actually do, so tuning is evidence-based instead of vibes-based.

One machine sweep = ~1.4M fights in ~10 seconds. That is the whole trick: any proposed constant
change can be evaluated against the full grid before it ships.

## What lives where

```
scripts/balance/
├─ roster.ts     # snapshot of the 19 authored characterDefs (Sanity drafts) + party builder
├─ enemies.ts    # code implementation of the ADR-0015 §G enemy tier template + encounter shapes
├─ sweep.ts      # the grid runner: comps × levels × tiers × shapes × time limits × seeds
└─ reports/      # dated sweep outputs (markdown summary + full CSV) — committed as tuning evidence
```

The harness imports the **real** engine — `simulateCombat`, `computeBaselines`, `resolveRole` —
from `src/lib`. Nothing is reimplemented, so what the sweep measures is exactly what the
`mission-claim` Edge Function will resolve.

## Running a sweep

```
node scripts/balance/sweep.ts          # 500 seeds per cell (default) — ~10s
node scripts/balance/sweep.ts 100      # quicker, ±5% win-rate noise
```

Node ≥ 22.18 runs the TypeScript directly (type stripping); no build step. Output lands in
`scripts/balance/reports/<date>-baseline.{md,csv}` — the markdown is the human summary (win-rate
matrices + auto-flagged anomalies), the CSV is the full grid for spreadsheet/deep-dive work.

## The grid

| Dimension | Values | Why |
|---|---|---|
| Comp | 10 named parties from the real roster | role coverage: core trio, no-healer, no-tank, casters, double-tank turtle, utility, gatherers, duo, solos |
| Level | 1, 5, 10, 20, 35, 50 | the leveling arc incl. both milestone spikes |
| Enemy tier | 1–8 | ×1.4^(tier−1) template growth (ADR-0015 §G) |
| Shape | solo · pack (3×basic) · boss (boss+2 swarm) | the 1–N encounter space |
| Time limit | 60s (authored today) · 180s | separates "can't kill it" from "can't kill it *in time*" |

Parties are **naked baselines** — level-derived stats only, no gear, no blessings, full HP. That is
deliberate: baseline math must hold up on its own before bonus layers are priced on top. When
itemDefs and blessing trees are authored, add geared/blessed variants as new comps (the `Combatant`
input already accepts them via `effectiveStats`).

## Metrics glossary (CSV columns)

- **winRate / timeoutRate / wipeRate** — outcome split. Timeout and wipe are both losses but need
  different fixes (clock vs. survivability).
- **avgMarginWin** — mean surviving-HP% on wins. Directly = `marginBonus ÷ MARGIN_MAX`, i.e. the
  reward dial. If this is always ~1.0 on wins, the "decisive vs. bloody win" reward design is inert.
- **avgDurationWin** — mean fight length on wins; how much of the clock fights actually use.
- **avgDowned** — mean party members at 0 HP per fight → infirmary load, the real cost of a comp.
- **avgHpLostPct** — mean party HP lost per fight (all outcomes) → sustain economy.
- **tankTargetPct** — share of enemy attacks that hit a tank-role member. The "does the tank
  actually tank" number; NaN for tankless comps.
- **expRewardMult** — mean `(1+marginBonus)(1+levelBonus)` across all attempts (losses = 0).
  Expected reward multiplier per attempt — the number the economy pass should consume.

## Auto-flagged anomalies

The report opens with rule-based flags so regressions jump out without reading 60 matrices:

1. **Threat failure** — tank comps where the tank absorbs <60% of enemy attacks.
2. **Timeout-heavy** — cells where >30% of fights end on the clock.
3. **Healer inversion** — cells where swapping the healer for a second damage dealer *raises* win
   rate by >10 points. A healer slot should never be a downgrade.
4. **Difficulty cliff** — win rate ≥90% at tier N and ≤10% at tier N+1. No middle band = no
   risk/reward decisions for the player, and margin-scaled rewards never engage.
5. **Clock-bound** — cells that gain ≥40 win-rate points when the limit is tripled to 180s.

## The tuning loop

1. **Run the sweep** on a clean branch; commit the dated report (evidence of "before").
2. **Read the anomaly list**, pick ONE systemic issue.
3. **Form a hypothesis** naming the constant/formula responsible (`COMBAT` in `combat.ts`, the
   tier template in `enemies.ts`, or the authored defs themselves — sometimes the fix is content,
   not code).
4. **Change one thing.** Constants in code; authored-stat conclusions go back to Sanity.
5. **Re-run, diff the reports.** Anomaly counts and the target bands below say whether it helped.
6. **Record the accepted change as an ADR** (combat math revisions supersede ADR-0015 values).
   Repeat.

Keep sweeps deterministic: seeds are derived from cell coordinates, so two runs at the same
seeds-per-cell are exactly comparable, run-to-run and machine-to-machine.

### Target bands (proposal — first tuning goal, not yet met)

| Situation | Target win rate |
|---|---|
| On-level content (tier matched to level band) | 70–90% |
| One tier above | 30–60% |
| Two tiers above | <15% |
| One tier below | ~100%, margin ~1.0 |

Plus: tankTargetPct ≥70% for tank comps, no healer inversions, and a visible middle band of
"bloody wins" (margins 0.3–0.8) somewhere in every level's matrix so `marginBonus` does real work.

## Keeping the roster fixture fresh

`roster.ts` is a point-in-time snapshot (2026-07-10) of the authored characterDefs, so sweeps are
reproducible offline. When baseStats/growth change in Sanity, re-pull with:

```groq
*[_type == "characterDef"]{ charKey, name, charClass, role,
  baseStats[]{ stat, value },
  growth[]{ stat, perLevel, milestones[]{ level, bonus } } } | order(charKey asc)
```

(drafts perspective — content is drafts-only) and update the file. The report header records the
`COMBAT` constants per run; the fixture date is in `roster.ts`'s header.

## Baseline findings — 2026-07-10 (untuned v1 constants)

Full data: [`scripts/balance/reports/2026-07-10-baseline.md`](../scripts/balance/reports/2026-07-10-baseline.md).
Headlines, in rough order of severity:

1. **Difficulty cliffs everywhere (~130 flagged).** Nearly every comp goes 100% → ~0% across one
   tier step; the 30–80% band barely exists. Driver: the tier template multiplies **every** stat by
   1.4 — including speed — so effective enemy DPS grows ~×1.96/tier while party HP grows far
   slower. Margin bimodality follows: wins are flawless, losses are total, `marginBonus` is inert.
   First knob to try: stop (or soften) speed scaling in the tier template and retune.
2. **Healer inversion is real and common.** `trio-core` (tank/dps/healer) loses to
   `trio-double-dps` in 8+ cells by up to 73 points. The sim's healer AI heals whenever *anyone* is
   below 100% HP, so a healer virtually never attacks — the slot trades all its damage for
   throughput that can't outpace scaled enemy DPS. Candidate fixes: heal-threshold (attack unless an
   ally is below ~70%), and/or healing output scaling.
3. **Threat fails at scale (67 cells).** Damage-based threat × flat ×4 tank multiplier loses to
   speed-scaled dps output (a L20+ Rogue attacks ~6× faster than the Warrior). Worst cell: tank
   absorbs 34% of hits. Candidate fixes: raise `TANK_THREAT_MULT`, or add the ADR-0013 defense/HP
   component to threat so it doesn't ride pure damage.
4. **Speed is the king stat.** Action rate is linear in speed (`interval = 30/speed`), so speed
   growth compounds: more actions = more damage *and* more `healthRegen` ticks (regen applies per
   action, [combat.ts:310](../src/lib/combat.ts#L310)). Enemy speed also scales per tier (see #1).
   Watch this when authoring blessing trees/items — +speed will out-value everything at current math.
5. **Turtle comps rule the top end.** `trio-double-tank` is the only trio standing at L50/T8 boss;
   intended per ADR-0014 (unkillable comps allowed), but 22 cells are >30% timeout — worth
   revisiting whether timeout-as-loss plus 60s limits makes sustain comps feel broken instead of
   clever.
6. **Enemy resistance is 0 everywhere** (template defines none; both authored enemies also omit
   it), so magic damage bypasses mitigation entirely. Casters still underperform (fragile + slow),
   which says power routing needs attention once resistance exists at all.

None of these change code yet — they are the input queue for the tuning loop above.
