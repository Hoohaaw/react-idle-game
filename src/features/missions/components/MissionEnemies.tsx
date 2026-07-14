import { SectionLabel } from '@/components/molecules/SectionLabel'
import { SchoolBadge } from '@/components/atoms/SchoolBadge'
import type { MissionEnemyView } from '@/services/missions'
import { summarizeResistances } from '../resistSummary'

// The dispatch modal's "Enemies" section (ADR-0033): what the party will fight, each enemy's
// damage school, and the aggregated "strong against / weak against" squad-choice summary.
// Renders nothing for missions with no encounter data (early tiers stay clean).

function ResistSummaryRows({ enemies }: { enemies: MissionEnemyView[] }) {
  const { strong, weak } = summarizeResistances(enemies)
  if (strong.length === 0 && weak.length === 0) return null
  const row = (label: string, schools: typeof strong) => (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px' }}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginRight: '3px' }}>{label}</span>
      {schools.map((s) => <SchoolBadge key={s} school={s} size="sm" />)}
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 10px', borderRadius: '4px', border: '1px solid var(--color-gold-dark)' }}>
      {strong.length > 0 && row('Strong against', strong)}
      {weak.length > 0 && row('Weak against', weak)}
    </div>
  )
}

export function MissionEnemies({ enemies }: { enemies: MissionEnemyView[] }) {
  if (enemies.length === 0) return null
  return (
    <>
      <SectionLabel>Enemies</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '18px' }}>
        {enemies.map((e) => (
          <div key={e.name} className="atom-heavy" style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '4px',
            border: '2px solid var(--color-gold-dark)', background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
          }}>
            <span style={{ color: 'var(--color-text-primary)', fontSize: '12px', flex: 1 }}>
              {e.name}{e.count > 1 ? <span style={{ color: 'var(--color-text-muted)' }}> ×{e.count}</span> : null}
            </span>
            {e.stats && <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{e.stats.health} HP</span>}
            <SchoolBadge school={e.damageType} size="sm" />
          </div>
        ))}
        <ResistSummaryRows enemies={enemies} />
      </div>
    </>
  )
}
