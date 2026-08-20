import { describe, it, expect } from 'vitest'
import { sortedMaps, isMapUnlocked, isStageLocked, BOSS_STAGE } from './mapProgress'
import type { MissionMapView } from '@/services/missions'

const MAPS: MissionMapView[] = [
  { mapKey: 'gravemarch', name: 'Gravemarch', order: 1 },
  { mapKey: 'embercrag', name: 'Embercrag', order: 2 },
  { mapKey: 'frosthollow', name: 'Frosthollow', order: 3 },
]

describe('sortedMaps', () => {
  it('dedupes by mapKey and sorts by world order', () => {
    const shuffled = [MAPS[2], null, MAPS[0], MAPS[2], MAPS[1], MAPS[0]]
    expect(sortedMaps(shuffled).map((m) => m.mapKey)).toEqual(['gravemarch', 'embercrag', 'frosthollow'])
  })
})

describe('isMapUnlocked', () => {
  it('first map is always open', () => {
    expect(isMapUnlocked(MAPS, {}, 'gravemarch')).toBe(true)
  })

  it('next map stays locked until the previous BOSS (stage 7) is cleared', () => {
    expect(isMapUnlocked(MAPS, { gravemarch: 6 }, 'embercrag')).toBe(false)
    expect(isMapUnlocked(MAPS, { gravemarch: BOSS_STAGE }, 'embercrag')).toBe(true)
    // Beating map 1's boss does NOT skip map 2's gate for map 3.
    expect(isMapUnlocked(MAPS, { gravemarch: BOSS_STAGE }, 'frosthollow')).toBe(false)
  })
})

describe('isStageLocked', () => {
  it('only cleared+1 is playable; earlier stages stay replayable', () => {
    expect(isStageLocked({}, 'gravemarch', 1)).toBe(false) // fresh player: stage 1 open
    expect(isStageLocked({}, 'gravemarch', 2)).toBe(true)
    expect(isStageLocked({ gravemarch: 3 }, 'gravemarch', 4)).toBe(false)
    expect(isStageLocked({ gravemarch: 3 }, 'gravemarch', 5)).toBe(true)
    expect(isStageLocked({ gravemarch: 3 }, 'gravemarch', 1)).toBe(false) // replay
  })
})
