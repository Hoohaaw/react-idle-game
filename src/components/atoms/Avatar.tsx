// size = width in px; height is derived at a fixed 4:5 portrait ratio.
export function Avatar({ size = 56, level, state = 'available' }: { size?: number; level?: number; state?: 'available' | 'busy' | 'locked' }) {
  const width = size
  const height = Math.round(size * 1.25)
  const badgeFont = Math.max(10, Math.round(size * 0.15)) // level badge text scales with the portrait
  const ringColor = state === 'busy' ? 'var(--color-warning)' : state === 'locked' ? '#444' : 'var(--color-gold-mid)'
  return (
    <div style={{ position: 'relative', width, height, flexShrink: 0 }}>
      <div style={{
        width: '100%', height: '100%', borderRadius: 4, overflow: 'hidden',
        border: `2px solid ${ringColor}`,
        background: 'linear-gradient(180deg, #1a0608 0%, #0d0304 100%)',
        boxShadow: state === 'available'
          ? '0 0 0 1px #080101, inset 0 2px 6px rgba(0,0,0,0.6), 0 0 10px rgba(200,140,30,0.2)'
          : '0 0 0 1px #080101, inset 0 2px 6px rgba(0,0,0,0.6)',
        opacity: state === 'locked' ? 0.5 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>{state === 'locked' ? 'LOCKED' : 'IMG'}</span>
      </div>
      {level !== undefined && (
        <span style={{
          position: 'absolute', bottom: -Math.round(badgeFont * 0.7), left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(180deg, #2a1a08, #120a02)', border: '2px solid var(--color-gold-mid)',
          borderRadius: badgeFont, padding: `${Math.round(badgeFont * 0.18)}px ${Math.round(badgeFont * 0.6)}px`, fontSize: badgeFont, fontWeight: 'bold', color: 'var(--color-gold-light)',
          boxShadow: '0 0 0 1px #080101, 0 1px 3px rgba(0,0,0,0.7)', whiteSpace: 'nowrap',
        }}>Lv {level}</span>
      )}
      {state === 'busy' && (
        <span style={{ position: 'absolute', top: -5, right: -5, width: 13, height: 13, borderRadius: '50%', background: 'var(--color-warning)', border: '2px solid #0d0304', boxShadow: '0 0 6px rgba(140,96,32,0.8)' }} />
      )}
    </div>
  )
}
