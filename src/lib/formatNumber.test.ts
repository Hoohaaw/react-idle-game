import { describe, it, expect } from 'vitest'
import { formatNumber } from './formatNumber'

describe('formatNumber', () => {
  it('formats numbers below 1,000 as a plain integer, matching the old toLocaleString output', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(142)).toBe('142')
    expect(formatNumber(999)).toBe('999')
  })

  it('formats thousands with a K suffix, trimming trailing decimal zeros', () => {
    expect(formatNumber(1000)).toBe('1K')
    expect(formatNumber(1500)).toBe('1.5K')
    expect(formatNumber(10000)).toBe('10K')
    expect(formatNumber(12340)).toBe('12.3K')
  })

  it('switches to 0 decimals once the scaled value reaches 100, without dropping a digit', () => {
    expect(formatNumber(100000)).toBe('100K')
    expect(formatNumber(999000)).toBe('999K')
  })

  it('formats millions with an M suffix', () => {
    expect(formatNumber(1_000_000)).toBe('1M')
    expect(formatNumber(2_500_000)).toBe('2.5M')
    expect(formatNumber(125_000_000)).toBe('125M')
  })

  it('formats billions with a B suffix', () => {
    expect(formatNumber(1_000_000_000)).toBe('1B')
    expect(formatNumber(4_200_000_000)).toBe('4.2B')
  })

  it('promotes to the next suffix tier when rounding reaches 1000 (no "1000K" / "1000M")', () => {
    expect(formatNumber(999499)).toBe('999K')
    expect(formatNumber(999500)).toBe('1M')
    expect(formatNumber(999999)).toBe('1M')
    expect(formatNumber(999500000)).toBe('1B')
  })

  it('passes non-finite values through as plain text, with no suffix', () => {
    expect(formatNumber(Infinity)).toBe('Infinity')
    expect(formatNumber(-Infinity)).toBe('-Infinity')
    expect(formatNumber(NaN)).toBe('NaN')
  })

  it('preserves the sign on negative numbers', () => {
    expect(formatNumber(-142)).toBe('-142')
    expect(formatNumber(-1500)).toBe('-1.5K')
  })
})
