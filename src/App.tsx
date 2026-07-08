import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { GameLayout } from './components/templates/GameLayout'
import { RequireAuth } from '@/features/auth'

// Route-level code splitting: every page loads as its own chunk on first visit, keeping the
// entry bundle small (it was one ~860 kB chunk). Feature pages are pulled through their barrel
// (import rules: outsiders import only @/features/<x>) and re-shaped to lazy's default-export
// contract; unmigrated pages already default-export.
const DesignPage = lazy(() => import('./pages/DesignPage'))
const MissionsPage = lazy(() => import('@/features/missions').then((m) => ({ default: m.MissionsPage })))
const InfirmaryPage = lazy(() => import('@/features/infirmary').then((m) => ({ default: m.InfirmaryPage })))
const GatherPage = lazy(() => import('@/features/gather').then((m) => ({ default: m.GatherPage })))
const TeamPage = lazy(() => import('@/features/team').then((m) => ({ default: m.TeamPage })))
const UpgradingPage = lazy(() => import('./pages/UpgradingPage'))
const ShopPage = lazy(() => import('./pages/ShopPage'))
const InventoryPage = lazy(() => import('./pages/InventoryPage'))
const CraftingPage = lazy(() => import('./pages/CraftingPage'))
const UpgradesPage = lazy(() => import('./pages/UpgradesPage'))
const BlessingsPage = lazy(() => import('./pages/BlessingsPage'))
const TranscendencePage = lazy(() => import('./pages/TranscendencePage'))
const StatisticsPage = lazy(() => import('./pages/StatisticsPage'))

function PageLoading() {
  return (
    <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', fontStyle: 'italic', padding: '24px' }}>
      Loading…
    </p>
  )
}

export default function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* Design system showcase (dev only) — intentionally outside the auth guard */}
        <Route path="/design" element={<DesignPage />} />

        {/* Everything below requires a signed-in player (RequireAuth renders the AuthPage otherwise) */}
        <Route element={<RequireAuth />}>
          {/* Game pages — share the global header via GameLayout */}
          <Route element={<GameLayout />}>
            <Route path="/missions" element={<MissionsPage />} />
            <Route path="/infirmary" element={<InfirmaryPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/mines" element={<GatherPage />} />
            <Route path="/upgrading" element={<UpgradingPage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/crafting" element={<CraftingPage />} />
            <Route path="/upgrades" element={<UpgradesPage />} />
            <Route path="/blessings" element={<BlessingsPage />} />
            <Route path="/transcendence" element={<TranscendencePage />} />
            <Route path="/statistics" element={<StatisticsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/missions" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
