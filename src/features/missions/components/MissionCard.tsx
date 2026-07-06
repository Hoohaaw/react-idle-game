import { StatusTag } from '@/components/atoms/StatusTag'
import { IconSlot } from '@/components/atoms/IconSlot'
import { PrimaryButton } from '@/components/atoms/Button'

// A selectable available mission (maps to a Sanity missionDef). `gold`/`xp` are the BASE rewards
// before the win-gated multipliers; `dropCount` = number of loot-table entries. `stage` is a display
// tag for ordering/difficulty.
export function MissionCard({ name, stage, gold, xp, duration, dropCount, locked, onSend }: { name: string; stage?: number; gold: number; xp: number; duration: string; dropCount: number; locked?: boolean; onSend?: () => void }) {
  return (
    <div style={{
      width: 250, borderRadius: 8,
      border: `3px solid ${locked ? 'var(--color-gold-dark)' : 'var(--color-gold-mid)'}`,
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', 'inset 0 2px 8px rgba(0,0,0,0.6)', '0 6px 18px rgba(0,0,0,0.75)'].join(', '),
      overflow: 'hidden',
      opacity: locked ? 0.6 : 1,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '10px 12px', borderBottom: '2px solid var(--color-gold-dark)',
        background: 'linear-gradient(180deg, rgba(200,145,42,0.15) 0%, rgba(200,145,42,0.04) 100%)',
      }}>
        <span style={{ color: 'var(--color-gold-light)', fontSize: 14, fontWeight: 'bold', textShadow: '0 0 10px rgba(240,208,96,0.4)' }}>{name}</span>
        {locked
          ? <StatusTag tone="locked">Locked</StatusTag>
          : stage != null ? <StatusTag tone="neutral">Stage {stage}</StatusTag> : null}
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <IconSlot size={16} /><span style={{ color: 'var(--color-text-gold)', fontSize: 13, fontWeight: 'bold' }}>{gold}</span>
          </span>
          <span style={{ color: 'var(--color-xp)', fontSize: 12, fontWeight: 'bold' }}>{xp} XP</span>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>⏱ {duration}</span>
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 11, marginBottom: 12, fontStyle: 'italic' }}>
          {dropCount} possible drop{dropCount === 1 ? '' : 's'} · base rewards, before win bonuses
        </p>
        {locked
          ? <p style={{ color: 'var(--color-text-muted)', fontSize: 12, textAlign: 'center', padding: '9px 0' }}>🔒 {stage != null ? `Requires stage ${stage}` : 'Locked'}</p>
          : <PrimaryButton fullWidth onClick={onSend}>Send Party</PrimaryButton>}
      </div>
    </div>
  )
}
