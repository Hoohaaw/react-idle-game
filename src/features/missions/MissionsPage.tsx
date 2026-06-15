import { useState } from 'react'
import { Modal } from '@/components/organisms/Modal'
import { MissionCard } from './components/MissionCard'
import { ActiveMissionCard } from './components/ActiveMissionCard'
import { MissionDispatch } from './components/MissionDispatch'
import { ClaimReward } from './components/ClaimReward'

// Mock progression + mission data (replaced by real data/services later).
const ADVENTURE_STAGE = 4

type Mission = { name: string; stage: number; coins: number; duration: string; dropCount: number }
const MAPS: { label: string; missions: Mission[] }[] = [
  {
    label: 'Verdant Reach',
    missions: [
      { name: 'Goblin Outpost', stage: 1, coins: 40, duration: '0:30', dropCount: 3 },
      { name: 'Thornwood Path', stage: 2, coins: 65, duration: '1:00', dropCount: 3 },
      { name: 'Boggy Hollow', stage: 3, coins: 90, duration: '2:00', dropCount: 4 },
      { name: 'Ruined Watchtower', stage: 4, coins: 120, duration: '3:00', dropCount: 4 },
      { name: 'Wolfden', stage: 5, coins: 160, duration: '5:00', dropCount: 4 },
      { name: 'Verdant Warren', stage: 6, coins: 240, duration: '8:00', dropCount: 5 },
    ],
  },
  {
    label: 'Emberfall',
    missions: [
      { name: 'Cinder Road', stage: 8, coins: 320, duration: '4:00', dropCount: 4 },
      { name: 'Ashen Quarry', stage: 9, coins: 380, duration: '6:00', dropCount: 4 },
      { name: 'Magma Vents', stage: 10, coins: 450, duration: '8:00', dropCount: 5 },
      { name: 'Ragefire Warren', stage: 11, coins: 700, duration: '12:00', dropCount: 5 },
    ],
  },
  {
    label: 'Frostmere',
    missions: [
      { name: 'Frozen Pass', stage: 15, coins: 820, duration: '6:00', dropCount: 5 },
      { name: 'Glacier Maw', stage: 16, coins: 900, duration: '9:00', dropCount: 5 },
      { name: 'Rimebound Keep', stage: 17, coins: 1100, duration: '14:00', dropCount: 6 },
    ],
  },
  {
    label: 'Shadowspire',
    missions: [
      { name: 'Dusk Gate', stage: 22, coins: 1400, duration: '10:00', dropCount: 6 },
      { name: 'Wraith Halls', stage: 23, coins: 1600, duration: '15:00', dropCount: 6 },
      { name: 'The Spire', stage: 24, coins: 2400, duration: '20:00', dropCount: 7 },
    ],
  },
]

const ACTIVE = [
  { name: 'Boggy Hollow', partySize: 2, durationSec: 120, startedSecAgo: 78 },
  { name: 'Goblin Outpost', partySize: 3, durationSec: 30, startedSecAgo: 30 },
]

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      color: 'var(--color-gold-mid)', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase',
      marginBottom: '14px', paddingBottom: '6px', borderBottom: '1px solid var(--color-gold-dark)',
    }}>{children}</h2>
  )
}

export default function MissionsPage() {
  const [mapIdx, setMapIdx] = useState(0)
  const [modal, setModal] = useState<null | 'dispatch' | 'claim'>(null)
  const map = MAPS[mapIdx]

  return (
    <div>
      {/* In-progress activity feed */}
      <section style={{ marginBottom: '36px' }}>
        <SectionTitle>In Progress</SectionTitle>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
          {ACTIVE.map((a, i) => (
            <ActiveMissionCard key={i} {...a} onClaim={() => setModal('claim')} />
          ))}
        </div>
      </section>

      {/* Mission maps */}
      <section>
        <SectionTitle>Missions</SectionTitle>

        {/* Map selector */}
        <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '2px solid var(--color-gold-dark)', marginBottom: '20px' }}>
          {MAPS.map((m, i) => (
            <button key={m.label} onClick={() => setMapIdx(i)} className={i === mapIdx ? 'tab tab--active' : 'tab'}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Mission grid */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
          {map.missions.map(mission => (
            <MissionCard
              key={mission.name}
              name={mission.name}
              stage={mission.stage}
              coins={mission.coins}
              duration={mission.duration}
              dropCount={mission.dropCount}
              locked={mission.stage > ADVENTURE_STAGE}
              onSend={() => setModal('dispatch')}
            />
          ))}
        </div>
      </section>

      <Modal open={modal !== null} onClose={() => setModal(null)}>
        {modal === 'dispatch' ? <MissionDispatch /> : modal === 'claim' ? <ClaimReward /> : null}
      </Modal>
    </div>
  )
}
