import { describe, it, expect } from 'vitest'
import { powerSpan, SPAN_STATS } from './powerSpan'

describe('powerSpan', () => {
  it('renders the ±40% per-fight band (ADR-0038, widened by ADR-0063)', () => {
    expect(powerSpan(50)).toBe('30–70')
    expect(powerSpan(100)).toBe('60–140')
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
