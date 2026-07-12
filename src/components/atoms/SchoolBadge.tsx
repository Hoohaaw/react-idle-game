import { SCHOOL_DEFS, type School } from '../../lib/schools'

type Size = 'sm' | 'md'

const SIZES: Record<Size, { padding: string; fontSize: string; letterSpacing: string; gap: number; borderRadius: number; iconSize: string }> = {
  sm: { padding: '2px 7px',  fontSize: '9px',  letterSpacing: '1px',   gap: 4, borderRadius: 3, iconSize: '10px' },
  md: { padding: '4px 10px', fontSize: '10px', letterSpacing: '1.5px', gap: 5, borderRadius: 4, iconSize: '11px' },
}

// A character's damage school (fire / ice / earth / wind / holy / shadow — ADR-0033).
// Only rendered for casters with an authored school; physical and plain-magic characters show nothing.
export function SchoolBadge({ school, size = 'md' }: { school: School; size?: Size }) {
  const s = SCHOOL_DEFS.find((d) => d.key === school)
  if (!s) return null
  const z = SIZES[size]
  return (
    <span className="atom-heavy" style={{
      display: 'inline-flex', alignItems: 'center', gap: z.gap,
      padding: z.padding, borderRadius: z.borderRadius,
      fontSize: z.fontSize, letterSpacing: z.letterSpacing, textTransform: 'uppercase',
      fontFamily: 'Georgia, serif', whiteSpace: 'nowrap',
      color: s.color,
      border: `2px solid color-mix(in srgb, ${s.color} 55%, #0f0203)`,
      background: `linear-gradient(180deg, color-mix(in srgb, ${s.color} 22%, #0f0203) 0%, #0f0203 100%)`,
      /* Override atom-heavy glow with the school-specific glow */
      boxShadow: [
        '0 0 0 1px #080101',
        'inset 0 1px 0 rgba(255,255,255,0.07)',
        'inset 0 2px 5px rgba(0,0,0,0.55)',
        `0 0 10px color-mix(in srgb, ${s.color} 35%, transparent)`,
        '0 3px 8px rgba(0,0,0,0.65)',
      ].join(', '),
    }}>
      <span style={{ fontSize: z.iconSize }}>{s.icon}</span>
      {s.label}
    </span>
  )
}
