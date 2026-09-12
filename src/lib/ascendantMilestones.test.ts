import { describe, it, expect } from 'vitest'
import { ASCENDANT_MILESTONES, checkAscendantMilestones } from './ascendantMilestones'

describe('ASCENDANT_MILESTONES', () => {
  it('has one ladder per tracked metric: gold, 9 resources, missions/dungeons/raids cleared, transcend count', () => {
    const keys = ASCENDANT_MILESTONES.map((l) => l.metricKey)
    expect(keys).toContain('goldEarned')
    expect(keys).toContain('resourceGathered.Wood')
    expect(keys).toContain('resourceGathered.Platinum')
    expect(keys).toContain('missionsCleared')
    expect(keys).toContain('dungeonsCleared')
    expect(keys).toContain('raidsCleared')
    expect(keys).toContain('transcendCount')
    expect(keys).toHaveLength(14) // gold + 9 resources + 3 clear-counts + transcendCount
  })

  it("transcendCount's ladder is every 2, up to 50", () => {
    const ladder = ASCENDANT_MILESTONES.find((l) => l.metricKey === 'transcendCount')!
    expect(ladder.thresholds.slice(0, 5)).toEqual([2, 4, 6, 8, 10])
    expect(ladder.thresholds[ladder.thresholds.length - 1]).toBe(50)
  })
})

describe('checkAscendantMilestones', () => {
  it('claims nothing when every value is 0 and nothing was previously claimed', () => {
    const result = checkAscendantMilestones({}, 0, {})
    expect(result.newlyClaimedKeys).toEqual([])
    expect(result.shardsAwarded).toBe(0)
  })

  it('claims every threshold a value has newly crossed', () => {
    const result = checkAscendantMilestones({ goldEarned: 15000 }, 0, {})
    expect(result.newlyClaimedKeys).toEqual(expect.arrayContaining(['goldEarned.0', 'goldEarned.1']))
    expect(result.shardsAwarded).toBe(2)
  })

  it('never re-claims an already-claimed threshold', () => {
    const result = checkAscendantMilestones({ goldEarned: 15000 }, 0, { 'goldEarned.0': true, 'goldEarned.1': true })
    expect(result.newlyClaimedKeys).toEqual([])
    expect(result.shardsAwarded).toBe(0)
  })

  it("reads transcendCount from the parameter, not from lifetimeStats", () => {
    const result = checkAscendantMilestones({ transcendCount: 999 }, 2, {})
    // the lifetimeStats key "transcendCount" (if it ever existed) must be ignored — only the
    // explicit transcendCount parameter counts.
    expect(result.newlyClaimedKeys).toEqual(['transcendCount.0'])
    expect(result.shardsAwarded).toBe(1)
  })
})
