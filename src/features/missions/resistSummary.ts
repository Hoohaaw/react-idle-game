import type { School } from '@/lib/schools'
import type { MissionEnemyView } from '@/services/missions'

// Aggregates an encounter's per-enemy resistances (ADR-0033) into the player-facing
// "strong against / weak against" summary shown on mission cards and the dispatch modal.
//  - strong: schools any enemy resists (value > 0), sorted by the encounter's highest value
//  - weak:   schools explicitly authored at 0 (the weakness convention — full damage),
//            unless another enemy in the encounter resists that school
export type ResistSummary = { strong: School[]; weak: School[] }

export function summarizeResistances(enemies: MissionEnemyView[]): ResistSummary {
  const maxResist = new Map<School, number>()
  const authoredZero = new Set<School>()

  for (const enemy of enemies) {
    for (const { school, value } of enemy.resistances) {
      if (value > 0) maxResist.set(school, Math.max(maxResist.get(school) ?? 0, value))
      else authoredZero.add(school)
    }
  }

  const strong = [...maxResist.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([school]) => school)
  const weak = [...authoredZero].filter((school) => !maxResist.has(school))
  return { strong, weak }
}
