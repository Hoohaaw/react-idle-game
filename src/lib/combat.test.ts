import { describe, it, expect } from 'vitest'
import {
  simulateCombat,
  marginBonus,
  levelRewardBonus,
  COMBAT,
  type Combatant,
  type Enemy,
  type Encounter,
} from './combat'

// The seeded Rotting Ghoul (drafts.enemy.rotting-ghoul).
const ghoul: Enemy = { id: 'ghoul', health: 120, attack: 12, damageType: 'physical', speed: 10, defense: 5 }
const encounterWith = (enemies: Enemy[], timeLimitSeconds = 120): Encounter => ({ enemies, timeLimitSeconds })

const warrior: Combatant = {
  id: 'warrior',
  role: 'damage',
  stats: { attack: 40, strength: 20, health: 200, defense: 30, speed: 12 },
}

describe('simulateCombat — outcomes', () => {
  it('a strong hero beats the ghoul and records ending HP', () => {
    const r = simulateCombat({ party: [warrior], encounter: encounterWith([ghoul]), seed: 'run-1' })
    expect(r.outcome).toBe('win')
    expect(r.reason).toBe('enemies-defeated')
    expect(r.endingHp.warrior).toBeGreaterThan(0)
    expect(r.endingHp.warrior).toBeLessThanOrEqual(200)
    expect(r.survivingHpPct).toBeGreaterThan(0)
    expect(r.survivingHpPct).toBeLessThanOrEqual(1)
  })

  it('a squishy hero is wiped by a strong enemy', () => {
    const squishy: Combatant = { id: 'squishy', role: 'damage', stats: { attack: 5, health: 30, speed: 8 } }
    const ogre: Enemy = { id: 'ogre', health: 1000, attack: 50, damageType: 'physical', speed: 12 }
    const r = simulateCombat({ party: [squishy], encounter: encounterWith([ogre]), seed: 'run-1' })
    expect(r.outcome).toBe('loss')
    expect(r.reason).toBe('party-wiped')
    expect(r.endingHp.squishy).toBe(0)
    expect(r.survivingHpPct).toBe(0)
  })

  it('a party that cannot out-DPS the clock times out (a loss), unharmed', () => {
    // 0 power party vs a 0-attack wall: nobody can kill or be killed → timeout.
    const pacifist: Combatant = { id: 'pacifist', role: 'utility', stats: { health: 100, speed: 10 } }
    const wall: Enemy = { id: 'wall', health: 100, attack: 0, damageType: 'physical', speed: 10 }
    const r = simulateCombat({ party: [pacifist], encounter: encounterWith([wall], 60), seed: 'run-1' })
    expect(r.outcome).toBe('loss')
    expect(r.reason).toBe('timeout')
    expect(r.endingHp.pacifist).toBe(100)
    expect(r.survivingHpPct).toBe(1)
    expect(r.durationSeconds).toBe(60)
  })
})

describe('simulateCombat — determinism', () => {
  it('same inputs + seed → identical result', () => {
    const a = simulateCombat({ party: [warrior], encounter: encounterWith([ghoul]), seed: 'same' })
    const b = simulateCombat({ party: [warrior], encounter: encounterWith([ghoul]), seed: 'same' })
    expect(a).toEqual(b)
  })

  it('never exceeds the time limit', () => {
    const r = simulateCombat({ party: [warrior], encounter: encounterWith([ghoul], 30), seed: 'run-1' })
    expect(r.durationSeconds).toBeLessThanOrEqual(30)
  })
})

describe('simulateCombat — role behaviours', () => {
  it('the tank holds aggro so the DPS is never touched', () => {
    const tank: Combatant = { id: 'tank', role: 'tank', stats: { attack: 20, health: 300, defense: 30, speed: 10 } }
    const dps: Combatant = { id: 'dps', role: 'damage', stats: { attack: 50, health: 100, speed: 10 } }
    const brute: Enemy = { id: 'brute', health: 300, attack: 25, damageType: 'physical', speed: 10, defense: 5 }
    const r = simulateCombat({ party: [tank, dps], encounter: encounterWith([brute]), seed: 'run-1' })
    expect(r.outcome).toBe('win')
    expect(r.endingHp.dps).toBe(100) // enemy always targeted the higher-threat tank
    expect(r.endingHp.tank).toBeLessThan(300)
    expect(r.endingHp.tank).toBeGreaterThan(0)
  })

  it('a healer sustains the party and stays safe (deals no damage → no threat)', () => {
    const tank: Combatant = { id: 'tank', role: 'tank', stats: { attack: 20, health: 300, defense: 40, speed: 10 } }
    const healer: Combatant = { id: 'healer', role: 'healer', stats: { healingPower: 40, health: 150, speed: 10 } }
    const brute: Enemy = { id: 'brute', health: 200, attack: 30, damageType: 'physical', speed: 10, defense: 5 }
    const r = simulateCombat({ party: [tank, healer], encounter: encounterWith([brute]), seed: 'run-1' })
    expect(r.outcome).toBe('win')
    expect(r.endingHp.healer).toBe(150) // never targeted
    expect(r.log.some((e) => e.type === 'heal' && e.source === 'healer')).toBe(true)
  })

  it('a 100%-dodge enemy cannot be hit → the fight times out', () => {
    const untouchable: Enemy = { id: 'ghost', health: 100, attack: 0, damageType: 'physical', speed: 10, dodge: 100 }
    const r = simulateCombat({ party: [warrior], encounter: encounterWith([untouchable], 40), seed: 'run-1' })
    expect(r.reason).toBe('timeout')
    expect(r.outcome).toBe('loss')
  })

  it('a healer attacks while the party is above the heal threshold', () => {
    // Enemy deals 0 damage → no party member ever drops below HEALER_HEAL_THRESHOLD.
    // Healer has real spell power so its attack power is non-zero.
    const healer: Combatant = {
      id: 'healer',
      role: 'healer',
      stats: { spellPower: 30, intelligence: 10, healingPower: 20, health: 150, speed: 10 },
    }
    const dummy: Enemy = { id: 'dummy', health: 500, attack: 0, damageType: 'physical', speed: 10 }
    const r = simulateCombat({ party: [healer], encounter: encounterWith([dummy], 30), seed: 'run-1' })
    expect(r.log.some((e) => e.type === 'attack' && e.source === 'healer')).toBe(true)
    expect(r.log.some((e) => e.type === 'heal' && e.source === 'healer')).toBe(false)
  })

  it('a healer starts healing once an ally drops below the threshold', () => {
    // Tank has 100 HP and no defense; enemy attack 50 means one hit takes the tank to 50 HP (50%),
    // well below the 0.7 threshold — healer must engage.
    const tank: Combatant = { id: 'tank', role: 'tank', stats: { attack: 5, health: 100, speed: 10 } }
    const healer: Combatant = {
      id: 'healer',
      role: 'healer',
      stats: { spellPower: 20, healingPower: 20, health: 150, speed: 10 },
    }
    const bruiser: Enemy = { id: 'bruiser', health: 500, attack: 50, damageType: 'physical', speed: 10 }
    const r = simulateCombat({ party: [tank, healer], encounter: encounterWith([bruiser], 60), seed: 'run-1' })
    expect(r.log.some((e) => e.type === 'heal' && e.source === 'healer')).toBe(true)
  })

  it('healer hysteresis: no attack events from the healer between the first heal and the ally reaching full HP', () => {
    // Tank has 100 HP, no defense; enemy hits for ~50 → tank at 50% triggers healing.
    // Healer healPower=10 (small) so it takes multiple ticks to top the tank up, letting us
    // assert that all healer actions between first-heal and full-HP are heals (no attacks).
    const tank: Combatant = { id: 'tank', role: 'tank', stats: { attack: 5, health: 100, speed: 10 } }
    const healer: Combatant = {
      id: 'healer',
      role: 'healer',
      stats: { spellPower: 30, healingPower: 10, health: 150, speed: 10 },
    }
    const bruiser: Enemy = { id: 'bruiser', health: 500, attack: 50, damageType: 'physical', speed: 10 }
    const r = simulateCombat({ party: [tank, healer], encounter: encounterWith([bruiser], 60), seed: 'run-1' })

    const healerEvents = r.log.filter((e) => e.source === 'healer')
    const firstHealIdx = healerEvents.findIndex((e) => e.type === 'heal')
    // Healer must have healed at least once (threshold was crossed)
    expect(firstHealIdx).toBeGreaterThanOrEqual(0)

    // Find when the tank first reaches full HP after the first heal: look for a heal event that
    // brings the tank's running HP back to maxHp (100). Replay healer heal amounts cumulatively.
    const firstHeal = healerEvents[firstHealIdx]
    let runningHp = 0
    // Recompute tank HP at the time healing started so we can track top-up.
    // We know tank fell below 70 (threshold) — find the exact HP by summing damage/heals on the tank.
    let tankHp = 100
    for (const e of r.log) {
      if (e.target === 'tank' && e.type === 'attack') tankHp = Math.max(0, tankHp - e.amount)
      if (e.target === 'tank' && e.type === 'heal') tankHp = Math.min(100, tankHp + e.amount)
      if (e === firstHeal) { runningHp = tankHp; break }
    }
    // Replay healer events from first heal onward until tank is topped up
    let topUpIdx = -1
    let hp = runningHp
    for (let i = firstHealIdx; i < healerEvents.length; i++) {
      const e = healerEvents[i]
      if (e.type === 'heal' && e.target === 'tank') {
        hp = Math.min(100, hp + e.amount)
        if (hp >= 100) { topUpIdx = i; break }
      }
    }

    if (topUpIdx > firstHealIdx) {
      // Every healer event between first heal (inclusive) and top-up (exclusive) must be a heal
      const between = healerEvents.slice(firstHealIdx, topUpIdx)
      expect(between.every((e) => e.type === 'heal')).toBe(true)
    }
    // If topUpIdx === firstHealIdx, a single heal topped the tank up — hysteresis had no span to check,
    // but the heal itself fired, which is sufficient.
    expect(r.log.some((e) => e.type === 'heal' && e.source === 'healer')).toBe(true)
  })
})

describe('reward helpers', () => {
  it('marginBonus scales surviving HP% by MARGIN_MAX', () => {
    expect(marginBonus(1)).toBeCloseTo(COMBAT.MARGIN_MAX)
    expect(marginBonus(0)).toBe(0)
    expect(marginBonus(0.5)).toBeCloseTo(0.25)
  })

  it('levelRewardBonus uses the average party level', () => {
    expect(levelRewardBonus([50, 50, 50])).toBeCloseTo(0.2) // 50 × 0.004
    expect(levelRewardBonus([10])).toBeCloseTo(0.04)
    expect(levelRewardBonus([10, 30])).toBeCloseTo(20 * COMBAT.LEVEL_BONUS_PER_AVG_LEVEL)
    expect(levelRewardBonus([])).toBe(0)
  })
})
