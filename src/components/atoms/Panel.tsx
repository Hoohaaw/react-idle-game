import type { ReactNode } from 'react'

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{
      width: '220px',
      borderRadius: '8px',
      /* Gold gradient border via box-shadow layering */
      border: '1px solid var(--color-gold-dark)',
      boxShadow: '0 0 0 1px rgba(240,208,96,0.15), inset 0 1px 0 rgba(240,208,96,0.08), 0 4px 16px rgba(0,0,0,0.7)',
      background: 'linear-gradient(180deg, var(--color-bg-raised) 0%, var(--color-bg-panel) 100%)',
      overflow: 'hidden',
    }}>
      {/* Panel header bar */}
      <div style={{
        padding: '8px 14px',
        borderBottom: '1px solid var(--color-gold-dark)',
        background: 'linear-gradient(180deg, rgba(200,145,42,0.15) 0%, rgba(200,145,42,0.05) 100%)',
      }}>
        <p style={{ color: 'var(--color-gold-light)', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>{title}</p>
      </div>
      <div style={{ padding: '14px' }}>
        {children}
      </div>
    </div>
  )
}
