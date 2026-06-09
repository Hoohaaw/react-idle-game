import { useState } from 'react'
import { useNow } from '../../hooks/useNow'
import { formatRemaining } from '../../lib/time'

export function CountdownTimer({ durationSec, startedSecAgo = 0 }: { durationSec: number; startedSecAgo?: number }) {
  const [endsAt] = useState(() => Date.now() + (durationSec - startedSecAgo) * 1000)
  const now = useNow()
  const done = endsAt - now <= 0
  return (
    <span className="atom-heavy" style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 4,
      border: `2px solid ${done ? 'var(--color-success)' : 'var(--color-gold-dark)'}`,
      background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
      fontFamily: 'Georgia, serif', fontSize: 13,
      color: done ? '#8ee59c' : 'var(--color-text-gold)',
      textShadow: done ? '0 0 8px rgba(74,140,63,0.4)' : '0 0 6px rgba(232,192,80,0.3)',
    }}>
      <span style={{ fontSize: 12 }}>{done ? '✓' : '⏱'}</span>
      <span style={{
        // Monospace so each digit is fixed-width — the readout never reflows as it ticks.
        fontFamily: done ? 'Georgia, serif' : '"Consolas", "SF Mono", ui-monospace, monospace',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '0.5px',
      }}>{done ? 'Ready' : formatRemaining(endsAt - now)}</span>
    </span>
  )
}
