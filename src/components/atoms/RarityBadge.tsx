import { RARITY_STYLES } from '../../lib/rarity'

type Size = 'sm' | 'md' | 'lg'

const SIZES: Record<Size, { padding: string; fontSize: string; letterSpacing: string; borderRadius: string }> = {
  sm: { padding: '2px 7px', fontSize: '9px', letterSpacing: '1px', borderRadius: '3px' },
  md: { padding: '4px 10px', fontSize: '10px', letterSpacing: '1.5px', borderRadius: '4px' },
  lg: { padding: '5px 14px', fontSize: '11px', letterSpacing: '2px', borderRadius: '4px' },
}

export function RarityBadge({ rarity, size = 'md' }: { rarity: string; size?: Size }) {
  const s = RARITY_STYLES[rarity] ?? RARITY_STYLES.Common
  const z = SIZES[size]
  return (
    <span className="atom-heavy" style={{
      display: 'inline-block',
      padding: z.padding,
      borderRadius: z.borderRadius,
      fontSize: z.fontSize,
      letterSpacing: z.letterSpacing,
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
