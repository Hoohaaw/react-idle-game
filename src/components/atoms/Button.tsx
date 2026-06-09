import type { ReactNode } from 'react'

export function PrimaryButton({ children, disabled, fullWidth, onClick, type }: { children: ReactNode; disabled?: boolean; fullWidth?: boolean; onClick?: () => void; type?: 'button' | 'submit' }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      type={type ?? 'button'}
      className="btn btn-primary"
      style={{
        position: 'relative',
        width: fullWidth ? '100%' : undefined,
        padding: '10px 24px',
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        letterSpacing: '1px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        borderRadius: '5px',
        /* Layer 1: outer dark grounding edge + glow */
        /* Layer 2: main gold border (3px) */
        /* Layer 3: inner light gold highlight edge */
        border: disabled ? '3px solid var(--color-gold-dark)' : '3px solid var(--color-gold-mid)',
        boxShadow: disabled ? 'none' : [
          '0 0 0 1px #3a2008',                          /* outer dark edge */
          'inset 0 0 0 1px rgba(240,208,96,0.25)',       /* inner light edge */
          '0 0 14px rgba(200,140,30,0.4)',               /* outer glow */
          '0 2px 6px rgba(0,0,0,0.7)',                   /* drop shadow */
        ].join(', '),
        background: disabled
          ? 'var(--color-bg-raised)'
          : 'linear-gradient(180deg, #4a1010 0%, #2d0808 50%, #1e0505 100%)',
        color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
      }}
    >
      <span style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 100%)',
        borderRadius: '5px 5px 0 0',
        pointerEvents: 'none',
      }} />
      {children}
    </button>
  )
}

export function SecondaryButton({ children }: { children: ReactNode }) {
  return (
    <button className="btn btn-secondary" style={{
      padding: '10px 24px',
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      letterSpacing: '1px',
      cursor: 'pointer',
      borderRadius: '5px',
      border: '2px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, #2a1a08 0%, #180e04 100%)',
      color: 'var(--color-text-gold)',
      boxShadow: '0 0 0 1px #1a0c02, 0 2px 4px rgba(0,0,0,0.5)',
    }}>
      {children}
    </button>
  )
}

export function DangerButton({ children }: { children: ReactNode }) {
  return (
    <button className="btn btn-danger" style={{
      padding: '10px 24px',
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      letterSpacing: '1px',
      cursor: 'pointer',
      borderRadius: '5px',
      border: '2px solid #6b1010',
      background: 'linear-gradient(180deg, #3d0a0a 0%, #200505 100%)',
      color: '#e08080',
      boxShadow: '0 0 10px rgba(140,20,20,0.3), 0 2px 4px rgba(0,0,0,0.6)',
    }}>
      {children}
    </button>
  )
}

export function GhostButton({ children }: { children: ReactNode }) {
  return (
    <button className="btn btn-ghost" style={{
      padding: '10px 24px',
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      letterSpacing: '1px',
      cursor: 'pointer',
      borderRadius: '5px',
      border: '1px solid rgba(200,145,42,0.3)',
      background: 'transparent',
      color: 'var(--color-text-muted)',
    }}>
      {children}
    </button>
  )
}
