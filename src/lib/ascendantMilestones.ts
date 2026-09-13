// The milestone ladder registry (ADR-0023, spec §4e) — the documented extensibility pattern for
// adding a new Ascendant-Shard-earning metric: (1) add the key to LIFETIME_STAT_KEYS (or a
// dedicated profiles column for a non-lifetime_stats counter, like transcendCount), (2) have the
// relevant Edge Function increment it, (3) add its ladder here. Nothing else — checkAscendantMilestones
// is generic over every entry, never special-cases a metric by name.
//
// checkAscendantMilestones here is a CLIENT-PREVIEW MIRROR ONLY (same relationship src/lib/
// reset.ts's computeEchoesAward has to reset_player's SQL) — never call this to compute an actual
// award. The authoritative check is public.check_ascendant_milestones (SQL, same migration as
// transcend_player), computed inside the RPC that owns the row lock. See spec §5c for why this
// split is load-bearing, not incidental.

import { RESOURCE_SOURCE } from './resources.ts'
import { resourceGatheredKey } from './lifetimeStats.ts'

export type MilestoneLadder = {
  metricKey: string
  label: string
  thresholds: number[]
  shardsPerStep: number
}

export const ASCENDANT_MILESTONES: MilestoneLadder[] = [
  { metricKey: 'goldEarned', label: 'Gold Earned', thresholds: [1_000, 10_000, 100_000, 1_000_000, 10_000_000], shardsPerStep: 1 },
  ...Object.keys(RESOURCE_SOURCE).map((resource) => ({
    metricKey: resourceGatheredKey(resource),
    label: `${resource} Gathered`,
    thresholds: [500, 5_000, 50_000, 500_000],
    shardsPerStep: 1,
  })),
  { metricKey: 'missionsCleared', label: 'Missions Cleared', thresholds: [50, 500, 5_000], shardsPerStep: 1 },
  { metricKey: 'dungeonsCleared', label: 'Dungeons Cleared', thresholds: [10, 100, 1_000], shardsPerStep: 1 },
  { metricKey: 'raidsCleared', label: 'Raids Cleared', thresholds: [5, 50, 500], shardsPerStep: 1 },
  {
    metricKey: 'transcendCount',
    label: 'Times Transcended',
    thresholds: Array.from({ length: 25 }, (_, i) => (i + 1) * 2),
    shardsPerStep: 1,
  },
]

export function checkAscendantMilestones(
  lifetimeStats: Record<string, number>,
  transcendCount: number,
  claimed: Record<string, boolean>,
): { newlyClaimedKeys: string[]; shardsAwarded: number } {
  const newlyClaimedKeys: string[] = []
  let shardsAwarded = 0
  for (const ladder of ASCENDANT_MILESTONES) {
    const value = ladder.metricKey === 'transcendCount' ? transcendCount : (lifetimeStats[ladder.metricKey] ?? 0)
    ladder.thresholds.forEach((threshold, i) => {
      const key = `${ladder.metricKey}.${i}`
      if (value >= threshold && !claimed[key]) {
        newlyClaimedKeys.push(key)
        shardsAwarded += ladder.shardsPerStep
      }
    })
  }
  return { newlyClaimedKeys, shardsAwarded }
}
