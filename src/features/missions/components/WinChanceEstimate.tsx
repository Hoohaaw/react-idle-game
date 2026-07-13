import { useMemo } from 'react'
import { resolveRole } from '@/lib/roles'
import type { MissionEnemyView } from '@/services/missions'
import { estimateWinChance, ESTIMATE_RUNS } from '../winChance'
import type { DispatchChar } from './dispatchSamples'

// The dispatch modal's "Estimated success" box: runs the real combat engine over
// ESTIMATE_RUNS random seeds for the currently selected party (see ../winChance.ts).
// Renders nothing when no party is picked or when stat blocks aren't loaded (fixtures).
export function WinChanceEstimate({ party, enemies, timeLimitSeconds }: {
  party: DispatchChar[]
  enemies: MissionEnemyView[]
  timeLimitSeconds: number | null
}) {
  const winPct = useMemo(() => {
    const withStats = party.filter((c): c is typeof c & { stats: Record<string, number> } => Boolean(c.stats))
    if (party.length === 0 || withStats.length !== party.length) return null
    return estimateWinChance({
      party: withStats.map((c) => ({
        id: c.id,
        role: resolveRole(c.charClass, c.role),
        stats: c.stats,
        currentHp: c.currentHp,
        damageSchool: c.damageSchool,
      })),
      enemies,
      timeLimitSeconds,
    })
  }, [party, enemies, timeLimitSeconds])

  if (winPct == null) return null
  const color = winPct >= 70 ? '#5fc77e' : winPct >= 40 ? '#d89a4f' : '#e0635c'
  const border = winPct >= 70 ? '#2d6b45' : winPct >= 40 ? '#8c6020' : '#8a2e29'
  const glow = winPct >= 70 ? 'rgba(95,199,126,0.4)' : winPct >= 40 ? 'rgba(216,154,79,0.4)' : 'rgba(224,99,92,0.4)'
  return (
    <div className="atom-heavy" style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px',
      padding: '10px 12px', borderRadius: '5px', marginBottom: '16px',
      border: `2px solid ${border}`,
      background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
    }}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
        Estimated success
        <span style={{ display: 'block', fontSize: '9px', letterSpacing: '0.5px', textTransform: 'none', fontStyle: 'italic', marginTop: '2px' }}>
          {ESTIMATE_RUNS} simulated fights
        </span>
      </span>
      <span style={{ fontSize: '20px', fontWeight: 'bold', color, textShadow: `0 0 10px ${glow}` }}>
        {winPct}%
      </span>
    </div>
  )
}
