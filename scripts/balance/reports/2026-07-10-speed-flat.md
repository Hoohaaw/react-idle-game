# Balance sweep — 2026-07-10 (speed-flat)

1,440,000 fights (2880 cells × 500 seeds) in 9.8s. Naked baselines (no gear, no blessings). Constants: ARMOR_K=100, TANK_THREAT_MULT=4, MARGIN_MAX=0.5, LEVEL_BONUS=0.004, BASE_INTERVAL=3, REF_SPEED=10.

Cell format: `winRate m<avg surviving-HP% on wins>`. `0` = no wins. Matrices are the 60s time limit.

## Anomalies (auto-flagged)

- **Threat failure** in 99 cells: tank absorbs <60% of enemy attacks (worst: trio-core L20 T4 boss — 21%).
- **Timeout-heavy** (87 cells >30% timeouts): trio-core L10 T5 pack@60s (36%), trio-core L10 T5 boss@60s (86%), trio-core L10 T5 boss@180s (35%), trio-core L20 T6 boss@60s (60%), trio-core L20 T7 boss@60s (93%), ….
- **Healer inversion** L10 T5 pack: trio-core 48% vs trio-double-dps 66% — the healer slot is a downgrade.
- **Healer inversion** L20 T6 pack: trio-core 73% vs trio-double-dps 100% — the healer slot is a downgrade.
- **Healer inversion** L35 T8 pack: trio-core 20% vs trio-double-dps 65% — the healer slot is a downgrade.
- **Healer inversion** L50 T8 boss: trio-core 85% vs trio-double-dps 100% — the healer slot is a downgrade.
- **Cliff** trio-core L1 pack: T2 100% → T3 0%.
- **Cliff** trio-core L1 boss: T2 100% → T3 0%.
- **Cliff** trio-core L5 solo: T6 100% → T7 2%.
- **Cliff** trio-core L10 solo: T7 100% → T8 1%.
- **Cliff** trio-double-dps L1 pack: T2 100% → T3 0%.
- **Cliff** trio-double-dps L1 boss: T1 100% → T2 1%.
- **Cliff** trio-double-dps L5 solo: T6 100% → T7 1%.
- **Cliff** trio-double-dps L5 boss: T3 100% → T4 0%.
- **Cliff** trio-double-dps L10 solo: T7 100% → T8 4%.
- **Cliff** trio-double-dps L10 boss: T4 100% → T5 1%.
- **Cliff** trio-double-dps L20 pack: T6 100% → T7 2%.
- **Cliff** trio-no-tank L1 solo: T4 100% → T5 5%.
- **Cliff** trio-no-tank L5 solo: T6 91% → T7 0%.
- **Cliff** trio-no-tank L5 boss: T3 100% → T4 2%.
- **Cliff** trio-no-tank L10 solo: T7 97% → T8 1%.
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
- **Cliff** trio-double-tank L1 solo: T4 100% → T5 6%.
- **Cliff** trio-double-tank L5 solo: T6 100% → T7 3%.
- **Cliff** trio-double-tank L5 pack: T3 100% → T4 9%.
- **Cliff** trio-double-tank L5 boss: T3 100% → T4 0%.
- **Cliff** trio-double-tank L10 pack: T5 100% → T6 1%.
- **Cliff** trio-double-tank L10 boss: T5 100% → T6 0%.
- **Cliff** trio-double-tank L20 pack: T7 93% → T8 9%.
- **Cliff** trio-double-tank L20 boss: T7 100% → T8 0%.
- **Cliff** trio-utility L1 solo: T4 100% → T5 0%.
- **Cliff** trio-utility L1 pack: T1 100% → T2 0%.
- **Cliff** trio-utility L5 solo: T4 100% → T5 1%.
- **Cliff** trio-utility L5 pack: T2 100% → T3 0%.
- **Cliff** trio-utility L5 boss: T1 100% → T2 0%.
- **Cliff** trio-utility L10 solo: T5 100% → T6 0%.
- **Cliff** trio-utility L10 pack: T3 100% → T4 0%.
- **Cliff** trio-utility L10 boss: T2 100% → T3 0%.
- **Cliff** trio-utility L20 solo: T7 100% → T8 0%.
- **Cliff** trio-utility L20 boss: T4 100% → T5 0%.
- **Cliff** trio-utility L35 pack: T7 100% → T8 0%.
- **Cliff** trio-utility L35 boss: T6 100% → T7 0%.
- **Cliff** trio-utility L50 boss: T7 100% → T8 0%.
- **Cliff** trio-gatherers L1 solo: T3 100% → T4 2%.
- **Cliff** trio-gatherers L5 pack: T2 100% → T3 0%.
- **Cliff** trio-gatherers L5 boss: T1 100% → T2 0%.
- **Cliff** trio-gatherers L10 solo: T5 100% → T6 3%.
- **Cliff** trio-gatherers L10 pack: T2 100% → T3 2%.
- **Cliff** trio-gatherers L10 boss: T2 100% → T3 0%.
- **Cliff** trio-gatherers L20 pack: T4 100% → T5 0%.
- **Cliff** trio-gatherers L20 boss: T3 100% → T4 9%.
- **Cliff** trio-gatherers L35 pack: T5 100% → T6 0%.
- **Cliff** trio-gatherers L35 boss: T5 100% → T6 0%.
- **Cliff** trio-gatherers L50 pack: T6 100% → T7 3%.
- **Cliff** duo-tank-heal L1 solo: T3 100% → T4 0%.
- **Cliff** duo-tank-heal L10 pack: T2 100% → T3 10%.
- **Cliff** duo-tank-heal L10 boss: T1 100% → T2 0%.
- **Cliff** duo-tank-heal L20 solo: T7 100% → T8 0%.
- **Cliff** duo-tank-heal L20 pack: T4 100% → T5 0%.
- **Cliff** duo-tank-heal L20 boss: T2 100% → T3 3%.
- **Cliff** duo-tank-heal L35 pack: T5 100% → T6 0%.
- **Cliff** duo-tank-heal L50 pack: T6 100% → T7 0%.
- **Cliff** duo-tank-heal L50 boss: T4 100% → T5 4%.
- **Cliff** solo-tank L5 solo: T4 100% → T5 0%.
- **Cliff** solo-tank L5 pack: T1 100% → T2 3%.
- **Cliff** solo-tank L5 boss: T1 100% → T2 0%.
- **Cliff** solo-tank L10 pack: T3 100% → T4 4%.
- **Cliff** solo-tank L10 boss: T3 100% → T4 1%.
- **Cliff** solo-tank L20 pack: T6 100% → T7 0%.
- **Cliff** solo-tank L20 boss: T6 100% → T7 0%.
- **Clock-bound** (39 cells win ≥40pts more at 180s): trio-core L10 T5 boss, trio-core L20 T6 boss, trio-core L35 T8 pack, trio-no-tank L1 T2 boss, trio-double-tank L1 T1 boss, ….

## Shape: solo

### Level 1 — solo (60s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m96% | 100% m100% | 100% m93% | 100% m87% | 38% m48% | 0 | 0 | 0 |
| trio-double-dps | 100% m96% | 100% m90% | 100% m85% | 100% m58% | 48% m26% | 0 | 0 | 0 |
| trio-no-tank | 100% m95% | 100% m98% | 100% m86% | 100% m76% | 5% m47% | 0 | 0 | 0 |
| trio-casters | 100% m88% | 100% m79% | 100% m48% | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m96% | 100% m92% | 100% m89% | 6% m45% | 0 | 0 | 0 |
| trio-utility | 100% m92% | 100% m83% | 100% m67% | 100% m16% | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m92% | 100% m84% | 100% m58% | 2% m34% | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m100% | 100% m99% | 100% m92% | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 100% m53% | 46% m9% | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m55% | 36% m29% | 0% m29% | 0 | 0 | 0 | 0 | 0 |

### Level 5 — solo (60s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m97% | 100% m90% | 100% m95% | 100% m90% | 100% m79% | 2% m44% | 0 |
| trio-double-dps | 100% m100% | 100% m96% | 100% m94% | 100% m85% | 100% m69% | 100% m40% | 1% m17% | 0 |
| trio-no-tank | 100% m100% | 100% m96% | 100% m93% | 100% m98% | 100% m76% | 91% m75% | 0 | 0 |
| trio-casters | 100% m95% | 100% m87% | 100% m98% | 100% m72% | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m99% | 100% m100% | 100% m95% | 100% m100% | 100% m95% | 3% m43% | 0 |
| trio-utility | 100% m97% | 100% m91% | 100% m82% | 100% m65% | 1% m13% | 0 | 0 | 0 |
| trio-gatherers | 100% m97% | 100% m92% | 100% m82% | 100% m65% | 18% m8% | 0 | 0 | 0 |
| duo-tank-heal | 100% m100% | 100% m96% | 100% m94% | 100% m100% | 16% m100% | 0 | 0 | 0 |
| solo-tank | 100% m97% | 100% m89% | 100% m67% | 100% m24% | 0 | 0 | 0 | 0 |
| solo-dps | 100% m78% | 100% m65% | 100% m27% | 11% m28% | 0 | 0 | 0 | 0 |

### Level 10 — solo (60s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m100% | 100% m97% | 100% m95% | 100% m99% | 100% m93% | 100% m76% | 1% m54% |
| trio-double-dps | 100% m100% | 100% m100% | 100% m97% | 100% m95% | 100% m85% | 100% m79% | 100% m43% | 4% m41% |
| trio-no-tank | 100% m100% | 100% m100% | 100% m95% | 100% m92% | 100% m80% | 100% m89% | 97% m73% | 1% m64% |
| trio-casters | 100% m100% | 100% m100% | 100% m93% | 100% m80% | 100% m91% | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m99% | 100% m96% | 100% m100% | 100% m94% | 100% m92% | 70% m83% |
| trio-utility | 100% m97% | 100% m96% | 100% m90% | 100% m80% | 100% m73% | 0 | 0 | 0 |
| trio-gatherers | 100% m98% | 100% m97% | 100% m91% | 100% m81% | 100% m44% | 3% m42% | 0 | 0 |
| duo-tank-heal | 100% m100% | 100% m100% | 100% m96% | 100% m95% | 100% m100% | 16% m100% | 0 | 0 |
| solo-tank | 100% m100% | 100% m99% | 100% m96% | 100% m90% | 100% m75% | 75% m33% | 0 | 0 |
| solo-dps | 100% m91% | 100% m87% | 100% m67% | 100% m49% | 48% m20% | 1% m50% | 0 | 0 |

### Level 20 — solo (60s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m96% | 100% m90% | 100% m95% | 100% m85% |
| trio-double-dps | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m96% | 100% m94% | 100% m82% | 100% m72% |
| trio-no-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m93% | 100% m90% | 100% m76% | 100% m83% |
| trio-casters | 100% m100% | 100% m100% | 100% m100% | 100% m93% | 100% m90% | 100% m73% | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m99% | 100% m99% | 100% m100% | 100% m98% |
| trio-utility | 100% m100% | 100% m98% | 100% m97% | 100% m95% | 100% m86% | 100% m81% | 100% m61% | 0 |
| trio-gatherers | 100% m100% | 100% m98% | 100% m97% | 100% m91% | 100% m87% | 100% m65% | 20% m47% | 0 |
| duo-tank-heal | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m100% | 100% m94% | 100% m92% | 0% m85% |
| solo-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m98% | 100% m100% | 100% m88% | 100% m60% |
| solo-dps | 100% m100% | 100% m92% | 100% m88% | 100% m84% | 100% m62% | 100% m36% | 21% m45% | 2% m36% |

### Level 35 — solo (60s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m96% | 100% m88% |
| trio-double-dps | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m96% | 100% m94% |
| trio-no-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m94% | 100% m92% | 100% m88% |
| trio-casters | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m91% | 100% m87% | 100% m82% |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m99% |
| trio-utility | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m96% | 100% m94% | 100% m92% | 100% m75% |
| trio-gatherers | 100% m100% | 100% m100% | 100% m98% | 100% m97% | 100% m96% | 100% m88% | 100% m83% | 100% m61% |
| duo-tank-heal | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% |
| solo-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m99% | 100% m100% |
| solo-dps | 100% m100% | 100% m100% | 100% m94% | 100% m91% | 100% m88% | 100% m83% | 100% m52% | 69% m58% |

### Level 50 — solo (60s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m98% | 100% m97% |
| trio-double-dps | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m98% | 100% m97% | 100% m97% |
| trio-no-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m94% | 100% m92% |
| trio-casters | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m90% | 100% m86% |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% |
| trio-utility | 100% m100% | 100% m100% | 100% m100% | 100% m98% | 100% m97% | 100% m96% | 100% m95% | 100% m93% |
| trio-gatherers | 100% m100% | 100% m100% | 100% m100% | 100% m98% | 100% m97% | 100% m95% | 100% m94% | 100% m82% |
| duo-tank-heal | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m96% |
| solo-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% |
| solo-dps | 100% m100% | 100% m100% | 100% m100% | 100% m96% | 100% m94% | 100% m90% | 100% m87% | 100% m81% |


## Shape: pack

### Level 1 — pack (60s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m85% | 0% m57% | 0 | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m74% | 100% m35% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m98% | 68% m71% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-casters | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m98% | 18% m99% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-utility | 100% m38% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 39% m26% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 5 — pack (60s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m98% | 100% m99% | 100% m98% | 42% m59% | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m90% | 100% m77% | 100% m57% | 16% m15% | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m98% | 100% m87% | 66% m73% | 1% m73% | 0 | 0 | 0 | 0 |
| trio-casters | 100% m92% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m99% | 100% m100% | 100% m100% | 9% m100% | 0 | 0 | 0 | 0 |
| trio-utility | 100% m77% | 100% m40% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m74% | 100% m14% | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m100% | 11% m96% | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 100% m52% | 3% m9% | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 15% m6% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 10 — pack (60s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m99% | 100% m97% | 100% m96% | 100% m97% | 48% m84% | 0 | 0 | 0 |
| trio-double-dps | 100% m96% | 100% m91% | 100% m79% | 100% m68% | 66% m27% | 0 | 0 | 0 |
| trio-no-tank | 100% m94% | 100% m96% | 100% m86% | 100% m88% | 41% m82% | 0 | 0 | 0 |
| trio-casters | 100% m100% | 100% m88% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 1% m100% | 0 | 0 |
| trio-utility | 100% m87% | 100% m75% | 100% m30% | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m87% | 100% m78% | 2% m35% | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m98% | 100% m100% | 10% m96% | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 100% m100% | 100% m81% | 100% m54% | 4% m15% | 0 | 0 | 0 | 0 |
| solo-dps | 100% m44% | 58% m14% | 0% m9% | 0 | 0 | 0 | 0 | 0 |

### Level 20 — pack (60s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m99% | 100% m97% | 100% m94% | 100% m96% | 100% m89% | 73% m85% | 1% m82% | 0 |
| trio-double-dps | 100% m99% | 100% m97% | 100% m96% | 100% m88% | 100% m78% | 100% m61% | 2% m24% | 0 |
| trio-no-tank | 100% m100% | 100% m95% | 100% m93% | 100% m86% | 100% m90% | 97% m91% | 2% m93% | 0 |
| trio-casters | 100% m97% | 100% m89% | 100% m85% | 100% m58% | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m98% | 93% m100% | 9% m95% |
| trio-utility | 100% m97% | 100% m91% | 100% m84% | 100% m73% | 11% m13% | 0 | 0 | 0 |
| trio-gatherers | 100% m96% | 100% m89% | 100% m81% | 100% m25% | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m99% | 100% m99% | 100% m100% | 100% m97% | 0 | 0 | 0 | 0 |
| solo-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m95% | 100% m63% | 0% m17% | 0 |
| solo-dps | 100% m89% | 100% m68% | 100% m53% | 54% m23% | 2% m14% | 0 | 0 | 0 |

### Level 35 — pack (60s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m99% | 100% m98% | 100% m97% | 100% m94% | 100% m93% | 100% m90% | 20% m84% |
| trio-double-dps | 100% m100% | 100% m99% | 100% m98% | 100% m97% | 100% m96% | 100% m86% | 100% m75% | 65% m60% |
| trio-no-tank | 100% m100% | 100% m100% | 100% m96% | 100% m94% | 100% m92% | 100% m77% | 100% m87% | 62% m82% |
| trio-casters | 100% m98% | 100% m98% | 100% m93% | 100% m90% | 100% m80% | 100% m53% | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m99% |
| trio-utility | 100% m98% | 100% m97% | 100% m96% | 100% m88% | 100% m84% | 100% m71% | 100% m51% | 0 |
| trio-gatherers | 100% m98% | 100% m97% | 100% m91% | 100% m88% | 100% m74% | 0% m24% | 0 | 0 |
| duo-tank-heal | 100% m100% | 100% m99% | 100% m99% | 100% m99% | 100% m100% | 0 | 0 | 0 |
| solo-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m99% | 100% m100% |
| solo-dps | 100% m94% | 100% m91% | 100% m75% | 100% m65% | 94% m41% | 58% m24% | 2% m14% | 0 |

### Level 50 — pack (60s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m100% | 100% m99% | 100% m98% | 100% m98% | 100% m97% | 100% m96% | 100% m97% |
| trio-double-dps | 100% m100% | 100% m100% | 100% m99% | 100% m98% | 100% m97% | 100% m95% | 100% m91% | 100% m83% |
| trio-no-tank | 100% m100% | 100% m100% | 100% m100% | 100% m96% | 100% m94% | 100% m92% | 100% m83% | 100% m93% |
| trio-casters | 100% m99% | 100% m98% | 100% m97% | 100% m93% | 100% m90% | 100% m79% | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% |
| trio-utility | 100% m99% | 100% m98% | 100% m97% | 100% m94% | 100% m92% | 100% m88% | 100% m78% | 100% m58% |
| trio-gatherers | 100% m98% | 100% m98% | 100% m97% | 100% m93% | 100% m87% | 100% m73% | 3% m72% | 0 |
| duo-tank-heal | 100% m100% | 100% m100% | 100% m99% | 100% m99% | 100% m99% | 100% m100% | 0 | 0 |
| solo-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% |
| solo-dps | 100% m96% | 100% m95% | 100% m93% | 100% m85% | 100% m81% | 100% m61% | 82% m37% | 31% m24% |


## Shape: boss

### Level 1 — boss (60s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m95% | 100% m95% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m55% | 1% m22% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m97% | 34% m90% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-casters | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 0% m96% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-utility | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 5 — boss (60s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m97% | 100% m95% | 86% m85% | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m84% | 100% m65% | 100% m29% | 0 | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m95% | 100% m97% | 100% m79% | 2% m81% | 0 | 0 | 0 | 0 |
| trio-casters | 100% m93% | 100% m80% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m95% | 0 | 0 | 0 | 0 | 0 |
| trio-utility | 100% m67% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m58% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 100% m22% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 2% m9% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 10 — boss (60s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m98% | 100% m93% | 100% m98% | 14% m86% | 0 | 0 | 0 |
| trio-double-dps | 100% m94% | 100% m88% | 100% m70% | 100% m43% | 1% m27% | 0 | 0 | 0 |
| trio-no-tank | 100% m100% | 100% m96% | 100% m100% | 100% m89% | 31% m74% | 0% m74% | 0 | 0 |
| trio-casters | 100% m100% | 100% m92% | 100% m77% | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m98% | 100% m95% | 0 | 0 | 0 |
| trio-utility | 100% m85% | 100% m68% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m83% | 100% m54% | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m98% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 100% m100% | 100% m97% | 100% m55% | 1% m21% | 0 | 0 | 0 | 0 |
| solo-dps | 100% m27% | 16% m15% | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 20 — boss (60s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m97% | 100% m99% | 100% m95% | 100% m97% | 100% m93% | 40% m86% | 7% m91% | 0 |
| trio-double-dps | 100% m98% | 100% m95% | 100% m93% | 100% m83% | 100% m69% | 12% m52% | 0% m31% | 0 |
| trio-no-tank | 100% m97% | 100% m93% | 100% m99% | 100% m92% | 100% m88% | 93% m80% | 48% m79% | 0 |
| trio-casters | 100% m92% | 100% m95% | 100% m85% | 100% m88% | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m98% | 100% m97% | 100% m95% | 0 |
| trio-utility | 100% m96% | 100% m90% | 100% m82% | 100% m67% | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m94% | 100% m87% | 100% m76% | 9% m45% | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m100% | 100% m100% | 3% m97% | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 100% m100% | 100% m100% | 100% m100% | 100% m98% | 100% m100% | 100% m72% | 0 | 0 |
| solo-dps | 100% m79% | 100% m58% | 83% m33% | 7% m15% | 0% m9% | 0% m3% | 0 | 0 |

### Level 35 — boss (60s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m99% | 100% m99% | 100% m97% | 100% m99% | 100% m96% | 100% m97% | 70% m94% | 33% m96% |
| trio-double-dps | 100% m99% | 100% m99% | 100% m98% | 100% m96% | 100% m91% | 100% m81% | 78% m64% | 26% m46% |
| trio-no-tank | 100% m98% | 100% m98% | 100% m97% | 100% m96% | 100% m99% | 100% m88% | 100% m86% | 100% m83% |
| trio-casters | 100% m97% | 100% m96% | 100% m90% | 100% m86% | 100% m90% | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m98% |
| trio-utility | 100% m98% | 100% m98% | 100% m93% | 100% m91% | 100% m81% | 100% m59% | 0 | 0 |
| trio-gatherers | 100% m97% | 100% m96% | 100% m90% | 100% m81% | 100% m49% | 0 | 0 | 0 |
| duo-tank-heal | 100% m99% | 100% m99% | 100% m99% | 24% m98% | 0 | 0 | 0 | 0 |
| solo-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m98% | 100% m100% | 100% m100% |
| solo-dps | 100% m89% | 100% m83% | 100% m77% | 100% m56% | 70% m30% | 13% m27% | 1% m16% | 0 |

### Level 50 — boss (60s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m99% | 100% m99% | 100% m99% | 100% m98% | 100% m96% | 100% m95% | 85% m98% |
| trio-double-dps | 100% m99% | 100% m99% | 100% m99% | 100% m99% | 100% m98% | 100% m92% | 100% m90% | 100% m74% |
| trio-no-tank | 100% m99% | 100% m98% | 100% m98% | 100% m97% | 100% m96% | 100% m90% | 100% m96% | 100% m94% |
| trio-casters | 100% m98% | 100% m97% | 100% m96% | 100% m89% | 100% m85% | 100% m100% | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% |
| trio-utility | 100% m99% | 100% m99% | 100% m98% | 100% m92% | 100% m89% | 100% m86% | 100% m66% | 0 |
| trio-gatherers | 100% m99% | 100% m99% | 100% m96% | 100% m93% | 100% m84% | 33% m59% | 0 | 0 |
| duo-tank-heal | 100% m100% | 100% m100% | 100% m99% | 100% m100% | 4% m100% | 0 | 0 | 0 |
| solo-tank | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m100% | 100% m99% | 100% m100% |
| solo-dps | 100% m96% | 100% m94% | 100% m92% | 100% m82% | 100% m75% | 88% m50% | 35% m41% | 7% m44% |

