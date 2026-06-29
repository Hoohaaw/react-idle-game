import { Outlet } from 'react-router-dom'
import { Spinner } from '@/components/atoms/Spinner'
import { useAuthStore } from '@/stores/authStore'
import { AuthPage } from './AuthPage'

// Layout-route guard: renders the routed game pages only for signed-in players. While the initial
// session resolves it shows a loader; signed-out players get the AuthPage instead of the game.
export function RequireAuth() {
  const status = useAuthStore((s) => s.status)

  if (status === 'loading') {
    return (
      <div style={{
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg-deep)',
      }}>
        <Spinner size={36} />
      </div>
    )
  }

  if (status === 'anonymous') return <AuthPage />

  return <Outlet />
}
