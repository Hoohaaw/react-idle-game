// Placeholder for an icon SVG to be dropped in later (resources, currency).
export function IconSlot({ size = 16 }: { size?: number }) {
  return (
    <span style={{
      display: 'inline-block',
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: '3px',
      border: '1px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, #0c0203 0%, #1a0608 100%)',
      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6)',
    }} />
  )
}
