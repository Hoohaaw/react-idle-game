import { useState } from 'react'
import { Avatar } from '../atoms/Avatar'
import { ProgressBar } from '../atoms/ProgressBar'
import { BonusTag } from '../atoms/BonusTag'
import { DangerButton } from '../atoms/Button'
import { ResourceMedallion } from '../atoms/ResourceMedallion'
import { useNow } from '../../hooks/useNow'
import { formatRemaining } from '../../lib/time'
import { resourceHeaderStyle, RESOURCE_COLOR } from '../../lib/resources'

// Compact summary of one active gather (collector feed) — shows the resource, the
// assigned character, the running banked total, and a looping countdown/bar to the next
// tick. `onStop` cancels the gather (the server banks everything accrued, then frees
// the character — same action as the mine card's Stop). Shares the mine card's visual
// language: medallion identity, accent-glow border, per-resource progress fill.
export function ActiveGatherCard({ resource, gatherer, intervalSec, yieldPerTick, assignedSecAgo, bonus, onStop }: {
  resource: string; gatherer: string; intervalSec: number; yieldPerTick: number; assignedSecAgo: number; bonus?: string
  onStop?: () => void
}) {
  const [assignedAt] = useState(() => Date.now() - assignedSecAgo * 1000)
  const now = useNow()
  const accent = RESOURCE_COLOR[resource] ?? '200,145,42'

  const intervalMs = intervalSec * 1000
  const elapsed = now - assignedAt
  const banked = Math.floor(elapsed / intervalMs) * yieldPerTick
  const into = elapsed % intervalMs
  const pct = (into / intervalMs) * 100
  const remainingMs = intervalMs - into

  return (
    <div style={{
      width: 230, borderRadius: 8,
      border: `2px solid rgba(${accent},0.75)`,
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: [
        '0 0 0 1px #080101',
        'inset 0 1px 0 rgba(255,255,255,0.06)',
        'inset 0 2px 8px rgba(0,0,0,0.6)',
        `0 0 14px rgba(${accent},0.25)`,
        '0 6px 18px rgba(0,0,0,0.75)',
      ].join(', '),
      overflow: 'hidden',
    }}>
      {/* Header: medallion + resource + banked total (faint per-resource wash + accent line) */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 11px',
        ...resourceHeaderStyle(resource),
      }}>
        <ResourceMedallion resource={resource} size={26} />
        <span style={{ flex: 1, minWidth: 0, color: 'var(--color-gold-light)', fontSize: 13, fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>{resource}</span>
        <span style={{
          whiteSpace: 'nowrap', padding: '1px 7px', borderRadius: 4,
          border: '1px solid rgba(74,140,63,0.6)',
          background: 'linear-gradient(180deg, rgba(74,140,63,0.18) 0%, rgba(74,140,63,0.06) 100%)',
          color: 'var(--color-success)', fontSize: 12, fontWeight: 'bold',
          textShadow: '0 0 8px rgba(74,140,63,0.5)',
        }}>+{banked}</span>
      </div>

      <div style={{ padding: '9px 11px' }}>
        {/* Gatherer + next-tick countdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Avatar size={24} />
          <span style={{ flex: 1, minWidth: 0, color: 'var(--color-text-muted)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{gatherer}</span>
          <span style={{
            fontFamily: '"Consolas", ui-monospace, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 12,
            color: 'var(--color-text-gold)', whiteSpace: 'nowrap',
          }}>⏱ {formatRemaining(remainingMs)}</span>
        </div>

        {/* Gather bonus (if the character specializes in this resource) */}
        {bonus && <div style={{ marginBottom: 8 }}><BonusTag label={bonus} /></div>}

        {/* Looping progress to next tick, filled in the resource's colour */}
        <ProgressBar value={pct} label="" color={`rgb(${accent})`} />

        {onStop && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <DangerButton onClick={onStop}>Stop</DangerButton>
          </div>
        )}
      </div>
    </div>
  )
}
