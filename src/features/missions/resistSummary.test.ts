import { describe, it, expect } from 'vitest'
import { summarizeResistances } from './resistSummary'
import type { MissionEnemyView } from '@/services/missions'

const enemy = (resistances: MissionEnemyView['resistances']): MissionEnemyView => ({
  name: 'Test Enemy',
  count: 1,
  damageType: 'physical',
  resistances,
})

describe('summarizeResistances', () => {
  it('returns empty lists for an encounter with no resistances', () => {
    expect(summarizeResistances([enemy([])])).toEqual({ strong: [], weak: [] })
    expect(summarizeResistances([])).toEqual({ strong: [], weak: [] })
  })

  it('splits the Bone Colossus profile into strong (sorted by value) and weak', () => {
    const summary = summarizeResistances([
      enemy([
        { school: 'ice', value: 40 },
        { school: 'shadow', value: 120 },
        { school: 'earth', value: 60 },
        { school: 'holy', value: 0 },
      ]),
    ])
    expect(summary.strong).toEqual(['shadow', 'earth', 'ice'])
    expect(summary.weak).toEqual(['holy'])
  })

  it('aggregates across enemies: a resist anywhere trumps a weakness elsewhere', () => {
    const summary = summarizeResistances([
      enemy([{ school: 'fire', value: 0 }]),
      enemy([{ school: 'fire', value: 100 }, { school: 'wind', value: 0 }]),
    ])
    expect(summary.strong).toEqual(['fire'])
    expect(summary.weak).toEqual(['wind'])
  })
})
