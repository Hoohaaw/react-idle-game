// Temporary placeholder for pages that don't have content yet.
export function PagePlaceholder({ title }: { title: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <h1 style={{
        color: 'var(--color-gold-light)',
        fontSize: '28px',
        letterSpacing: '2px',
        textTransform: 'uppercase',
        textShadow: '0 0 14px rgba(240,208,96,0.45)',
      }}>{title}</h1>
      <p style={{ color: 'var(--color-text-muted)', marginTop: '10px', fontStyle: 'italic' }}>Coming soon.</p>
    </div>
  )
}
