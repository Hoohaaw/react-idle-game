import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PrimaryButton } from '../atoms/Button'

const ACK_KEY = 'cookieNotice:acknowledged'

// Bottom notice, dismissed once and remembered in localStorage (same pattern GameLayout already
// uses for its own once-a-day flag). Mounted globally in App.tsx so it shows regardless of auth
// state — the local-storage usage it discloses (session token, this flag itself) applies before
// and after sign-in alike.
export function CookieBanner() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(ACK_KEY) === '1')
  if (dismissed) return null

  const acknowledge = () => {
    localStorage.setItem(ACK_KEY, '1')
    setDismissed(true)
  }

  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 100,
      padding: '14px 20px', fontFamily: 'Georgia, serif',
      borderTop: '2px solid var(--color-gold-mid)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: '0 -4px 16px rgba(0,0,0,0.7)',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 12, lineHeight: 1.5, maxWidth: 560, margin: 0 }}>
        This site uses local storage to keep you signed in and remember a few preferences —
        nothing beyond that (no ad or tracking cookies). See our{' '}
        <Link to="/privacy" style={{ color: 'var(--color-gold-light)', textDecoration: 'underline' }}>Privacy Policy</Link>.
      </p>
      <PrimaryButton onClick={acknowledge}>Got it</PrimaryButton>
    </div>
  )
}
