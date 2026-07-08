import { useState, useRef, useCallback } from 'react'
import type { ReactNode, MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { IconSlot } from '../atoms/IconSlot'
import { RARITY_STYLES } from '../../lib/rarity'
import type { Item } from '../../types/item'

// Hover wrapper that shows a rarity-styled item card on hover. Rendered through a
// portal to document.body and positioned at the cursor, so it is never clipped by
// scroll/overflow containers (the limitation of the plain absolute-positioned Tooltip).
export function ItemTooltip({ item, children }: { item: Item; children: ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const move = useCallback((e: MouseEvent) => {
    const pad = 16
    const w = cardRef.current?.offsetWidth ?? 240
    const h = cardRef.current?.offsetHeight ?? 200
    let x = e.clientX + pad
    let y = e.clientY + pad
    if (x + w > window.innerWidth) x = e.clientX - w - pad
    if (y + h > window.innerHeight) y = Math.max(pad, window.innerHeight - h - pad)
    setPos({ x, y })
  }, [])

  const s = RARITY_STYLES[item.rarity] ?? RARITY_STYLES.Common

  return (
    <div onMouseEnter={move} onMouseMove={move} onMouseLeave={() => setPos(null)} style={{ display: 'contents' }}>
      {children}
      {pos && createPortal(
        <div ref={cardRef} style={{
          position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999, pointerEvents: 'none',
          width: 240, borderRadius: '6px', overflow: 'hidden', fontFamily: 'Georgia, serif',
          border: '2px solid var(--color-gold-mid)',
          background: 'linear-gradient(180deg, #2a0f12 0%, #120407 100%)',
          boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.07)', `0 0 14px ${s.glow}`, '0 8px 24px rgba(0,0,0,0.85)'].join(', '),
        }}>
          {/* Header: name + slot/rarity */}
          <div style={{ padding: '12px 14px', borderBottom: '2px solid var(--color-gold-dark)' }}>
            <p style={{ color: s.color, fontSize: '15px', fontWeight: 'bold', lineHeight: 1.25, textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>{item.name}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '5px' }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{item.slot}</span>
              <span style={{ color: s.color, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{item.rarity}</span>
            </div>
          </div>

          {/* Stats */}
          {item.stats.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '11px 14px' }}>
              {item.stats.map(stat => (
                <div key={stat.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{stat.key}</span>
                  <span style={{ color: 'var(--color-text-gold)', fontSize: '13px', fontWeight: 'bold', textShadow: '0 0 6px rgba(232,192,80,0.3)' }}>{stat.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Value — hidden while items have no authored coin value (real inventory passes 0) */}
          {item.value > 0 && <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
            padding: '9px 14px', borderTop: '1px solid var(--color-gold-dark)',
          }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Value</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconSlot size={14} />
              <span style={{ color: 'var(--color-text-gold)', fontSize: '13px', fontWeight: 'bold' }}>{item.value.toLocaleString()}</span>
            </span>
          </div>}

          {/* Flavour */}
          {item.flavor && (
            <p style={{
              color: 'var(--color-text-muted)', fontSize: '11px', fontStyle: 'italic', lineHeight: 1.5,
              padding: '10px 14px', borderTop: '1px solid var(--color-gold-dark)',
            }}>{item.flavor}</p>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
