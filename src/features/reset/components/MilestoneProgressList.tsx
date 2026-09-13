// src/features/reset/components/MilestoneProgressList.tsx
import { ASCENDANT_MILESTONES } from '@/lib/ascendantMilestones'

// Compact progress list (spec §3 non-goal: not a full achievement gallery) — for each ladder,
// shows the current value and the next unclaimed threshold, so a player has a reason to check in
// on metrics they aren't actively grinding.
export function MilestoneProgressList({ lifetimeStats, transcendCount, ascendantMilestones }: {
  lifetimeStats: Record<string, number>
  transcendCount: number
  ascendantMilestones: Record<string, boolean>
}) {
  const rows = ASCENDANT_MILESTONES.map((ladder) => {
    const value = ladder.metricKey === 'transcendCount' ? transcendCount : (lifetimeStats[ladder.metricKey] ?? 0)
    const nextIndex = ladder.thresholds.findIndex((_, i) => !ascendantMilestones[`${ladder.metricKey}.${i}`])
    const next = nextIndex === -1 ? null : ladder.thresholds[nextIndex]
    return { label: ladder.label, value, next }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: 'var(--color-text-primary)' }}>{r.label}</span>
          <span style={{ color: 'var(--color-text-muted)' }}>
            {r.next === null ? `${r.value.toLocaleString()} (maxed)` : `${r.value.toLocaleString()} / ${r.next.toLocaleString()}`}
          </span>
        </div>
      ))}
    </div>
  )
}
