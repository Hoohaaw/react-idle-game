import { IconSlot } from './IconSlot'

type Size = 'sm' | 'md'

const SIZES: Record<Size, { padding: string; fontSize: string; letterSpacing: string; gap: number; borderRadius: number; iconSize: number }> = {
  sm: { padding: '2px 7px',  fontSize: '9px',  letterSpacing: '1px',   gap: 4, borderRadius: 3, iconSize: 9 },
  md: { padding: '4px 10px', fontSize: '10px', letterSpacing: '1.5px', gap: 5, borderRadius: 4, iconSize: 10 },
}

// A character's CLASS (Death Knight, Mage, Rogue, …) — its fixed identity, shown
// alongside the <RoleBadge>. Deliberately a NEUTRAL gold "identity" pill so it reads
// distinctly from the colour-coded RoleBadge (which conveys the character's role/function):
//   ClassBadge = WHO they are · RoleBadge = WHAT they do.
export function ClassBadge({ charClass, size = 'md' }: { charClass: string; size?: Size }) {
  const z = SIZES[size]
  return (
    <span className="atom-heavy" style={{
      display: 'inline-flex', alignItems: 'center', gap: z.gap,
      padding: z.padding, borderRadius: z.borderRadius,
      fontSize: z.fontSize, letterSpacing: z.letterSpacing, textTransform: 'uppercase',
      fontFamily: 'Georgia, serif', whiteSpace: 'nowrap',
      color: 'var(--color-gold-light)',
      border: '2px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, #2a1c0a 0%, #120a02 100%)',
      // Quieter glow than the RoleBadge so the colour-coded role stays the louder of the two.
      boxShadow: [
        '0 0 0 1px #080101',
        'inset 0 1px 0 rgba(255,255,255,0.06)',
        'inset 0 2px 5px rgba(0,0,0,0.5)',
        '0 0 8px rgba(200,140,30,0.15)',
        '0 3px 8px rgba(0,0,0,0.6)',
      ].join(', '),
    }}>
      {/* Icon placeholder until real class icons land (design rule: no emoji icons) */}
      <IconSlot size={z.iconSize} />
      {charClass}
    </span>
  )
}
