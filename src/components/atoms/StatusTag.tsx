import type { ReactNode } from 'react'

const STATUS_TONES: Record<string, { color: string; border: string; dot: string }> = {
  ready:   { color: '#8ee59c', border: '#4a8c3f', dot: '#6fd98a' },
  busy:    { color: '#e8c050', border: '#8c6020', dot: '#e8c050' },
  locked:  { color: '#9a8a78', border: '#555',    dot: '#777' },
  neutral: { color: 'var(--color-text-gold)', border: 'var(--color-gold-dark)', dot: 'var(--color-gold-mid)' },
  danger:  { color: '#ff9090', border: '#8c2020', dot: '#d83232' },
}

export function StatusTag({ tone = 'neutral', children }: { tone?: keyof typeof STATUS_TONES; children: ReactNode }) {
  const s = STATUS_TONES[tone]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 3,
      border: `2px solid ${s.border}`, background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
      fontFamily: 'Georgia, serif', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
      color: s.color, boxShadow: '0 0 0 1px #080101',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, boxShadow: `0 0 5px ${s.dot}`, flexShrink: 0 }} />
      {children}
    </span>
  )
}
