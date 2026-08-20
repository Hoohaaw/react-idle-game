import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClaimReward } from './ClaimReward'
import { SAMPLE_CLAIM_WIN, SAMPLE_CLAIM_LOSS, SAMPLE_CLAIM_WIPE } from './claimSamples'

// The two failure screens must be distinct AND trigger on the right server reason
// (combat sim: 'party-wiped' = everyone at 0 HP; 'timeout' = clock expired, enemies alive).

describe('ClaimReward outcome screens', () => {
  it('win shows Victory and the rewards section', () => {
    render(<ClaimReward result={SAMPLE_CLAIM_WIN} />)
    expect(screen.getByText('Victory')).toBeInTheDocument()
    expect(screen.getByText('Rewards')).toBeInTheDocument()
    expect(screen.queryByText(/Party Wiped|Out of Time/)).not.toBeInTheDocument()
  })

  it("reason 'party-wiped' shows the wipe screen, not the timeout screen", () => {
    render(<ClaimReward result={SAMPLE_CLAIM_WIPE} />)
    expect(screen.getByText(/Party Wiped/)).toBeInTheDocument()
    expect(screen.getByText(/Your party has fallen/)).toBeInTheDocument()
    expect(screen.queryByText(/Out of Time/)).not.toBeInTheDocument()
    expect(screen.queryByText('Rewards')).not.toBeInTheDocument()
  })

  it("reason 'timeout' shows the out-of-time screen, not the wipe screen", () => {
    render(<ClaimReward result={SAMPLE_CLAIM_LOSS} />)
    expect(screen.getByText(/Out of Time/)).toBeInTheDocument()
    expect(screen.getByText(/The clock ran out/)).toBeInTheDocument()
    expect(screen.queryByText(/Party Wiped/)).not.toBeInTheDocument()
    expect(screen.queryByText('Rewards')).not.toBeInTheDocument()
  })
})
