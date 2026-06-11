import { ROLE_STYLES, type CharacterRole } from '../../lib/roles'

type Size = 'sm' | 'md'

const SIZES: Record<Size, { padding: string; fontSize: string; letterSpacing: string; gap: number; borderRadius: number; iconSize: string }> = {
  sm: { padding: '2px 7px',  fontSize: '9px',  letterSpacing: '1px',   gap: 4, borderRadius: 3, iconSize: '10px' },
  md: { padding: '4px 10px', fontSize: '10px', letterSpacing: '1.5px', gap: 5, borderRadius: 4, iconSize: '11px' },
}

// A character's role/archetype (Tank / Damage / Healer / Utility / Gatherer).
// Role is fixed by class — see src/lib/roles.ts.
export function RoleBadge({ role, size = 'md' }: { role: CharacterRole; size?: Size }) {
  const s = ROLE_STYLES[role]
  const z = SIZES[size]
  return (
    <span className="atom-heavy" style={{
      display: 'inline-flex', alignItems: 'center', gap: z.gap,
      padding: z.padding, borderRadius: z.borderRadius,
      fontSize: z.fontSize, letterSpacing: z.letterSpacing, textTransform: 'uppercase',
      fontFamily: 'Georgia, serif', whiteSpace: 'nowrap',
      color: s.color,
      border: `2px solid ${s.border}`,
      background: `linear-gradient(180deg, color-mix(in srgb, ${s.border} 30%, #0f0203) 0%, #0f0203 100%)`,
      /* Override atom-heavy glow with the role-specific glow */
      boxShadow: [
        '0 0 0 1px #080101',
        'inset 0 1px 0 rgba(255,255,255,0.07)',
        'inset 0 2px 5px rgba(0,0,0,0.55)',
        `0 0 10px ${s.glow}`,
        '0 3px 8px rgba(0,0,0,0.65)',
      ].join(', '),
    }}>
      <span style={{ fontSize: z.iconSize }}>{s.icon}</span>
      {s.label}
    </span>
  )
}
