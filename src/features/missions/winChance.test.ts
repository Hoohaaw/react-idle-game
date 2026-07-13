import { describe, it, expect } from 'vitest'
import { estimateWinChance, type EstimateMember } from './winChance'
import type { MissionEnemyView } from '@/services/missions'

const bruiser = (over: Partial<EstimateMember> = {}): EstimateMember => ({
  id: 'hero-1',
  role: 'damage',
  stats: { health: 500, attack: 80, strength: 40, speed: 12, defense: 20 },
  ...over,
})

const enemy = (stats: NonNullable<MissionEnemyView['stats']>, over: Partial<MissionEnemyView> = {}): MissionEnemyView => ({
  name: 'Test Enemy',
  count: 1,
  damageType: 'physical',
  resistances: [],
  stats,
  ...over,
})

describe('estimateWinChance', () => {
  it('overwhelming party vs a weak enemy → 100%', () => {
    const pct = estimateWinChance({
      party: [bruiser()],
      enemies: [enemy({ health: 50, attack: 1, speed: 10 })],
      timeLimitSeconds: 180,
    })
    expect(pct).toBe(100)
  })

  it('harmless party vs an untouchable wall → 0% (timeout loss)', () => {
    const pct = estimateWinChance({
      party: [bruiser({ stats: { health: 500, attack: 0, speed: 10 } })],
      enemies: [enemy({ health: 100000, attack: 0, speed: 10, defense: 1000 })],
      timeLimitSeconds: 180,
    })
    expect(pct).toBe(0)
  })

  it('is deterministic (fixed seed list) and null-safe without enemy stats or a time limit', () => {
    const args = {
      party: [bruiser()],
      enemies: [enemy({ health: 400, attack: 60, speed: 10, defense: 15 })],
      timeLimitSeconds: 180,
    }
    expect(estimateWinChance(args)).toBe(estimateWinChance(args))
    expect(estimateWinChance({ ...args, enemies: [{ ...args.enemies[0], stats: undefined }] })).toBeNull()
    expect(estimateWinChance({ ...args, timeLimitSeconds: null })).toBeNull()
    expect(estimateWinChance({ ...args, party: [] })).toBeNull()
  })
})
