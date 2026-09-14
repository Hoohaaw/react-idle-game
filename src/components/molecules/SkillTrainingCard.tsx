import { useState } from 'react'
import { Avatar } from '../atoms/Avatar'
import { ProgressBar } from '../atoms/ProgressBar'
import { PrimaryButton, DangerButton } from '../atoms/Button'
import { useNow } from '../../hooks/useNow'
import { formatRemaining } from '../../lib/time'
import { xpToNext } from '../../lib/leveling'

// One character's active skill-training assignment (docs/superpowers/specs/
// 2026-09-14-skill-assignments-design.md) — same visual language + live-recompute mechanism as
// ActiveGatherCard, but banks XP toward a level/xp bar (leveling.ts's curve) instead of a wallet
// resource. `level`/`xp` are the server-committed values as of the last collect; the "+N xp" badge
// is the live-accruing amount not yet banked (same accrual math as gather, just not yet applied).
export function SkillTrainingCard({
  trainee, level, xp, intervalSec, xpPerTick, lastCollectedAt, onCollect, onStop,
}: {
  trainee: string
  level: number
  xp: number
  intervalSec: number
  xpPerTick: number
  lastCollectedAt: string
  onCollect?: () => void
  onStop?: () => void
}) {
  const [assignedAt] = useState(() => new Date(lastCollectedAt).getTime())
  const now = useNow()

  const intervalMs = intervalSec * 1000
  const elapsed = Math.max(0, now - assignedAt)
  const pending = Math.floor(elapsed / intervalMs) * xpPerTick
  const into = elapsed % intervalMs
  const tickPct = (into / intervalMs) * 100
  const remainingMs = intervalMs - into

  const needed = xpToNext(level)
  const levelPct = needed === Infinity ? 100 : (xp / needed) * 100

  return (
    <div style={{
      width: 230, borderRadius: 8,
      border: '2px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', '0 6px 18px rgba(0,0,0,0.75)'].join(', '),
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', borderBottom: '1px solid var(--color-gold-dark)' }}>
        <Avatar size={26} />
        <span style={{ flex: 1, minWidth: 0, color: 'var(--color-gold-light)', fontSize: 13, fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{trainee}</span>
        <span style={{
          whiteSpace: 'nowrap', padding: '1px 7px', borderRadius: 4,
          border: '1px solid rgba(74,140,63,0.6)',
          background: 'linear-gradient(180deg, rgba(74,140,63,0.18) 0%, rgba(74,140,63,0.06) 100%)',
          color: 'var(--color-success)', fontSize: 12, fontWeight: 'bold',
        }}>+{pending} xp</span>
      </div>

      <div style={{ padding: '9px 11px' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 11, marginBottom: 6 }}>
          Level {level}{needed === Infinity ? ' (MAX)' : ''}
        </p>
        <div style={{ marginBottom: 8 }}>
          <ProgressBar value={levelPct} label="" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ flex: 1, color: 'var(--color-text-muted)', fontSize: 11 }}>Next tick</span>
          <span style={{
            fontFamily: '"Consolas", ui-monospace, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 12,
            color: 'var(--color-text-gold)',
          }}>{formatRemaining(remainingMs)}</span>
        </div>
        <ProgressBar value={tickPct} label="" color="#8c2020" />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          {onCollect && <PrimaryButton onClick={onCollect}>Collect</PrimaryButton>}
          {onStop && <DangerButton onClick={onStop}>Stop & Cash Out</DangerButton>}
        </div>
      </div>
    </div>
  )
}
