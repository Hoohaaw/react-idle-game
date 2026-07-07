import { describe, it, expect } from 'vitest'
import {
  INFIRMARY,
  bedsForLevel,
  regenPerSec,
  stabilizeSeconds,
  healState,
  settleForUpgrade,
} from './infirmary'

// ---------------------------------------------------------------------------
// bedsForLevel
// ---------------------------------------------------------------------------

describe('bedsForLevel', () => {
  it('returns the infirmary level as the bed count (identity)', () => {
    expect(bedsForLevel(1)).toBe(1)
    expect(bedsForLevel(3)).toBe(3)
    expect(bedsForLevel(5)).toBe(5)
  })

  it('covers every level in the valid range 1–MAX_LEVEL', () => {
    for (let l = 1; l <= INFIRMARY.MAX_LEVEL; l++) {
      expect(bedsForLevel(l)).toBe(l)
    }
  })
})

// ---------------------------------------------------------------------------
// regenPerSec
// ---------------------------------------------------------------------------

describe('regenPerSec', () => {
  it('returns the correct HP/s for each defined infirmary level', () => {
    expect(regenPerSec(1)).toBe(10)
    expect(regenPerSec(2)).toBe(25)
    expect(regenPerSec(3)).toBe(50)
    expect(regenPerSec(4)).toBe(75)
    expect(regenPerSec(5)).toBe(100)
  })

  it('falls back to the level-1 rate (10) for an unknown infirmary level', () => {
    expect(regenPerSec(0)).toBe(10)
    expect(regenPerSec(99)).toBe(10)
    expect(regenPerSec(-1)).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// stabilizeSeconds
// ---------------------------------------------------------------------------

describe('stabilizeSeconds', () => {
  it('level-10 character at infirmary 1 = 300s', () => {
    expect(stabilizeSeconds(10, 1)).toBe(300)
  })

  it('level-10 character at infirmary 5 = 60s', () => {
    expect(stabilizeSeconds(10, 5)).toBe(60)
  })

  it('scales linearly with character level at a fixed infirmary level', () => {
    // charLevel * 30 / 1 — already whole numbers, no ceil required
    expect(stabilizeSeconds(1, 1)).toBe(30)
    expect(stabilizeSeconds(5, 1)).toBe(150)
    expect(stabilizeSeconds(50, 1)).toBe(1500)
  })

  it('divides by infirmary level (higher building = faster stabilize)', () => {
    expect(stabilizeSeconds(10, 2)).toBe(150) // ceil(300 / 2) = 150
    expect(stabilizeSeconds(10, 3)).toBe(100) // ceil(300 / 3) = 100
    expect(stabilizeSeconds(10, 4)).toBe(75)  // ceil(300 / 4) = 75
  })

  it('ceils fractional seconds (odd charLevel / infirmaryLevel combo)', () => {
    // charLevel=1, infirmaryLevel=2 → 30/2 = 15 (exact, no rounding needed)
    expect(stabilizeSeconds(1, 2)).toBe(15)
    // charLevel=1, infirmaryLevel=3 → 30/3 = 10 exactly
    expect(stabilizeSeconds(1, 3)).toBe(10)
    // charLevel=1, infirmaryLevel=4 → ceil(30/4) = ceil(7.5) = 8
    expect(stabilizeSeconds(1, 4)).toBe(8)
    // charLevel=1, infirmaryLevel=5 → ceil(30/5) = 6
    expect(stabilizeSeconds(1, 5)).toBe(6)
  })
})

// ---------------------------------------------------------------------------
// healState — stabilizing phase
// ---------------------------------------------------------------------------

describe('healState — stabilizing phase', () => {
  // Level-10 char at infirmary 1: stabilize = 300s
  // Admitted at t=0 with 0 HP, maxHp=200
  const base = {
    hpAtAdmission: 0,
    admittedAtMs: 0,
    charLevel: 10,
    infirmaryLevel: 1,
    maxHp: 200,
  }

  it('phase is stabilizing immediately after admission at 0 HP', () => {
    const state = healState({ ...base, nowMs: 0 })
    expect(state.phase).toBe('stabilizing')
    expect(state.currentHp).toBe(0)
    expect(state.stabilizeRemainingSec).toBe(300)
  })

  it('currentHp stays 0 throughout the stabilize window', () => {
    // 150 s in — halfway, still stabilizing
    const state = healState({ ...base, nowMs: 150_000 })
    expect(state.phase).toBe('stabilizing')
    expect(state.currentHp).toBe(0)
    expect(state.stabilizeRemainingSec).toBe(150)
  })

  it('stabilizeRemainingSec counts down correctly at 299s elapsed', () => {
    const state = healState({ ...base, nowMs: 299_000 })
    expect(state.phase).toBe('stabilizing')
    expect(state.stabilizeRemainingSec).toBe(1)
    expect(state.currentHp).toBe(0)
  })

  it('secondsToFull accounts for remaining stabilize time plus heal time', () => {
    // At nowMs=0: 300s stabilize + ceil(200/10)=20s healing = 320s total
    const state = healState({ ...base, nowMs: 0 })
    expect(state.secondsToFull).toBe(320)
  })

  it('secondsToFull reduces as time elapses during stabilize', () => {
    // At nowMs=100_000: 200s stabilize left + ceil(200/10)=20s = 220s
    const state = healState({ ...base, nowMs: 100_000 })
    expect(state.secondsToFull).toBe(220)
  })
})

// ---------------------------------------------------------------------------
// healState — healing phase (admitted at 0 HP, past stabilize)
// ---------------------------------------------------------------------------

describe('healState — healing phase after stabilize', () => {
  const base = {
    hpAtAdmission: 0,
    admittedAtMs: 0,
    charLevel: 10,
    infirmaryLevel: 1, // rate = 10 HP/s
    maxHp: 200,
  }
  // Stabilize ends at t=300s. Healing begins at t=300s.

  it('phase transitions to healing at exactly stabilize end', () => {
    // At 300s elapsed: healElapsedSec = 0, currentHp = 0; still not full
    const state = healState({ ...base, nowMs: 300_000 })
    expect(state.phase).toBe('healing')
    expect(state.currentHp).toBe(0)
    expect(state.stabilizeRemainingSec).toBe(0)
  })

  it('accrues HP correctly at 10 HP/s after stabilize', () => {
    // At 310s: 10s of regen at 10 HP/s → floor(10 * 10) = 100 HP
    const state = healState({ ...base, nowMs: 310_000 })
    expect(state.phase).toBe('healing')
    expect(state.currentHp).toBe(100)
  })

  it('secondsToFull = ceil((maxHp - currentHp) / rate) while healing', () => {
    // At 310s: currentHp=100, remaining=100, rate=10 → ceil(100/10) = 10s
    const state = healState({ ...base, nowMs: 310_000 })
    expect(state.secondsToFull).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// healState — full phase
// ---------------------------------------------------------------------------

describe('healState — full phase', () => {
  const base = {
    hpAtAdmission: 0,
    admittedAtMs: 0,
    charLevel: 10,
    infirmaryLevel: 1, // rate = 10 HP/s, stabilize = 300s
    maxHp: 200,
  }
  // Full at: 300s stabilize + ceil(200/10)=20s = 320s total

  it('phase is full once maxHp is reached', () => {
    const state = healState({ ...base, nowMs: 320_000 })
    expect(state.phase).toBe('full')
  })

  it('currentHp is clamped to maxHp when full', () => {
    const state = healState({ ...base, nowMs: 320_000 })
    expect(state.currentHp).toBe(200)
  })

  it('secondsToFull and stabilizeRemainingSec are both 0 when full', () => {
    const state = healState({ ...base, nowMs: 320_000 })
    expect(state.secondsToFull).toBe(0)
    expect(state.stabilizeRemainingSec).toBe(0)
  })

  it('remains full and clamped well past the heal time', () => {
    const state = healState({ ...base, nowMs: 9_999_999 })
    expect(state.phase).toBe('full')
    expect(state.currentHp).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// healState — hpAtAdmission > 0 skips stabilize entirely
// ---------------------------------------------------------------------------

describe('healState — positive hpAtAdmission skips stabilize', () => {
  // Infirmary level 2: rate = 25 HP/s, stabilize is skipped regardless
  const base = {
    hpAtAdmission: 50,
    admittedAtMs: 0,
    charLevel: 10,
    infirmaryLevel: 2, // 25 HP/s
    maxHp: 200,
  }

  it('phase is healing immediately at nowMs=admittedAtMs when hpAtAdmission > 0', () => {
    const state = healState({ ...base, nowMs: 0 })
    expect(state.phase).toBe('healing')
    expect(state.stabilizeRemainingSec).toBe(0)
    expect(state.currentHp).toBe(50)
  })

  it('HP accrues at 25 HP/s (level-2 infirmary rate)', () => {
    // 2s elapsed: 50 + floor(2 * 25) = 50 + 50 = 100
    const state = healState({ ...base, nowMs: 2_000 })
    expect(state.currentHp).toBe(100)
    expect(state.phase).toBe('healing')
  })

  it('HP accrues at the correct fractional second boundary', () => {
    // 0.5s elapsed: floor(0.5 * 25) = floor(12.5) = 12 → 50 + 12 = 62
    const state = healState({ ...base, nowMs: 500 })
    expect(state.currentHp).toBe(62)
  })

  it('reaches full once HP hits maxHp', () => {
    // Need to heal 150 HP at 25 HP/s → 6s exactly → full at t=6000ms
    const state = healState({ ...base, nowMs: 6_000 })
    expect(state.phase).toBe('full')
    expect(state.currentHp).toBe(200)
  })

  it('secondsToFull = ceil((maxHp - hpAtAdmission) / rate) at admission moment', () => {
    // ceil((200 - 50) / 25) = ceil(6) = 6s
    const state = healState({ ...base, nowMs: 0 })
    expect(state.secondsToFull).toBe(6)
  })

  it('secondsToFull accounts for partial regen progress', () => {
    // At 1s: currentHp = 50 + 25 = 75; remaining = 125; ceil(125/25) = 5
    const state = healState({ ...base, nowMs: 1_000 })
    expect(state.secondsToFull).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// healState — admit-now projection (admittedAtMs === nowMs)
// ---------------------------------------------------------------------------

describe('healState — admit-now projection', () => {
  it('immediately projects secondsToFull when admitted at 0 HP', () => {
    const nowMs = 1_000_000
    const state = healState({
      hpAtAdmission: 0,
      admittedAtMs: nowMs,
      nowMs,
      charLevel: 5,
      infirmaryLevel: 1, // stabilize = ceil(5*30/1) = 150s, rate = 10 HP/s
      maxHp: 100,
    })
    // stabilizeRemainingSec = 150, secondsToFull = 150 + ceil(100/10) = 160
    expect(state.phase).toBe('stabilizing')
    expect(state.stabilizeRemainingSec).toBe(150)
    expect(state.secondsToFull).toBe(160)
    expect(state.currentHp).toBe(0)
  })

  it('immediately projects secondsToFull when admitted with positive HP', () => {
    const nowMs = 5_000_000
    const state = healState({
      hpAtAdmission: 80,
      admittedAtMs: nowMs,
      nowMs,
      charLevel: 5,
      infirmaryLevel: 2, // rate = 25 HP/s, no stabilize
      maxHp: 100,
    })
    // ceil((100 - 80) / 25) = ceil(0.8) = 1s
    expect(state.phase).toBe('healing')
    expect(state.secondsToFull).toBe(1)
    expect(state.currentHp).toBe(80)
  })
})

// ---------------------------------------------------------------------------
// settleForUpgrade — healing character
// ---------------------------------------------------------------------------

describe('settleForUpgrade — healing phase', () => {
  it('banks derived currentHp as hpAtAdmission and resets clock to nowMs', () => {
    // hpAtAdmission=50, rate=10 HP/s, 5s elapsed → currentHp = floor(50 + 5*10) = 100
    const nowMs = 5_000
    const result = settleForUpgrade({
      hpAtAdmission: 50,
      admittedAtMs: 0,
      nowMs,
      charLevel: 5,
      infirmaryLevel: 1,
      maxHp: 200,
      newInfirmaryLevel: 2,
    })
    expect(result.hpAtAdmission).toBe(100)
    expect(result.currentHp).toBe(100)
    expect(result.admittedAtMs).toBe(nowMs)
  })

  it('settled state immediately matches pre-settlement currentHp', () => {
    const nowMs = 5_000
    const input = {
      hpAtAdmission: 50,
      admittedAtMs: 0,
      nowMs,
      charLevel: 5,
      infirmaryLevel: 1,
      maxHp: 200,
    }
    const before = healState(input)
    const result = settleForUpgrade({ ...input, newInfirmaryLevel: 2 })
    const after = healState({
      hpAtAdmission: result.hpAtAdmission,
      admittedAtMs: result.admittedAtMs,
      nowMs,
      charLevel: input.charLevel,
      infirmaryLevel: 2,
      maxHp: input.maxHp,
    })
    expect(after.currentHp).toBe(before.currentHp)
    expect(after.phase).toBe(before.phase)
  })
})

// ---------------------------------------------------------------------------
// settleForUpgrade — stabilizing character
// ---------------------------------------------------------------------------

describe('settleForUpgrade — stabilizing phase', () => {
  // charLevel=10, infirmary 1: stabilize = 300s
  // After upgrade to infirmary 2: stabilize = 150s
  // Half-way through infirmary-1 stabilize = 150s elapsed → elapsedFrac = 0.5
  // New admittedAtMs = nowMs - 0.5 * 150s = nowMs - 75_000ms

  it('preserves elapsed fraction of the stabilize window under the new duration', () => {
    const nowMs = 150_000 // 150s into a 300s stabilize → half-way
    const result = settleForUpgrade({
      hpAtAdmission: 0,
      admittedAtMs: 0,
      nowMs,
      charLevel: 10,
      infirmaryLevel: 1,
      maxHp: 200,
      newInfirmaryLevel: 2,
    })
    // newDur = 150s; half-elapsed → admittedAtMs = 150_000 - 0.5 * 150_000 = 75_000
    expect(result.hpAtAdmission).toBe(0)
    expect(result.currentHp).toBe(0)
    expect(result.admittedAtMs).toBe(75_000)
  })

  it('settled state has matching phase and currentHp after upgrade', () => {
    const nowMs = 150_000
    const input = {
      hpAtAdmission: 0,
      admittedAtMs: 0,
      nowMs,
      charLevel: 10,
      infirmaryLevel: 1,
      maxHp: 200,
    }
    const before = healState(input)
    const result = settleForUpgrade({ ...input, newInfirmaryLevel: 2 })
    const after = healState({
      hpAtAdmission: result.hpAtAdmission,
      admittedAtMs: result.admittedAtMs,
      nowMs,
      charLevel: input.charLevel,
      infirmaryLevel: 2,
      maxHp: input.maxHp,
    })
    expect(after.currentHp).toBe(before.currentHp)
    expect(after.phase).toBe(before.phase)
  })

  it('a character at 0% elapsed fraction stays at the beginning of the new window', () => {
    // Admitted at nowMs → elapsedFrac = 0 → new admittedAtMs = nowMs - 0 = nowMs
    const nowMs = 0
    const result = settleForUpgrade({
      hpAtAdmission: 0,
      admittedAtMs: nowMs,
      nowMs,
      charLevel: 10,
      infirmaryLevel: 1,
      maxHp: 200,
      newInfirmaryLevel: 2,
    })
    expect(result.admittedAtMs).toBe(nowMs)
    expect(result.hpAtAdmission).toBe(0)
  })

  it('at 100% elapsed fraction the elapsedFrac clamp is exercised — character transitions to healing branch', () => {
    // At exactly nowMs = stabilize end (300_000ms), healState returns phase:'healing'
    // (stabilizeRemainingSec = ceil(0/1000) = 0), so settleForUpgrade takes the
    // healing branch: banks currentHp=0 with admittedAtMs=nowMs.
    const nowMs = 300_000
    const result = settleForUpgrade({
      hpAtAdmission: 0,
      admittedAtMs: 0,
      nowMs,
      charLevel: 10,
      infirmaryLevel: 1,
      maxHp: 200,
      newInfirmaryLevel: 2,
    })
    expect(result.hpAtAdmission).toBe(0)
    expect(result.currentHp).toBe(0)
    expect(result.admittedAtMs).toBe(nowMs)
  })

  it('elapsedFrac clamp is exercised for genuinely over-time stabilize (past boundary still in stabilizing)', () => {
    // 1s before stabilize ends → still stabilizing (stabilizeRemainingSec=1)
    // elapsedFrac = 299/300 = ~0.9967; newDur(infirmary 2) = 150s
    // new admittedAtMs = 299_000 - 0.9967 * 150_000 ≈ 299_000 - 149_500 = 149_500
    const nowMs = 299_000
    const result = settleForUpgrade({
      hpAtAdmission: 0,
      admittedAtMs: 0,
      nowMs,
      charLevel: 10,
      infirmaryLevel: 1,
      maxHp: 200,
      newInfirmaryLevel: 2,
    })
    const elapsedFrac = 299 / 300
    const newDur = stabilizeSeconds(10, 2) // 150
    const expectedAdmittedAtMs = nowMs - elapsedFrac * newDur * 1000
    expect(result.admittedAtMs).toBeCloseTo(expectedAdmittedAtMs)
    expect(result.hpAtAdmission).toBe(0)
  })

  it('upgrading from level 1 to level 3 compresses the stabilize window correctly', () => {
    // charLevel=6, infirmary 1: stabilize = ceil(6*30/1) = 180s
    // 60s elapsed → elapsedFrac = 60/180 = 1/3
    // infirmary 3: stabilize = ceil(6*30/3) = 60s
    // new admittedAtMs = nowMs - (1/3 * 60_000) = 180_000 - 20_000 = 160_000
    const nowMs = 60_000
    const result = settleForUpgrade({
      hpAtAdmission: 0,
      admittedAtMs: 0,
      nowMs,
      charLevel: 6,
      infirmaryLevel: 1,
      maxHp: 300,
      newInfirmaryLevel: 3,
    })
    const expectedAdmittedAtMs = nowMs - (1 / 3) * 60_000
    expect(result.admittedAtMs).toBeCloseTo(expectedAdmittedAtMs)
    expect(result.hpAtAdmission).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// INFIRMARY constants shape invariants
// ---------------------------------------------------------------------------

describe('INFIRMARY constants', () => {
  it('HPS_BY_LEVEL has entries for levels 1 through MAX_LEVEL', () => {
    for (let l = 1; l <= INFIRMARY.MAX_LEVEL; l++) {
      expect(INFIRMARY.HPS_BY_LEVEL[l]).toBeGreaterThan(0)
    }
  })

  it('HP/s rates are strictly increasing with infirmary level', () => {
    for (let l = 2; l <= INFIRMARY.MAX_LEVEL; l++) {
      expect(INFIRMARY.HPS_BY_LEVEL[l]).toBeGreaterThan(INFIRMARY.HPS_BY_LEVEL[l - 1])
    }
  })

  it('MAX_LEVEL is 5', () => {
    expect(INFIRMARY.MAX_LEVEL).toBe(5)
  })

  it('STABILIZE_SEC_PER_CHAR_LEVEL is 30', () => {
    expect(INFIRMARY.STABILIZE_SEC_PER_CHAR_LEVEL).toBe(30)
  })
})
