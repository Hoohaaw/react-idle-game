// src/features/reset/PrestigePage.tsx
import { useState } from 'react'
import { SegmentedControl } from '@/components/atoms/SegmentedControl'
import { ResetTab } from './components/ResetTab'
import { TranscendTab } from './components/TranscendTab'
import { useRaidEligibility } from './hooks'

export default function PrestigePage() {
  const { isEligible } = useRaidEligibility()
  const tabs = isEligible ? ['Reset', 'Transcend'] : ['Reset']
  const [active, setActive] = useState('Reset')
  // If the gate is lost/regained between renders (a raid re-locking it, spec §5a), never strand
  // the player on a tab that just disappeared.
  const visibleActive = tabs.includes(active) ? active : 'Reset'

  return (
    <div>
      <h1 style={{ color: 'var(--color-gold-light)', fontSize: '22px', letterSpacing: '1px', textShadow: '0 0 12px rgba(240,208,96,0.35)', marginBottom: 14 }}>
        Prestige
      </h1>
      <SegmentedControl options={tabs} value={visibleActive} onChange={setActive} />
      <div style={{ marginTop: 20 }}>
        {visibleActive === 'Reset' ? <ResetTab /> : <TranscendTab />}
      </div>
    </div>
  )
}
