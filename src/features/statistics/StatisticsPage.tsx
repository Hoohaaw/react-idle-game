// src/features/statistics/StatisticsPage.tsx
import { useProfile } from '@/hooks/useProfile'
import { formatRemaining } from '@/lib/time'
import { groupLifetimeStats } from './statGroups'
import { StatGroupSection } from './components/StatGroupSection'

// missionSecondsSent is the one duration-shaped stat — everything else in the registry is a count
// (missions/dungeons/raids cleared, gold, resources gathered), formatted with toLocaleString.
// formatRemaining is built for a countdown ("Ready" at 0) — a zero LIFETIME total isn't "ready",
// it's "none yet", so that branch is overridden here rather than reused as-is.
function formatStatValue(key: string, value: number): string {
  if (key === 'missionSecondsSent') return value === 0 ? '0s' : formatRemaining(value * 1000)
  return value.toLocaleString()
}

export default function StatisticsPage() {
  const profile = useProfile()

  if (profile.isLoading || !profile.data) {
    return <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
  }

  const { lifetimeStats, resetCount, transcendCount, ascendantShardsEarnedTotal } = profile.data

  // Not part of LIFETIME_STAT_DEFS/lifetime_stats JSONB — these three are their own `profiles`
  // columns (see src/services/profile.ts), so they're assembled here rather than through the
  // registry-driven groupLifetimeStats().
  const metaRows = [
    { key: 'resetCount', label: 'Times Reset', value: resetCount.toLocaleString() },
    { key: 'transcendCount', label: 'Times Transcended', value: transcendCount.toLocaleString() },
    {
      key: 'ascendantShardsEarnedTotal',
      label: 'Ascendant Shards earned (lifetime)',
      value: ascendantShardsEarnedTotal.toLocaleString(),
    },
  ]

  return (
    <div>
      <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 16 }}>Statistics</h2>
      {groupLifetimeStats().map((group) => (
        <StatGroupSection
          key={group.title}
          title={group.title}
          rows={group.stats.map((s) => ({
            key: s.key,
            label: s.label,
            value: formatStatValue(s.key, lifetimeStats[s.key] ?? 0),
          }))}
        />
      ))}
      <StatGroupSection title="Meta-progression" rows={metaRows} />
    </div>
  )
}
