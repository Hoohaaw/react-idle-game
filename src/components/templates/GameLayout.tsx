import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { GameHeader } from '../organisms/GameHeader'
import { useRecordLogin } from '@/features/achievements/hooks'

const LAST_RECORDED_KEY = 'achievements:lastRecordedLoginDate'

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

// Shared layout for all game pages: sticky header + routed content area. Mounts once per signed-
// in session (nested routes swap only the Outlet), so this is the natural place to record a
// login once per UTC day (spec 2026-09-13 §4c) — a client-side localStorage check on top of the
// server's own idempotent last_login_date, purely to avoid a network call on every mount.
export function GameLayout() {
  const recordLogin = useRecordLogin()

  useEffect(() => {
    const today = todayUtc()
    if (localStorage.getItem(LAST_RECORDED_KEY) === today) return
    recordLogin.mutate(undefined, {
      onSuccess: () => localStorage.setItem(LAST_RECORDED_KEY, today),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'var(--color-bg-deep)', fontFamily: 'Georgia, serif' }}>
      <GameHeader />
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        <Outlet />
      </main>
    </div>
  )
}
