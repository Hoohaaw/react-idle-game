import { IconSlot } from '@/components/atoms/IconSlot'
import type { TraitDef } from '@/lib/traits'

// A character's trait chips (ADR-0035). Neutral display on roster surfaces; when `activeKeys`
// is provided (mission dispatch), traits ACTIVE for that mission light up and the rest dim —
// the anti-spreadsheet rule: only what matters right now draws the eye. Tooltip = the trait's
// plain-language description.
export function TraitChips({ traits, activeKeys }: {
  traits: TraitDef[]
  /** traitKeys active in the current context; omit for neutral (roster) display. */
  activeKeys?: Set<string>
}) {
  if (traits.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {traits.map((t) => {
        const active = activeKeys?.has(t.traitKey) ?? false
        const dimmed = activeKeys != null && !active
        return (
          <span
            key={t.traitKey}
            title={t.description ?? t.name}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 7px', borderRadius: 3,
              fontFamily: 'Georgia, serif', fontSize: 9, letterSpacing: '0.5px',
              textTransform: 'uppercase', whiteSpace: 'nowrap',
              color: active ? 'var(--color-gold-light)' : 'var(--color-text-muted)',
              border: `1px solid ${active ? 'var(--color-gold-mid)' : 'var(--color-gold-dark)'}`,
              background: active
                ? 'linear-gradient(180deg, rgba(200,145,42,0.22) 0%, rgba(200,145,42,0.06) 100%)'
                : 'linear-gradient(180deg, #16080a 0%, #0e0304 100%)',
              boxShadow: active ? '0 0 8px rgba(200,140,30,0.35)' : 'none',
              opacity: dimmed ? 0.45 : 1,
            }}
          >
            <IconSlot size={9} />
            {t.name}
            {active && <span style={{ color: '#5fc77e' }}>✓</span>}
          </span>
        )
      })}
    </div>
  )
}
