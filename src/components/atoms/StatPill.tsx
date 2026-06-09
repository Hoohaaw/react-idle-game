export function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="atom-heavy" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '7px',
      padding: '6px 12px',
      borderRadius: '4px',
      border: '2px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
    }}>
      <span style={{
        color: 'var(--color-text-muted)',
        fontSize: '10px',
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
      }}>{label}</span>
      <span style={{
        color: 'var(--color-text-gold)',
        fontSize: '15px',
        fontWeight: 'bold',
        textShadow: '0 0 6px rgba(232,192,80,0.4), 0 1px 2px rgba(0,0,0,0.9)',
      }}>{value}</span>
    </div>
  )
}
