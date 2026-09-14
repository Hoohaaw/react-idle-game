// src/features/achievements/components/AchievementBadge.tsx
import { IconSlot } from '@/components/atoms/IconSlot'
import type { AchievementLadder } from '@/lib/achievements'

// One badge: earned (icon + name + description, filled state), or locked — with a progress bar
// for a threshold ladder still in progress, or a plain locked state for a one-off "moment" badge
// (nothing partial to show for a boolean, spec §4f).
export function AchievementBadge({ ladder, value, earnedTiers }: {
  ladder: AchievementLadder
  /** Current raw value driving this ladder (e.g. lifetimeStats.missionsCleared) — null when this
   *  ladder's value isn't available client-side (the three counter-backed one-offs). */
  value: number | null
  /** How many of this ladder's thresholds are already claimed, read from profile.achievements. */
  earnedTiers: number
}) {
  const totalTiers = ladder.thresholds.length
  const isFullyEarned = earnedTiers >= totalTiers
  const nextThreshold = earnedTiers < totalTiers ? ladder.thresholds[earnedTiers] : null

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 12,
      border: `1px solid ${isFullyEarned ? 'var(--color-gold-dark)' : 'var(--color-border)'}`,
      borderRadius: 8,
      opacity: earnedTiers > 0 || isFullyEarned ? 1 : 0.55,
      minWidth: 120,
    }}>
      <IconSlot size={40} />
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', textAlign: 'center' }}>
        {ladder.label}
      </span>
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
        {isFullyEarned
          ? 'Maxed'
          : totalTiers > 1
            ? `Tier ${earnedTiers + 1} / ${totalTiers}`
            : earnedTiers > 0 ? 'Earned' : 'Locked'}
      </span>
      {!isFullyEarned && nextThreshold !== null && value !== null && (
        <div style={{ width: '100%', height: 4, background: 'var(--color-bg-deep)', borderRadius: 2 }}>
          <div style={{
            width: `${Math.min(100, (value / nextThreshold) * 100)}%`, height: '100%',
            background: 'var(--color-gold-dark)', borderRadius: 2,
          }} />
        </div>
      )}
    </div>
  )
}
