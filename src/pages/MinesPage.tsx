import { MineCard } from '../components/molecules/MineCard'
import { ActiveGatherCard } from '../components/molecules/ActiveGatherCard'

// Mock mine data for the prototype (replaced by real gather-config/service data later).
// Values come from the carried-over GATHER_CONFIG (a starting point, pending rebalance
// for the continuous/uncapped tick model). Ores: Copper, Silver, Gold, Platinum.
type Mine = {
  resource: string; tier: string; intervalSec: number; yieldPerTick: number
  gatherer?: string; assignedSecAgo?: number; bonus?: string
}

const MINES: Mine[] = [
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

const ACTIVE = MINES.filter(m => m.gatherer)

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      color: 'var(--color-gold-mid)', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase',
      marginBottom: '14px', paddingBottom: '6px', borderBottom: '1px solid var(--color-gold-dark)',
    }}>{children}</h2>
  )
}

export default function MinesPage() {
  return (
    <div>
      {/* Active gathering collector — at-a-glance feed of what's being gathered and by whom */}
      {ACTIVE.length > 0 && (
        <section style={{ marginBottom: '36px' }}>
          <SectionTitle>Active Gathering</SectionTitle>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
            {ACTIVE.map(m => (
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
          {MINES.map(m => <MineCard key={m.resource} {...m} />)}
        </div>
      </section>
    </div>
  )
}
