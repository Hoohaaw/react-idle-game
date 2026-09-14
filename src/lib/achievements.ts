// The achievements registry (spec docs/superpowers/specs/2026-09-13-achievements-design.md) — a
// purely cosmetic badge system, architecturally mirroring src/lib/ascendantMilestones.ts's
// pattern (threshold ladders, permanent-claim tracking) but with no reward payout.
//
// checkAchievements here is a CLIENT-PREVIEW MIRROR ONLY (same relationship
// ascendantMilestones.ts's checkAscendantMilestones has to its SQL counterpart) — never call this
// to compute an actual claim. The authoritative check is public.check_achievements (SQL, same
// migration family as record_login/claim_mission/etc.), computed inside the RPC that already
// holds whatever lock its own logic requires. See the design spec §4b for why the split is
// load-bearing, not incidental.
//
// Three of the "moment" achievements — Legendary Collector, Blessed, Max Level — are backed by
// server-only counters (profiles.achievement_counters) never exposed to the client, so this
// module cannot preview whether they've newly been crossed; it only knows whether they're already
// in the `achievements` claimed-map (fetched via useProfile()). checkAchievements below simply
// never evaluates them — there is nothing in CheckAchievementsInput to evaluate them against.

import { ASCENDANT_MILESTONES } from './ascendantMilestones'
import { RESOURCE_SOURCE } from './resources'

export type AchievementCategory = 'combat' | 'economy' | 'collection' | 'prestige' | 'dedication'

export type AchievementLadder = {
  metricKey: string
  category: AchievementCategory
  label: string
  thresholds: number[]
}

function milestoneThresholds(metricKey: string): number[] {
  return ASCENDANT_MILESTONES.find((l) => l.metricKey === metricKey)!.thresholds
}

export const ACHIEVEMENT_DEFS: AchievementLadder[] = [
  // Combat — reuses ASCENDANT_MILESTONES's own thresholds so the two can never drift apart.
  { metricKey: 'missionsCleared', category: 'combat', label: 'Missions Cleared', thresholds: milestoneThresholds('missionsCleared') },
  { metricKey: 'dungeonsCleared', category: 'combat', label: 'Dungeons Cleared', thresholds: milestoneThresholds('dungeonsCleared') },
  { metricKey: 'raidsCleared', category: 'combat', label: 'Raids Cleared', thresholds: milestoneThresholds('raidsCleared') },

  // Economy — gold + one ladder per resource, all reusing ASCENDANT_MILESTONES's thresholds.
  { metricKey: 'goldEarned', category: 'economy', label: 'Gold Earned', thresholds: milestoneThresholds('goldEarned') },
  ...Object.keys(RESOURCE_SOURCE).map((resource) => ({
    metricKey: `resourceGathered.${resource}`,
    category: 'economy' as const,
    label: `${resource} Gathered`,
    thresholds: milestoneThresholds(`resourceGathered.${resource}`),
  })),

  // Collection
  { metricKey: 'fullRoster', category: 'collection', label: 'Full Roster', thresholds: [19] },
  { metricKey: 'legendaryCollector', category: 'collection', label: 'Legendary Collector', thresholds: [1] },
  { metricKey: 'blessed', category: 'collection', label: 'Blessed', thresholds: [1] },

  // Prestige
  { metricKey: 'echoesOfThePast', category: 'prestige', label: 'Echoes of the Past', thresholds: [1] },
  { metricKey: 'ascendant', category: 'prestige', label: 'Ascendant', thresholds: [1] },
  { metricKey: 'shardHoarder', category: 'prestige', label: 'Shard Hoarder', thresholds: [50, 500, 5000] },

  // Dedication
  { metricKey: 'daysPlayed', category: 'dedication', label: 'Days Played', thresholds: [1, 7, 30, 100] },
  { metricKey: 'maxLevel', category: 'dedication', label: 'Max Level', thresholds: [1] },
]

export type CheckAchievementsInput = {
  lifetimeStats: Record<string, number>
  unlockedCharacterCount: number
  resetCount: number
  transcendCount: number
  shardsEarnedTotal: number
  daysPlayed: number
}

const COUNTER_BACKED_KEYS = new Set(['legendaryCollector', 'blessed', 'maxLevel'])

export function checkAchievements(input: CheckAchievementsInput, claimed: Record<string, boolean>): string[] {
  const newlyClaimedKeys: string[] = []
  for (const ladder of ACHIEVEMENT_DEFS) {
    if (COUNTER_BACKED_KEYS.has(ladder.metricKey)) continue
    const value =
      ladder.metricKey === 'fullRoster' ? input.unlockedCharacterCount :
      ladder.metricKey === 'echoesOfThePast' ? input.resetCount :
      ladder.metricKey === 'ascendant' ? input.transcendCount :
      ladder.metricKey === 'shardHoarder' ? input.shardsEarnedTotal :
      ladder.metricKey === 'daysPlayed' ? input.daysPlayed :
      (input.lifetimeStats[ladder.metricKey] ?? 0)
    ladder.thresholds.forEach((threshold, i) => {
      const key = `${ladder.metricKey}.${i}`
      if (value >= threshold && !claimed[key]) {
        newlyClaimedKeys.push(key)
      }
    })
  }
  return newlyClaimedKeys
}
