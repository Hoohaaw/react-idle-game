import { describe, it, expect } from 'vitest'
import { formatRemaining } from './time'

describe('formatRemaining', () => {
  it('returns "Ready" for zero milliseconds', () => {
    expect(formatRemaining(0)).toBe('Ready')
  })

  it('returns "Ready" for negative milliseconds', () => {
    expect(formatRemaining(-1)).toBe('Ready')
    expect(formatRemaining(-1000)).toBe('Ready')
  })

  it('formats sub-minute durations as MM:SS', () => {
    expect(formatRemaining(1000)).toBe('00:01')
    expect(formatRemaining(59000)).toBe('00:59')
    expect(formatRemaining(30000)).toBe('00:30')
  })

  it('formats exactly one minute as 01:00', () => {
    expect(formatRemaining(60000)).toBe('01:00')
  })

  it('formats sub-hour durations as MM:SS with padded minutes', () => {
    expect(formatRemaining(90000)).toBe('01:30')
    expect(formatRemaining(9 * 60 * 1000 + 5000)).toBe('09:05')
    expect(formatRemaining(59 * 60 * 1000 + 59000)).toBe('59:59')
  })

  it('formats exactly one hour as "1h 0m"', () => {
    expect(formatRemaining(3600000)).toBe('1h 0m')
  })

  it('formats durations >= 1 hour as "Hh Mm"', () => {
    expect(formatRemaining(3600000 + 30 * 60 * 1000)).toBe('1h 30m')
    expect(formatRemaining(2 * 3600000)).toBe('2h 0m')
    expect(formatRemaining(2 * 3600000 + 15 * 60 * 1000)).toBe('2h 15m')
  })

  it('truncates sub-second precision without rounding up', () => {
    // 999 ms floors to 0 total seconds → displays 00:00, not Ready (Ready is only for ms <= 0)
    expect(formatRemaining(999)).toBe('00:00')
    // 1999 ms floors to 1 second
    expect(formatRemaining(1999)).toBe('00:01')
  })

  it('does not show seconds in the hour format', () => {
    // 1h 0m 45s → only hours and minutes shown
    expect(formatRemaining(3600000 + 45000)).toBe('1h 0m')
  })
})
