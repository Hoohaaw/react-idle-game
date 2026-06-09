import type { ReactNode } from 'react'

export function IconButton({ children, size = 34, label, variant = 'default', onClick }: { children: ReactNode; size?: number; label?: string; variant?: 'default' | 'danger'; onClick?: () => void }) {
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={label}
      onClick={onClick}
      style={{
        width: size, height: size, fontSize: Math.round(size * 0.42),
        ...(variant === 'danger' ? { borderColor: '#6b1010', color: '#e08080' } : {}),
      }}
    >{children}</button>
  )
}
