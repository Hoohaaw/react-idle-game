import { useEffect, useState } from 'react'
import { formatRemaining } from '@/lib/time'
import type { GroupRun } from '@/services/groupContent'

export function StageProgress({ run, stageCount, lockoutBoundary, isLockedOut }: {
  run: GroupRun | undefined
  stageCount: number
  lockoutBoundary: Date | null
  isLockedOut: boolean
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (isLockedOut && lockoutBoundary) {
    return (
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
        Cleared — available again in {formatRemaining(lockoutBoundary.getTime() - now)}.
      </p>
    )
  }

  const stageIndex = run?.current_stage_index ?? 0
  const inFlight = run?.stage_ends_at ? new Date(run.stage_ends_at).getTime() : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p style={{ color: 'var(--color-text-primary)', fontSize: 13 }}>Stage {stageIndex + 1} / {stageCount}</p>
      {inFlight != null && (
        <p style={{ color: 'var(--color-text-gold)', fontSize: 13, fontWeight: 'bold' }}>
          {formatRemaining(inFlight - now)}
        </p>
      )}
    </div>
  )
}
