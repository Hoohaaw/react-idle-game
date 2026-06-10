import type { ReactNode } from 'react'
import { IconSlot } from '../atoms/IconSlot'
import { RARITY_STYLES } from '../../lib/rarity'
import type { Item } from '../../types/item'

// Rarity-bordered item cell: icon, a stack-count chip when the player owns multiples,
// and the item's name + slot. Optional selection state and a footer slot (used by the
// crafting upgrade view). Shared by the Inventory and Crafting pages.
export function ItemTile({ item, selected = false, onClick, footer }: {
  item: Item
  selected?: boolean
  onClick?: () => void
  footer?: ReactNode
}) {
  const s = RARITY_STYLES[item.rarity] ?? RARITY_STYLES.Common
  const qty = item.quantity ?? 1
  return (
    <div onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      padding: '12px 10px', borderRadius: '6px', cursor: onClick ? 'pointer' : 'default',
      border: `2px solid ${selected ? 'var(--color-gold-light)' : s.border}`,
      background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
      boxShadow: [
        '0 0 0 1px #080101',
        'inset 0 1px 0 rgba(255,255,255,0.05)',
        selected ? '0 0 14px rgba(240,208,96,0.5)' : `0 0 10px ${s.glow}`,
        '0 3px 8px rgba(0,0,0,0.6)',
      ].join(', '),
    }}>
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        <IconSlot size={56} />
        {qty > 1 && (
          <span style={{
            position: 'absolute', right: -5, bottom: -5,
            minWidth: 18, padding: '1px 5px', borderRadius: '4px',
            fontFamily: 'Georgia, serif', fontSize: '11px', fontWeight: 'bold', lineHeight: 1.3,
            textAlign: 'center', color: 'var(--color-gold-light)',
            border: '1.5px solid var(--color-gold-mid)',
            background: 'linear-gradient(180deg, #2a1a08 0%, #120a02 100%)',
            boxShadow: '0 0 0 1px #080101, 0 1px 3px rgba(0,0,0,0.7)',
            textShadow: '0 1px 2px rgba(0,0,0,0.9)',
          }}>×{qty}</span>
        )}
      </div>
      <div style={{ textAlign: 'center', minWidth: 0, width: '100%' }}>
        <p style={{ color: s.color, fontSize: '12px', fontWeight: 'bold', textShadow: '0 1px 2px rgba(0,0,0,0.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '3px' }}>{item.slot}</p>
      </div>
      {footer}
    </div>
  )
}
