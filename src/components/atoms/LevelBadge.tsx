export function LevelBadge({ level }: { level: number }) {
  return (
    <div className="atom-heavy" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      padding: '6px 14px',
      borderRadius: '4px',
      border: '2px solid var(--color-gold-mid)',
      background: 'linear-gradient(180deg, #2a1a08 0%, #120a02 100%)',
    }}>
      <span style={{
        color: 'var(--color-text-muted)',
        fontSize: '10px',
        letterSpacing: '2px',
        textTransform: 'uppercase',
      }}>LV</span>
      <span style={{
        color: 'var(--color-gold-light)',
        fontSize: '16px',
        fontWeight: 'bold',
        textShadow: '0 0 8px rgba(240,208,96,0.5), 0 1px 3px rgba(0,0,0,0.9)',
      }}>{level}</span>
    </div>
  )
}
