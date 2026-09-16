import { LIFETIME_STAT_DEFS, type LifetimeStatDef } from '@/lib/lifetimeStats'

export type StatGroup = { title: string; stats: LifetimeStatDef[] }

// Registry-driven split (ADR-0004): resources are matched by key prefix, not an explicit list, so
// a new resource in RESOURCE_SOURCE automatically lands in "Resources Gathered" with no edit here.
export function groupLifetimeStats(): StatGroup[] {
  const resources = LIFETIME_STAT_DEFS.filter((d) => d.key.startsWith('resourceGathered.'))
  const economy = LIFETIME_STAT_DEFS.filter((d) => d.key === 'goldEarned')
  const combat = LIFETIME_STAT_DEFS.filter((d) => d.key !== 'goldEarned' && !d.key.startsWith('resourceGathered.'))

  return [
    { title: 'Missions & Combat', stats: combat },
    { title: 'Economy', stats: economy },
    { title: 'Resources Gathered', stats: resources },
  ]
}
