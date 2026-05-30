import { Routes, Route, Navigate } from 'react-router-dom'
import DesignPage from './pages/DesignPage'

export default function App() {
  return (
    <Routes>
      <Route path="/design" element={<DesignPage />} />
      <Route path="*" element={<Navigate to="/design" replace />} />
    </Routes>
  )
}
