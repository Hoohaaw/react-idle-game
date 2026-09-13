// src/features/reset/components/TranscendTab.tsx
import { useProfile } from '@/hooks/useProfile'
import { Alert } from '@/components/atoms/Alert'
import { AscendantShopGrid } from './AscendantShopGrid'
import { MilestoneProgressList } from './MilestoneProgressList'
import { TranscendAction } from './TranscendAction'

export function TranscendTab() {
  const profile = useProfile()
  if (profile.isPending) {
    return <p style={{ color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic' }}>Loading...</p>
  }
  if (profile.error || !profile.data) {
    return <Alert variant="error">Could not load your profile.</Alert>
  }
  return (
    <div>
      <AscendantShopGrid ascendantShards={profile.data.ascendantShards} ascendantShop={profile.data.ascendantShop} />
      <p style={{ color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', margin: '24px 0 10px' }}>
        Milestones
      </p>
      <MilestoneProgressList
        lifetimeStats={profile.data.lifetimeStats}
        transcendCount={profile.data.transcendCount}
        ascendantMilestones={profile.data.ascendantMilestones}
      />
      <TranscendAction protectedSlots={profile.data.echoShop.protectedSlots ?? 0} />
    </div>
  )
}
