// src/features/achievements/components/AchievementCategorySection.tsx
import type { AchievementCategory, AchievementLadder } from '@/lib/achievements'
import { AchievementBadge } from './AchievementBadge'

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  combat: 'Combat',
  economy: 'Economy',
  collection: 'Collection',
  prestige: 'Prestige',
  dedication: 'Dedication',
}

export function AchievementCategorySection({ category, ladders, valueFor, earnedTiersFor }: {
  category: AchievementCategory
  ladders: AchievementLadder[]
  valueFor: (ladder: AchievementLadder) => number | null
  earnedTiersFor: (ladder: AchievementLadder) => number
}) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h3 style={{ color: 'var(--color-text-primary)', fontSize: 15, marginBottom: 8 }}>
        {CATEGORY_LABELS[category]}
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {ladders.map((ladder) => (
          <AchievementBadge
            key={ladder.metricKey}
            ladder={ladder}
            value={valueFor(ladder)}
            earnedTiers={earnedTiersFor(ladder)}
          />
        ))}
      </div>
    </section>
  )
}
