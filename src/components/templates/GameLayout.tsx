import { Outlet } from 'react-router-dom'
import { GameHeader } from '../organisms/GameHeader'

// Shared layout for all game pages: sticky header + routed content area.
export function GameLayout() {
  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'var(--color-bg-deep)', fontFamily: 'Georgia, serif' }}>
      <GameHeader />
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        <Outlet />
      </main>
    </div>
  )
}
