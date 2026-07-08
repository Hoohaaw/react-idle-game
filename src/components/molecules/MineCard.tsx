import { useState } from 'react'
import { Avatar } from '../atoms/Avatar'
import { IconSlot } from '../atoms/IconSlot'
import { ProgressBar } from '../atoms/ProgressBar'
import { PrimaryButton, SecondaryButton, DangerButton } from '../atoms/Button'
import { StatusTag } from '../atoms/StatusTag'
import { BonusTag } from '../atoms/BonusTag'
import { useNow } from '../../hooks/useNow'
import { formatRemaining } from '../../lib/time'
import { resourceHeaderStyle, mineRate } from '../../lib/resources'

// A mine yields a fixed amount of one resource every interval while a character is
// assigned, repeating indefinitely (uncapped, auto-banked). The timer loops toward
// the next tick; the banked counter is what has accrued this session.
export function MineCard({ resource, tier, intervalSec, yieldPerTick, owned, gatherer, assignedSecAgo, bonus, onAssign, onCollect, onStop }: {
  resource: string; tier: string; intervalSec: number; yieldPerTick: number
  owned?: number // player's current wallet balance of this resource
  gatherer?: string; assignedSecAgo?: number; bonus?: string
  onAssign?: () => void; onCollect?: () => void; onStop?: () => void
}) {
  const active = assignedSecAgo !== undefined
  const [assignedAt] = useState(() => Date.now() - (assignedSecAgo ?? 0) * 1000)
  const now = useNow()

  const intervalMs = intervalSec * 1000
  const elapsed = active ? now - assignedAt : 0
  const banked = active ? Math.floor(elapsed / intervalMs) * yieldPerTick : 0
  const into = active ? elapsed % intervalMs : 0
  const pct = active ? (into / intervalMs) * 100 : 0
  const remainingMs = intervalMs - into

  return (
    <div style={{
      width: 250, borderRadius: 8, border: '3px solid var(--color-gold-mid)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', 'inset 0 2px 8px rgba(0,0,0,0.6)', '0 6px 18px rgba(0,0,0,0.75)'].join(', '),
      overflow: 'hidden',
    }}>
      {/* Header: resource + tier (faint per-resource color wash + accent line) */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '10px 12px',
        ...resourceHeaderStyle(resource),
      }}>
        <span style={{ color: 'var(--color-gold-light)', fontSize: 14, fontWeight: 'bold', textShadow: '0 0 10px rgba(240,208,96,0.4)' }}>{resource}</span>
        <StatusTag tone="neutral">{tier}</StatusTag>
      </div>

      <div style={{ padding: 12 }}>
        {/* Rate — always shown so each mine's yield is clear; owned = current wallet balance */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <IconSlot size={16} /><span style={{ color: 'var(--color-text-gold)', fontSize: 13, fontWeight: 'bold' }}>+{yieldPerTick}</span>
          </span>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>⏱ every {mineRate(intervalSec)}</span>
          {owned !== undefined && (
            <span style={{ marginLeft: 'auto', color: 'var(--color-text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
              Owned <span style={{ color: 'var(--color-text-gold)', fontWeight: 'bold', fontVariantNumeric: 'tabular-nums' }}>{owned.toLocaleString()}</span>
            </span>
          )}
        </div>

        {active ? (
          <>
            {/* Gatherer + banked counter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: bonus ? 8 : 10 }}>
              <Avatar size={28} />
              <span style={{ color: 'var(--color-text-primary)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{gatherer}</span>
              <span style={{ marginLeft: 'auto', color: 'var(--color-success)', fontSize: 13, fontWeight: 'bold', textShadow: '0 0 8px rgba(74,140,63,0.4)', whiteSpace: 'nowrap' }}>+{banked} banked</span>
            </div>

            {/* Gather bonus (if the character specializes in this resource) */}
            {bonus && <div style={{ marginBottom: 10 }}><BonusTag label={bonus} /></div>}

            {/* Progress to next tick (loops) */}
            <div style={{ marginBottom: 8 }}>
              <ProgressBar value={pct} label="" color="#c9922a" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{
                fontFamily: '"Consolas", ui-monospace, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 13,
                color: 'var(--color-text-gold)',
              }}>⏱ {formatRemaining(remainingMs)}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {onCollect && <SecondaryButton onClick={onCollect}>Collect</SecondaryButton>}
                <DangerButton onClick={onStop}>Stop</DangerButton>
              </div>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 11, fontStyle: 'italic', marginBottom: 12, textAlign: 'center', padding: '4px 0' }}>No gatherer assigned</p>
            <PrimaryButton fullWidth onClick={onAssign}>Assign Character</PrimaryButton>
          </>
        )}
      </div>
    </div>
  )
}
