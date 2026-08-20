import type { MissionMapView } from '@/services/missions'

// Client-side mirrors of the ADR-0034 unlock rules (the server enforces them in the
// start_mission RPC; these only drive what the UI shows as locked):
//   - a map is unlocked if it's first in world order, or the previous map's boss
//     (stage 7) has been cleared
//   - within an unlocked map, stage N is playable iff N <= highestCleared + 1

export const BOSS_STAGE = 7

/** Unique maps present in the mission list, in world order. */
export function sortedMaps(maps: (MissionMapView | null)[]): MissionMapView[] {
  const byKey = new Map<string, MissionMapView>()
  for (const m of maps) if (m && !byKey.has(m.mapKey)) byKey.set(m.mapKey, m)
  return [...byKey.values()].sort((a, b) => a.order - b.order)
}

export function isMapUnlocked(
  maps: MissionMapView[],
  progress: Record<string, number>,
  mapKey: string,
): boolean {
  const idx = maps.findIndex((m) => m.mapKey === mapKey)
  if (idx <= 0) return true // first map (or unknown — let the server be the judge)
  return (progress[maps[idx - 1].mapKey] ?? 0) >= BOSS_STAGE
}

export function isStageLocked(progress: Record<string, number>, mapKey: string, stage: number): boolean {
  return stage > (progress[mapKey] ?? 0) + 1
}
