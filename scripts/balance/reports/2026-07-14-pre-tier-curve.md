# Balance sweep — 2026-07-14 (pre-tier-curve)

633,600 fights (3168 cells × 200 seeds) in 5.3s. Naked baselines (no gear, no blessings). Constants: ARMOR_K=100, TANK_THREAT_MULT=4, TANK_THREAT_STAT_RATE=3, HEALER_HEAL_THRESHOLD=0.7, DODGE_CAP=25, SPEED_DR_K=30, MARGIN_MAX=0.5, LEVEL_BONUS=0.004, BASE_INTERVAL=3, REF_SPEED=10.

Cell format: `winRate m<avg surviving-HP% on wins>`. `0` = no wins. Matrices are the 180s time limit.

## Anomalies (auto-flagged)

- **Threat failure** in 3 cells: tank absorbs <60% of enemy attacks (worst: duo-tank-heal L10 T4 pack — 54%).
- **Timeout-heavy** (30 cells >30% timeouts): trio-no-tank L1 T2 pack@180s (57%), trio-no-tank L1 T2 pack@300s (55%), trio-no-tank L5 T3 pack@180s (57%), trio-no-tank L5 T3 pack@300s (53%), trio-no-tank L20 T6 boss@180s (98%), ….
- **Cliff** trio-core L1 pack: T2 100% → T3 0%.
- **Cliff** trio-core L1 boss: T2 100% → T3 0%.
- **Cliff** trio-core L5 solo: T6 100% → T7 0%.
- **Cliff** trio-core L5 pack: T3 100% → T4 3%.
- **Cliff** trio-core L10 solo: T7 100% → T8 1%.
- **Cliff** trio-core L10 boss: T5 100% → T6 0%.
- **Cliff** trio-core L20 pack: T6 100% → T7 3%.
- **Cliff** trio-double-dps L1 solo: T4 100% → T5 10%.
- **Cliff** trio-double-dps L1 pack: T2 100% → T3 0%.
- **Cliff** trio-double-dps L1 boss: T1 100% → T2 0%.
- **Cliff** trio-double-dps L5 solo: T6 100% → T7 0%.
- **Cliff** trio-double-dps L5 pack: T3 100% → T4 1%.
- **Cliff** trio-double-dps L5 boss: T3 100% → T4 0%.
- **Cliff** trio-double-dps L10 solo: T7 100% → T8 0%.
- **Cliff** trio-double-dps L10 boss: T4 100% → T5 0%.
- **Cliff** trio-double-dps L20 pack: T6 100% → T7 0%.
- **Cliff** trio-double-dps L35 boss: T7 100% → T8 2%.
- **Cliff** trio-no-tank L1 solo: T4 100% → T5 1%.
- **Cliff** trio-no-tank L1 boss: T2 100% → T3 0%.
- **Cliff** trio-no-tank L5 solo: T5 100% → T6 9%.
- **Cliff** trio-no-tank L5 boss: T3 100% → T4 0%.
- **Cliff** trio-no-tank L10 pack: T4 100% → T5 0%.
- **Cliff** trio-no-tank L10 boss: T4 100% → T5 0%.
- **Cliff** trio-no-tank L20 pack: T5 100% → T6 4%.
- **Cliff** trio-no-tank L20 boss: T5 100% → T6 2%.
- **Cliff** trio-casters L1 solo: T3 100% → T4 0%.
- **Cliff** trio-casters L1 pack: T1 100% → T2 0%.
- **Cliff** trio-casters L1 boss: T1 100% → T2 0%.
- **Cliff** trio-casters L5 solo: T5 100% → T6 0%.
- **Cliff** trio-casters L5 pack: T2 100% → T3 0%.
- **Cliff** trio-casters L5 boss: T2 100% → T3 0%.
- **Cliff** trio-casters L10 solo: T5 100% → T6 0%.
- **Cliff** trio-casters L10 pack: T3 100% → T4 0%.
- **Cliff** trio-casters L10 boss: T3 100% → T4 0%.
- **Cliff** trio-casters L20 solo: T7 100% → T8 0%.
- **Cliff** trio-casters L20 pack: T4 100% → T5 0%.
- **Cliff** trio-casters L20 boss: T5 100% → T6 0%.
- **Cliff** trio-casters L35 pack: T5 100% → T6 0%.
- **Cliff** trio-casters L35 boss: T6 100% → T7 0%.
- **Cliff** trio-casters L50 pack: T7 100% → T8 0%.
- **Cliff** trio-casters L50 boss: T7 100% → T8 0%.
- **Cliff** trio-double-tank L1 solo: T4 100% → T5 1%.
- **Cliff** trio-double-tank L1 pack: T2 100% → T3 0%.
- **Cliff** trio-double-tank L1 boss: T2 100% → T3 0%.
- **Cliff** trio-double-tank L5 pack: T3 100% → T4 0%.
- **Cliff** trio-double-tank L10 solo: T7 100% → T8 0%.
- **Cliff** trio-double-tank L10 pack: T4 100% → T5 2%.
- **Cliff** trio-double-tank L20 pack: T6 100% → T7 0%.
- **Cliff** trio-double-tank L20 boss: T6 100% → T7 0%.
- **Cliff** trio-double-tank L35 boss: T7 100% → T8 4%.
- **Cliff** trio-utility L1 solo: T3 100% → T4 0%.
- **Cliff** trio-utility L1 pack: T1 100% → T2 0%.
- **Cliff** trio-utility L5 solo: T4 100% → T5 0%.
- **Cliff** trio-utility L5 pack: T2 100% → T3 0%.
- **Cliff** trio-utility L5 boss: T1 100% → T2 0%.
- **Cliff** trio-utility L10 solo: T5 100% → T6 0%.
- **Cliff** trio-utility L20 solo: T6 100% → T7 0%.
- **Cliff** trio-utility L20 pack: T4 100% → T5 0%.
- **Cliff** trio-utility L20 boss: T3 100% → T4 0%.
- **Cliff** trio-utility L35 pack: T5 100% → T6 0%.
- **Cliff** trio-utility L50 pack: T6 100% → T7 3%.
- **Cliff** trio-gatherers L1 solo: T4 100% → T5 0%.
- **Cliff** trio-gatherers L1 pack: T1 100% → T2 0%.
- **Cliff** trio-gatherers L5 solo: T4 100% → T5 8%.
- **Cliff** trio-gatherers L5 pack: T2 100% → T3 0%.
- **Cliff** trio-gatherers L5 boss: T1 100% → T2 0%.
- **Cliff** trio-gatherers L10 solo: T5 100% → T6 7%.
- **Cliff** trio-gatherers L10 pack: T3 100% → T4 0%.
- **Cliff** trio-gatherers L10 boss: T2 100% → T3 1%.
- **Cliff** trio-gatherers L20 solo: T7 100% → T8 0%.
- **Cliff** trio-gatherers L20 pack: T4 100% → T5 1%.
- **Cliff** trio-gatherers L20 boss: T4 100% → T5 0%.
- **Cliff** trio-gatherers L35 pack: T6 100% → T7 0%.
- **Cliff** trio-gatherers L35 boss: T5 100% → T6 0%.
- **Cliff** trio-gatherers L50 pack: T6 100% → T7 1%.
- **Cliff** trio-gatherers L50 boss: T6 100% → T7 0%.
- **Cliff** duo-tank-heal L1 pack: T1 100% → T2 0%.
- **Cliff** duo-tank-heal L1 boss: T1 100% → T2 0%.
- **Cliff** duo-tank-heal L5 solo: T5 100% → T6 0%.
- **Cliff** duo-tank-heal L5 pack: T2 100% → T3 2%.
- **Cliff** duo-tank-heal L5 boss: T2 100% → T3 1%.
- **Cliff** duo-tank-heal L10 boss: T3 100% → T4 0%.
- **Cliff** duo-tank-heal L20 boss: T5 100% → T6 0%.
- **Cliff** duo-tank-heal L35 pack: T7 100% → T8 0%.
- **Cliff** duo-tank-heal L35 boss: T6 100% → T7 0%.
- **Cliff** duo-tank-heal L50 boss: T7 91% → T8 0%.
- **Cliff** solo-tank L1 solo: T1 100% → T2 0%.
- **Cliff** solo-tank L5 solo: T2 100% → T3 5%.
- **Cliff** solo-tank L10 solo: T4 100% → T5 0%.
- **Cliff** solo-tank L10 pack: T1 100% → T2 0%.
- **Cliff** solo-tank L10 boss: T1 100% → T2 0%.
- **Cliff** solo-tank L20 solo: T5 100% → T6 0%.
- **Cliff** solo-tank L20 boss: T2 100% → T3 3%.
- **Cliff** solo-tank L35 pack: T4 100% → T5 0%.
- **Cliff** solo-tank L35 boss: T4 100% → T5 0%.
- **Cliff** solo-tank L50 pack: T5 100% → T6 3%.
- **Cliff** solo-tank L50 boss: T5 100% → T6 0%.
- **Cliff** solo-dps L1 solo: T1 100% → T2 6%.
- **Cliff** solo-dps L5 solo: T3 100% → T4 1%.
- **Cliff** solo-dps L10 solo: T4 100% → T5 2%.
- **Cliff** solo-dps L10 pack: T1 100% → T2 1%.
- **Cliff** solo-dps L20 pack: T3 100% → T4 1%.
- **Cliff** solo-dps L35 pack: T4 100% → T5 6%.
- **Cliff** solo-dps L50 pack: T5 100% → T6 2%.
- **Cliff** solo-dps L50 boss: T5 100% → T6 0%.
- **Cliff** solo-crit L5 solo: T3 100% → T4 0%.
- **Cliff** solo-crit L10 solo: T4 100% → T5 3%.
- **Cliff** solo-crit L10 pack: T1 100% → T2 2%.
- **Cliff** solo-crit L10 boss: T1 100% → T2 0%.
- **Cliff** solo-crit L20 pack: T2 100% → T3 9%.
- **Cliff** solo-crit L20 boss: T2 100% → T3 4%.
- **Cliff** solo-crit L35 solo: T6 100% → T7 4%.
- **Cliff** solo-crit L35 pack: T4 100% → T5 0%.
- **Cliff** solo-crit L35 boss: T3 100% → T4 9%.
- **Cliff** solo-crit L50 solo: T7 100% → T8 4%.
- **Cliff** solo-crit L50 pack: T5 100% → T6 0%.
- **Cliff** solo-crit L50 boss: T4 100% → T5 3%.
- **Clock-bound** (8 cells win ≥40pts more at 300s): trio-double-tank L5 T4 boss, trio-double-tank L10 T5 boss, trio-double-tank L35 T8 boss, duo-tank-heal L5 T3 boss, duo-tank-heal L10 T4 boss, ….

## Shape: solo

### Level 1 — solo (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m93% | 100% m89% | 100% m92% | 100% m88% | 11% m52% | 0 | 0 | 0 |
| trio-double-dps | 100% m96% | 100% m88% | 100% m79% | 100% m57% | 10% m17% | 0 | 0 | 0 |
| trio-no-tank | 100% m95% | 100% m99% | 100% m97% | 100% m73% | 1% m40% | 0 | 0 | 0 |
| trio-casters | 100% m90% | 100% m90% | 100% m73% | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m95% | 100% m93% | 100% m95% | 100% m90% | 1% m46% | 0 | 0 | 0 |
| trio-utility | 100% m92% | 100% m82% | 100% m55% | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m93% | 100% m84% | 100% m64% | 100% m20% | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m87% | 100% m95% | 100% m93% | 38% m58% | 0 | 0 | 0 | 0 |
| solo-tank | 100% m41% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m48% | 6% m27% | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 100% m51% | 17% m7% | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 5 — solo (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m96% | 100% m89% | 100% m95% | 100% m95% | 100% m47% | 0 | 0 |
| trio-double-dps | 100% m100% | 100% m96% | 100% m94% | 100% m85% | 100% m68% | 100% m23% | 0 | 0 |
| trio-no-tank | 100% m100% | 100% m95% | 100% m92% | 100% m89% | 100% m66% | 9% m65% | 0 | 0 |
| trio-casters | 100% m100% | 100% m95% | 100% m85% | 100% m83% | 100% m55% | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m95% | 100% m94% | 100% m82% | 100% m96% | 71% m55% | 0 | 0 |
| trio-utility | 100% m93% | 100% m91% | 100% m81% | 100% m63% | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m97% | 100% m92% | 100% m88% | 100% m72% | 8% m39% | 0 | 0 | 0 |
| duo-tank-heal | 100% m93% | 100% m86% | 100% m100% | 100% m98% | 100% m100% | 0 | 0 | 0 |
| solo-tank | 100% m80% | 100% m54% | 5% m9% | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m75% | 100% m47% | 100% m23% | 1% m25% | 0 | 0 | 0 | 0 |
| solo-crit | 100% m75% | 100% m60% | 100% m18% | 0 | 0 | 0 | 0 | 0 |

### Level 10 — solo (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m100% | 100% m96% | 100% m90% | 100% m94% | 100% m90% | 100% m84% | 1% m33% |
| trio-double-dps | 100% m100% | 100% m100% | 100% m97% | 100% m94% | 100% m84% | 100% m69% | 100% m40% | 0 |
| trio-no-tank | 100% m100% | 100% m100% | 100% m95% | 100% m92% | 100% m77% | 100% m65% | 84% m59% | 0 |
| trio-casters | 100% m100% | 100% m100% | 100% m94% | 100% m83% | 100% m76% | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m94% | 100% m93% | 100% m99% | 100% m100% | 100% m88% | 0 |
| trio-utility | 100% m97% | 100% m93% | 100% m90% | 100% m79% | 100% m44% | 0 | 0 | 0 |
| trio-gatherers | 100% m100% | 100% m97% | 100% m91% | 100% m88% | 100% m73% | 7% m33% | 0 | 0 |
| duo-tank-heal | 100% m100% | 100% m93% | 100% m91% | 100% m99% | 100% m98% | 100% m100% | 28% m72% | 0 |
| solo-tank | 100% m97% | 100% m87% | 100% m67% | 100% m15% | 0 | 0 | 0 | 0 |
| solo-dps | 100% m90% | 100% m74% | 100% m60% | 100% m19% | 2% m20% | 0 | 0 | 0 |
| solo-crit | 100% m88% | 100% m83% | 100% m60% | 100% m35% | 3% m8% | 0 | 0 | 0 |

### Level 20 — solo (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m96% | 100% m89% | 100% m93% | 100% m97% |
| trio-double-dps | 100% m100% | 100% m100% | 100% m100% | 100% m98% | 100% m96% | 100% m94% | 100% m84% | 100% m66% |
| trio-no-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m92% | 100% m89% | 100% m84% | 100% m74% |
| trio-casters | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m92% | 100% m76% | 100% m67% | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m95% | 100% m93% | 100% m92% | 100% m98% | 100% m92% |
| trio-utility | 100% m100% | 100% m98% | 100% m97% | 100% m90% | 100% m85% | 100% m57% | 0 | 0 |
| trio-gatherers | 100% m100% | 100% m100% | 100% m97% | 100% m96% | 100% m88% | 100% m83% | 100% m60% | 0 |
| duo-tank-heal | 100% m100% | 100% m100% | 100% m95% | 100% m93% | 100% m85% | 100% m99% | 100% m100% | 100% m89% |
| solo-tank | 100% m100% | 100% m99% | 100% m92% | 100% m78% | 100% m39% | 0 | 0 | 0 |
| solo-dps | 100% m100% | 100% m92% | 100% m86% | 100% m81% | 100% m47% | 14% m22% | 0 | 0 |
| solo-crit | 100% m100% | 100% m90% | 100% m82% | 100% m75% | 100% m31% | 72% m3% | 0 | 0 |

### Level 35 — solo (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m92% | 100% m93% |
| trio-double-dps | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m95% | 100% m87% |
| trio-no-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m93% | 100% m89% | 100% m71% |
| trio-casters | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m92% | 100% m77% | 100% m72% |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m95% | 100% m92% | 100% m97% |
| trio-utility | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m95% | 100% m86% | 100% m71% | 100% m40% |
| trio-gatherers | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m96% | 100% m94% | 100% m84% | 100% m61% |
| duo-tank-heal | 100% m100% | 100% m100% | 100% m100% | 100% m96% | 100% m94% | 100% m89% | 100% m99% | 100% m96% |
| solo-tank | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m88% | 100% m69% | 87% m16% | 0 |
| solo-dps | 100% m100% | 100% m100% | 100% m93% | 100% m87% | 100% m82% | 100% m53% | 81% m30% | 0 |
| solo-crit | 100% m100% | 100% m100% | 100% m90% | 100% m82% | 100% m75% | 100% m30% | 4% m49% | 0 |

### Level 50 — solo (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m99% | 100% m97% | 100% m93% |
| trio-double-dps | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m96% |
| trio-no-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m93% | 100% m89% |
| trio-casters | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m91% | 100% m87% |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m96% | 100% m90% |
| trio-utility | 100% m100% | 100% m100% | 100% m100% | 100% m98% | 100% m96% | 100% m91% | 100% m85% | 100% m75% |
| trio-gatherers | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m95% | 100% m87% | 100% m82% |
| duo-tank-heal | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m96% | 100% m90% | 100% m95% |
| solo-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m98% | 100% m91% | 100% m71% | 88% m19% |
| solo-dps | 100% m100% | 100% m100% | 100% m100% | 100% m93% | 100% m86% | 100% m81% | 100% m47% | 65% m25% |
| solo-crit | 100% m100% | 100% m100% | 100% m100% | 100% m89% | 100% m80% | 100% m72% | 100% m38% | 4% m44% |


## Shape: pack

### Level 1 — pack (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m96% | 100% m89% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m75% | 100% m19% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m97% | 24% m70% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-casters | 100% m60% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m99% | 100% m99% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-utility | 100% m22% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m47% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m100% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 5 — pack (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m95% | 100% m100% | 100% m95% | 3% m62% | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m88% | 100% m77% | 100% m52% | 1% m15% | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m96% | 100% m95% | 43% m63% | 0 | 0 | 0 | 0 | 0 |
| trio-casters | 100% m100% | 100% m81% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m92% | 100% m97% | 100% m100% | 0 | 0 | 0 | 0 | 0 |
| trio-utility | 100% m68% | 100% m12% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m80% | 100% m40% | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m100% | 100% m100% | 2% m100% | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 1% m5% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 3% m3% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 10 — pack (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m94% | 100% m88% | 100% m97% | 100% m97% | 41% m53% | 0 | 0 | 0 |
| trio-double-dps | 100% m94% | 100% m89% | 100% m78% | 100% m62% | 24% m14% | 0 | 0 | 0 |
| trio-no-tank | 100% m91% | 100% m98% | 100% m93% | 100% m69% | 0 | 0 | 0 | 0 |
| trio-casters | 100% m91% | 100% m100% | 100% m65% | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m96% | 100% m91% | 100% m100% | 100% m96% | 2% m58% | 0 | 0 | 0 |
| trio-utility | 100% m85% | 100% m64% | 89% m9% | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m91% | 100% m81% | 100% m40% | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m87% | 100% m100% | 100% m100% | 71% m100% | 0 | 0 | 0 | 0 |
| solo-tank | 100% m53% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m39% | 1% m11% | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 100% m30% | 2% m15% | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 20 — pack (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m98% | 100% m96% | 100% m94% | 100% m96% | 100% m99% | 100% m98% | 3% m98% | 0 |
| trio-double-dps | 100% m99% | 100% m97% | 100% m96% | 100% m88% | 100% m75% | 100% m55% | 0 | 0 |
| trio-no-tank | 100% m98% | 100% m95% | 100% m92% | 100% m99% | 100% m67% | 4% m66% | 0 | 0 |
| trio-casters | 100% m98% | 100% m91% | 100% m87% | 100% m93% | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m98% | 100% m97% | 100% m94% | 100% m100% | 100% m97% | 100% m95% | 0 | 0 |
| trio-utility | 100% m93% | 100% m86% | 100% m76% | 100% m44% | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m97% | 100% m93% | 100% m84% | 100% m74% | 1% m41% | 0 | 0 | 0 |
| duo-tank-heal | 100% m93% | 100% m90% | 100% m99% | 100% m100% | 100% m99% | 19% m100% | 0 | 0 |
| solo-tank | 100% m84% | 100% m68% | 56% m10% | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m86% | 100% m48% | 100% m16% | 1% m1% | 0 | 0 | 0 | 0 |
| solo-crit | 100% m82% | 100% m43% | 9% m10% | 0 | 0 | 0 | 0 | 0 |

### Level 35 — pack (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m98% | 100% m97% | 100% m95% | 100% m92% | 100% m96% | 100% m98% | 100% m96% |
| trio-double-dps | 100% m100% | 100% m99% | 100% m98% | 100% m97% | 100% m93% | 100% m84% | 100% m73% | 69% m30% |
| trio-no-tank | 100% m100% | 100% m98% | 100% m95% | 100% m92% | 100% m86% | 100% m67% | 18% m67% | 0 |
| trio-casters | 100% m98% | 100% m98% | 100% m97% | 100% m87% | 100% m82% | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m99% | 100% m98% | 100% m96% | 100% m99% | 100% m99% | 100% m100% | 100% m91% |
| trio-utility | 100% m98% | 100% m96% | 100% m94% | 100% m78% | 100% m58% | 0 | 0 | 0 |
| trio-gatherers | 100% m98% | 100% m97% | 100% m93% | 100% m85% | 100% m75% | 100% m24% | 0 | 0 |
| duo-tank-heal | 100% m99% | 100% m95% | 100% m92% | 100% m100% | 100% m99% | 100% m100% | 100% m99% | 0 |
| solo-tank | 100% m100% | 100% m94% | 100% m82% | 100% m44% | 0 | 0 | 0 | 0 |
| solo-dps | 100% m91% | 100% m87% | 100% m58% | 100% m36% | 6% m6% | 0 | 0 | 0 |
| solo-crit | 100% m87% | 100% m81% | 100% m42% | 100% m8% | 0 | 0 | 0 | 0 |

### Level 50 — pack (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m100% | 100% m99% | 100% m97% | 100% m96% | 100% m91% | 100% m95% | 100% m99% |
| trio-double-dps | 100% m100% | 100% m100% | 100% m99% | 100% m98% | 100% m97% | 100% m94% | 100% m86% | 100% m77% |
| trio-no-tank | 100% m100% | 100% m100% | 100% m98% | 100% m95% | 100% m92% | 100% m83% | 100% m69% | 59% m68% |
| trio-casters | 100% m99% | 100% m98% | 100% m98% | 100% m97% | 100% m86% | 100% m81% | 100% m73% | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m99% | 100% m97% | 100% m98% | 100% m99% | 100% m100% |
| trio-utility | 100% m99% | 100% m98% | 100% m94% | 100% m87% | 100% m77% | 100% m47% | 3% m7% | 0 |
| trio-gatherers | 100% m99% | 100% m98% | 100% m97% | 100% m93% | 100% m84% | 100% m73% | 1% m53% | 0 |
| duo-tank-heal | 100% m99% | 100% m99% | 100% m96% | 100% m93% | 100% m99% | 100% m99% | 100% m100% | 100% m96% |
| solo-tank | 100% m100% | 100% m100% | 100% m98% | 100% m89% | 100% m55% | 3% m9% | 0 | 0 |
| solo-dps | 100% m93% | 100% m90% | 100% m86% | 100% m58% | 100% m32% | 2% m19% | 0 | 0 |
| solo-crit | 100% m89% | 100% m85% | 100% m79% | 100% m51% | 100% m20% | 0 | 0 | 0 |


## Shape: boss

### Level 1 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m99% | 100% m96% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m51% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m97% | 100% m70% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-casters | 100% m62% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m95% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-utility | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 16% m8% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m94% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 5 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m96% | 100% m99% | 100% m94% | 47% m82% | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m83% | 100% m64% | 100% m22% | 0 | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m98% | 100% m92% | 100% m89% | 0 | 0 | 0 | 0 | 0 |
| trio-casters | 100% m88% | 100% m90% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m95% | 28% m93% | 0 | 0 | 0 | 0 |
| trio-utility | 100% m41% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m68% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m100% | 100% m94% | 1% m100% | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 10 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m92% | 100% m97% | 100% m95% | 100% m89% | 100% m98% | 0 | 0 | 0 |
| trio-double-dps | 100% m93% | 100% m87% | 100% m70% | 100% m35% | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m89% | 100% m97% | 100% m89% | 100% m65% | 0 | 0 | 0 | 0 |
| trio-casters | 100% m91% | 100% m94% | 100% m100% | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m90% | 100% m100% | 100% m100% | 100% m100% | 31% m99% | 0 | 0 | 0 |
| trio-utility | 100% m78% | 35% m7% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m82% | 100% m72% | 1% m8% | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m98% | 100% m100% | 100% m95% | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 100% m15% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 29% m15% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 100% m4% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 20 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m97% | 100% m95% | 100% m90% | 100% m100% | 100% m98% | 100% m96% | 79% m95% | 0 |
| trio-double-dps | 100% m98% | 100% m95% | 100% m94% | 100% m81% | 100% m66% | 87% m31% | 0 | 0 |
| trio-no-tank | 100% m97% | 100% m92% | 100% m94% | 100% m91% | 100% m95% | 2% m80% | 0 | 0 |
| trio-casters | 100% m93% | 100% m95% | 100% m87% | 100% m91% | 100% m55% | 0 | 0 | 0 |
| trio-double-tank | 100% m97% | 100% m93% | 100% m96% | 100% m100% | 100% m100% | 100% m98% | 0 | 0 |
| trio-utility | 100% m93% | 100% m81% | 100% m61% | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m96% | 100% m90% | 100% m80% | 100% m29% | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m89% | 100% m92% | 100% m99% | 100% m97% | 100% m100% | 0 | 0 | 0 |
| solo-tank | 100% m85% | 100% m52% | 3% m7% | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m64% | 100% m36% | 19% m8% | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 100% m56% | 100% m18% | 4% m7% | 0 | 0 | 0 | 0 | 0 |

### Level 35 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m99% | 100% m98% | 100% m97% | 100% m93% | 100% m92% | 100% m97% | 100% m97% | 100% m92% |
| trio-double-dps | 100% m99% | 100% m99% | 100% m97% | 100% m95% | 100% m91% | 100% m79% | 100% m57% | 2% m11% |
| trio-no-tank | 100% m98% | 100% m97% | 100% m92% | 100% m97% | 100% m90% | 100% m87% | 14% m62% | 0 |
| trio-casters | 100% m95% | 100% m94% | 100% m91% | 100% m94% | 100% m82% | 100% m47% | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m98% | 100% m97% | 100% m93% | 100% m98% | 100% m100% | 100% m97% | 4% m100% |
| trio-utility | 100% m97% | 100% m93% | 100% m85% | 100% m63% | 23% m20% | 0 | 0 | 0 |
| trio-gatherers | 100% m97% | 100% m96% | 100% m94% | 100% m80% | 100% m61% | 0 | 0 | 0 |
| duo-tank-heal | 100% m97% | 100% m92% | 100% m87% | 100% m99% | 100% m97% | 100% m99% | 0 | 0 |
| solo-tank | 100% m100% | 100% m97% | 100% m79% | 100% m36% | 0 | 0 | 0 | 0 |
| solo-dps | 100% m83% | 100% m72% | 100% m49% | 87% m13% | 0 | 0 | 0 | 0 |
| solo-crit | 100% m76% | 100% m61% | 100% m33% | 9% m4% | 0 | 0 | 0 | 0 |

### Level 50 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m99% | 100% m99% | 100% m98% | 100% m97% | 100% m94% | 100% m89% | 100% m99% | 100% m96% |
| trio-double-dps | 100% m99% | 100% m99% | 100% m99% | 100% m97% | 100% m96% | 100% m92% | 100% m83% | 100% m65% |
| trio-no-tank | 100% m98% | 100% m98% | 100% m97% | 100% m91% | 100% m96% | 100% m91% | 100% m70% | 56% m61% |
| trio-casters | 100% m98% | 100% m95% | 100% m93% | 100% m90% | 100% m93% | 100% m90% | 100% m45% | 0 |
| trio-double-tank | 100% m99% | 100% m100% | 100% m98% | 100% m99% | 100% m94% | 100% m99% | 100% m100% | 100% m99% |
| trio-utility | 100% m98% | 100% m97% | 100% m91% | 100% m82% | 100% m68% | 57% m21% | 0 | 0 |
| trio-gatherers | 100% m99% | 100% m97% | 100% m95% | 100% m90% | 100% m79% | 100% m54% | 0 | 0 |
| duo-tank-heal | 100% m98% | 100% m97% | 100% m93% | 100% m90% | 100% m99% | 100% m97% | 91% m99% | 0 |
| solo-tank | 100% m100% | 100% m100% | 100% m100% | 100% m86% | 100% m48% | 0 | 0 | 0 |
| solo-dps | 100% m87% | 100% m82% | 100% m72% | 100% m50% | 100% m8% | 0 | 0 | 0 |
| solo-crit | 100% m85% | 100% m73% | 100% m62% | 100% m26% | 3% m24% | 0 | 0 | 0 |

