import { RarityBadge } from '@/components/atoms/RarityBadge'
import { RARITY_ORDER } from '@/lib/rarity'

// For an item-typed reagent the player owns at more than one rarity: which stack to spend
// (docs/superpowers/specs/2026-09-09-crafting-create-recipes-design.md §2 — the player picks at
// craft time). Rendered inside the reagent slot's popover; low → high.
export function RarityPicker({ options, selected, onPick }: {
  options: { rarity: string; have: number }[]
  selected: string | null
  onPick: (rarity: string) => void
}) {
  const order = RARITY_ORDER as readonly string[]
  const sorted = [...options].sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, minWidth: 150,
      borderRadius: 6, border: '2px solid var(--color-gold-dark)', background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: '0 0 0 1px #080101, 0 6px 18px rgba(0,0,0,0.75)' }}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Spend which?</span>
      {sorted.map((o) => (
        <button key={o.rarity} type="button" onClick={() => onPick(o.rarity)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '5px 8px', borderRadius: 4, cursor: 'pointer',
          fontFamily: 'Georgia, serif', textAlign: 'left',
          border: `1px solid ${o.rarity === selected ? 'var(--color-gold-mid)' : 'transparent'}`,
          background: o.rarity === selected ? 'rgba(200,145,42,0.15)' : 'transparent',
        }}>
          <RarityBadge rarity={o.rarity} size="sm" />
          <span style={{ color: 'var(--color-text-primary)', fontSize: 12, fontWeight: 'bold' }}>×{o.have}</span>
        </button>
      ))}
    </div>
  )
}
