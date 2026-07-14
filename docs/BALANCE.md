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

One machine sweep = ~4.7M fights in ~40 seconds (at the 500-seed default). That is the whole
trick: any proposed constant change can be evaluated against the full grid before it ships.

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
node scripts/balance/sweep.ts          # 500 seeds per cell (default) — ~40s
node scripts/balance/sweep.ts 200 <label>   # tuning-run standard: quicker, names the report
```

Node ≥ 22.18 runs the TypeScript directly (type stripping); no build step. Output lands in
`scripts/balance/reports/<date>-baseline.{md,csv}` — the markdown is the human summary (win-rate
matrices + auto-flagged anomalies), the CSV is the full grid for spreadsheet/deep-dive work.

## The grid

| Dimension | Values | Why |
|---|---|---|
| Comp | 10 named parties from the real roster | role coverage: core trio, no-healer, no-tank, casters, double-tank turtle, utility, gatherers, duo, solos |
| Power tier | naked ×1.0 · geared ×1.35 · full-build ×1.9 | gear/trait/blessing PROXIES (ADR-0040) — all stats × mult except speed |
| Level | 1, 5, 10, 20, 35, 50 | the leveling arc incl. both milestone spikes |
| Enemy tier | 1–8 | ×1.8^(tier−1) template growth (ADR-0015 §G, revised ADR-0024/0036/0037) |
| Shape | solo · pack (3×basic) · boss (boss+2 swarm) | the 1–N encounter space |
| Time limit | 180s (recommended, ADR-0025) · 300s probe | separates "can't kill it" from "can't kill it *in time*" |

Matrices, anomaly counts, and the middle-band metric all read the **naked** slice only, so those
numbers stay comparable with every pre-ADR-0040 report (the naked seed streams are unchanged).
The power tiers are probes: they answer "does the tier curve hold once the player has the bonus
layers the harness doesn't model", in the CSV `power` column + the report's "Power tiers"
section. The multipliers are stand-ins — when itemDefs and blessing trees are actually authored,
re-derive them from real content (`effectiveStats` already accepts the layers) and re-sweep.

### Power budget per map (ADR-0040 — the authoring reference)

Maps span tiers m..m+1 (docs/MAPS.md); the stage-7 boss is the wall the next map hangs on. What
the player is EXPECTED to bring per map, and what the 2026-07-14 `power-tiers` sweep (trio-core,
boss shape) says that gets them:

| Map | Boss tier | Expected level | Expected power | Sweep reality check |
|---|---|---|---|---|
| 1 | T2 | ~1–6 | naked | T2 boss 100% from L5 naked (L1 = 5% — fresh solo pushes fail, by design) |
| 2 | T3 | ~6–12 | naked | T3 boss 82% at L10 naked |
| 3 | T4 | ~12–20 | geared | T4 boss 47% at L20 naked, 100% geared — the first real gear check |
| 4 | T5 | ~20–35 | geared | T5 boss 11% at L20 geared → 79% at L35 geared |
| 5 | T6 | ~35–50 | full-build | T6 boss 43% at L35 full-build → 99% at L50 |
| 6 | T7 | ~45–50 | full-build + deep blessings | T7 boss **11% at L50 ×1.9** — needs ~×3.4 combined |
| 7 | T8 | 50 (cap) | everything maxed | T8 boss **0% at L50 ×1.9** — needs ~×6 combined |

The bottom two rows are the standing requirement this table exists to record: under the ×1.8
tier curve, **gear + blessings together must reach roughly ×3.4 (map 6) and ×6 (map 7) over
naked stats at the level cap** — each tier step costs ×1.8 of party stats, and ×1.9 buys almost
exactly one step past naked. Alex's direction (2026-07-14): needing a full farm + good blessings
for the last maps is the intent. So author itemDef stat budgets + blessing trees toward that
combined ×5–6 endgame total — or, if that turns out too steep in practice, the alternatives are
tapering tier growth above T6 or gating maps 6–7 behind transcendence. Re-check this table
against real content sweeps before authoring wave-3+ maps.

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
7. **Update the player guide** — if the change alters what a player would feel or plan around
   (caps, thresholds, curve behavior, reward rules), update the affected entry in
   `src/pages/gameStatsContent.ts` (the `/game-stats` page) in the same branch.
   Repeat.

Keep sweeps deterministic: seeds are derived from cell coordinates, so two runs at the same
seeds-per-cell are exactly comparable, run-to-run and machine-to-machine.

## Agent playbook — how a tuning iteration is actually executed

The 2026-07-10 session (ADR-0024…0030) followed this recipe. Future agents: replicate it.

**Setup (once per session)**
1. Read `src/lib/combat.ts` + the combat ADRs before touching anything. If the roster fixture is
   stale (characterDef baseStats/growth changed in Sanity), re-snapshot `roster.ts` first.
2. Confirm the latest committed report matches a fresh sweep at the current constants (sanity
   check that master's engine = the last "after" state).

**Per iteration (one branch → one change → one ADR → one PR)**
3. Pick ONE issue from the newest report's anomaly list (or the queue in the tuning log). Name the
   hypothesis: which constant, formula, or authored content is responsible — and decide
   **engine vs content**: growth/authoring problems get fixed in Sanity, not with a new engine knob.
4. If a constant needs a value: run quick candidate sweeps
   (`node scripts/balance/sweep.ts 200 <label>` per candidate), look for the **plateau**, take the
   smallest value on it. Robustness beats optimality — if candidates are indistinguishable, say so
   in the ADR (that's evidence the knob is safe, not a failed experiment).
5. Make the change. Then write a **discriminating regression test**: one that FAILS on the old
   behavior and passes on the new. Verify the failure for real — temporarily flip the constant
   back, run the test, watch it fail, restore. A test that can't fail proves nothing.
6. Run the canonical sweep: `node scripts/balance/sweep.ts 500 <adr-slug>`. Delete the candidate
   experiment reports; commit only baseline-quality evidence (md + csv).
7. **Diff the CSVs, don't just read anomaly counts.** Join old/new on
   (comp, level, tier, shape, limit); list every cell whose win rate moved >15pts; explain each
   mover in both directions. An unexplained mover means STOP — you don't understand your change.
8. Interrogate suspicious metrics before "fixing" them. Two real examples: most "threat failures"
   were doomed fights where the tank correctly dies first (the metric got refined, not the
   engine); the solo-tank 100% sweep peeled like an onion — regen → dodge → speed → authored stat
   breadth — and each layer needed its own iteration. When a hypothesis turns out wrong, record
   the correction in the ADR ("speed DR does NOT break X because…") — wrong-but-documented beats
   silently-adjusted.
9. Check for **blind spots**: if a stat or mechanic has no comp probing it, add a probe comp to
   the grid (e.g. `solo-crit` was added because the only crit-growth character sat in no comp and
   crit stacking had never been measured).
10. Close out: ADR in `docs/DECISIONS.md` (context → decision → evidence → alternatives →
    consequences, including the mission-claim redeploy note), a row + outcome paragraph in the
    tuning log below, player-guide entry if player-visible (step 7 of the loop), memory update,
    `lint`+`build`+`test`, commit, stacked PR.

**Mechanics that keep results trustworthy**
- Never overwrite reports: always pass a label; the constants header in each report is the
  provenance record.
- Seeds derive from cell coordinates — identical grids are exactly comparable across runs and
  machines; a single anomalous fight can be replayed by reconstructing its seed string.
- Merge stacked PRs bottom-up and DELETE each base branch immediately — twice this session, PRs
  merged into stale stacked bases and never reached master (rescued by #33/#37).
- Windows note: edit source with proper tools; if scripting a constant flip, write files back as
  UTF-8 **without BOM** or the diff grows a phantom first-line change.

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

## Tuning log

| Date | Change | Report | ADR |
|---|---|---|---|
| 2026-07-10 | Baseline, untuned v1 constants | `2026-07-10-baseline` | — |
| 2026-07-10 | Tier template v2: enemy speed flat across tiers | `2026-07-10-speed-flat` | ADR-0024 |
| 2026-07-10 | Time limit 180s flat (was 60s); grid limits now 180/300 | `2026-07-10-limit-180` | ADR-0025 |
| 2026-07-10 | Healer AI: heal threshold 0.7 + hysteresis (engine change) | `2026-07-10-healer-threshold` | ADR-0026 |
| 2026-07-10 | Tank threat: passive (def + maxHp/10) × 3 × t accrual (engine change) | `2026-07-10-threat-stat` | ADR-0027 |
| 2026-07-10 | healthRegen time-normalized: HP per 3s, not per action (engine change) | `2026-07-10-regen-cadence` | ADR-0028 |
| 2026-07-10 | Party dodge capped at 25% + percent-stat audit; `solo-crit` probe comp added | `2026-07-10-dodge-cap` | ADR-0029 |
| 2026-07-10 | Speed DR above baseline (K=30, asymptote 4× actions; haste pre-curve) | `2026-07-10-speed-dr` | ADR-0030 |
| 2026-07-10 | Roster re-costed to point-buy budgets + rarity | `2026-07-10-budget-recost` | ADR-0031 |
| 2026-07-11 | Elemental schools + tier-gated enemy resistances | `2026-07-11-schools` | ADR-0033 |

**v2 outcome (ADR-0024):** cliffs ~130 → ~78, healer inversions 8 → 4 (milder), real 30–80% win band
appears (`marginBonus` engages). New binding constraint: **timeouts 22 → 87 heavy cells** — enemy HP
×1.4/tier against the flat 60s limit became the wall (39 cells win ≥40pts more at 180s). Also
confirmed: per-action `healthRegen` + speed growth = L50 solo tank untouchable (100% win, margin
1.0, every tier) — queued as its own iteration.

**Limit-180 outcome (ADR-0025):** flipped-cell analysis showed slow wins are comp-dependent
(sustain grinds, 60–170s at every tier), not tier-dependent — so flat 180s, not a per-tier formula.
Timeout-heavy 87 → 35, **healer inversions 4 → 0**, clock-bound at 300s down to 8 cells (all
`duo-tank-heal` boss grinds — the intended ADR-0014 gate). Both authored Sanity encounter drafts
patched 60→180.

**Healer-threshold outcome (ADR-0026, first engine change):** healers attack when the party is
above 70% HP, heal-to-full below it (hysteresis). Threshold robust (0.5/0.7/0.9 indistinguishable
on aggregates). Strictly-upward effect: 4 cells move >15pts, all up (sustain-edge timeouts become
kills); timeout-heavy 35 → 29; no regressions. Modest by design — ADR-0025 had already rescued the
win rates; this fixes the degenerate never-attacks behavior and makes healer damage stats real.

**Threat-stat outcome (ADR-0027, engine change):** tanks passively accrue threat
`(defense + maxHp/10) × 3` per combat second on top of damage threat — action-rate independent, so
fast dps no longer out-threats the slow tank at high levels. Rate plateau at 3 (1/3/5 swept). In
winnable fights the sub-60%-absorption flag drops to ZERO grid-wide (~89% avg tank absorption);
remaining low-absorption cells are doomed fights where the tank correctly dies first — the
threat-failure anomaly rule now only counts cells with win rate ≥50% for this reason. Defensive
stats double as aggro tools — price into tank gear/blessing authoring.

**Regen-cadence outcome (ADR-0028, engine change):** `healthRegen` now = HP per 3s of combat time
(applied per action scaled by interval) instead of full value per action — speed no longer buys
regen. 23 cells move >15pts, both directions, all explainable: regen-carried overtier immortality
collapses (`solo-tank` L20 T6 boss 100%→0%), slow sustain comps correctly buffed. Anomalies stable
(inversions 0, threat 1 marginal cell, cliffs ~79 = the tier ×1.4 jump itself, a design-feel call).
**Newly identified queue item: authored dodge growth** — Mordrek's +1 dodge/level = 53% at L50
keeps solo-tank sweeping the grid; content fix (rarer dodge growth) or engine dodge cap, TBD.

**Dodge-cap outcome (ADR-0029, engine change):** party dodge clamped at 25% (enemies uncapped —
authored gimmicks stay legal). 18 cells move, all downward, all dodge-stacked comps at overtier
edges (`solo-dps` L50 T7 pack 83%→19%). Percent-stat audit alongside: crit healthy (new `solo-crit`
probe comp — clean gradient, no cap), block bounded (worst case −50% damage; authoring guidance
only), defense/armorPen/heals self-limiting. **Remaining runaway = SPEED**: linear action rate ×
authored speed growth (Mordrek 55, Dace/Lyra 110 at L50) still carries solo-tank to 100% grid-wide.
Design decision pending: authoring guidelines vs engine diminishing returns on action rate.

**Speed-DR outcome (ADR-0030, engine change):** effective speed saturates above baseline
(K=30, asymptote 4× actions; haste folds in pre-curve; at/below speed 10 untouched — enemies keep
exact behavior). Gentle global compression (grid mean win rate 0.607→0.585), no comp breaks.
**Honest correction:** speed DR does NOT break Mordrek's L50 solo sweep — the cause is authored
stat BREADTH (every defensive growth at once), not any single engine channel. All engine-side
runaway guards are now closed (regen · dodge · speed · threat); the remaining fix is a **content
rebalance of Mordrek's defensive growth spread in Sanity**, then re-sweep.

## Baseline findings — 2026-07-10 (untuned v1 constants)

Full data: [`scripts/balance/reports/2026-07-10-baseline.md`](../scripts/balance/reports/2026-07-10-baseline.md).
Headlines, in rough order of severity:

1. **Difficulty cliffs everywhere (~130 flagged).** ~~Nearly every comp goes 100% → ~0% across one
   tier step; the 30–80% band barely exists.~~ Driver: the tier template multiplied **every** stat by
   1.4 — including speed — so effective enemy DPS grew ~×1.96/tier while party HP grows far
   slower. Margin bimodality followed: wins flawless, losses total, `marginBonus` inert.
   **ADDRESSED (ADR-0024): speed no longer scales with tier — see the tuning log.**
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
