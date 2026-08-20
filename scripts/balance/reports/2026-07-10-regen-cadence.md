# Balance sweep — 2026-07-10 (regen-cadence)

1,440,000 fights (2880 cells × 500 seeds) in 12.9s. Naked baselines (no gear, no blessings). Constants: ARMOR_K=100, TANK_THREAT_MULT=4, TANK_THREAT_STAT_RATE=3, HEALER_HEAL_THRESHOLD=0.7, MARGIN_MAX=0.5, LEVEL_BONUS=0.004, BASE_INTERVAL=3, REF_SPEED=10.

Cell format: `winRate m<avg surviving-HP% on wins>`. `0` = no wins. Matrices are the 180s time limit.

## Anomalies (auto-flagged)

- **Threat failure** in 1 cells: tank absorbs <60% of enemy attacks (worst: trio-core L1 T5 solo — 57%).
- **Timeout-heavy** (33 cells >30% timeouts): trio-no-tank L5 T4 boss@180s (99%), trio-no-tank L5 T4 boss@300s (98%), trio-no-tank L10 T5 boss@180s (65%), trio-no-tank L10 T5 boss@300s (70%), trio-no-tank L20 T7 boss@180s (47%), ….
- **Cliff** trio-core L1 pack: T2 100% → T3 0%.
- **Cliff** trio-core L1 boss: T2 100% → T3 2%.
- **Cliff** trio-core L5 solo: T6 100% → T7 2%.
- **Cliff** trio-core L5 boss: T4 100% → T5 0%.
- **Cliff** trio-core L10 boss: T5 100% → T6 6%.
- **Cliff** trio-double-dps L1 pack: T2 100% → T3 0%.
- **Cliff** trio-double-dps L1 boss: T1 100% → T2 3%.
- **Cliff** trio-double-dps L5 solo: T6 100% → T7 1%.
- **Cliff** trio-double-dps L5 boss: T3 100% → T4 0%.
- **Cliff** trio-double-dps L10 solo: T7 100% → T8 9%.
- **Cliff** trio-double-dps L10 boss: T4 100% → T5 5%.
- **Cliff** trio-double-dps L20 boss: T6 100% → T7 7%.
- **Cliff** trio-no-tank L1 solo: T4 100% → T5 7%.
- **Cliff** trio-no-tank L1 boss: T2 100% → T3 0%.
- **Cliff** trio-no-tank L5 solo: T6 91% → T7 0%.
- **Cliff** trio-no-tank L5 pack: T3 100% → T4 1%.
- **Cliff** trio-no-tank L5 boss: T3 100% → T4 1%.
- **Cliff** trio-no-tank L10 solo: T7 98% → T8 0%.
- **Cliff** trio-no-tank L20 pack: T6 97% → T7 2%.
- **Cliff** trio-casters L1 solo: T3 100% → T4 0%.
- **Cliff** trio-casters L5 solo: T4 100% → T5 0%.
- **Cliff** trio-casters L5 pack: T1 100% → T2 0%.
- **Cliff** trio-casters L5 boss: T2 100% → T3 0%.
- **Cliff** trio-casters L10 solo: T5 100% → T6 0%.
- **Cliff** trio-casters L10 pack: T2 100% → T3 0%.
- **Cliff** trio-casters L10 boss: T3 100% → T4 0%.
- **Cliff** trio-casters L20 solo: T6 100% → T7 0%.
- **Cliff** trio-casters L20 pack: T4 100% → T5 0%.
- **Cliff** trio-casters L20 boss: T4 100% → T5 0%.
- **Cliff** trio-casters L35 pack: T6 100% → T7 0%.
- **Cliff** trio-casters L35 boss: T5 100% → T6 0%.
- **Cliff** trio-casters L50 pack: T6 100% → T7 0%.
- **Cliff** trio-casters L50 boss: T6 100% → T7 0%.
- **Cliff** trio-double-tank L1 pack: T2 100% → T3 0%.
- **Cliff** trio-double-tank L1 boss: T2 100% → T3 3%.
- **Cliff** trio-double-tank L5 solo: T6 100% → T7 2%.
- **Cliff** trio-double-tank L5 boss: T4 100% → T5 0%.
- **Cliff** trio-double-tank L10 pack: T5 100% → T6 0%.
- **Cliff** trio-double-tank L20 pack: T7 95% → T8 0%.
- **Cliff** trio-double-tank L20 boss: T7 100% → T8 7%.
- **Cliff** trio-utility L1 solo: T4 100% → T5 0%.
- **Cliff** trio-utility L1 pack: T1 100% → T2 0%.
- **Cliff** trio-utility L5 solo: T4 100% → T5 7%.
- **Cliff** trio-utility L5 pack: T2 100% → T3 0%.
- **Cliff** trio-utility L5 boss: T1 100% → T2 0%.
- **Cliff** trio-utility L10 solo: T5 100% → T6 0%.
- **Cliff** trio-utility L10 pack: T3 100% → T4 0%.
- **Cliff** trio-utility L10 boss: T2 100% → T3 0%.
- **Cliff** trio-utility L20 solo: T7 100% → T8 0%.
- **Cliff** trio-utility L20 pack: T4 100% → T5 0%.
- **Cliff** trio-utility L20 boss: T4 100% → T5 0%.
- **Cliff** trio-utility L35 pack: T6 100% → T7 1%.
- **Cliff** trio-utility L35 boss: T5 100% → T6 5%.
- **Cliff** trio-utility L50 boss: T7 100% → T8 0%.
- **Cliff** trio-gatherers L1 solo: T3 100% → T4 3%.
- **Cliff** trio-gatherers L5 pack: T2 100% → T3 0%.
- **Cliff** trio-gatherers L5 boss: T1 100% → T2 0%.
- **Cliff** trio-gatherers L10 solo: T5 100% → T6 2%.
- **Cliff** trio-gatherers L10 pack: T2 100% → T3 2%.
- **Cliff** trio-gatherers L10 boss: T2 100% → T3 0%.
- **Cliff** trio-gatherers L20 pack: T4 100% → T5 0%.
- **Cliff** trio-gatherers L20 boss: T3 100% → T4 4%.
- **Cliff** trio-gatherers L35 pack: T5 100% → T6 3%.
- **Cliff** trio-gatherers L35 boss: T5 100% → T6 0%.
- **Cliff** trio-gatherers L50 pack: T6 100% → T7 4%.
- **Cliff** duo-tank-heal L1 solo: T4 99% → T5 0%.
- **Cliff** duo-tank-heal L1 pack: T1 100% → T2 0%.
- **Cliff** duo-tank-heal L1 boss: T1 100% → T2 0%.
- **Cliff** duo-tank-heal L10 solo: T7 100% → T8 0%.
- **Cliff** duo-tank-heal L10 pack: T4 100% → T5 0%.
- **Cliff** duo-tank-heal L20 pack: T6 100% → T7 0%.
- **Cliff** duo-tank-heal L20 boss: T5 100% → T6 0%.
- **Cliff** duo-tank-heal L35 boss: T6 100% → T7 1%.
- **Cliff** duo-tank-heal L50 boss: T7 99% → T8 1%.
- **Cliff** solo-tank L5 solo: T4 100% → T5 0%.
- **Cliff** solo-tank L5 pack: T1 100% → T2 2%.
- **Cliff** solo-tank L5 boss: T1 100% → T2 0%.
- **Cliff** solo-tank L10 pack: T3 100% → T4 0%.
- **Cliff** solo-tank L20 boss: T5 100% → T6 0%.
- **Clock-bound** (8 cells win ≥40pts more at 300s): duo-tank-heal L1 T2 boss, duo-tank-heal L5 T3 boss, duo-tank-heal L10 T4 boss, duo-tank-heal L10 T5 boss, duo-tank-heal L20 T6 boss, ….

## Shape: solo

### Level 1 — solo (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m96% | 100% m89% | 100% m90% | 100% m88% | 48% m50% | 0 | 0 | 0 |
| trio-double-dps | 100% m96% | 100% m90% | 100% m86% | 100% m59% | 41% m27% | 0 | 0 | 0 |
| trio-no-tank | 100% m95% | 100% m97% | 100% m86% | 100% m77% | 7% m49% | 0 | 0 | 0 |
| trio-casters | 100% m88% | 100% m79% | 100% m49% | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m95% | 100% m90% | 100% m96% | 100% m89% | 11% m47% | 0 | 0 | 0 |
| trio-utility | 100% m92% | 100% m83% | 100% m67% | 100% m18% | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m92% | 100% m85% | 100% m60% | 3% m33% | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m87% | 100% m96% | 100% m94% | 99% m67% | 0 | 0 | 0 | 0 |
| solo-tank | 100% m60% | 68% m14% | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m55% | 37% m28% | 1% m29% | 0 | 0 | 0 | 0 | 0 |

### Level 5 — solo (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m97% | 100% m90% | 100% m93% | 100% m91% | 100% m81% | 2% m59% | 0 |
| trio-double-dps | 100% m100% | 100% m96% | 100% m94% | 100% m85% | 100% m69% | 100% m40% | 1% m24% | 0 |
| trio-no-tank | 100% m100% | 100% m96% | 100% m93% | 100% m98% | 100% m76% | 91% m75% | 0% m41% | 0 |
| trio-casters | 100% m95% | 100% m87% | 100% m98% | 100% m72% | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m99% | 100% m93% | 100% m99% | 100% m100% | 100% m94% | 2% m48% | 0 |
| trio-utility | 100% m97% | 100% m90% | 100% m81% | 100% m64% | 7% m2% | 0 | 0 | 0 |
| trio-gatherers | 100% m97% | 100% m92% | 100% m82% | 100% m64% | 19% m10% | 0 | 0 | 0 |
| duo-tank-heal | 100% m93% | 100% m92% | 100% m98% | 100% m99% | 100% m99% | 24% m80% | 0 | 0 |
| solo-tank | 100% m97% | 100% m90% | 100% m66% | 100% m24% | 0 | 0 | 0 | 0 |
| solo-dps | 100% m77% | 100% m66% | 100% m27% | 11% m25% | 0 | 0 | 0 | 0 |

### Level 10 — solo (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m100% | 100% m97% | 100% m95% | 100% m96% | 100% m94% | 100% m83% | 36% m65% |
| trio-double-dps | 100% m100% | 100% m100% | 100% m96% | 100% m95% | 100% m85% | 100% m79% | 100% m44% | 9% m35% |
| trio-no-tank | 100% m100% | 100% m100% | 100% m95% | 100% m92% | 100% m80% | 100% m89% | 98% m75% | 0% m42% |
| trio-casters | 100% m100% | 100% m100% | 100% m93% | 100% m80% | 100% m91% | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m98% | 100% m95% | 100% m92% | 100% m94% | 100% m92% | 68% m69% |
| trio-utility | 100% m97% | 100% m96% | 100% m90% | 100% m79% | 100% m70% | 0 | 0 | 0 |
| trio-gatherers | 100% m98% | 100% m97% | 100% m90% | 100% m80% | 100% m45% | 2% m41% | 0 | 0 |
| duo-tank-heal | 100% m100% | 100% m94% | 100% m92% | 100% m98% | 100% m99% | 100% m99% | 100% m97% | 0 |
| solo-tank | 100% m100% | 100% m97% | 100% m92% | 100% m84% | 100% m64% | 48% m25% | 0 | 0 |
| solo-dps | 100% m91% | 100% m87% | 100% m66% | 100% m50% | 47% m23% | 1% m54% | 0 | 0 |

### Level 20 — solo (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m96% | 100% m91% | 100% m94% | 100% m91% |
| trio-double-dps | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m96% | 100% m94% | 100% m84% | 100% m73% |
| trio-no-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m93% | 100% m90% | 100% m76% | 100% m83% |
| trio-casters | 100% m100% | 100% m100% | 100% m100% | 100% m93% | 100% m90% | 100% m73% | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m98% | 100% m95% | 100% m93% | 100% m95% |
| trio-utility | 100% m100% | 100% m98% | 100% m97% | 100% m95% | 100% m86% | 100% m81% | 100% m49% | 0 |
| trio-gatherers | 100% m100% | 100% m98% | 100% m97% | 100% m91% | 100% m87% | 100% m65% | 18% m45% | 0 |
| duo-tank-heal | 100% m100% | 100% m100% | 100% m95% | 100% m93% | 100% m87% | 100% m91% | 100% m91% | 100% m88% |
| solo-tank | 100% m100% | 100% m100% | 100% m99% | 100% m99% | 100% m92% | 100% m92% | 100% m60% | 72% m16% |
| solo-dps | 100% m100% | 100% m92% | 100% m88% | 100% m84% | 100% m64% | 100% m37% | 21% m47% | 3% m19% |

### Level 35 — solo (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m96% | 100% m89% |
| trio-double-dps | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m96% | 100% m94% |
| trio-no-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m94% | 100% m92% | 100% m88% |
| trio-casters | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m91% | 100% m87% | 100% m82% |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m99% | 100% m99% | 100% m96% |
| trio-utility | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m96% | 100% m94% | 100% m92% | 100% m75% |
| trio-gatherers | 100% m100% | 100% m100% | 100% m98% | 100% m97% | 100% m96% | 100% m87% | 100% m82% | 100% m61% |
| duo-tank-heal | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m95% | 100% m94% | 100% m89% | 100% m100% |
| solo-tank | 100% m100% | 100% m100% | 100% m100% | 100% m99% | 100% m99% | 100% m99% | 100% m93% | 100% m94% |
| solo-dps | 100% m100% | 100% m100% | 100% m94% | 100% m91% | 100% m88% | 100% m82% | 100% m53% | 70% m55% |

### Level 50 — solo (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m98% | 100% m97% |
| trio-double-dps | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m98% | 100% m98% | 100% m96% |
| trio-no-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m94% | 100% m92% |
| trio-casters | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m90% | 100% m86% |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m99% | 100% m99% |
| trio-utility | 100% m100% | 100% m100% | 100% m100% | 100% m98% | 100% m97% | 100% m96% | 100% m95% | 100% m93% |
| trio-gatherers | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m96% | 100% m95% | 100% m93% | 100% m81% |
| duo-tank-heal | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m96% | 100% m95% | 100% m86% |
| solo-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m99% | 100% m99% | 100% m99% | 100% m99% |
| solo-dps | 100% m100% | 100% m100% | 100% m100% | 100% m95% | 100% m92% | 100% m90% | 100% m86% | 100% m80% |


## Shape: pack

### Level 1 — pack (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m88% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m76% | 100% m34% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m98% | 59% m71% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-casters | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m85% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-utility | 100% m41% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 43% m28% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m99% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 5 — pack (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m89% | 100% m99% | 100% m100% | 42% m61% | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m90% | 100% m78% | 100% m57% | 14% m17% | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m96% | 100% m87% | 100% m70% | 1% m72% | 0 | 0 | 0 | 0 |
| trio-casters | 100% m92% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m94% | 100% m100% | 100% m100% | 72% m67% | 0 | 0 | 0 | 0 |
| trio-utility | 100% m75% | 100% m36% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m73% | 100% m17% | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m100% | 100% m96% | 57% m95% | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 100% m52% | 2% m11% | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 17% m7% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 10 — pack (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m95% | 100% m91% | 100% m97% | 100% m100% | 77% m85% | 0 | 0 | 0 |
| trio-double-dps | 100% m96% | 100% m92% | 100% m80% | 100% m69% | 72% m27% | 0 | 0 | 0 |
| trio-no-tank | 100% m94% | 100% m94% | 100% m84% | 100% m87% | 37% m84% | 0 | 0 | 0 |
| trio-casters | 100% m100% | 100% m88% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m99% | 100% m96% | 100% m96% | 100% m100% | 100% m96% | 0% m55% | 0 | 0 |
| trio-utility | 100% m85% | 100% m72% | 100% m31% | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m86% | 100% m76% | 2% m34% | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m88% | 100% m99% | 100% m96% | 100% m95% | 0 | 0 | 0 | 0 |
| solo-tank | 100% m92% | 100% m66% | 100% m39% | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m45% | 54% m12% | 0% m9% | 0 | 0 | 0 | 0 | 0 |

### Level 20 — pack (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m99% | 100% m97% | 100% m94% | 100% m92% | 100% m97% | 100% m98% | 66% m90% | 0% m34% |
| trio-double-dps | 100% m99% | 100% m97% | 100% m96% | 100% m89% | 100% m80% | 100% m66% | 47% m30% | 0 |
| trio-no-tank | 100% m100% | 100% m95% | 100% m93% | 100% m86% | 100% m89% | 97% m90% | 2% m88% | 0 |
| trio-casters | 100% m97% | 100% m89% | 100% m85% | 100% m58% | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m99% | 100% m96% | 100% m97% | 100% m97% | 95% m98% | 0% m94% |
| trio-utility | 100% m97% | 100% m90% | 100% m83% | 100% m71% | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m95% | 100% m88% | 100% m79% | 100% m23% | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m95% | 100% m91% | 100% m99% | 100% m97% | 100% m99% | 100% m99% | 0 | 0 |
| solo-tank | 100% m100% | 100% m99% | 100% m93% | 100% m83% | 100% m53% | 18% m17% | 0 | 0 |
| solo-dps | 100% m88% | 100% m69% | 100% m55% | 60% m23% | 2% m14% | 0 | 0 | 0 |

### Level 35 — pack (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m99% | 100% m98% | 100% m97% | 100% m94% | 100% m94% | 100% m96% | 100% m95% |
| trio-double-dps | 100% m100% | 100% m99% | 100% m98% | 100% m97% | 100% m96% | 100% m88% | 100% m79% | 100% m65% |
| trio-no-tank | 100% m100% | 100% m100% | 100% m96% | 100% m94% | 100% m92% | 100% m77% | 100% m86% | 74% m80% |
| trio-casters | 100% m98% | 100% m98% | 100% m93% | 100% m90% | 100% m80% | 100% m53% | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m99% | 100% m95% | 100% m96% | 100% m97% |
| trio-utility | 100% m98% | 100% m97% | 100% m96% | 100% m88% | 100% m83% | 100% m69% | 1% m9% | 0 |
| trio-gatherers | 100% m98% | 100% m97% | 100% m91% | 100% m87% | 100% m70% | 3% m10% | 0 | 0 |
| duo-tank-heal | 100% m99% | 100% m96% | 100% m93% | 100% m91% | 100% m98% | 100% m99% | 100% m99% | 17% m97% |
| solo-tank | 100% m100% | 100% m100% | 100% m100% | 100% m98% | 100% m96% | 100% m89% | 100% m58% | 47% m17% |
| solo-dps | 100% m93% | 100% m91% | 100% m76% | 100% m66% | 93% m42% | 55% m26% | 5% m21% | 0 |

### Level 50 — pack (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m100% | 100% m99% | 100% m98% | 100% m98% | 100% m97% | 100% m90% | 100% m98% |
| trio-double-dps | 100% m100% | 100% m100% | 100% m99% | 100% m98% | 100% m97% | 100% m95% | 100% m91% | 100% m84% |
| trio-no-tank | 100% m100% | 100% m100% | 100% m100% | 100% m96% | 100% m94% | 100% m92% | 100% m83% | 100% m93% |
| trio-casters | 100% m99% | 100% m98% | 100% m97% | 100% m93% | 100% m90% | 100% m79% | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m99% | 100% m98% | 100% m94% |
| trio-utility | 100% m99% | 100% m98% | 100% m97% | 100% m94% | 100% m92% | 100% m88% | 100% m76% | 100% m56% |
| trio-gatherers | 100% m98% | 100% m97% | 100% m96% | 100% m92% | 100% m86% | 100% m72% | 4% m55% | 0 |
| duo-tank-heal | 100% m99% | 100% m99% | 100% m97% | 100% m95% | 100% m92% | 100% m98% | 100% m99% | 100% m99% |
| solo-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m98% | 100% m94% | 100% m82% |
| solo-dps | 100% m96% | 100% m95% | 100% m93% | 100% m86% | 100% m79% | 100% m60% | 83% m32% | 26% m24% |


## Shape: boss

### Level 1 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m96% | 100% m95% | 2% m71% | 0 | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m57% | 3% m15% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m97% | 100% m74% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-casters | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m99% | 100% m94% | 3% m66% | 0 | 0 | 0 | 0 | 0 |
| trio-utility | 2% m9% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m99% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 5 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m98% | 100% m99% | 100% m97% | 100% m94% | 0% m70% | 0 | 0 | 0 |
| trio-double-dps | 100% m85% | 100% m66% | 100% m34% | 0 | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m94% | 100% m96% | 100% m77% | 1% m62% | 0 | 0 | 0 | 0 |
| trio-casters | 100% m93% | 100% m80% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m95% | 100% m98% | 100% m96% | 100% m98% | 0 | 0 | 0 | 0 |
| trio-utility | 100% m60% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m50% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m98% | 100% m99% | 16% m98% | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 100% m22% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 1% m8% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 10 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m93% | 100% m86% | 100% m95% | 100% m100% | 100% m92% | 6% m87% | 0 | 0 |
| trio-double-dps | 100% m94% | 100% m89% | 100% m72% | 100% m48% | 5% m23% | 0 | 0 | 0 |
| trio-no-tank | 100% m96% | 100% m89% | 100% m100% | 100% m92% | 35% m74% | 0 | 0 | 0 |
| trio-casters | 100% m100% | 100% m92% | 100% m77% | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m99% | 100% m94% | 100% m97% | 100% m96% | 100% m94% | 32% m91% | 0 | 0 |
| trio-utility | 100% m81% | 100% m61% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m81% | 100% m38% | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m97% | 100% m99% | 100% m99% | 42% m99% | 0 | 0 | 0 | 0 |
| solo-tank | 100% m96% | 100% m79% | 87% m23% | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m26% | 14% m17% | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 20 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m97% | 100% m96% | 100% m92% | 100% m89% | 100% m97% | 100% m97% | 100% m94% | 12% m84% |
| trio-double-dps | 100% m98% | 100% m96% | 100% m94% | 100% m86% | 100% m74% | 100% m49% | 7% m18% | 0 |
| trio-no-tank | 100% m97% | 100% m93% | 100% m95% | 100% m92% | 100% m88% | 94% m81% | 50% m82% | 0 |
| trio-casters | 100% m92% | 100% m95% | 100% m85% | 100% m88% | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m99% | 100% m98% | 100% m97% | 100% m96% | 100% m98% | 7% m92% |
| trio-utility | 100% m95% | 100% m88% | 100% m77% | 100% m37% | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m93% | 100% m85% | 100% m69% | 4% m43% | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m92% | 100% m87% | 100% m97% | 100% m98% | 100% m99% | 0% m89% | 0 | 0 |
| solo-tank | 100% m99% | 100% m98% | 100% m99% | 100% m75% | 100% m41% | 0% m10% | 0 | 0 |
| solo-dps | 100% m78% | 100% m58% | 82% m31% | 4% m19% | 0% m20% | 0 | 0 | 0 |

### Level 35 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m99% | 100% m99% | 100% m97% | 100% m96% | 100% m92% | 100% m91% | 100% m96% | 100% m96% |
| trio-double-dps | 100% m99% | 100% m99% | 100% m98% | 100% m96% | 100% m92% | 100% m84% | 100% m72% | 100% m40% |
| trio-no-tank | 100% m98% | 100% m98% | 100% m97% | 100% m96% | 100% m99% | 100% m87% | 100% m86% | 100% m87% |
| trio-casters | 100% m97% | 100% m96% | 100% m90% | 100% m86% | 100% m90% | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m99% | 100% m97% | 100% m96% | 100% m96% |
| trio-utility | 100% m98% | 100% m98% | 100% m92% | 100% m89% | 100% m77% | 5% m20% | 0 | 0 |
| trio-gatherers | 100% m97% | 100% m95% | 100% m88% | 100% m78% | 100% m47% | 0 | 0 | 0 |
| duo-tank-heal | 100% m98% | 100% m95% | 100% m90% | 100% m92% | 100% m96% | 100% m99% | 1% m95% | 0 |
| solo-tank | 100% m100% | 100% m100% | 100% m100% | 100% m98% | 100% m95% | 100% m84% | 100% m54% | 12% m21% |
| solo-dps | 100% m89% | 100% m83% | 100% m77% | 100% m53% | 68% m30% | 13% m27% | 1% m37% | 0% m100% |

### Level 50 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m99% | 100% m99% | 100% m99% | 100% m97% | 100% m95% | 100% m89% | 100% m99% |
| trio-double-dps | 100% m99% | 100% m99% | 100% m99% | 100% m99% | 100% m98% | 100% m93% | 100% m91% | 100% m77% |
| trio-no-tank | 100% m99% | 100% m98% | 100% m98% | 100% m97% | 100% m96% | 100% m90% | 100% m94% | 100% m94% |
| trio-casters | 100% m98% | 100% m97% | 100% m96% | 100% m89% | 100% m85% | 100% m100% | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m96% |
| trio-utility | 100% m99% | 100% m99% | 100% m98% | 100% m92% | 100% m88% | 100% m84% | 100% m61% | 0 |
| trio-gatherers | 100% m99% | 100% m98% | 100% m95% | 100% m91% | 100% m82% | 31% m58% | 0 | 0 |
| duo-tank-heal | 100% m99% | 100% m98% | 100% m95% | 100% m92% | 100% m86% | 100% m97% | 99% m98% | 1% m94% |
| solo-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m99% | 100% m92% | 100% m77% |
| solo-dps | 100% m96% | 100% m95% | 100% m93% | 100% m82% | 100% m75% | 89% m48% | 34% m44% | 5% m50% |

