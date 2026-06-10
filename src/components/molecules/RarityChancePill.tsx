import { RARITY_STYLES } from '../../lib/rarity'
import type { RarityChance } from '../../types/loot'

export function RarityChancePill({ rarity, chance }: RarityChance) {
  const s = RARITY_STYLES[rarity] ?? RARITY_STYLES.Common
  return (
    <span className="atom-heavy" style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '3px 9px',
      borderRadius: '3px',
      fontSize: '11px',
      fontFamily: 'Georgia, serif',
      border: `2px solid ${s.border}`,
      background: `linear-gradient(180deg, color-mix(in srgb, ${s.border} 25%, #0f0203) 0%, #0f0203 100%)`,
    }}>
      <span style={{ color: s.color, letterSpacing: '0.5px', textShadow: `0 0 6px ${s.glow}` }}>{rarity}</span>
      <span style={{ color: 'var(--color-text-primary)', fontWeight: 'bold' }}>{chance}%</span>
    </span>
  )
}
