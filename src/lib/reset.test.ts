import { describe, it, expect } from 'vitest'
import { RESET_GATE_STAGE, sumStagesCleared, isResetGateMet, computeEchoesAward } from './reset'

describe('sumStagesCleared', () => {
  it('sums every map\'s highest stage cleared', () => {
    expect(sumStagesCleared({ gravemarch: 7, embercrag: 3 })).toBe(10)
  })
  it('is 0 for an empty map_progress', () => {
    expect(sumStagesCleared({})).toBe(0)
  })
})

describe('isResetGateMet', () => {
  it('requires at least RESET_GATE_STAGE (7)', () => {
    expect(isResetGateMet(6)).toBe(false)
    expect(isResetGateMet(7)).toBe(true)
    expect(isResetGateMet(8)).toBe(true)
    expect(RESET_GATE_STAGE).toBe(7)
  })
})

describe('computeEchoesAward', () => {
  it('matches the SQL formula: floor(stages * 10) + floor(sqrt(gold) * 2)', () => {
    expect(computeEchoesAward(7, 500)).toBe(70 + 44) // floor(sqrt(500)*2) = floor(44.72...) = 44
    expect(computeEchoesAward(21, 5000)).toBe(210 + 141) // floor(sqrt(5000)*2) = floor(141.42...) = 141
  })
  it('is 0 for a fresh account (no stages, no gold)', () => {
    expect(computeEchoesAward(0, 0)).toBe(0)
  })
})
