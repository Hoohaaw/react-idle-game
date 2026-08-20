import { useState } from 'react'
import { AuthForm } from './components/AuthForm'

// Branded, centered auth screen shown to signed-out players. Toggles between login and register.

type Mode = 'login' | 'register'

const toggleLinkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  color: 'var(--color-gold-light)',
  fontFamily: 'Georgia, serif',
  fontSize: 13,
  textDecoration: 'underline',
}

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')

  return (
    <div style={{
      minHeight: '100svh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: 'var(--color-bg-deep)',
      fontFamily: 'Georgia, serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 380,
        borderRadius: 10,
        border: '1px solid var(--color-gold-dark)',
        boxShadow: '0 0 0 1px rgba(240,208,96,0.15), inset 0 1px 0 rgba(240,208,96,0.08), 0 8px 28px rgba(0,0,0,0.8)',
        background: 'linear-gradient(180deg, var(--color-bg-raised) 0%, var(--color-bg-panel) 100%)',
        padding: '28px 26px',
      }}>
        <h1 style={{
          textAlign: 'center',
          marginBottom: 4,
          color: 'var(--color-gold-light)',
          fontSize: 22,
          letterSpacing: '1.5px',
          textShadow: '0 0 12px rgba(240,208,96,0.4), 0 2px 3px rgba(0,0,0,0.9)',
        }}>The Idle Game</h1>
        <p style={{ textAlign: 'center', marginBottom: 24, color: 'var(--color-text-muted)', fontSize: 13 }}>
          {mode === 'login' ? 'Sign in to continue your adventure.' : 'Create an account to begin.'}
        </p>

        <AuthForm mode={mode} />

        <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--color-text-muted)', fontSize: 13 }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            style={toggleLinkStyle}
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
