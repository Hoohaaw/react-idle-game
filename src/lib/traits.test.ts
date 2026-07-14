import { describe, it, expect } from 'vitest'
import {
  traitActive,
  collectTraitBonuses,
  missionDurationMultiplier,
  partyAverageStat,
  MISSION_SPEED_CAP,
  type TraitDef,
} from './traits'
import { effectiveStats } from './stats'
import { simulateCombat, type Combatant, type Enemy } from './combat'

const trait = (over: Partial<TraitDef>): TraitDef => ({
  traitKey: 't',
  name: 'T',
  condition: { type: 'always' },
  effects: [{ stat: 'attack', kind: 'pct', value: 12 }],
  ...over,
})

describe('traitActive', () => {
  it('matches each condition type against the context', () => {
    expect(traitActive(trait({}), {})).toBe(true) // always
    expect(traitActive(trait({ condition: { type: 'map', value: 'gravemarch' } }), { mapKey: 'gravemarch' })).toBe(true)
    expect(traitActive(trait({ condition: { type: 'map', value: 'gravemarch' } }), { mapKey: 'embercrag' })).toBe(false)
    expect(traitActive(trait({ condition: { type: 'map', value: 'gravemarch' } }), {})).toBe(false) // no context = no match
    expect(traitActive(trait({ condition: { type: 'enemyArchetype', value: 'boss' } }), { enemyArchetypes: ['basic', 'boss'] })).toBe(true)
    expect(traitActive(trait({ condition: { type: 'enemyArchetype', value: 'boss' } }), { enemyArchetypes: ['basic'] })).toBe(false)
    expect(traitActive(trait({ condition: { type: 'enemySchool', value: 'fire' } }), { enemySchools: ['fire'] })).toBe(true)
    expect(traitActive(trait({ condition: { type: 'resource', value: 'Wood' } }), { resource: 'Wood' })).toBe(true)
    expect(traitActive(trait({ condition: { type: 'resource', value: 'Wood' } }), { mapKey: 'gravemarch' })).toBe(false)
  })
})

describe('collectTraitBonuses', () => {
  it('totals only condition-matched effects, splitting flat and pct', () => {
    const traits: TraitDef[] = [
      trait({ condition: { type: 'map', value: 'gravemarch' }, effects: [{ stat: 'attack', kind: 'pct', value: 12 }] }),
      trait({ traitKey: 'w', condition: { type: 'always' }, effects: [{ stat: 'resistance', kind: 'flat', value: 40 }] }),
      trait({ traitKey: 'x', condition: { type: 'map', value: 'embercrag' }, effects: [{ stat: 'attack', kind: 'pct', value: 99 }] }),
    ]
    const bonuses = collectTraitBonuses(traits, { mapKey: 'gravemarch' })
    expect(bonuses).toEqual({
      attack: { flat: 0, pct: 12 },
      resistance: { flat: 40, pct: 0 },
    })
  })

  it('feeds effectiveStats through extraBonuses with the standard stacking rule', () => {
    const base = { level: 1, baseStats: [{ stat: 'attack', value: 100 }], growth: [], blessingAllocations: {}, blessingNodes: [], equipped: {}, itemDefs: {} }
    const bonuses = collectTraitBonuses([trait({})], {})
    expect(effectiveStats(base).attack).toBe(100)
    expect(effectiveStats({ ...base, extraBonuses: bonuses }).attack).toBe(112) // 100 + 100×12%
  })
})

describe('missionDurationMultiplier', () => {
  it('sums party missionSpeedDecrease and caps at 30%', () => {
    expect(missionDurationMultiplier([])).toBe(1)
    expect(missionDurationMultiplier([{ missionSpeedDecrease: 10 }])).toBeCloseTo(0.9)
    expect(missionDurationMultiplier([{ missionSpeedDecrease: 10 }, { missionSpeedDecrease: 8 }])).toBeCloseTo(0.82)
    expect(missionDurationMultiplier([{ missionSpeedDecrease: 20 }, { missionSpeedDecrease: 20 }, { missionSpeedDecrease: 20 }])).toBeCloseTo(1 - MISSION_SPEED_CAP)
    expect(missionDurationMultiplier([{ missionSpeedDecrease: -50 }])).toBe(1) // negatives clamp
  })
})

describe('partyAverageStat', () => {
  it('averages across the party, missing stat = 0', () => {
    expect(partyAverageStat([{ goldFind: 12 }, {}], 'goldFind')).toBe(6)
    expect(partyAverageStat([], 'goldFind')).toBe(0)
  })
})

// The point of the whole system: a conditional trait must lift a MARGINAL fight's WIN RATE on
// its map and change nothing off-map. Per-fight rolls (ADR-0038) make single-seed outcomes
// probabilistic, so the pair compares win rates over many seeds instead of one fixed seed.
describe('discriminating sim pair (Mapborn)', () => {
  const mapborn = trait({
    traitKey: 'gravehand',
    condition: { type: 'map', value: 'gravemarch' },
    effects: [{ stat: 'attack', kind: 'pct', value: 12 }],
  })
  // Marginal by construction: 60 atk × 61 actions = 3660 vs 3900 hp — the hero kills the wall
  // JUST too slowly at the roll midpoint; +12% attack (4099) clears it at the midpoint.
  const enemy: Enemy = { id: 'wall', health: 3900, attack: 0, damageType: 'physical', speed: 10 }
  const winRate = (ctx: { mapKey?: string }) => {
    const stats = effectiveStats({
      level: 1,
      baseStats: [{ stat: 'attack', value: 60 }, { stat: 'health', value: 100 }, { stat: 'speed', value: 10 }],
      growth: [], blessingAllocations: {}, blessingNodes: [], equipped: {}, itemDefs: {},
      extraBonuses: collectTraitBonuses([mapborn], ctx),
    })
    const party: Combatant[] = [{ id: 'hero', role: 'damage', stats }]
    let wins = 0
    for (let s = 0; s < 200; s++) {
      const r = simulateCombat({ party, encounter: { enemies: [enemy], timeLimitSeconds: 180 }, seed: `trait-pair-${s}` })
      if (r.outcome === 'win') wins++
    }
    return wins / 200
  }

  it("lifts a marginal fight's win rate on its map, not off it", () => {
    const off = winRate({ mapKey: 'embercrag' })
    const on = winRate({ mapKey: 'gravemarch' })
    expect(off).toBeLessThan(0.5) // below the roll midpoint without the bonus
    expect(on).toBeGreaterThan(0.5) // above it with the bonus
    expect(on - off).toBeGreaterThan(0.25) // and the gap is decisive, not noise
  })
})
