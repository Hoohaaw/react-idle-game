// src/features/reset/components/TranscendTab.tsx
import { useProfile } from '@/hooks/useProfile'
import { Alert } from '@/components/atoms/Alert'

// Placeholder body — AscendantShopGrid (Task 17) and TranscendAction (Task 18) render here once
// built. Kept as its own component from the start (mirrors ResetTab.tsx's shape) so PrestigePage's
// tab-switching (this task) and the tab's real content (next two tasks) are separate, independently
// reviewable changes.
export function TranscendTab() {
  const profile = useProfile()
  if (profile.isPending) {
    return <p style={{ color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic' }}>Loading...</p>
  }
  if (profile.error || !profile.data) {
    return <Alert variant="error">Could not load your profile.</Alert>
  }
  return <div />
}
