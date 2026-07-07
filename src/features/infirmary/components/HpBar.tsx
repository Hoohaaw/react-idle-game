// Compact HP bar with the infirmary color ramp: red when downed, amber when low, green otherwise.
const hpColor = (pct: number) => (pct <= 0 ? '#e0635c' : pct < 0.35 ? '#d89a4f' : '#5fc77e')

export function HpBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0
  const color = hpColor(pct)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#0d0304', border: '1px solid var(--color-gold-dark)', overflow: 'hidden' }}>
        <div style={{ width: `${pct * 100}%`, height: '100%', background: color, boxShadow: `0 0 6px ${color}88`, transition: 'width 0.3s' }} />
      </div>
      <span style={{ color, fontSize: 11, fontWeight: 'bold', minWidth: 56, textAlign: 'right' }}>
        {current <= 0 ? 'DOWNED' : `${Math.round(current)}/${max}`}
      </span>
    </div>
  )
}
