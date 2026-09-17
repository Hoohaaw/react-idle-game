import { useNavigate } from 'react-router-dom'
import { Outlet } from 'react-router-dom'

// Shared chrome for /terms and /privacy: narrow readable column, back link, consistent heading/
// paragraph styling. Both are plain public pages (outside RequireAuth — see src/App.tsx) since
// a prospective player should be able to read them before creating an account.
export function LegalLayout() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'var(--color-bg-deep)', fontFamily: 'Georgia, serif', padding: '32px 20px 80px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', padding: 0, marginBottom: 24, cursor: 'pointer',
            color: 'var(--color-gold-light)', fontFamily: 'Georgia, serif', fontSize: 13,
          }}
        >
          ← Back
        </button>
        <Outlet />
      </div>
    </div>
  )
}

export function LegalH1({ children }: { children: React.ReactNode }) {
  return (
    <h1 style={{ color: 'var(--color-gold-light)', fontSize: 26, letterSpacing: 1, marginBottom: 6 }}>
      {children}
    </h1>
  )
}

export function LegalMeta({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic', marginBottom: 32 }}>
      {children}
    </p>
  )
}

export function LegalH2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      color: 'var(--color-gold-mid)', fontSize: 15, letterSpacing: 0.5,
      marginTop: 28, marginBottom: 10, borderBottom: '1px solid var(--color-gold-dark)', paddingBottom: 6,
    }}>
      {children}
    </h2>
  )
}

export function LegalP({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: 'var(--color-text-primary)', fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>
      {children}
    </p>
  )
}
