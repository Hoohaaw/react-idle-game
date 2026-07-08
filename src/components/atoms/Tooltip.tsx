import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// Anchored hover tooltip, rendered through a portal to document.body (the overlay rule:
// z-index alone can't escape overflow/transform ancestors — see ItemTooltip). Prefers to
// open ABOVE the trigger; flips below when the viewport (e.g. the sticky header) would cut
// it off, and clamps horizontally. The arrow tracks the trigger centre even when clamped.
// Positioning is applied imperatively in a layout effect (needs the box's rendered size;
// the box mounts hidden and unmounts on leave, so no state can go stale).

const GAP = 10 // trigger ↔ tooltip distance (matches the old CSS offset)
const PAD = 8 // minimum distance from the viewport edges

export function Tooltip({ children, content }: { children: ReactNode; content: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useLayoutEffect(() => {
    if (!visible) return
    const box = boxRef.current
    const anchor = wrapRef.current?.getBoundingClientRect()
    if (!box || !anchor) return

    const rect = box.getBoundingClientRect()
    const below = anchor.top - rect.height - GAP < PAD // no room above → open beneath
    const top = below ? anchor.bottom + GAP : anchor.top - rect.height - GAP
    const anchorCenter = anchor.left + anchor.width / 2
    const left = Math.max(PAD, Math.min(anchorCenter - rect.width / 2, window.innerWidth - rect.width - PAD))
    const arrowLeft = Math.max(12, Math.min(anchorCenter - left, rect.width - 12))

    box.style.left = `${left}px`
    box.style.top = `${top}px`
    box.style.setProperty('--tooltip-arrow-left', `${arrowLeft}px`)
    box.classList.toggle('tooltip-box--below', below)
    box.style.visibility = 'visible'
  }, [visible])

  return (
    <div
      ref={wrapRef}
      className="tooltip-wrap"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible &&
        createPortal(
          <div ref={boxRef} className="tooltip-box" style={{ visibility: 'hidden' }}>
            {content}
          </div>,
          document.body,
        )}
    </div>
  )
}
