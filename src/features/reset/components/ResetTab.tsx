// src/features/reset/components/ResetTab.tsx
import { useProfile } from '@/hooks/useProfile'
import { Alert } from '@/components/atoms/Alert'
import { EchoShopGrid } from './EchoShopGrid'
import { ResetAction } from './ResetAction'

export function ResetTab() {
  const profile = useProfile()
  if (profile.isPending) {
    return <p style={{ color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic' }}>Loading...</p>
  }
  if (profile.error || !profile.data) {
    return <Alert variant="error">Could not load your profile.</Alert>
  }

  return (
    <div>
      <EchoShopGrid echoes={profile.data.echoes} echoShop={profile.data.echoShop} />
      <ResetAction mapProgress={profile.data.mapProgress} lifetimeGoldEarned={profile.data.lifetimeStats.goldEarned ?? 0} />
    </div>
  )
}
