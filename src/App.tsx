import { Routes, Route, Navigate } from 'react-router-dom'
import { GameLayout } from './components/templates/GameLayout'
import DesignPage from './pages/DesignPage'
import MissionsPage from './pages/MissionsPage'
import TeamPage from './pages/TeamPage'
import MinesPage from './pages/MinesPage'
import UpgradingPage from './pages/UpgradingPage'
import ShopPage from './pages/ShopPage'
import InventoryPage from './pages/InventoryPage'
import CraftingPage from './pages/CraftingPage'
import UpgradesPage from './pages/UpgradesPage'
import BlessingsPage from './pages/BlessingsPage'
import TranscendencePage from './pages/TranscendencePage'
import StatisticsPage from './pages/StatisticsPage'

export default function App() {
  return (
    <Routes>
      {/* Design system showcase (dev only) */}
      <Route path="/design" element={<DesignPage />} />

      {/* Game pages — share the global header via GameLayout */}
      <Route element={<GameLayout />}>
        <Route path="/missions" element={<MissionsPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/mines" element={<MinesPage />} />
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
    </Routes>
  )
}
