import { RARITY_STYLES } from '../../lib/rarity'
import { IconSlot } from '../atoms/IconSlot'
import { PrimaryButton, SecondaryButton } from '../atoms/Button'
import type { Item } from '../../types/item'

// Six reagent slots arranged on a ring around a central result slot, plus the Clear/Craft
// actions. Controlled — the reagent state lives in the page so the inventory can be laid
// out separately (and wider) below. Recipe-matching not yet wired. See [[project-crafting]].
export function CraftingCircle({ reagents, onRemoveAt, onClear }: {
  reagents: (Item | null)[]
  onRemoveAt: (i: number) => void
  onClear: () => void
}) {
  const filled = reagents.filter(Boolean).length
  const SIZE = 300, RADIUS = 110, SLOT = 58, CENTER = 88

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: 340, flexShrink: 0 }}>
      {/* The crafting circle */}
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        <Ring d={RADIUS * 2} />
        <Ring d={CENTER + 30} faint />
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 150, height: 150, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,208,96,0.10) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* reagent slots, evenly spaced (one at top) */}
        {reagents.map((item, i) => {
          const a = (-90 + i * 60) * Math.PI / 180
          const x = SIZE / 2 + RADIUS * Math.cos(a)
          const y = SIZE / 2 + RADIUS * Math.sin(a)
          return (
            <div key={i} style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%,-50%)' }}>
              <CraftSlot item={item} size={SLOT} onClick={item ? () => onRemoveAt(i) : undefined} />
            </div>
          )
        })}

        {/* center result slot */}
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}>
          <CraftSlot item={null} size={CENTER} result />
        </div>
      </div>

      {/* actions */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
        <SecondaryButton onClick={onClear}>Clear</SecondaryButton>
        <PrimaryButton disabled={filled === 0}>Craft</PrimaryButton>
      </div>
    </div>
  )
}

// A decorative ring of the crafting circle.
function Ring({ d, faint = false }: { d: number; faint?: boolean }) {
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%', width: d, height: d, transform: 'translate(-50%,-50%)',
      borderRadius: '50%', pointerEvents: 'none',
      border: `1px solid rgba(200,145,42,${faint ? 0.18 : 0.4})`,
      boxShadow: faint ? 'none' : '0 0 14px rgba(200,145,42,0.12), inset 0 0 14px rgba(200,145,42,0.08)',
    }} />
  )
}

// One slot in the circle: empty placeholder, a filled reagent, or the center result.
function CraftSlot({ item, size, result = false, onClick }: { item: Item | null; size: number; result?: boolean; onClick?: () => void }) {
  const s = item ? (RARITY_STYLES[item.rarity] ?? RARITY_STYLES.Common) : null
  return (
    <div
      onClick={onClick}
      title={item ? `${item.name} — click to remove` : undefined}
      style={{
        width: size, height: size, borderRadius: 8,
        border: `${result ? 3 : 2}px solid ${s ? s.border : result ? 'var(--color-gold-mid)' : 'var(--color-gold-dark)'}`,
        background: item ? 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)' : 'radial-gradient(circle at 50% 40%, #1a0608 0%, #0c0203 100%)',
        boxShadow: [
          '0 0 0 1px #080101',
          'inset 0 1px 0 rgba(255,255,255,0.05)',
          item && s ? `0 0 12px ${s.glow}` : result ? '0 0 18px rgba(240,208,96,0.35)' : 'inset 0 2px 8px rgba(0,0,0,0.6)',
          '0 3px 8px rgba(0,0,0,0.6)',
        ].join(', '),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {item
        ? <IconSlot size={Math.round(size * 0.52)} />
        : <span style={{ color: result ? 'var(--color-gold-mid)' : 'var(--color-text-muted)', fontSize: result ? 11 : 22, letterSpacing: result ? 1.5 : 0, fontWeight: result ? 'bold' : 'normal', textTransform: 'uppercase' }}>{result ? 'Result' : '+'}</span>}
    </div>
  )
}
