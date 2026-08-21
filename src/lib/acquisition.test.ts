import { describe, it, expect } from 'vitest'
import { evaluateCondition, type AcquisitionCondition, type PlayerAcquisitionState } from './acquisition'

const emptyState: PlayerAcquisitionState = {
  characters: [],
  lifetimeStats: {},
  mapProgress: {},
}

describe('evaluateCondition', () => {
  it('an undefined condition is always met (gold-only)', () => {
    expect(evaluateCondition(undefined, emptyState)).toBe(true)
  })

  describe('characterLevel', () => {
    const condition: AcquisitionCondition = { type: 'characterLevel', level: 10 }
    it('met when any character is at/above the level', () => {
      const state: PlayerAcquisitionState = { ...emptyState, characters: [{ level: 5, stats: {} }, { level: 10, stats: {} }] }
      expect(evaluateCondition(condition, state)).toBe(true)
    })
    it('not met when every character is below the level', () => {
      const state: PlayerAcquisitionState = { ...emptyState, characters: [{ level: 5, stats: {} }, { level: 9, stats: {} }] }
      expect(evaluateCondition(condition, state)).toBe(false)
    })
  })

  describe('statThreshold', () => {
    const condition: AcquisitionCondition = { type: 'statThreshold', stat: 'attack', threshold: 50 }
    it('met when any character has the stat at/above the threshold', () => {
      const state: PlayerAcquisitionState = { ...emptyState, characters: [{ level: 1, stats: { attack: 60 } }] }
      expect(evaluateCondition(condition, state)).toBe(true)
    })
    it('not met when no character has the stat', () => {
      const state: PlayerAcquisitionState = { ...emptyState, characters: [{ level: 1, stats: { attack: 10 } }] }
      expect(evaluateCondition(condition, state)).toBe(false)
    })
  })

  describe('resourceTotal', () => {
    const condition: AcquisitionCondition = { type: 'resourceTotal', resource: 'Wood', threshold: 500 }
    it('met when the lifetime resourceGathered total is at/above the threshold', () => {
      const state: PlayerAcquisitionState = { ...emptyState, lifetimeStats: { 'resourceGathered.Wood': 500 } }
      expect(evaluateCondition(condition, state)).toBe(true)
    })
    it('not met when below the threshold', () => {
      const state: PlayerAcquisitionState = { ...emptyState, lifetimeStats: { 'resourceGathered.Wood': 499 } }
      expect(evaluateCondition(condition, state)).toBe(false)
    })
  })

  describe('goldTotal', () => {
    const condition: AcquisitionCondition = { type: 'goldTotal', threshold: 10000 }
    it('met when lifetime goldEarned is at/above the threshold', () => {
      const state: PlayerAcquisitionState = { ...emptyState, lifetimeStats: { goldEarned: 10000 } }
      expect(evaluateCondition(condition, state)).toBe(true)
    })
    it('not met when below', () => {
      const state: PlayerAcquisitionState = { ...emptyState, lifetimeStats: { goldEarned: 9999 } }
      expect(evaluateCondition(condition, state)).toBe(false)
    })
  })

  describe('missionTimeTotal', () => {
    const condition: AcquisitionCondition = { type: 'missionTimeTotal', threshold: 3600 }
    it('met when lifetime missionSecondsSent is at/above the threshold', () => {
      const state: PlayerAcquisitionState = { ...emptyState, lifetimeStats: { missionSecondsSent: 3600 } }
      expect(evaluateCondition(condition, state)).toBe(true)
    })
    it('not met when below', () => {
      const state: PlayerAcquisitionState = { ...emptyState, lifetimeStats: { missionSecondsSent: 100 } }
      expect(evaluateCondition(condition, state)).toBe(false)
    })
  })

  describe('mapCompletion', () => {
    const condition: AcquisitionCondition = { type: 'mapCompletion', map: 'embercrag', stage: 7 }
    it('met when the map is cleared to at/above the stage', () => {
      const state: PlayerAcquisitionState = { ...emptyState, mapProgress: { embercrag: 7 } }
      expect(evaluateCondition(condition, state)).toBe(true)
    })
    it('not met when cleared less than the stage', () => {
      const state: PlayerAcquisitionState = { ...emptyState, mapProgress: { embercrag: 6 } }
      expect(evaluateCondition(condition, state)).toBe(false)
    })
    it('defaults the required stage to 7 (boss/full clear) when stage is omitted', () => {
      const cond: AcquisitionCondition = { type: 'mapCompletion', map: 'embercrag' }
      expect(evaluateCondition(cond, { ...emptyState, mapProgress: { embercrag: 6 } })).toBe(false)
      expect(evaluateCondition(cond, { ...emptyState, mapProgress: { embercrag: 7 } })).toBe(true)
    })
  })
})
