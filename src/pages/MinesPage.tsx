import { useState } from 'react'
import { MineCard } from '../components/molecules/MineCard'
import { ActiveGatherCard } from '../components/molecules/ActiveGatherCard'
import { Modal } from '../components/organisms/Modal'
import { PartyRoster } from '../components/organisms/PartyRoster'
import type { RosterCharacter } from '../components/organisms/PartyRoster'
import { PrimaryButton, SecondaryButton } from '../components/atoms/Button'
import { resourceHeaderStyle } from '../lib/resources'

// Mock mine data for the prototype (replaced by real gather-config/service data later).
// Values come from the carried-over GATHER_CONFIG (a starting point, pending rebalance
// for the continuous/uncapped tick model). Ores: Copper, Silver, Gold, Platinum.
type Mine = {
  resource: string; tier: string; intervalSec: number; yieldPerTick: number
  gatherer?: string; assignedSecAgo?: number; bonus?: string
}

const INITIAL_MINES: Mine[] = [
  { resource: 'Copper', tier: 'Ore', intervalSec: 30, yieldPerTick: 5, gatherer: 'Lyra Swift', assignedSecAgo: 18, bonus: '+10% gather speed' },
  { resource: 'Wood', tier: 'Material', intervalSec: 20, yieldPerTick: 4, gatherer: 'Tyra Oakheart', assignedSecAgo: 35, bonus: '+30% yield' },
  { resource: 'Stone', tier: 'Material', intervalSec: 30, yieldPerTick: 5 },
  { resource: 'Coal', tier: 'Material', intervalSec: 45, yieldPerTick: 6 },
  { resource: 'Iron', tier: 'Material', intervalSec: 60, yieldPerTick: 8 },
  { resource: 'Silver', tier: 'Ore', intervalSec: 90, yieldPerTick: 10 },
  { resource: 'Bronze', tier: 'Material', intervalSec: 120, yieldPerTick: 15 },
  { resource: 'Gold', tier: 'Ore', intervalSec: 300, yieldPerTick: 25, gatherer: 'Alexandros', assignedSecAgo: 140, bonus: '+20% yield' },
  { resource: 'Platinum', tier: 'Ore', intervalSec: 900, yieldPerTick: 75 },
]

// Mock party (replaced by characters-table data later). On-mission status is mock;
// gathering status is derived live from the current mine assignments below.
type Character = { id: string; name: string; charClass: string; level: number; onMission?: string }
const CHARACTERS: Character[] = [
  { id: 'c1', name: 'Lyra Swift', charClass: 'Rogue', level: 12 },
  { id: 'c2', name: 'Tyra Oakheart', charClass: 'Hunter', level: 9 },
  { id: 'c3', name: 'Alexandros', charClass: 'Death Knight', level: 24 },
  { id: 'c4', name: 'Sally Whitemane', charClass: 'Priest', level: 15, onMission: 'Frozen Pass' },
  { id: 'c5', name: 'Fandral Staghelm', charClass: 'Druid', level: 9 },
  { id: 'c6', name: 'Bron Stormhammer', charClass: 'Warrior', level: 18 },
]

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      color: 'var(--color-gold-mid)', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase',
      marginBottom: '14px', paddingBottom: '6px', borderBottom: '1px solid var(--color-gold-dark)',
    }}>{children}</h2>
  )
}

export default function MinesPage() {
  const [mines, setMines] = useState<Mine[]>(INITIAL_MINES)
  const [assigningResource, setAssigningResource] = useState<string | null>(null)
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null)

  const active = mines.filter(m => m.gatherer)

  // Each character's status: gathering (derived from a mine they're on), on a
  // mission (mock), or idle/available.
  const rosterChars: RosterCharacter[] = CHARACTERS.map(c => {
    const mine = mines.find(m => m.gatherer === c.name)
    const base = { id: c.id, name: c.name, charClass: c.charClass, level: c.level }
    if (mine) return { ...base, activity: 'gather', detail: mine.resource }
    if (c.onMission) return { ...base, activity: 'mission', detail: c.onMission }
    return { ...base, activity: 'idle' }
  })

  const closeAssign = () => { setAssigningResource(null); setSelectedCharId(null) }

  const confirmAssign = () => {
    const char = CHARACTERS.find(c => c.id === selectedCharId)
    if (!char || !assigningResource) return
    setMines(ms => ms.map(m => m.resource === assigningResource ? { ...m, gatherer: char.name, assignedSecAgo: 0 } : m))
    closeAssign()
  }

  const stopMine = (resource: string) => {
    setMines(ms => ms.map(m => m.resource === resource ? { ...m, gatherer: undefined, assignedSecAgo: undefined, bonus: undefined } : m))
  }

  return (
    <div>
      {/* Active gathering collector — at-a-glance feed of what's being gathered and by whom */}
      {active.length > 0 && (
        <section style={{ marginBottom: '36px' }}>
          <SectionTitle>Active Gathering</SectionTitle>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
            {active.map(m => (
              <ActiveGatherCard
                key={m.resource}
                resource={m.resource}
                gatherer={m.gatherer!}
                intervalSec={m.intervalSec}
                yieldPerTick={m.yieldPerTick}
                assignedSecAgo={m.assignedSecAgo!}
                bonus={m.bonus}
              />
            ))}
          </div>
        </section>
      )}

      {/* All mines */}
      <section>
        <SectionTitle>Mines</SectionTitle>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
          {mines.map(m => (
            <MineCard
              // key includes the gatherer so the card remounts on assign/stop,
              // resetting MineCard's internal tick clock to start "now".
              key={`${m.resource}-${m.gatherer ?? 'idle'}`}
              {...m}
              onAssign={() => setAssigningResource(m.resource)}
              onStop={() => stopMine(m.resource)}
            />
          ))}
        </div>
      </section>

      {/* Assign-character flow: pick a free character, then send them to gather */}
      <Modal open={assigningResource !== null} onClose={closeAssign}>
        <div style={{
          width: 360, maxWidth: '90vw', borderRadius: 8, overflow: 'hidden',
          border: '3px solid var(--color-gold-mid)',
          background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
          boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', 'inset 0 2px 8px rgba(0,0,0,0.6)', '0 10px 30px rgba(0,0,0,0.85)'].join(', '),
        }}>
          {/* Header — carries the target resource's accent wash */}
          <div style={{ padding: '14px 16px', borderBottom: '2px solid var(--color-gold-dark)', ...resourceHeaderStyle(assigningResource ?? '') }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>Assign Gatherer</p>
            <p style={{ color: 'var(--color-gold-light)', fontSize: 16, fontWeight: 'bold', textShadow: '0 0 10px rgba(240,208,96,0.4)' }}>⛏ {assigningResource}</p>
          </div>

          {/* Roster — every character; busy ones are shown but not selectable */}
          <div style={{ padding: 16, maxHeight: '52vh', overflowY: 'auto' }}>
            <PartyRoster characters={rosterChars} selectedId={selectedCharId} onSelect={setSelectedCharId} />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--color-gold-dark)' }}>
            <SecondaryButton onClick={closeAssign}>Cancel</SecondaryButton>
            <PrimaryButton disabled={!selectedCharId} onClick={confirmAssign}>Send to Gather</PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
