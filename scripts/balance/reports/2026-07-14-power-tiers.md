# Balance sweep — 2026-07-14 (power-tiers)

1,900,800 fights (9504 cells × 200 seeds) in 16.0s. Naked baselines (no gear, no blessings). Constants: ARMOR_K=100, TANK_THREAT_MULT=4, TANK_THREAT_STAT_RATE=3, HEALER_HEAL_THRESHOLD=0.7, DODGE_CAP=25, SPEED_DR_K=30, MARGIN_MAX=0.5, LEVEL_BONUS=0.004, BASE_INTERVAL=3, REF_SPEED=10, PARTY_POWER_ROLL=0.1, ENEMY_STAT_ROLL=0.12.

Cell format: `winRate m<avg surviving-HP% on wins>`. `0` = no wins. Matrices are the 180s time limit.

## Anomalies (auto-flagged)

- **Threat failure** in 4 cells: tank absorbs <60% of enemy attacks (worst: duo-tank-heal L5 T2 pack — 42%).
- **Timeout-heavy** (4 cells >30% timeouts): duo-tank-heal L5 T2 boss@180s (45%), duo-tank-heal L10 T3 boss@180s (38%), duo-tank-heal L35 T4 boss@180s (51%), duo-tank-heal L50 T7 solo@180s (100%).
- **Healer inversion** L5 T4 solo: trio-core 52% vs trio-double-dps 74% — the healer slot is a downgrade.
- **Healer inversion** L50 T5 boss: trio-core 84% vs trio-double-dps 100% — the healer slot is a downgrade.
- **Cliff** trio-core L1 solo: T3 99% → T4 0%.
- **Cliff** trio-core L1 pack: T1 100% → T2 0%.
- **Cliff** trio-core L1 boss: T1 100% → T2 5%.
- **Cliff** trio-core L5 pack: T2 100% → T3 0%.
- **Cliff** trio-core L5 boss: T2 100% → T3 0%.
- **Cliff** trio-core L10 solo: T4 100% → T5 4%.
- **Cliff** trio-core L10 pack: T3 100% → T4 0%.
- **Cliff** trio-core L20 solo: T5 100% → T6 5%.
- **Cliff** trio-core L20 pack: T4 100% → T5 0%.
- **Cliff** trio-core L35 solo: T6 100% → T7 9%.
- **Cliff** trio-core L35 pack: T5 100% → T6 0%.
- **Cliff** trio-core L50 solo: T7 100% → T8 0%.
- **Cliff** trio-double-dps L1 solo: T3 100% → T4 0%.
- **Cliff** trio-double-dps L1 pack: T1 100% → T2 0%.
- **Cliff** trio-double-dps L1 boss: T1 99% → T2 0%.
- **Cliff** trio-double-dps L5 pack: T2 100% → T3 0%.
- **Cliff** trio-double-dps L5 boss: T2 93% → T3 0%.
- **Cliff** trio-double-dps L10 solo: T4 100% → T5 3%.
- **Cliff** trio-double-dps L10 pack: T3 100% → T4 0%.
- **Cliff** trio-double-dps L10 boss: T2 100% → T3 10%.
- **Cliff** trio-double-dps L20 solo: T5 100% → T6 0%.
- **Cliff** trio-double-dps L20 pack: T4 100% → T5 0%.
- **Cliff** trio-double-dps L35 solo: T6 100% → T7 0%.
- **Cliff** trio-double-dps L35 boss: T4 100% → T5 7%.
- **Cliff** trio-double-dps L50 pack: T5 100% → T6 1%.
- **Cliff** trio-double-dps L50 boss: T5 100% → T6 0%.
- **Cliff** trio-no-tank L1 pack: T1 100% → T2 0%.
- **Cliff** trio-no-tank L1 boss: T1 100% → T2 0%.
- **Cliff** trio-no-tank L5 pack: T2 98% → T3 0%.
- **Cliff** trio-no-tank L5 boss: T2 100% → T3 0%.
- **Cliff** trio-no-tank L10 solo: T4 94% → T5 0%.
- **Cliff** trio-no-tank L20 solo: T5 98% → T6 0%.
- **Cliff** trio-no-tank L20 pack: T3 100% → T4 6%.
- **Cliff** trio-no-tank L20 boss: T3 100% → T4 6%.
- **Cliff** trio-no-tank L35 pack: T4 100% → T5 0%.
- **Cliff** trio-no-tank L50 solo: T6 100% → T7 0%.
- **Cliff** trio-casters L1 solo: T2 100% → T3 1%.
- **Cliff** trio-casters L1 pack: T1 99% → T2 0%.
- **Cliff** trio-casters L5 solo: T3 100% → T4 0%.
- **Cliff** trio-casters L10 pack: T2 100% → T3 0%.
- **Cliff** trio-casters L10 boss: T2 100% → T3 0%.
- **Cliff** trio-casters L20 pack: T3 91% → T4 0%.
- **Cliff** trio-casters L20 boss: T3 90% → T4 0%.
- **Cliff** trio-casters L35 solo: T5 100% → T6 0%.
- **Cliff** trio-casters L50 solo: T5 100% → T6 6%.
- **Cliff** trio-casters L50 boss: T4 100% → T5 0%.
- **Cliff** trio-double-tank L1 solo: T3 90% → T4 0%.
- **Cliff** trio-double-tank L1 pack: T1 100% → T2 0%.
- **Cliff** trio-double-tank L1 boss: T1 100% → T2 0%.
- **Cliff** trio-double-tank L5 pack: T2 100% → T3 0%.
- **Cliff** trio-double-tank L5 boss: T2 100% → T3 0%.
- **Cliff** trio-double-tank L10 solo: T4 100% → T5 0%.
- **Cliff** trio-double-tank L10 pack: T3 100% → T4 0%.
- **Cliff** trio-double-tank L20 solo: T5 100% → T6 1%.
- **Cliff** trio-double-tank L20 pack: T4 100% → T5 0%.
- **Cliff** trio-double-tank L35 solo: T6 100% → T7 1%.
- **Cliff** trio-double-tank L35 pack: T5 94% → T6 0%.
- **Cliff** trio-double-tank L35 boss: T4 100% → T5 1%.
- **Cliff** trio-double-tank L50 solo: T7 100% → T8 0%.
- **Cliff** trio-utility L1 solo: T2 100% → T3 0%.
- **Cliff** trio-utility L5 pack: T1 100% → T2 0%.
- **Cliff** trio-utility L5 boss: T1 92% → T2 0%.
- **Cliff** trio-utility L10 solo: T3 100% → T4 0%.
- **Cliff** trio-utility L10 pack: T2 95% → T3 0%.
- **Cliff** trio-utility L10 boss: T1 100% → T2 0%.
- **Cliff** trio-utility L20 solo: T4 100% → T5 0%.
- **Cliff** trio-utility L20 pack: T2 100% → T3 7%.
- **Cliff** trio-utility L20 boss: T2 100% → T3 0%.
- **Cliff** trio-utility L35 pack: T3 100% → T4 0%.
- **Cliff** trio-utility L50 solo: T5 100% → T6 0%.
- **Cliff** trio-utility L50 pack: T4 99% → T5 0%.
- **Cliff** trio-gatherers L1 solo: T2 100% → T3 0%.
- **Cliff** trio-gatherers L1 pack: T1 98% → T2 0%.
- **Cliff** trio-gatherers L5 solo: T3 100% → T4 0%.
- **Cliff** trio-gatherers L5 pack: T1 100% → T2 1%.
- **Cliff** trio-gatherers L5 boss: T1 100% → T2 0%.
- **Cliff** trio-gatherers L10 solo: T3 100% → T4 9%.
- **Cliff** trio-gatherers L10 pack: T2 100% → T3 0%.
- **Cliff** trio-gatherers L20 solo: T4 100% → T5 0%.
- **Cliff** trio-gatherers L20 pack: T3 100% → T4 0%.
- **Cliff** trio-gatherers L20 boss: T2 100% → T3 8%.
- **Cliff** trio-gatherers L35 solo: T5 100% → T6 0%.
- **Cliff** trio-gatherers L35 pack: T3 100% → T4 10%.
- **Cliff** trio-gatherers L35 boss: T3 100% → T4 0%.
- **Cliff** trio-gatherers L50 solo: T5 100% → T6 1%.
- **Cliff** trio-gatherers L50 pack: T4 100% → T5 0%.
- **Cliff** duo-tank-heal L1 solo: T2 100% → T3 1%.
- **Cliff** duo-tank-heal L1 pack: T1 100% → T2 0%.
- **Cliff** duo-tank-heal L1 boss: T1 99% → T2 0%.
- **Cliff** duo-tank-heal L5 solo: T3 100% → T4 0%.
- **Cliff** duo-tank-heal L10 solo: T4 100% → T5 0%.
- **Cliff** duo-tank-heal L10 pack: T2 100% → T3 0%.
- **Cliff** duo-tank-heal L10 boss: T2 100% → T3 0%.
- **Cliff** duo-tank-heal L20 solo: T5 100% → T6 0%.
- **Cliff** duo-tank-heal L20 pack: T3 100% → T4 1%.
- **Cliff** duo-tank-heal L20 boss: T3 100% → T4 0%.
- **Cliff** duo-tank-heal L35 solo: T6 100% → T7 0%.
- **Cliff** duo-tank-heal L35 pack: T4 100% → T5 2%.
- **Cliff** duo-tank-heal L50 solo: T6 100% → T7 0%.
- **Cliff** duo-tank-heal L50 pack: T5 100% → T6 0%.
- **Cliff** duo-tank-heal L50 boss: T4 100% → T5 0%.
- **Cliff** solo-tank L1 solo: T1 100% → T2 0%.
- **Cliff** solo-tank L10 solo: T2 100% → T3 5%.
- **Cliff** solo-tank L10 pack: T1 100% → T2 0%.
- **Cliff** solo-tank L20 solo: T3 100% → T4 0%.
- **Cliff** solo-tank L20 pack: T2 97% → T3 0%.
- **Cliff** solo-tank L20 boss: T1 100% → T2 5%.
- **Cliff** solo-tank L35 solo: T4 100% → T5 0%.
- **Cliff** solo-tank L35 pack: T3 96% → T4 0%.
- **Cliff** solo-tank L35 boss: T2 100% → T3 1%.
- **Cliff** solo-tank L50 pack: T3 100% → T4 1%.
- **Cliff** solo-tank L50 boss: T3 100% → T4 0%.
- **Cliff** solo-dps L1 solo: T1 100% → T2 0%.
- **Cliff** solo-dps L5 solo: T2 97% → T3 0%.
- **Cliff** solo-dps L10 pack: T1 100% → T2 0%.
- **Cliff** solo-dps L20 solo: T3 100% → T4 8%.
- **Cliff** solo-dps L20 pack: T2 100% → T3 0%.
- **Cliff** solo-dps L35 solo: T4 100% → T5 1%.
- **Cliff** solo-dps L50 pack: T3 100% → T4 2%.
- **Cliff** solo-dps L50 boss: T3 100% → T4 0%.
- **Cliff** solo-crit L1 solo: T1 100% → T2 0%.
- **Cliff** solo-crit L5 solo: T2 94% → T3 0%.
- **Cliff** solo-crit L10 pack: T1 100% → T2 0%.
- **Cliff** solo-crit L20 solo: T3 100% → T4 6%.
- **Cliff** solo-crit L35 solo: T4 100% → T5 0%.
- **Cliff** solo-crit L35 pack: T2 100% → T3 2%.
- **Cliff** solo-crit L35 boss: T2 100% → T3 1%.
- **Cliff** solo-crit L50 solo: T4 100% → T5 5%.
- **Cliff** solo-crit L50 pack: T3 100% → T4 0%.
- **Cliff** solo-crit L50 boss: T3 92% → T4 0%.
- **Clock-bound** (3 cells win ≥40pts more at 300s): duo-tank-heal L5 T2 boss, duo-tank-heal L35 T4 boss, duo-tank-heal L50 T7 solo.

## Middle band (10–90% win at 180s)

54/1584 cells (3%) — solo: 16, pack: 12, boss: 26.

## Power tiers (ADR-0040 proxies — trio-core, boss shape)

Party stats × naked 1 / geared 1.35 / full-build 1.9 (speed untouched). Highest tier at ≥70% win by level 50: naked: T5, geared: T5, full-build: T6.

### trio-core — naked (×1, boss, 180s)

| level \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| L1 | 100% | 5% | 0 | 0 | 0 | 0 | 0 | 0 |
| L5 | 100% | 100% | 0 | 0 | 0 | 0 | 0 | 0 |
| L10 | 100% | 100% | 82% | 0 | 0 | 0 | 0 | 0 |
| L20 | 100% | 100% | 100% | 47% | 0 | 0 | 0 | 0 |
| L35 | 100% | 100% | 100% | 100% | 33% | 0 | 0 | 0 |
| L50 | 100% | 100% | 100% | 100% | 84% | 8% | 0 | 0 |


### trio-core — geared (×1.35, boss, 180s)

| level \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| L1 | 100% | 100% | 0 | 0 | 0 | 0 | 0 | 0 |
| L5 | 100% | 100% | 73% | 0 | 0 | 0 | 0 | 0 |
| L10 | 100% | 100% | 100% | 7% | 0 | 0 | 0 | 0 |
| L20 | 100% | 100% | 100% | 100% | 11% | 0 | 0 | 0 |
| L35 | 100% | 100% | 100% | 100% | 79% | 5% | 0 | 0 |
| L50 | 100% | 100% | 100% | 100% | 100% | 49% | 1% | 0 |


### trio-core — full-build (×1.9, boss, 180s)

| level \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| L1 | 100% | 100% | 42% | 0 | 0 | 0 | 0 | 0 |
| L5 | 100% | 100% | 100% | 5% | 0 | 0 | 0 | 0 |
| L10 | 100% | 100% | 100% | 100% | 0 | 0 | 0 | 0 |
| L20 | 100% | 100% | 100% | 100% | 57% | 1% | 0 | 0 |
| L35 | 100% | 100% | 100% | 100% | 100% | 43% | 3% | 0 |
| L50 | 100% | 100% | 100% | 100% | 100% | 99% | 11% | 0 |


## Shape: solo

### Level 1 — solo (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m94% | 100% m95% | 99% m62% | 0 | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m96% | 100% m85% | 100% m38% | 0 | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m95% | 100% m97% | 22% m59% | 0 | 0 | 0 | 0 | 0 |
| trio-casters | 100% m90% | 100% m77% | 1% m37% | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m95% | 100% m93% | 90% m63% | 0 | 0 | 0 | 0 | 0 |
| trio-utility | 100% m92% | 100% m66% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m93% | 100% m72% | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m86% | 100% m96% | 1% m43% | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 100% m44% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m48% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 100% m46% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 5 — solo (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m90% | 100% m94% | 52% m54% | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m100% | 100% m95% | 100% m75% | 74% m21% | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m100% | 100% m93% | 100% m83% | 18% m51% | 0 | 0 | 0 | 0 |
| trio-casters | 100% m100% | 100% m87% | 100% m72% | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m98% | 100% m93% | 100% m94% | 32% m54% | 0 | 0 | 0 | 0 |
| trio-utility | 100% m93% | 100% m83% | 67% m19% | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m97% | 100% m90% | 100% m48% | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m93% | 100% m94% | 100% m96% | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 100% m82% | 69% m19% | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m75% | 97% m28% | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 100% m74% | 94% m31% | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 10 — solo (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m97% | 100% m93% | 100% m92% | 4% m50% | 0 | 0 | 0 |
| trio-double-dps | 100% m100% | 100% m98% | 100% m87% | 100% m67% | 3% m6% | 0 | 0 | 0 |
| trio-no-tank | 100% m100% | 100% m97% | 100% m82% | 94% m60% | 0 | 0 | 0 | 0 |
| trio-casters | 100% m100% | 100% m97% | 100% m80% | 47% m54% | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m94% | 100% m93% | 100% m95% | 0 | 0 | 0 | 0 |
| trio-utility | 100% m97% | 100% m91% | 100% m67% | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m100% | 100% m94% | 100% m84% | 9% m34% | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m98% | 100% m92% | 100% m96% | 100% m97% | 0 | 0 | 0 | 0 |
| solo-tank | 100% m96% | 100% m70% | 5% m19% | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m90% | 100% m63% | 36% m12% | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 100% m89% | 100% m71% | 28% m22% | 0 | 0 | 0 | 0 | 0 |

### Level 20 — solo (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m100% | 100% m97% | 100% m92% | 100% m96% | 5% m59% | 0 | 0 |
| trio-double-dps | 100% m100% | 100% m100% | 100% m97% | 100% m92% | 100% m66% | 0 | 0 | 0 |
| trio-no-tank | 100% m100% | 100% m100% | 100% m94% | 100% m90% | 98% m68% | 0 | 0 | 0 |
| trio-casters | 100% m100% | 100% m100% | 100% m94% | 100% m77% | 41% m54% | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m95% | 100% m95% | 100% m96% | 1% m57% | 0 | 0 |
| trio-utility | 100% m100% | 100% m97% | 100% m88% | 100% m56% | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m100% | 100% m98% | 100% m95% | 100% m78% | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m100% | 100% m96% | 100% m90% | 100% m96% | 100% m96% | 0 | 0 | 0 |
| solo-tank | 100% m100% | 100% m94% | 100% m64% | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m98% | 100% m87% | 100% m62% | 8% m16% | 0 | 0 | 0 | 0 |
| solo-crit | 100% m97% | 100% m84% | 100% m49% | 6% m6% | 0 | 0 | 0 | 0 |

### Level 35 — solo (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m92% | 100% m95% | 9% m69% | 0 |
| trio-double-dps | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m88% | 100% m58% | 0 | 0 |
| trio-no-tank | 100% m100% | 100% m100% | 100% m100% | 100% m92% | 100% m74% | 63% m54% | 0 | 0 |
| trio-casters | 100% m100% | 100% m100% | 100% m100% | 100% m91% | 100% m67% | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m96% | 100% m97% | 100% m99% | 1% m62% | 0 |
| trio-utility | 100% m100% | 100% m100% | 100% m96% | 100% m86% | 77% m43% | 0 | 0 | 0 |
| trio-gatherers | 100% m100% | 100% m100% | 100% m96% | 100% m89% | 100% m66% | 0 | 0 | 0 |
| duo-tank-heal | 100% m100% | 100% m100% | 100% m95% | 100% m87% | 100% m98% | 100% m94% | 0 | 0 |
| solo-tank | 100% m100% | 100% m100% | 100% m94% | 100% m58% | 0 | 0 | 0 | 0 |
| solo-dps | 100% m100% | 100% m94% | 100% m85% | 100% m47% | 1% m4% | 0 | 0 | 0 |
| solo-crit | 100% m100% | 100% m91% | 100% m78% | 100% m22% | 0 | 0 | 0 | 0 |

### Level 50 — solo (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m100% | 100% m100% | 100% m99% | 100% m93% | 100% m93% | 100% m91% | 0 |
| trio-double-dps | 100% m100% | 100% m100% | 100% m100% | 100% m99% | 100% m96% | 100% m84% | 34% m42% | 0 |
| trio-no-tank | 100% m100% | 100% m100% | 100% m100% | 100% m98% | 100% m89% | 100% m69% | 0 | 0 |
| trio-casters | 100% m100% | 100% m100% | 100% m100% | 100% m99% | 100% m87% | 6% m66% | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m100% | 100% m100% | 100% m97% | 100% m92% | 100% m98% | 100% m96% | 0 |
| trio-utility | 100% m100% | 100% m100% | 100% m98% | 100% m91% | 100% m77% | 0 | 0 | 0 |
| trio-gatherers | 100% m100% | 100% m100% | 100% m99% | 100% m95% | 100% m82% | 1% m7% | 0 | 0 |
| duo-tank-heal | 100% m100% | 100% m100% | 100% m99% | 100% m95% | 100% m96% | 100% m98% | 0 | 0 |
| solo-tank | 100% m100% | 100% m100% | 100% m99% | 100% m87% | 82% m22% | 0 | 0 | 0 |
| solo-dps | 100% m100% | 100% m100% | 100% m91% | 100% m73% | 60% m24% | 0 | 0 | 0 |
| solo-crit | 100% m100% | 100% m100% | 100% m84% | 100% m69% | 5% m29% | 0 | 0 | 0 |


## Shape: pack

### Level 1 — pack (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m97% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m71% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m97% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-casters | 99% m66% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m99% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-utility | 75% m24% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 98% m44% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m100% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 5 — pack (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m93% | 100% m96% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m88% | 100% m59% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m96% | 98% m67% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-casters | 100% m89% | 48% m57% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m96% | 100% m98% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-utility | 100% m68% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m80% | 1% m17% | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m99% | 50% m100% | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 2% m6% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 2% m5% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 10 — pack (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m94% | 100% m97% | 100% m94% | 0 | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m94% | 100% m82% | 100% m38% | 0 | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m91% | 100% m94% | 14% m65% | 0 | 0 | 0 | 0 | 0 |
| trio-casters | 100% m92% | 100% m81% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m94% | 100% m100% | 100% m86% | 0 | 0 | 0 | 0 | 0 |
| trio-utility | 100% m85% | 95% m24% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m91% | 100% m65% | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m91% | 100% m100% | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 100% m48% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m41% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 100% m31% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 20 — pack (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m97% | 100% m94% | 100% m97% | 100% m95% | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m99% | 100% m96% | 100% m84% | 100% m45% | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m98% | 100% m93% | 100% m82% | 6% m70% | 0 | 0 | 0 | 0 |
| trio-casters | 100% m98% | 100% m88% | 91% m70% | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m98% | 100% m94% | 100% m98% | 100% m81% | 0 | 0 | 0 | 0 |
| trio-utility | 100% m93% | 100% m79% | 7% m14% | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m97% | 100% m89% | 100% m56% | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m93% | 100% m98% | 100% m100% | 1% m100% | 0 | 0 | 0 | 0 |
| solo-tank | 100% m86% | 97% m27% | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m81% | 100% m24% | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 100% m73% | 85% m17% | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 35 — pack (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m97% | 100% m94% | 100% m97% | 100% m95% | 0 | 0 | 0 |
| trio-double-dps | 100% m100% | 100% m98% | 100% m95% | 100% m83% | 86% m34% | 0 | 0 | 0 |
| trio-no-tank | 100% m100% | 100% m96% | 100% m88% | 100% m66% | 0 | 0 | 0 | 0 |
| trio-casters | 100% m98% | 100% m97% | 100% m85% | 51% m69% | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m98% | 100% m95% | 100% m99% | 94% m94% | 0 | 0 | 0 |
| trio-utility | 100% m98% | 100% m94% | 100% m75% | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m98% | 100% m95% | 100% m82% | 10% m28% | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m99% | 100% m93% | 100% m99% | 100% m99% | 2% m100% | 0 | 0 | 0 |
| solo-tank | 100% m100% | 100% m86% | 96% m26% | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m91% | 100% m64% | 74% m11% | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 100% m87% | 100% m49% | 2% m9% | 0 | 0 | 0 | 0 | 0 |

### Level 50 — pack (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m100% | 100% m99% | 100% m97% | 100% m89% | 100% m99% | 59% m94% | 0 | 0 |
| trio-double-dps | 100% m100% | 100% m100% | 100% m98% | 100% m93% | 100% m77% | 1% m26% | 0 | 0 |
| trio-no-tank | 100% m100% | 100% m99% | 100% m94% | 100% m86% | 59% m69% | 0 | 0 | 0 |
| trio-casters | 100% m99% | 100% m98% | 100% m89% | 100% m80% | 25% m49% | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m99% | 100% m97% | 100% m96% | 100% m99% | 12% m99% | 0 | 0 |
| trio-utility | 100% m99% | 100% m96% | 100% m86% | 99% m46% | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m100% | 100% m97% | 100% m92% | 100% m69% | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m99% | 100% m97% | 100% m91% | 100% m100% | 100% m98% | 0 | 0 | 0 |
| solo-tank | 100% m100% | 100% m100% | 100% m78% | 1% m11% | 0 | 0 | 0 | 0 |
| solo-dps | 100% m93% | 100% m87% | 100% m50% | 2% m11% | 0 | 0 | 0 | 0 |
| solo-crit | 100% m89% | 100% m81% | 100% m34% | 0 | 0 | 0 | 0 | 0 |


## Shape: boss

### Level 1 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m96% | 5% m51% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-dps | 99% m42% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m88% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-casters | 84% m57% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m98% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-utility | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 8% m16% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 99% m97% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 5 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m95% | 100% m91% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m82% | 93% m25% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m98% | 100% m74% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-casters | 100% m89% | 28% m47% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m98% | 100% m98% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-utility | 92% m42% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m59% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m99% | 56% m99% | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 10 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m92% | 100% m90% | 82% m76% | 0 | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m93% | 100% m75% | 10% m12% | 0 | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m93% | 100% m95% | 19% m50% | 0 | 0 | 0 | 0 | 0 |
| trio-casters | 100% m86% | 100% m87% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m92% | 100% m100% | 72% m92% | 0 | 0 | 0 | 0 | 0 |
| trio-utility | 100% m76% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m84% | 52% m30% | 0 | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m99% | 100% m97% | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 28% m13% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 65% m16% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 61% m13% | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 20 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m97% | 100% m92% | 100% m94% | 47% m69% | 0 | 0 | 0 | 0 |
| trio-double-dps | 100% m98% | 100% m94% | 100% m76% | 21% m22% | 0 | 0 | 0 | 0 |
| trio-no-tank | 100% m96% | 100% m97% | 100% m95% | 6% m56% | 0 | 0 | 0 | 0 |
| trio-casters | 100% m93% | 100% m86% | 90% m80% | 0 | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m97% | 100% m92% | 100% m100% | 14% m82% | 0 | 0 | 0 | 0 |
| trio-utility | 100% m91% | 100% m68% | 0 | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m96% | 100% m81% | 8% m19% | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m90% | 100% m99% | 100% m97% | 0 | 0 | 0 | 0 | 0 |
| solo-tank | 100% m77% | 5% m11% | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m62% | 52% m11% | 0 | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 100% m56% | 11% m10% | 0 | 0 | 0 | 0 | 0 | 0 |

### Level 35 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m99% | 100% m97% | 100% m90% | 100% m89% | 33% m63% | 0 | 0 | 0 |
| trio-double-dps | 100% m99% | 100% m98% | 100% m94% | 100% m76% | 7% m12% | 0 | 0 | 0 |
| trio-no-tank | 100% m98% | 100% m94% | 100% m97% | 87% m77% | 1% m85% | 0 | 0 | 0 |
| trio-casters | 100% m96% | 100% m92% | 100% m83% | 25% m47% | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m100% | 100% m98% | 100% m93% | 100% m99% | 1% m78% | 0 | 0 | 0 |
| trio-utility | 100% m97% | 100% m88% | 78% m40% | 0 | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m97% | 100% m94% | 100% m76% | 0 | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m96% | 100% m89% | 100% m99% | 49% m100% | 0 | 0 | 0 | 0 |
| solo-tank | 100% m99% | 100% m75% | 1% m6% | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m83% | 100% m56% | 12% m8% | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 100% m76% | 100% m40% | 1% m26% | 0 | 0 | 0 | 0 | 0 |

### Level 50 — boss (180s)

| comp \ tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| trio-core | 100% m99% | 100% m98% | 100% m96% | 100% m97% | 84% m78% | 8% m73% | 0 | 0 |
| trio-double-dps | 100% m99% | 100% m99% | 100% m97% | 100% m89% | 100% m66% | 0 | 0 | 0 |
| trio-no-tank | 100% m98% | 100% m97% | 100% m92% | 100% m92% | 26% m58% | 0 | 0 | 0 |
| trio-casters | 100% m98% | 100% m94% | 100% m92% | 100% m80% | 0 | 0 | 0 | 0 |
| trio-double-tank | 100% m99% | 100% m99% | 100% m96% | 100% m99% | 41% m84% | 0 | 0 | 0 |
| trio-utility | 100% m97% | 100% m95% | 100% m76% | 19% m18% | 0 | 0 | 0 | 0 |
| trio-gatherers | 100% m99% | 100% m96% | 100% m86% | 86% m41% | 0 | 0 | 0 | 0 |
| duo-tank-heal | 100% m98% | 100% m94% | 100% m86% | 100% m98% | 0 | 0 | 0 | 0 |
| solo-tank | 100% m100% | 100% m99% | 100% m57% | 0 | 0 | 0 | 0 | 0 |
| solo-dps | 100% m87% | 100% m74% | 100% m33% | 0 | 0 | 0 | 0 | 0 |
| solo-crit | 100% m85% | 100% m65% | 92% m12% | 0 | 0 | 0 | 0 | 0 |

