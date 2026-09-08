// Subcomponents for MissionDispatch.tsx (wide layout) — split out to keep that file
// under the ~200-line guidance.

export function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="atom-heavy" style={{
      flex: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px',
      padding: '12px 16px', borderRadius: '5px',
      border: '2px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
    }}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ color: 'var(--color-text-gold)', fontSize: '18px', fontWeight: 'bold', textShadow: '0 0 6px rgba(232,192,80,0.3)' }}>{value}</span>
    </div>
  )
}

export function RewardRow({ label, pct }: { label: string; pct: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: '12px', letterSpacing: '0.5px' }}>{label}</span>
      <span style={{ color: 'var(--color-text-gold)', fontSize: '13px', fontWeight: 'bold' }}>+{pct.toFixed(1)}%</span>
    </div>
  )
}
