import { Routes, Route, Navigate } from 'react-router-dom'
import { GameLayout } from './components/templates/GameLayout'
import { RequireAuth } from '@/features/auth'
import DesignPage from './pages/DesignPage'
import { MissionsPage } from '@/features/missions'
import { InfirmaryPage } from '@/features/infirmary'
import { GatherPage } from '@/features/gather'
import { TeamPage } from '@/features/team'
import { RecruitsPage } from '@/features/recruits'
import { BlessingsPage } from '@/features/blessings'
import { RespecPage } from '@/features/respec'
import UpgradingPage from './pages/UpgradingPage'
import ShopPage from './pages/ShopPage'
import InventoryPage from './pages/InventoryPage'
import CraftingPage from './pages/CraftingPage'
import UpgradesPage from './pages/UpgradesPage'
import TranscendencePage from './pages/TranscendencePage'
import StatisticsPage from './pages/StatisticsPage'
import GameStatsPage from './pages/GameStatsPage'

export default function App() {
  return (
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
          <Route path="/recruits" element={<RecruitsPage />} />
          <Route path="/mines" element={<GatherPage />} />
          <Route path="/upgrading" element={<UpgradingPage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/crafting" element={<CraftingPage />} />
          <Route path="/upgrades" element={<UpgradesPage />} />
          <Route path="/blessings" element={<BlessingsPage />} />
          <Route path="/respec" element={<RespecPage />} />
          <Route path="/transcendence" element={<TranscendencePage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/game-stats" element={<GameStatsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/missions" replace />} />
      </Route>
    </Routes>
  )
}
