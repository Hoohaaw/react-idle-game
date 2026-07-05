import { Avatar } from '@/components/atoms/Avatar'
import { ProgressBar } from '@/components/atoms/ProgressBar'
import { PrimaryButton } from '@/components/atoms/Button'
import { useNow } from '@/hooks/useNow'
import { formatRemaining } from '@/lib/time'

// An in-progress mission (maps to a mission_runs row). `startedAt`/`endsAt` are absolute epoch ms —
// pass the row's started_at/ends_at directly. The countdown reconstructs from those, so it's
// offline-safe: a mission that finished while away simply shows "Ready" on return.
export function ActiveMissionCard({ name, partySize, startedAt, endsAt, onClaim }: { name: string; partySize: number; startedAt: number; endsAt: number; onClaim?: () => void }) {
  const now = useNow()
  const remaining = Math.max(0, endsAt - now)
  const done = remaining <= 0
  const total = Math.max(1, endsAt - startedAt)
  const pct = Math.min(100, Math.max(0, ((now - startedAt) / total) * 100))
  return (
    <div style={{
      width: 250, borderRadius: 8, border: `3px solid ${done ? 'var(--color-success)' : 'var(--color-gold-mid)'}`,
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', 'inset 0 2px 8px rgba(0,0,0,0.6)', '0 6px 18px rgba(0,0,0,0.75)'].join(', '),
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '10px 12px', borderBottom: '2px solid var(--color-gold-dark)',
        background: 'linear-gradient(180deg, rgba(200,145,42,0.12) 0%, rgba(200,145,42,0.03) 100%)',
      }}>
        <span style={{ color: 'var(--color-gold-light)', fontSize: 14, fontWeight: 'bold' }}>{name}</span>
        <div style={{ display: 'flex', gap: 3 }}>
          {Array.from({ length: partySize }).map((_, i) => <Avatar key={i} size={26} />)}
        </div>
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ marginBottom: 10 }}>
          <ProgressBar value={pct} label="" color={done ? 'var(--color-success)' : '#8c2020'} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontFamily: '"Consolas", ui-monospace, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 13,
            color: done ? '#8ee59c' : 'var(--color-text-gold)',
          }}>{done ? '✓ Ready' : `⏱ ${formatRemaining(remaining)}`}</span>
          {done
            ? <span style={{ width: 130 }}><PrimaryButton fullWidth onClick={onClaim}>Claim</PrimaryButton></span>
            : <span style={{ color: 'var(--color-text-muted)', fontSize: 11, fontStyle: 'italic' }}>In progress…</span>}
        </div>
      </div>
    </div>
  )
}
