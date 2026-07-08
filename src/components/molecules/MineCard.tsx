import { useState } from 'react'
import { Avatar } from '../atoms/Avatar'
import { ProgressBar } from '../atoms/ProgressBar'
import { PrimaryButton, SecondaryButton, DangerButton } from '../atoms/Button'
import { BonusTag } from '../atoms/BonusTag'
import { ResourceMedallion } from '../atoms/ResourceMedallion'
import { useNow } from '../../hooks/useNow'
import { formatRemaining } from '../../lib/time'
import { resourceHeaderStyle, mineRate, RESOURCE_COLOR } from '../../lib/resources'

// A mine yields a fixed amount of one resource every interval while a character is
// assigned, repeating indefinitely (uncapped, auto-banked). The timer loops toward
// the next tick; the banked counter is what has accrued this session.
//
// Visual language: resource medallion + name/tier in the accent-washed header, a sunken
// stat strip (rate + owned balance), and a per-resource accent on the progress fill.
// Active mines glow faintly in their resource colour so they stand out in the grid.
export function MineCard({ resource, tier, intervalSec, yieldPerTick, owned, gatherer, assignedSecAgo, bonus, onAssign, onCollect, onStop }: {
  resource: string; tier: string; intervalSec: number; yieldPerTick: number
  owned?: number // player's current wallet balance of this resource
  gatherer?: string; assignedSecAgo?: number; bonus?: string
  onAssign?: () => void; onCollect?: () => void; onStop?: () => void
}) {
  const active = assignedSecAgo !== undefined
  const [assignedAt] = useState(() => Date.now() - (assignedSecAgo ?? 0) * 1000)
  const now = useNow()
  const accent = RESOURCE_COLOR[resource] ?? '200,145,42'

  const intervalMs = intervalSec * 1000
  const elapsed = active ? now - assignedAt : 0
  const banked = active ? Math.floor(elapsed / intervalMs) * yieldPerTick : 0
  const into = active ? elapsed % intervalMs : 0
  const pct = active ? (into / intervalMs) * 100 : 0
  const remainingMs = intervalMs - into

  return (
    <div style={{
      width: 250, borderRadius: 8,
      border: `3px solid ${active ? `rgba(${accent},0.75)` : 'var(--color-gold-dark)'}`,
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: [
        '0 0 0 1px #080101',
        'inset 0 1px 0 rgba(255,255,255,0.06)',
        'inset 0 2px 8px rgba(0,0,0,0.6)',
        active ? `0 0 16px rgba(${accent},0.28)` : '0 0 10px rgba(200,140,30,0.10)',
        '0 6px 18px rgba(0,0,0,0.75)',
      ].join(', '),
      overflow: 'hidden',
      opacity: active ? 1 : 0.92,
    }}>
      {/* Header: medallion + resource identity (faint per-resource color wash + accent line) */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px',
        ...resourceHeaderStyle(resource),
      }}>
        <ResourceMedallion resource={resource} />
        <div style={{ minWidth: 0 }}>
          <p style={{ color: 'var(--color-gold-light)', fontSize: 15, fontWeight: 'bold', lineHeight: 1.15, textShadow: '0 1px 2px rgba(0,0,0,0.9), 0 0 10px rgba(240,208,96,0.35)' }}>{resource}</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>{tier} mine</p>
        </div>
      </div>

      {/* Sunken stat strip: rate + owned balance */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '7px 12px',
        background: 'linear-gradient(180deg, #0b0203 0%, #150506 100%)',
        borderTop: '1px solid #060101',
        borderBottom: '1px solid var(--color-gold-dark)',
        boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.65), inset 0 -1px 0 rgba(255,255,255,0.03)',
      }}>
        <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--color-text-gold)', fontWeight: 'bold', fontSize: 13 }}>+{yieldPerTick}</span>
          <span style={{ color: 'var(--color-text-muted)' }}> / {mineRate(intervalSec)}</span>
        </span>
        {owned !== undefined && (
          <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' }}>Owned </span>
            <span style={{ color: 'var(--color-text-gold)', fontWeight: 'bold', fontVariantNumeric: 'tabular-nums' }}>{owned.toLocaleString()}</span>
          </span>
        )}
      </div>

      <div style={{ padding: 12 }}>
        {active ? (
          <>
            {/* Gatherer + banked counter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: bonus ? 8 : 10 }}>
              <Avatar size={28} />
              <span style={{ color: 'var(--color-text-primary)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{gatherer}</span>
              <span style={{
                marginLeft: 'auto', whiteSpace: 'nowrap',
                padding: '2px 8px', borderRadius: 4,
                border: '1px solid rgba(74,140,63,0.6)',
                background: 'linear-gradient(180deg, rgba(74,140,63,0.18) 0%, rgba(74,140,63,0.06) 100%)',
                color: 'var(--color-success)', fontSize: 12, fontWeight: 'bold',
                textShadow: '0 0 8px rgba(74,140,63,0.5)',
              }}>+{banked}</span>
            </div>

            {/* Gather bonus (if the character specializes in this resource) */}
            {bonus && <div style={{ marginBottom: 10 }}><BonusTag label={bonus} /></div>}

            {/* Progress to next tick (loops), filled in the resource's colour */}
            <div style={{ marginBottom: 8 }}>
              <ProgressBar value={pct} label="" color={`rgb(${accent})`} />
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
            {/* Empty gatherer berth */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginBottom: 12, padding: '10px 0',
              border: '2px dashed #3a1218', borderRadius: 6,
              background: 'linear-gradient(180deg, #120405 0%, #0d0304 100%)',
            }}>
              <span style={{ color: '#4a1a20', fontSize: 16 }}>⛏</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 11, fontStyle: 'italic' }}>No gatherer assigned</span>
            </div>
            <PrimaryButton fullWidth onClick={onAssign}>Assign Character</PrimaryButton>
          </>
        )}
      </div>
    </div>
  )
}
