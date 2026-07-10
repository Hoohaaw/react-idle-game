# Balance sweep — 2026-07-10 (budget-recost)

1,584,000 fights (3168 cells × 500 seeds) in 15.4s. Naked baselines (no gear, no blessings). Constants: ARMOR_K=100, TANK_THREAT_MULT=4, TANK_THREAT_STAT_RATE=3, HEALER_HEAL_THRESHOLD=0.7, DODGE_CAP=25, SPEED_DR_K=30, MARGIN_MAX=0.5, LEVEL_BONUS=0.004, BASE_INTERVAL=3, REF_SPEED=10.

Cell format: `winRate m<avg surviving-HP% on wins>`. `0` = no wins. Matrices are the 180s time limit.

## Anomalies (auto-flagged)

- **Threat failure** in 1 cells: tank absorbs <60% of enemy attacks (worst: duo-tank-heal L10 T4 pack — 53%).
- **Timeout-heavy** (30 cells >30% timeouts): trio-no-tank L1 T2 pack@180s (52%), trio-no-tank L1 T2 pack@300s (52%), trio-no-tank L5 T3 pack@180s (53%), trio-no-tank L5 T3 pack@300s (53%), trio-no-tank L20 T6 boss@180s (99%), ….
- **Cliff** trio-core L1 solo: T4 100% → T5 9%.
- **Cliff** trio-core L1 pack: T2 100% → T3 0%.
- **Cliff** trio-core L1 boss: T2 100% → T3 0%.
- **Cliff** trio-core L5 solo: T6 100% → T7 0%.
- **Cliff** trio-core L5 pack: T3 100% → T4 2%.
- **Cliff** trio-core L10 solo: T7 100% → T8 1%.
- **Cliff** trio-core L10 boss: T5 100% → T6 0%.
- **Cliff** trio-core L20 pack: T6 100% → T7 2%.
- **Cliff** trio-double-dps L1 solo: T4 100% → T5 9%.
- **Cliff** trio-double-dps L1 pack: T2 100% → T3 0%.
- **Cliff** trio-double-dps L1 boss: T1 100% → T2 0%.
- **Cliff** trio-double-dps L5 solo: T6 100% → T7 0%.
- **Cliff** trio-double-dps L5 pack: T3 100% → T4 0%.
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
- **Cliff** trio-no-tank L20 pack: T5 100% → T6 3%.
- **Cliff** trio-no-tank L20 boss: T5 100% → T6 1%.
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
- **Cliff** trio-casters L50 pack: T6 100% → T7 0%.
- **Cliff** trio-casters L50 boss: T7 100% → T8 0%.
- **Cliff** trio-double-tank L1 solo: T4 100% → T5 1%.
- **Cliff** trio-double-tank L1 pack: T2 100% → T3 0%.
- **Cliff** trio-double-tank L1 boss: T2 100% → T3 0%.
- **Cliff** trio-double-tank L5 pack: T3 100% → T4 0%.
- **Cliff** trio-double-tank L10 solo: T7 100% → T8 0%.
- **Cliff** trio-double-tank L10 pack: T4 100% → T5 3%.
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
- **Cliff** trio-utility L50 pack: T6 100% → T7 2%.
- **Cliff** trio-gatherers L1 solo: T4 100% → T5 0%.
- **Cliff** trio-gatherers L1 pack: T1 100% → T2 0%.
- **Cliff** trio-gatherers L5 solo: T4 100% → T5 9%.
- **Cliff** trio-gatherers L5 pack: T2 100% → T3 0%.
- **Cliff** trio-gatherers L5 boss: T1 100% → T2 1%.
- **Cliff** trio-gatherers L10 solo: T5 100% → T6 8%.
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
- **Cliff** duo-tank-heal L5 pack: T2 100% → T3 1%.
- **Cliff** duo-tank-heal L5 boss: T2 100% → T3 1%.
- **Cliff** duo-tank-heal L10 boss: T3 100% → T4 1%.
- **Cliff** duo-tank-heal L20 boss: T5 100% → T6 0%.
- **Cliff** duo-tank-heal L35 pack: T7 100% → T8 0%.
- **Cliff** duo-tank-heal L35 boss: T6 100% → T7 0%.
- **Cliff** duo-tank-heal L50 boss: T7 92% → T8 0%.
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
- **Cliff** solo-dps L1 solo: T1 100% → T2 5%.
- **Cliff** solo-dps L5 solo: T3 100% → T4 0%.
- **Cliff** solo-dps L10 solo: T4 100% → T5 1%.
- **Cliff** solo-dps L10 pack: T1 100% → T2 1%.
- **Cliff** solo-dps L20 pack: T3 100% → T4 1%.
- **Cliff** solo-dps L35 pack: T4 100% → T5 6%.
- **Cliff** solo-dps L50 pack: T5 100% → T6 2%.
- **Cliff** solo-dps L50 boss: T5 100% → T6 0%.
- **Cliff** solo-crit L5 solo: T3 100% → T4 0%.
- **Cliff** solo-crit L10 solo: T4 100% → T5 4%.
- **Cliff** solo-crit L10 pack: T1 100% → T2 1%.
- **Cliff** solo-crit L10 boss: T1 100% → T2 0%.
- **Cliff** solo-crit L20 pack: T2 100% → T3 10%.
- **Cliff** solo-crit L20 boss: T2 100% → T3 3%.
- **Cliff** solo-crit L35 solo: T6 100% → T7 4%.
- **Cliff** solo-crit L35 pack: T4 100% → T5 0%.
- **Cliff** solo-crit L35 boss: T3 100% → T4 7%.
- **Cliff** solo-crit L50 solo: T7 100% → T8 3%.
- **Cliff** solo-crit L50 pack: T5 100% → T6 0%.
- **Cliff** solo-crit L50 boss: T4 100% → T5 2%.
- **Clock-bound** (8 cells win ≥40pts more at 300s): trio-double-tank L5 T4 boss, trio-double-tank L10 T5 boss, trio-double-tank L35 T8 boss, duo-tank-heal L5 T3 boss, duo-tank-heal L10 T4 boss, ….

## Shape: solo

### Level 1 — solo (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m93% | 100% m89% | 100% m92% | 100% m88% | 9% m53% | 0 | 0 | 0 |
| trio-double-dps | 100% m96% | 100% m88% | 100% m79% | 100% m57% | 9% m15% | 0 | 0 | 0 |
| trio-no-tank | 100% m95% | 100% m98% | 100% m97% | 100% m74% | 1% m40% | 0 | 0 | 0 |
| trio-casters | 100% m90% | 100% m90% | 100% m73% | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m95% | 100% m93% | 100% m94% | 100% m90% | 1% m49% | 0 | 0 | 0 |
| trio-utility | 100% m92% | 100% m82% | 100% m55% | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m93% | 100% m85% | 100% m64% | 100% m19% | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m87% | 100% m95% | 100% m93% | 38% m59% | 0 | 0 | 0 | 0 |
| solo-tank | 100% m41% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m49% | 5% m25% | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 100% m51% | 15% m7% | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 5 — solo (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m96% | 100% m89% | 100% m96% | 100% m95% | 100% m47% | 0 | 0 |
| trio-double-dps | 100% m100% | 100% m96% | 100% m94% | 100% m85% | 100% m68% | 100% m22% | 0 | 0 |
| trio-no-tank | 100% m100% | 100% m95% | 100% m92% | 100% m89% | 100% m66% | 9% m62% | 0 | 0 |
| trio-casters | 100% m100% | 100% m95% | 100% m85% | 100% m83% | 100% m55% | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m95% | 100% m94% | 100% m82% | 100% m96% | 68% m56% | 0 | 0 |
| trio-utility | 100% m93% | 100% m91% | 100% m81% | 100% m63% | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m97% | 100% m92% | 100% m88% | 100% m72% | 9% m40% | 0 | 0 | 0 |
| duo-tank-heal | 100% m93% | 100% m86% | 100% m99% | 100% m98% | 100% m100% | 0 | 0 | 0 |
| solo-tank | 100% m80% | 100% m54% | 5% m10% | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m75% | 100% m47% | 100% m22% | 0% m25% | 0 | 0 | 0 | 0 |
| solo-crit | 100% m75% | 100% m60% | 100% m17% | 0 | 0 | 0 | 0 | 0 |

### Level 10 — solo (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m100% | 100% m96% | 100% m90% | 100% m94% | 100% m90% | 100% m84% | 1% m41% |
| trio-double-dps | 100% m100% | 100% m100% | 100% m97% | 100% m94% | 100% m84% | 100% m70% | 100% m40% | 0 |
| trio-no-tank | 100% m100% | 100% m100% | 100% m95% | 100% m92% | 100% m77% | 100% m64% | 85% m59% | 0 |
| trio-casters | 100% m100% | 100% m100% | 100% m94% | 100% m83% | 100% m76% | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m94% | 100% m93% | 100% m99% | 100% m100% | 100% m87% | 0 |
| trio-utility | 100% m97% | 100% m93% | 100% m90% | 100% m79% | 100% m44% | 0 | 0 | 0 |
| trio-gatherers | 100% m100% | 100% m97% | 100% m91% | 100% m88% | 100% m73% | 8% m37% | 0 | 0 |
| duo-tank-heal | 100% m100% | 100% m93% | 100% m91% | 100% m99% | 100% m98% | 100% m100% | 28% m70% | 0 |
| solo-tank | 100% m97% | 100% m87% | 100% m67% | 100% m15% | 0 | 0 | 0 | 0 |
| solo-dps | 100% m90% | 100% m74% | 100% m60% | 100% m18% | 1% m20% | 0 | 0 | 0 |
| solo-crit | 100% m88% | 100% m83% | 100% m61% | 100% m35% | 4% m8% | 0 | 0 | 0 |

### Level 20 — solo (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m96% | 100% m89% | 100% m93% | 100% m97% |
| trio-double-dps | 100% m100% | 100% m100% | 100% m100% | 100% m98% | 100% m96% | 100% m94% | 100% m83% | 100% m66% |
| trio-no-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m92% | 100% m89% | 100% m84% | 100% m74% |
| trio-casters | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m92% | 100% m88% | 100% m38% | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m95% | 100% m93% | 100% m91% | 100% m98% | 100% m92% |
| trio-utility | 100% m100% | 100% m98% | 100% m97% | 100% m90% | 100% m85% | 100% m57% | 0 | 0 |
| trio-gatherers | 100% m100% | 100% m100% | 100% m97% | 100% m96% | 100% m88% | 100% m83% | 100% m60% | 0 |
| duo-tank-heal | 100% m100% | 100% m100% | 100% m95% | 100% m93% | 100% m85% | 100% m99% | 100% m100% | 100% m89% |
| solo-tank | 100% m100% | 100% m99% | 100% m92% | 100% m78% | 100% m39% | 0 | 0 | 0 |
| solo-dps | 100% m100% | 100% m91% | 100% m86% | 100% m81% | 100% m47% | 16% m22% | 0 | 0 |
| solo-crit | 100% m100% | 100% m89% | 100% m82% | 100% m75% | 100% m31% | 71% m3% | 0 | 0 |

### Level 35 — solo (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m92% | 100% m93% |
| trio-double-dps | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m95% | 100% m87% |
| trio-no-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m93% | 100% m89% | 100% m71% |
| trio-casters | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m92% | 100% m88% | 100% m72% |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m95% | 100% m92% | 100% m97% |
| trio-utility | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m95% | 100% m86% | 100% m71% | 100% m40% |
| trio-gatherers | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m96% | 100% m94% | 100% m84% | 100% m61% |
| duo-tank-heal | 100% m100% | 100% m100% | 100% m100% | 100% m96% | 100% m94% | 100% m89% | 100% m98% | 100% m96% |
| solo-tank | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m88% | 100% m69% | 83% m15% | 0 |
| solo-dps | 100% m100% | 100% m100% | 100% m93% | 100% m87% | 100% m82% | 100% m52% | 80% m29% | 0 |
| solo-crit | 100% m100% | 100% m100% | 100% m90% | 100% m82% | 100% m75% | 100% m30% | 4% m49% | 0% m29% |

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
| solo-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m98% | 100% m91% | 100% m70% | 88% m20% |
| solo-dps | 100% m100% | 100% m100% | 100% m100% | 100% m93% | 100% m86% | 100% m81% | 100% m47% | 61% m25% |
| solo-crit | 100% m100% | 100% m100% | 100% m100% | 100% m90% | 100% m80% | 100% m72% | 100% m37% | 3% m44% |


## Shape: pack

### Level 1 — pack (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m96% | 100% m90% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m75% | 100% m19% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m97% | 27% m70% | 0 | 0 | 0 | 0 | 0 | 0 |
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
| trio-core | 100% m95% | 100% m100% | 100% m94% | 2% m56% | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m88% | 100% m77% | 100% m53% | 0% m11% | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m96% | 100% m95% | 47% m63% | 0 | 0 | 0 | 0 | 0 |
| trio-casters | 100% m100% | 100% m81% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m92% | 100% m97% | 100% m100% | 0 | 0 | 0 | 0 | 0 |
| trio-utility | 100% m68% | 100% m12% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m80% | 100% m40% | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m100% | 100% m100% | 1% m100% | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 1% m5% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 4% m3% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 10 — pack (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m94% | 100% m88% | 100% m97% | 100% m97% | 41% m54% | 0 | 0 | 0 |
| trio-double-dps | 100% m94% | 100% m89% | 100% m78% | 100% m62% | 25% m14% | 0 | 0 | 0 |
| trio-no-tank | 100% m91% | 100% m98% | 100% m93% | 100% m69% | 0% m59% | 0 | 0 | 0 |
| trio-casters | 100% m91% | 100% m100% | 100% m65% | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m96% | 100% m91% | 100% m100% | 100% m96% | 3% m60% | 0 | 0 | 0 |
| trio-utility | 100% m85% | 100% m64% | 88% m9% | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m91% | 100% m81% | 100% m40% | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m87% | 100% m100% | 100% m100% | 68% m100% | 0 | 0 | 0 | 0 |
| solo-tank | 100% m53% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m39% | 1% m11% | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 100% m30% | 1% m15% | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 20 — pack (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m98% | 100% m96% | 100% m94% | 100% m96% | 100% m99% | 100% m98% | 2% m99% | 0 |
| trio-double-dps | 100% m99% | 100% m97% | 100% m96% | 100% m89% | 100% m75% | 100% m54% | 0% m24% | 0 |
| trio-no-tank | 100% m98% | 100% m95% | 100% m92% | 100% m99% | 100% m67% | 3% m67% | 0 | 0 |
| trio-casters | 100% m98% | 100% m91% | 100% m87% | 100% m93% | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m98% | 100% m97% | 100% m94% | 100% m100% | 100% m97% | 100% m95% | 0 | 0 |
| trio-utility | 100% m93% | 100% m86% | 100% m76% | 100% m44% | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m97% | 100% m93% | 100% m84% | 100% m74% | 1% m29% | 0 | 0 | 0 |
| duo-tank-heal | 100% m93% | 100% m90% | 100% m99% | 100% m100% | 100% m99% | 16% m100% | 0 | 0 |
| solo-tank | 100% m84% | 100% m67% | 55% m10% | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m86% | 100% m48% | 100% m17% | 1% m1% | 0 | 0 | 0 | 0 |
| solo-crit | 100% m82% | 100% m43% | 10% m9% | 0 | 0 | 0 | 0 | 0 |

### Level 35 — pack (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m98% | 100% m97% | 100% m95% | 100% m92% | 100% m96% | 100% m98% | 100% m95% |
| trio-double-dps | 100% m100% | 100% m99% | 100% m98% | 100% m97% | 100% m93% | 100% m84% | 100% m73% | 67% m30% |
| trio-no-tank | 100% m100% | 100% m98% | 100% m95% | 100% m92% | 100% m85% | 100% m66% | 19% m67% | 0 |
| trio-casters | 100% m98% | 100% m98% | 100% m97% | 100% m87% | 100% m82% | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m99% | 100% m98% | 100% m96% | 100% m99% | 100% m99% | 100% m100% | 100% m91% |
| trio-utility | 100% m98% | 100% m96% | 100% m94% | 100% m78% | 100% m57% | 0 | 0 | 0 |
| trio-gatherers | 100% m98% | 100% m97% | 100% m93% | 100% m85% | 100% m75% | 100% m23% | 0 | 0 |
| duo-tank-heal | 100% m99% | 100% m95% | 100% m92% | 100% m100% | 100% m99% | 100% m100% | 100% m99% | 0 |
| solo-tank | 100% m100% | 100% m94% | 100% m82% | 100% m44% | 0 | 0 | 0 | 0 |
| solo-dps | 100% m91% | 100% m87% | 100% m58% | 100% m35% | 6% m6% | 0 | 0 | 0 |
| solo-crit | 100% m87% | 100% m81% | 100% m43% | 100% m8% | 0 | 0 | 0 | 0 |

### Level 50 — pack (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m100% | 100% m99% | 100% m97% | 100% m96% | 100% m91% | 100% m95% | 100% m99% |
| trio-double-dps | 100% m100% | 100% m100% | 100% m99% | 100% m98% | 100% m97% | 100% m94% | 100% m87% | 100% m77% |
| trio-no-tank | 100% m100% | 100% m100% | 100% m98% | 100% m95% | 100% m92% | 100% m83% | 100% m69% | 65% m69% |
| trio-casters | 100% m99% | 100% m98% | 100% m98% | 100% m97% | 100% m86% | 100% m81% | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m99% | 100% m97% | 100% m98% | 100% m99% | 100% m100% |
| trio-utility | 100% m99% | 100% m98% | 100% m94% | 100% m87% | 100% m77% | 100% m46% | 2% m8% | 0 |
| trio-gatherers | 100% m99% | 100% m98% | 100% m97% | 100% m93% | 100% m84% | 100% m73% | 1% m53% | 0 |
| duo-tank-heal | 100% m99% | 100% m99% | 100% m96% | 100% m93% | 100% m98% | 100% m99% | 100% m100% | 100% m96% |
| solo-tank | 100% m100% | 100% m100% | 100% m98% | 100% m89% | 100% m55% | 3% m8% | 0 | 0 |
| solo-dps | 100% m93% | 100% m90% | 100% m86% | 100% m59% | 100% m31% | 2% m19% | 0 | 0 |
| solo-crit | 100% m89% | 100% m85% | 100% m79% | 100% m51% | 100% m20% | 0 | 0 | 0 |


## Shape: boss

### Level 1 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m96% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m51% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m97% | 100% m70% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-casters | 100% m62% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m95% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-utility | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 18% m8% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m94% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 5 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m96% | 100% m99% | 100% m94% | 45% m81% | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m83% | 100% m64% | 100% m22% | 0 | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m98% | 100% m92% | 100% m90% | 0 | 0 | 0 | 0 | 0 |
| trio-casters | 100% m88% | 100% m90% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m95% | 28% m93% | 0 | 0 | 0 | 0 |
| trio-utility | 100% m41% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m68% | 1% m11% | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m100% | 100% m94% | 1% m100% | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 10 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m92% | 100% m97% | 100% m95% | 100% m89% | 100% m97% | 0 | 0 | 0 |
| trio-double-dps | 100% m93% | 100% m87% | 100% m70% | 100% m35% | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m89% | 100% m97% | 100% m89% | 100% m63% | 0 | 0 | 0 | 0 |
| trio-casters | 100% m91% | 100% m94% | 100% m100% | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m90% | 100% m100% | 100% m100% | 100% m100% | 31% m99% | 0 | 0 | 0 |
| trio-utility | 100% m78% | 34% m7% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m82% | 100% m72% | 1% m9% | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m98% | 100% m100% | 100% m94% | 1% m100% | 0 | 0 | 0 | 0 |
| solo-tank | 100% m16% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 33% m16% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 100% m4% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 20 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m97% | 100% m95% | 100% m90% | 100% m100% | 100% m98% | 100% m96% | 80% m94% | 0 |
| trio-double-dps | 100% m98% | 100% m95% | 100% m94% | 100% m81% | 100% m66% | 85% m31% | 0 | 0 |
| trio-no-tank | 100% m97% | 100% m92% | 100% m95% | 100% m91% | 100% m95% | 1% m78% | 0 | 0 |
| trio-casters | 100% m93% | 100% m95% | 100% m87% | 100% m91% | 100% m55% | 0 | 0 | 0 |
| trio-double-tank | 100% m97% | 100% m93% | 100% m96% | 100% m100% | 100% m100% | 100% m98% | 0 | 0 |
| trio-utility | 100% m93% | 100% m81% | 100% m66% | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m96% | 100% m90% | 100% m80% | 100% m29% | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m89% | 100% m92% | 100% m99% | 100% m98% | 100% m100% | 0 | 0 | 0 |
| solo-tank | 100% m85% | 100% m52% | 3% m8% | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m64% | 100% m35% | 18% m8% | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 100% m56% | 100% m17% | 3% m8% | 0 | 0 | 0 | 0 | 0 |

### Level 35 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m99% | 100% m98% | 100% m97% | 100% m94% | 100% m91% | 100% m97% | 100% m97% | 100% m92% |
| trio-double-dps | 100% m99% | 100% m99% | 100% m97% | 100% m95% | 100% m91% | 100% m79% | 100% m57% | 2% m14% |
| trio-no-tank | 100% m98% | 100% m97% | 100% m92% | 100% m97% | 100% m91% | 100% m88% | 12% m62% | 0% m71% |
| trio-casters | 100% m95% | 100% m94% | 100% m91% | 100% m94% | 100% m82% | 100% m47% | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m98% | 100% m97% | 100% m95% | 100% m98% | 100% m100% | 100% m97% | 4% m99% |
| trio-utility | 100% m97% | 100% m93% | 100% m85% | 100% m62% | 25% m20% | 0 | 0 | 0 |
| trio-gatherers | 100% m97% | 100% m96% | 100% m94% | 100% m80% | 100% m61% | 0% m45% | 0 | 0 |
| duo-tank-heal | 100% m97% | 100% m92% | 100% m87% | 100% m100% | 100% m97% | 100% m99% | 0 | 0 |
| solo-tank | 100% m100% | 100% m97% | 100% m79% | 100% m36% | 0 | 0 | 0 | 0 |
| solo-dps | 100% m83% | 100% m71% | 100% m49% | 89% m13% | 0 | 0 | 0 | 0 |
| solo-crit | 100% m76% | 100% m61% | 100% m33% | 7% m5% | 0 | 0 | 0 | 0 |

### Level 50 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m99% | 100% m99% | 100% m98% | 100% m97% | 100% m94% | 100% m89% | 100% m99% | 100% m96% |
| trio-double-dps | 100% m99% | 100% m99% | 100% m99% | 100% m97% | 100% m96% | 100% m92% | 100% m83% | 100% m65% |
| trio-no-tank | 100% m98% | 100% m98% | 100% m97% | 100% m92% | 100% m96% | 100% m91% | 100% m70% | 54% m61% |
| trio-casters | 100% m98% | 100% m95% | 100% m93% | 100% m90% | 100% m93% | 100% m81% | 100% m45% | 0 |
| trio-double-tank | 100% m99% | 100% m100% | 100% m98% | 100% m98% | 100% m94% | 100% m99% | 100% m100% | 100% m99% |
| trio-utility | 100% m98% | 100% m97% | 100% m92% | 100% m82% | 100% m68% | 87% m21% | 0 | 0 |
| trio-gatherers | 100% m99% | 100% m97% | 100% m95% | 100% m90% | 100% m79% | 100% m54% | 0 | 0 |
| duo-tank-heal | 100% m98% | 100% m97% | 100% m93% | 100% m89% | 100% m99% | 100% m97% | 92% m99% | 0 |
| solo-tank | 100% m100% | 100% m100% | 100% m100% | 100% m86% | 100% m48% | 0 | 0 | 0 |
| solo-dps | 100% m87% | 100% m82% | 100% m72% | 100% m50% | 100% m9% | 0 | 0 | 0 |
| solo-crit | 100% m85% | 100% m73% | 100% m62% | 100% m26% | 2% m23% | 0 | 0 | 0 |

