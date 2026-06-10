import type { ReactNode } from 'react'

// Small muted uppercase label used to head sub-sections inside cards/panels.
export function SectionLabel({ children }: { children: ReactNode }) {
  return <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>{children}</p>
}
