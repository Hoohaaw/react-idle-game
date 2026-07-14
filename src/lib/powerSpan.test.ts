import { describe, it, expect } from 'vitest'
import { powerSpan, SPAN_STATS } from './powerSpan'

describe('powerSpan', () => {
  it('renders the ±10% per-fight band (ADR-0038)', () => {
    expect(powerSpan(50)).toBe('45–55')
    expect(powerSpan(100)).toBe('90–110')
  })

  it('collapses to a single number when rounding closes the band', () => {
    expect(powerSpan(0)).toBe('0')
  })

  it('covers the attack-type stats only', () => {
    expect(SPAN_STATS.has('attack')).toBe(true)
    expect(SPAN_STATS.has('spellPower')).toBe(true)
    expect(SPAN_STATS.has('healingPower')).toBe(false) // healing does not roll
  })
})
