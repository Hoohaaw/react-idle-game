import { useEffect, useState } from 'react'
import { IconSlot } from '@/components/atoms/IconSlot'
import { formatRemaining } from '@/lib/time'
import type { GroupStageView } from '@/services/groupContent'

// One stage node in the path: boss vs trash coloring (same red/gold treatment MissionCard gives
// boss vs regular stages), dimmed for 'locked' (upcoming, active variant only) or 'cleared',
// highlighted gold for 'current'. A small IconSlot marks stages with a real loot table. A compact
// "BOSS" caption stands in for StatusTag here — a full tag reads too large at this node size and
// risks overlapping neighbors in a wrapping row.
function StageNode({ stage, index, status }: { stage: GroupStageView; index: number; status: 'plain' | 'cleared' | 'current' | 'locked' }) {
  const boss = stage.kind === 'boss'
  const dim = status === 'locked' || status === 'cleared'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
      <div style={{
        position: 'relative', width: 44, height: 44, borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `2px solid ${boss ? '#8a2e29' : 'var(--color-gold-mid)'}`,
        background: boss
          ? 'linear-gradient(180deg, #2a0d0c 0%, #1a0605 100%)'
          : 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
        boxShadow: status === 'current'
          ? '0 0 14px rgba(240,208,96,0.6), 0 0 0 2px var(--color-gold-light)'
          : boss && !dim ? '0 0 10px rgba(160,45,40,0.35)' : 'none',
        opacity: dim ? 0.6 : 1,
      }}>
        <span style={{ color: boss ? '#ff9090' : 'var(--color-text-gold)', fontSize: 13, fontWeight: 'bold' }}>
          {status === 'cleared' ? '✓' : index + 1}
        </span>
        {(stage.loot?.length ?? 0) > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4 }}>
            <IconSlot size={12} />
          </span>
        )}
      </div>
      <span style={{
        fontSize: 8, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase',
        color: boss ? '#ff9090' : 'transparent', opacity: dim ? 0.6 : 1, lineHeight: 1,
      }}>
        {boss ? 'Boss' : '·'}
      </span>
    </div>
  )
}

export function StagePath({ stages, variant, currentStageIndex, stageEndsAt, isLockedOut, lockoutBoundary }: {
  stages: GroupStageView[]
  variant: 'preview' | 'active'
  currentStageIndex?: number
  stageEndsAt?: string | null
  isLockedOut?: boolean
  lockoutBoundary?: Date | null
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (variant === 'active' && isLockedOut && lockoutBoundary) {
    return (
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
        Cleared — available again in {formatRemaining(lockoutBoundary.getTime() - now)}.
      </p>
    )
  }

  const currentIndex = currentStageIndex ?? 0
  const inFlight = stageEndsAt ? new Date(stageEndsAt).getTime() : null

  const statusFor = (index: number): 'plain' | 'cleared' | 'current' | 'locked' => {
    if (variant === 'preview') return 'plain'
    if (index < currentIndex) return 'cleared'
    if (index === currentIndex) return 'current'
    return 'locked'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {stages.map((stage, i) => (
          <StageNode key={i} stage={stage} index={i} status={statusFor(i)} />
        ))}
      </div>
      {variant === 'active' && inFlight != null && inFlight > now && (
        <p style={{ color: 'var(--color-text-gold)', fontSize: 13, fontWeight: 'bold' }}>
          {formatRemaining(inFlight - now)}
        </p>
      )}
    </div>
  )
}
