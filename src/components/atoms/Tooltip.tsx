import { useState } from 'react'
import type { ReactNode } from 'react'

export function Tooltip({ children, content }: { children: ReactNode; content: ReactNode }) {
  const [visible, setVisible] = useState(false)
  return (
    <div
      className="tooltip-wrap"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && <div className="tooltip-box">{content}</div>}
    </div>
  )
}
