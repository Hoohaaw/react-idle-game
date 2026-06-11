import { useState, useRef, useCallback } from 'react'
import type { ReactNode, MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { RESOURCE_COLOR, RESOURCE_SOURCE } from '../../lib/resources'

// Hover wrapper for a crafting material — shows a small portal popover at the cursor with
// the material's name, tier and where to obtain it. Portal + pointerEvents:none so it is
// never clipped by the recipe book's overflow:hidden frame (the tooltip rule). Mirrors the
// ItemTooltip pattern.
export function ResourceTooltip({ resource, children }: { resource: string; children: ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const move = useCallback((e: MouseEvent) => {
    const pad = 14
    const w = cardRef.current?.offsetWidth ?? 200
    const h = cardRef.current?.offsetHeight ?? 110
    let x = e.clientX + pad
    let y = e.clientY + pad
    if (x + w > window.innerWidth) x = e.clientX - w - pad
    if (y + h > window.innerHeight) y = Math.max(pad, window.innerHeight - h - pad)
    setPos({ x, y })
  }, [])

  const c = RESOURCE_COLOR[resource] ?? '200,145,42'
  const src = RESOURCE_SOURCE[resource]

  return (
    <span onMouseEnter={move} onMouseMove={move} onMouseLeave={() => setPos(null)} style={{ display: 'contents' }}>
      {children}
      {pos && createPortal(
        <div ref={cardRef} style={{
          position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999, pointerEvents: 'none',
          width: 200, borderRadius: 6, overflow: 'hidden', fontFamily: 'Georgia, serif',
          border: `2px solid rgba(${c},0.7)`,
          background: 'linear-gradient(180deg, #2a0f12 0%, #120407 100%)',
          boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.07)', `0 0 14px rgba(${c},0.35)`, '0 8px 24px rgba(0,0,0,0.85)'].join(', '),
        }}>
          {/* Header: swatch + name + tier */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: `1px solid rgba(${c},0.45)` }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: `rgb(${c})`, boxShadow: `0 0 6px rgba(${c},0.6)`, flexShrink: 0 }} />
            <span style={{ color: 'var(--color-text-primary)', fontSize: 14, fontWeight: 'bold', flex: 1 }}>{resource}</span>
            {src && <span style={{ color: 'var(--color-text-muted)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>{src.tier}</span>}
          </div>
          {/* Source */}
          <div style={{ padding: '9px 12px' }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 }}>Source</p>
            <p style={{ color: 'var(--color-text-gold)', fontSize: 12, lineHeight: 1.4 }}>{src ? src.from : 'Unknown'}</p>
          </div>
        </div>,
        document.body,
      )}
    </span>
  )
}
