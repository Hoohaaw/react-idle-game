// src/features/achievements/AchievementsPage.tsx
import { useProfile } from '@/hooks/useProfile'
import { ACHIEVEMENT_DEFS, type AchievementCategory, type AchievementLadder } from '@/lib/achievements'
import { AchievementCategorySection } from './components/AchievementCategorySection'

const CATEGORIES: AchievementCategory[] = ['combat', 'economy', 'collection', 'prestige', 'dedication']

// The three "moment" achievements backed by server-only counters (spec §4e) — value is never
// available client-side for these; the badge falls back to its earned/locked state alone with no
// progress bar (AchievementBadge already handles value === null this way).
const COUNTER_BACKED_KEYS = new Set(['legendaryCollector', 'blessed', 'maxLevel'])

export default function AchievementsPage() {
  const profile = useProfile()

  if (profile.isLoading || !profile.data) {
    return <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
  }

  const { lifetimeStats, unlockedCharacters, resetCount, transcendCount, ascendantShardsEarnedTotal, daysPlayed, achievements } = profile.data

  function valueFor(ladder: AchievementLadder): number | null {
    if (COUNTER_BACKED_KEYS.has(ladder.metricKey)) return null
    if (ladder.metricKey === 'fullRoster') return Object.keys(unlockedCharacters).length
    if (ladder.metricKey === 'echoesOfThePast') return resetCount
    if (ladder.metricKey === 'ascendant') return transcendCount
    if (ladder.metricKey === 'shardHoarder') return ascendantShardsEarnedTotal
    if (ladder.metricKey === 'daysPlayed') return daysPlayed
    return lifetimeStats[ladder.metricKey] ?? 0
  }

  function earnedTiersFor(ladder: AchievementLadder): number {
    let count = 0
    for (let i = 0; i < ladder.thresholds.length; i++) {
      if (achievements[`${ladder.metricKey}.${i}`]) count++
      else break
    }
    return count
  }

  return (
    <div>
      <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 16 }}>Achievements</h2>
      {CATEGORIES.map((category) => (
        <AchievementCategorySection
          key={category}
          category={category}
          ladders={ACHIEVEMENT_DEFS.filter((l) => l.category === category)}
          valueFor={valueFor}
          earnedTiersFor={earnedTiersFor}
        />
      ))}
    </div>
  )
}
