import { RARITY_STYLES } from '../../lib/rarity'

export function RarityBadge({ rarity }: { rarity: string }) {
  const s = RARITY_STYLES[rarity] ?? RARITY_STYLES.Common
  return (
    <span className="atom-heavy" style={{
      display: 'inline-block',
      padding: '5px 14px',
      borderRadius: '4px',
      fontSize: '11px',
      letterSpacing: '2px',
      textTransform: 'uppercase',
      fontFamily: 'Georgia, serif',
      color: s.color,
      border: `2px solid ${s.border}`,
      background: `linear-gradient(180deg, color-mix(in srgb, ${s.border} 30%, #0f0203) 0%, #0f0203 100%)`,
      /* Override atom-heavy glow with rarity-specific glow */
      boxShadow: [
        '0 0 0 1px #080101',
        'inset 0 1px 0 rgba(255,255,255,0.07)',
        'inset 0 2px 5px rgba(0,0,0,0.55)',
        `0 0 10px ${s.glow}`,
        '0 3px 8px rgba(0,0,0,0.65)',
      ].join(', '),
    }}>
      {rarity}
    </span>
  )
}
