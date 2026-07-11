import { describe, it, expect } from 'vitest'
import {
  baselineForStat,
  computeBaselines,
  applyBonuses,
  collectBlessingBonuses,
  statRewardBonus,
  finalReward,
  collectGearBonuses,
  mergeBonuses,
  effectiveStats,
  effectiveStatBreakdown,
  RARITY_MULT,
  REWARD_BONUS_PER_STAT_POINT,
  type StatGrowth,
  type BlessingNodeDef,
  type ItemDefBonuses,
  type EquippedItem,
} from './stats'

describe('baselineForStat', () => {
  it('returns base at level 1 (no per-level gain yet)', () => {
    const growth: StatGrowth = { stat: 'strength', perLevel: 3, milestones: [] }
    expect(baselineForStat(1, 10, growth)).toBe(10)
  })

  it('adds perLevel × (L − 1)', () => {
    const growth: StatGrowth = { stat: 'strength', perLevel: 3, milestones: [] }
    expect(baselineForStat(5, 10, growth)).toBe(10 + 3 * 4) // 22
  })

  it('adds milestones ADDITIVELY on top of the normal gain, once level is reached', () => {
    const growth: StatGrowth = { stat: 'strength', perLevel: 3, milestones: [{ level: 10, bonus: 8 }] }
    expect(baselineForStat(9, 10, growth)).toBe(10 + 3 * 8) // 34 — milestone not yet active
    expect(baselineForStat(10, 10, growth)).toBe(10 + 3 * 9 + 8) // 45 — milestone adds to the level-10 gain
  })

  it('sums multiple milestones cumulatively', () => {
    const growth: StatGrowth = {
      stat: 'strength',
      perLevel: 2,
      milestones: [{ level: 5, bonus: 5 }, { level: 10, bonus: 10 }],
    }
    expect(baselineForStat(12, 0, growth)).toBe(2 * 11 + 5 + 10) // 37
  })

  it('returns base unchanged when there is no growth entry', () => {
    expect(baselineForStat(50, 7)).toBe(7)
  })
})

describe('computeBaselines', () => {
  it('computes every stat over the union of base + growth keys', () => {
    const baseStats = [
      { stat: 'strength', value: 10 },
      { stat: 'health', value: 100 },
    ]
    const growth: StatGrowth[] = [
      { stat: 'strength', perLevel: 3 },
      { stat: 'agility', perLevel: 1 }, // growth-only stat → starts from base 0
    ]
    const out = computeBaselines(5, baseStats, growth)
    expect(out).toEqual({
      strength: 10 + 3 * 4, // 22
      health: 100, // no growth → flat
      agility: 0 + 1 * 4, // 4
    })
  })
})

describe('applyBonuses', () => {
  it('applies flat then percent-of-baseline: baseline + flat + baseline×pct/100', () => {
    const effective = applyBonuses({ attack: 100 }, { attack: { flat: 10, pct: 20 } })
    expect(effective.attack).toBe(100 + 10 + 20) // 130
  })

  it('passes through stats with no bonus and defaults a missing baseline to 0', () => {
    const effective = applyBonuses({ attack: 50 }, { defense: { flat: 5, pct: 0 } })
    expect(effective.attack).toBe(50)
    expect(effective.defense).toBe(5)
  })
})

describe('collectBlessingBonuses', () => {
  const nodes: BlessingNodeDef[] = [
    { nodeId: 'a', effects: [{ stat: 'attack', kind: 'flat', perRank: 2 }] },
    { nodeId: 'b', effects: [{ stat: 'attack', kind: 'pct', perRank: 5 }] },
    { nodeId: 'c', effects: [{ stat: 'health', kind: 'flat', perRank: 10 }] },
  ]

  it('multiplies perRank by allocated ranks and splits flat vs pct per stat', () => {
    const out = collectBlessingBonuses({ a: 3, b: 2 }, nodes)
    expect(out.attack).toEqual({ flat: 6, pct: 10 }) // 2×3 flat, 5×2 pct
  })

  it('ignores nodes with zero or missing allocation', () => {
    const out = collectBlessingBonuses({ c: 0 }, nodes)
    expect(out).toEqual({})
  })

  it('sums contributions to the same stat across nodes', () => {
    const stacked: BlessingNodeDef[] = [
      { nodeId: 'x', effects: [{ stat: 'attack', kind: 'flat', perRank: 1 }] },
      { nodeId: 'y', effects: [{ stat: 'attack', kind: 'flat', perRank: 4 }] },
    ]
    const out = collectBlessingBonuses({ x: 2, y: 1 }, stacked)
    expect(out.attack).toEqual({ flat: 6, pct: 0 }) // 1×2 + 4×1
  })
})

describe('statRewardBonus', () => {
  it('sums reward-flagged points at 0.1% each and ignores misc', () => {
    const bonus = statRewardBonus({
      attack: 100, // reward-flagged
      health: 50, // reward-flagged
      gatherSpeed: 999, // misc → ignored
    })
    expect(bonus).toBeCloseTo(150 * REWARD_BONUS_PER_STAT_POINT) // 0.15
  })

  it('is 0 when only misc stats are present', () => {
    expect(statRewardBonus({ gatherYield: 500, missionSpeedDecrease: 20 })).toBe(0)
  })

  it('ignores combat-depth stats flagged reward:false even though they are offensive/defensive (ADR-0007)', () => {
    // critChance is category "offensive" but reward:false — it must NOT inflate rewards.
    expect(statRewardBonus({ critChance: 999 })).toBe(0)
    expect(statRewardBonus({ attack: 10, critChance: 999, dodge: 500 })).toBeCloseTo(
      10 * REWARD_BONUS_PER_STAT_POINT,
    )
  })

  it('counts the WoW-routing power stats spellPower + haste, but not the new depth/economy stats (ADR-0009)', () => {
    expect(statRewardBonus({ spellPower: 30, haste: 20 })).toBeCloseTo(50 * REWARD_BONUS_PER_STAT_POINT)
    expect(statRewardBonus({ healingCrit: 999, magicFind: 999 })).toBe(0)
  })
})

describe('collectGearBonuses', () => {
  const itemDefs: Record<string, ItemDefBonuses> = {
    'iron-sword': { statBonuses: [{ stat: 'attack', kind: 'flat', value: 10 }] },
    'ruby-ring': { statBonuses: [{ stat: 'attack', kind: 'pct', value: 5 }, { stat: 'health', kind: 'flat', value: 20 }] },
  }

  it('scales each base bonus by the equipped rarity (ADR-0032 flattened ladder)', () => {
    const equipped: Record<string, EquippedItem> = { weapon: { itemDefId: 'iron-sword', rarity: 'Epic' } }
    // Epic ×1.75 → base +10 attack becomes +17.5.
    expect(collectGearBonuses(equipped, itemDefs).attack).toEqual({ flat: 17.5, pct: 0 })
  })

  it('accumulates flat and pct across slots at their own rarities', () => {
    const equipped: Record<string, EquippedItem> = {
      weapon: { itemDefId: 'iron-sword', rarity: 'Common' }, // attack +10 flat
      ring: { itemDefId: 'ruby-ring', rarity: 'Rare' }, // ×1.45 → attack +7.25% pct, health +29 flat
    }
    const out = collectGearBonuses(equipped, itemDefs)
    expect(out.attack).toEqual({ flat: 10, pct: 7.25 })
    expect(out.health).toEqual({ flat: 29, pct: 0 })
  })

  it('skips unknown items and falls back to ×1 for an unknown rarity', () => {
    expect(collectGearBonuses({ weapon: { itemDefId: 'ghost', rarity: 'Epic' } }, itemDefs)).toEqual({})
    const out = collectGearBonuses({ weapon: { itemDefId: 'iron-sword', rarity: 'Mythic' } }, itemDefs)
    expect(out.attack).toEqual({ flat: 10, pct: 0 }) // ×1 fallback
  })

  it('exposes the full rarity ladder', () => {
    expect(RARITY_MULT).toEqual({ Common: 1, Uncommon: 1.2, Rare: 1.45, Epic: 1.75, Legendary: 2.25 })
  })
})

describe('mergeBonuses', () => {
  it('sums flat and pct per stat across maps', () => {
    const a = { attack: { flat: 5, pct: 10 } }
    const b = { attack: { flat: 3, pct: 0 }, health: { flat: 50, pct: 0 } }
    expect(mergeBonuses(a, b)).toEqual({ attack: { flat: 8, pct: 10 }, health: { flat: 50, pct: 0 } })
  })
})

describe('effectiveStats', () => {
  it('stacks level baselines + blessings + gear into one effective map', () => {
    const out = effectiveStats({
      level: 5,
      baseStats: [{ stat: 'attack', value: 10 }, { stat: 'health', value: 100 }],
      growth: [{ stat: 'attack', perLevel: 5 }], // → baseline attack 30
      blessingAllocations: { might: 2 },
      blessingNodes: [{ nodeId: 'might', effects: [{ stat: 'attack', kind: 'pct', perRank: 10 }] }], // +20% pct
      equipped: { weapon: { itemDefId: 'sword', rarity: 'Uncommon' } }, // ×1.2 → +6 flat attack
      itemDefs: { sword: { statBonuses: [{ stat: 'attack', kind: 'flat', value: 5 }] } },
    })
    // attack: baseline 30 + gear flat 6 + 30×20% = 42
    expect(out.attack).toBeCloseTo(42)
    expect(out.health).toBe(100)
  })
})

describe('finalReward', () => {
  it('multiplies the base by each (1 + modifier) — margin × level × party × transcendence', () => {
    const out = finalReward(100, { marginBonus: 0.15, levelBonus: 0.2, partyBonus: 0.2, transcendenceBonus: 0.1 })
    expect(out).toBeCloseTo(100 * 1.15 * 1.2 * 1.2 * 1.1)
  })

  it('treats missing modifiers as 0 (no change)', () => {
    expect(finalReward(100)).toBe(100)
    expect(finalReward(100, { marginBonus: 0.5 })).toBe(150)
  })
})

describe('effectiveStatBreakdown', () => {
  // Shared base character data reused across cases
  const baseStats = [{ stat: 'attack', value: 10 }, { stat: 'health', value: 100 }]
  const growth: StatGrowth[] = [{ stat: 'attack', perLevel: 5 }]
  const noGear: Record<string, EquippedItem> = {}
  const noItemDefs: Record<string, ItemDefBonuses> = {}
  const noAllocations: Record<string, number> = {}
  const noNodes: BlessingNodeDef[] = []

  it('base-only character: items and blessings are 0, total equals base for every stat', () => {
    const breakdown = effectiveStatBreakdown({
      level: 5,
      baseStats,
      growth,
      blessingAllocations: noAllocations,
      blessingNodes: noNodes,
      equipped: noGear,
      itemDefs: noItemDefs,
    })
    // attack baseline at level 5: 10 + 5×4 = 30
    expect(breakdown.attack).toEqual({ base: 30, items: 0, blessings: 0, total: 30 })
    // health has no growth → baseline stays at 100
    expect(breakdown.health).toEqual({ base: 100, items: 0, blessings: 0, total: 100 })
  })

  it('gear flat bonus lands in items (Common rarity, ×1)', () => {
    const equipped: Record<string, EquippedItem> = { weapon: { itemDefId: 'sword', rarity: 'Common' } }
    const itemDefs: Record<string, ItemDefBonuses> = {
      sword: { statBonuses: [{ stat: 'attack', kind: 'flat', value: 5 }] },
    }
    const breakdown = effectiveStatBreakdown({
      level: 1,
      baseStats: [{ stat: 'attack', value: 10 }],
      growth: [],
      blessingAllocations: noAllocations,
      blessingNodes: noNodes,
      equipped,
      itemDefs,
    })
    // baseline at level 1 = 10; gear +5 flat at Common (×1)
    expect(breakdown.attack.base).toBe(10)
    expect(breakdown.attack.items).toBe(5)
    expect(breakdown.attack.blessings).toBe(0)
    expect(breakdown.attack.total).toBe(15)
  })

  it('rarity scaling: same flat bonus at Uncommon (×2) doubles items contribution', () => {
    const itemDefs: Record<string, ItemDefBonuses> = {
      sword: { statBonuses: [{ stat: 'attack', kind: 'flat', value: 5 }] },
    }
    const commonBreakdown = effectiveStatBreakdown({
      level: 1,
      baseStats: [{ stat: 'attack', value: 10 }],
      growth: [],
      blessingAllocations: noAllocations,
      blessingNodes: noNodes,
      equipped: { weapon: { itemDefId: 'sword', rarity: 'Common' } },
      itemDefs,
    })
    const uncommonBreakdown = effectiveStatBreakdown({
      level: 1,
      baseStats: [{ stat: 'attack', value: 10 }],
      growth: [],
      blessingAllocations: noAllocations,
      blessingNodes: noNodes,
      equipped: { weapon: { itemDefId: 'sword', rarity: 'Uncommon' } },
      itemDefs,
    })
    // Common items = 5×1 = 5; Uncommon items = 5×2 = 10
    expect(uncommonBreakdown.attack.items).toBe(commonBreakdown.attack.items * RARITY_MULT.Uncommon)
  })

  it('gear pct bonus computes against the baseline (not against flats)', () => {
    // health baseline = 100; +5% pct → items contribution = 100 × 5/100 = 5
    const equipped: Record<string, EquippedItem> = { ring: { itemDefId: 'ring', rarity: 'Common' } }
    const itemDefs: Record<string, ItemDefBonuses> = {
      ring: { statBonuses: [{ stat: 'health', kind: 'pct', value: 5 }] },
    }
    const breakdown = effectiveStatBreakdown({
      level: 1,
      baseStats: [{ stat: 'health', value: 100 }],
      growth: [],
      blessingAllocations: noAllocations,
      blessingNodes: noNodes,
      equipped,
      itemDefs,
    })
    expect(breakdown.health.base).toBe(100)
    expect(breakdown.health.items).toBe(5) // 100 × 5/100
    expect(breakdown.health.total).toBe(105)
  })

  it('blessing flat bonus lands in blessings', () => {
    const nodes: BlessingNodeDef[] = [
      { nodeId: 'might', effects: [{ stat: 'attack', kind: 'flat', perRank: 3 }] },
    ]
    const breakdown = effectiveStatBreakdown({
      level: 1,
      baseStats: [{ stat: 'attack', value: 10 }],
      growth: [],
      blessingAllocations: { might: 4 },
      blessingNodes: nodes,
      equipped: noGear,
      itemDefs: noItemDefs,
    })
    // attack baseline = 10; blessing flat = 3×4 = 12
    expect(breakdown.attack.blessings).toBe(12)
    expect(breakdown.attack.items).toBe(0)
    expect(breakdown.attack.total).toBe(22)
  })

  it('blessing pct bonus computes against the baseline', () => {
    // attack baseline at level 1 = 10; +20% pct from blessing → blessings = 10 × 20/100 = 2
    const nodes: BlessingNodeDef[] = [
      { nodeId: 'power', effects: [{ stat: 'attack', kind: 'pct', perRank: 10 }] },
    ]
    const breakdown = effectiveStatBreakdown({
      level: 1,
      baseStats: [{ stat: 'attack', value: 10 }],
      growth: [],
      blessingAllocations: { power: 2 },
      blessingNodes: nodes,
      equipped: noGear,
      itemDefs: noItemDefs,
    })
    expect(breakdown.attack.blessings).toBeCloseTo(2) // 10 × 20/100
    expect(breakdown.attack.total).toBeCloseTo(12)
  })

  it('total === base + items + blessings for every stat AND matches effectiveStats (the invariant)', () => {
    // Mixed fixture: gear + blessings + a stat that only exists in gear (no baseline)
    const nodes: BlessingNodeDef[] = [
      { nodeId: 'might', effects: [{ stat: 'attack', kind: 'pct', perRank: 10 }] },
      { nodeId: 'vitality', effects: [{ stat: 'health', kind: 'flat', perRank: 20 }] },
    ]
    const equipped: Record<string, EquippedItem> = {
      weapon: { itemDefId: 'sword', rarity: 'Uncommon' }, // ×2 → attack +10 flat
      ring: { itemDefId: 'ring', rarity: 'Rare' },        // ×4 → gatherSpeed +8 flat (gear-only stat)
    }
    const itemDefs: Record<string, ItemDefBonuses> = {
      sword: { statBonuses: [{ stat: 'attack', kind: 'flat', value: 5 }] },
      ring: { statBonuses: [{ stat: 'gatherSpeed', kind: 'flat', value: 2 }] },
    }
    const input = {
      level: 5,
      baseStats,                               // attack 10, health 100
      growth,                                  // attack perLevel 5 → baseline 30 at level 5
      blessingAllocations: { might: 2, vitality: 1 },
      blessingNodes: nodes,
      equipped,
      itemDefs,
    }

    const breakdown = effectiveStatBreakdown(input)
    const effective = effectiveStats(input)

    for (const stat of Object.keys(breakdown)) {
      const { base, items, blessings, total } = breakdown[stat]
      // invariant 1: total decomposition
      expect(total).toBeCloseTo(base + items + blessings, 10)
      // invariant 2: matches effectiveStats output
      expect(total).toBeCloseTo(effective[stat] ?? 0, 10)
    }
  })

  it('a stat present only in gear appears in the result with base 0 and pct contribution 0', () => {
    // gatherSpeed has no baseline → base = 0; a pct bonus on a 0 baseline contributes 0
    const equipped: Record<string, EquippedItem> = {
      ring: { itemDefId: 'ring', rarity: 'Common' },
    }
    const itemDefs: Record<string, ItemDefBonuses> = {
      ring: { statBonuses: [
        { stat: 'gatherSpeed', kind: 'flat', value: 7 },
        { stat: 'gatherYield', kind: 'pct', value: 50 }, // 50% of 0 baseline = 0
      ]},
    }
    const breakdown = effectiveStatBreakdown({
      level: 1,
      baseStats: [],
      growth: [],
      blessingAllocations: noAllocations,
      blessingNodes: noNodes,
      equipped,
      itemDefs,
    })
    // flat-only gear stat
    expect(breakdown.gatherSpeed.base).toBe(0)
    expect(breakdown.gatherSpeed.items).toBe(7)
    expect(breakdown.gatherSpeed.total).toBe(7)
    // pct against 0 baseline → items = 0
    expect(breakdown.gatherYield.base).toBe(0)
    expect(breakdown.gatherYield.items).toBe(0)
    expect(breakdown.gatherYield.total).toBe(0)
  })
})

describe('integration: level → baselines → effective → reward bonus', () => {
  it('threads a small character through the whole pipeline', () => {
    const baseStats = [{ stat: 'attack', value: 10 }, { stat: 'health', value: 100 }]
    const growth: StatGrowth[] = [{ stat: 'attack', perLevel: 5 }]
    const nodes: BlessingNodeDef[] = [
      { nodeId: 'might', effects: [{ stat: 'attack', kind: 'pct', perRank: 10 }] },
    ]

    const baselines = computeBaselines(5, baseStats, growth) // attack 30, health 100
    expect(baselines).toEqual({ attack: 30, health: 100 })

    const bonuses = collectBlessingBonuses({ might: 2 }, nodes) // attack +20% pct
    const effective = applyBonuses(baselines, bonuses) // attack 30 + 30×0.2 = 36
    expect(effective.attack).toBeCloseTo(36)
    expect(effective.health).toBe(100)

    const bonus = statRewardBonus(effective) // (36 + 100) × 0.001
    expect(bonus).toBeCloseTo(136 * REWARD_BONUS_PER_STAT_POINT) // 0.136
  })
})
