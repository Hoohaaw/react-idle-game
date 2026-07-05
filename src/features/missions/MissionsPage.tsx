import { useState } from 'react'
import { Modal } from '@/components/organisms/Modal'
import { MissionCard } from './components/MissionCard'
import { ActiveMissionCard } from './components/ActiveMissionCard'
import { MissionDispatch } from './components/MissionDispatch'
import { ClaimReward } from './components/ClaimReward'

// Mock progression + mission data (replaced by real data/services later). Shapes mirror the Sanity
// missionDef (name/coins/xp base rewards + loot count) and mission_runs (started_at/ends_at).
const ADVENTURE_STAGE = 4

type Mission = { name: string; stage: number; coins: number; xp: number; duration: string; dropCount: number }
const MAPS: { label: string; missions: Mission[] }[] = [
  {
    label: 'Verdant Reach',
    missions: [
      { name: 'Goblin Outpost', stage: 1, coins: 40, xp: 30, duration: '0:30', dropCount: 3 },
      { name: 'Thornwood Path', stage: 2, coins: 65, xp: 55, duration: '1:00', dropCount: 3 },
      { name: 'Boggy Hollow', stage: 3, coins: 90, xp: 80, duration: '2:00', dropCount: 4 },
      { name: 'Ruined Watchtower', stage: 4, coins: 120, xp: 110, duration: '3:00', dropCount: 4 },
      { name: 'Wolfden', stage: 5, coins: 160, xp: 150, duration: '5:00', dropCount: 4 },
      { name: 'Verdant Warren', stage: 6, coins: 240, xp: 220, duration: '8:00', dropCount: 5 },
    ],
  },
  {
    label: 'Emberfall',
    missions: [
      { name: 'Cinder Road', stage: 8, coins: 320, xp: 300, duration: '4:00', dropCount: 4 },
      { name: 'Ashen Quarry', stage: 9, coins: 380, xp: 360, duration: '6:00', dropCount: 4 },
      { name: 'Magma Vents', stage: 10, coins: 450, xp: 430, duration: '8:00', dropCount: 5 },
      { name: 'Ragefire Warren', stage: 11, coins: 700, xp: 620, duration: '12:00', dropCount: 5 },
    ],
  },
  {
    label: 'Frostmere',
    missions: [
      { name: 'Frozen Pass', stage: 15, coins: 820, xp: 760, duration: '6:00', dropCount: 5 },
      { name: 'Glacier Maw', stage: 16, coins: 900, xp: 840, duration: '9:00', dropCount: 5 },
      { name: 'Rimebound Keep', stage: 17, coins: 1100, xp: 1000, duration: '14:00', dropCount: 6 },
    ],
  },
  {
    label: 'Shadowspire',
    missions: [
      { name: 'Dusk Gate', stage: 22, coins: 1400, xp: 1300, duration: '10:00', dropCount: 6 },
      { name: 'Wraith Halls', stage: 23, coins: 1600, xp: 1500, duration: '15:00', dropCount: 6 },
      { name: 'The Spire', stage: 24, coins: 2400, xp: 2200, duration: '20:00', dropCount: 7 },
    ],
  },
]

// started_at/ends_at as absolute epoch ms (frozen at module load so demo countdowns stay stable).
const NOW = Date.now()
const ACTIVE = [
  { name: 'Boggy Hollow', partySize: 2, startedAt: NOW - 78_000, endsAt: NOW + 42_000 },
  { name: 'Goblin Outpost', partySize: 3, startedAt: NOW - 30_000, endsAt: NOW },
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
              xp={mission.xp}
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
