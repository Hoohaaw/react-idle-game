import { describe, it, expect } from 'vitest'
import { GROUP_PARTY_CAP, GROUP_LOCKOUT, isLockedOut, nextResetBoundary } from './groupContent'

describe('groupContent constants', () => {
  it('dungeon caps at 5, raid at 10', () => {
    expect(GROUP_PARTY_CAP.dungeon).toBe(5)
    expect(GROUP_PARTY_CAP.raid).toBe(10)
  })
  it('dungeon locks out daily, raid weekly', () => {
    expect(GROUP_LOCKOUT.dungeon).toBe('daily')
    expect(GROUP_LOCKOUT.raid).toBe('weekly')
  })
})

describe('nextResetBoundary', () => {
  it('daily: next UTC midnight after the cleared timestamp', () => {
    const boundary = nextResetBoundary('2026-09-08T13:00:00.000Z', 'daily')
    expect(boundary.toISOString()).toBe('2026-09-09T00:00:00.000Z')
  })
  it('daily: cleared exactly at midnight rolls to the FOLLOWING midnight', () => {
    const boundary = nextResetBoundary('2026-09-09T00:00:00.000Z', 'daily')
    expect(boundary.toISOString()).toBe('2026-09-10T00:00:00.000Z')
  })
  it('weekly: next Sunday UTC midnight after a mid-week clear', () => {
    // 2026-09-08 is a Tuesday; next Sunday 00:00 UTC is 2026-09-13.
    const boundary = nextResetBoundary('2026-09-08T13:00:00.000Z', 'weekly')
    expect(boundary.toISOString()).toBe('2026-09-13T00:00:00.000Z')
  })
  it('weekly: cleared exactly at a Sunday-midnight boundary rolls to the FOLLOWING Sunday', () => {
    const boundary = nextResetBoundary('2026-09-13T00:00:00.000Z', 'weekly')
    expect(boundary.toISOString()).toBe('2026-09-20T00:00:00.000Z')
  })
})

describe('isLockedOut', () => {
  it('never locked out when there is no prior clear', () => {
    expect(isLockedOut(null, 'daily')).toBe(false)
  })
  it('locked out before the reset boundary, free after it', () => {
    const clearedAt = '2026-09-08T13:00:00.000Z' // boundary: 2026-09-09T00:00:00Z
    expect(isLockedOut(clearedAt, 'daily', new Date('2026-09-08T23:59:59.000Z'))).toBe(true)
    expect(isLockedOut(clearedAt, 'daily', new Date('2026-09-09T00:00:00.000Z'))).toBe(false)
  })
})
