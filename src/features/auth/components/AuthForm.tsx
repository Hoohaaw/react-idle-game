import { useState } from 'react'
import { PrimaryButton } from '@/components/atoms/Button'
import { Alert } from '@/components/atoms/Alert'
import { signIn, signUp } from '@/services/auth'

// One form for both modes — login and register differ only in which service call they make and a
// register-only "confirm your email" outcome. The store's auth listener handles a successful sign-in,
// so this component only owns the form fields, the in-flight/error state, and the confirm-email notice.

type Mode = 'login' | 'register'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontFamily: 'Georgia, serif',
  fontSize: '14px',
  borderRadius: '5px',
  border: '2px solid var(--color-gold-dark)',
  background: 'var(--color-bg-deep)',
  color: 'var(--color-text-primary)',
  boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.5)',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  fontSize: 12,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  color: 'var(--color-text-gold)',
}

export function AuthForm({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmSent, setConfirmSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'register') {
        const data = await signUp({ email, password })
        // No session => email confirmation is required; signing in happens after the user confirms.
        if (!data.session) setConfirmSent(true)
      } else {
        await signIn({ email, password })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (confirmSent) {
    return (
      <Alert variant="info">
        Account created. Check <strong>{email}</strong> for a confirmation link, then sign in.
      </Alert>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label htmlFor="auth-email" style={labelStyle}>Email</label>
        <input
          id="auth-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="auth-password" style={labelStyle}>Password</label>
        <input
          id="auth-password"
          type="password"
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <PrimaryButton type="submit" fullWidth disabled={busy}>
        {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
      </PrimaryButton>
    </form>
  )
}
