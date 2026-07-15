import { useMemo } from 'react'
import { resolveRole } from '@/lib/roles'
import { effectiveStats, mergeBonuses } from '@/lib/stats'
import { collectTraitBonuses } from '@/lib/traits'
import { resolveBlessingAllocations, capstoneEarned, resolveCapstoneBonuses } from '@/lib/blessings'
import { useItemDefs } from '@/hooks/useRoster'
import type { MissionEnemyView } from '@/services/missions'
import { estimateWinChance, missionTraitContext } from '../winChance'
import type { DispatchChar } from './dispatchSamples'

// The dispatch modal's "Estimated success" box: runs the real combat engine over
// ESTIMATE_RUNS random seeds for the currently selected party (see ../winChance.ts).
// When a member carries statInputs + traits (real roster data), their stats are RECOMPUTED
// with the mission's trait context — the same math mission-claim runs — so picking a
// Gravehand for a Gravemarch mission visibly moves the number (ADR-0035). Always renders
// (shows a "—" placeholder before a party is picked / while stat blocks are loading) so it
// doesn't pop the layout in and out next to Duration/Base XP.
export function WinChanceEstimate({ party, enemies, timeLimitSeconds, mapKey }: {
  party: DispatchChar[]
  enemies: MissionEnemyView[]
  timeLimitSeconds: number | null
  mapKey?: string | null
}) {
  const itemDefs = useItemDefs()

  const winPct = useMemo(() => {
    const withStats = party.filter((c): c is typeof c & { stats: Record<string, number> } => Boolean(c.stats))
    if (party.length === 0 || withStats.length !== party.length) return null
    const ctx = missionTraitContext(enemies, mapKey)
    return estimateWinChance({
      party: withStats.map((c) => ({
        id: c.id,
        role: resolveRole(c.charClass, c.role),
        stats:
          c.statInputs && itemDefs.data
            ? effectiveStats({
                level: c.level,
                baseStats: c.statInputs.baseStats,
                growth: c.statInputs.growth,
                blessingAllocations: resolveBlessingAllocations(c.blessings ?? {}),
                blessingNodes: c.statInputs.blessingNodes,
                equipped: c.equipped ?? {},
                itemDefs: itemDefs.data,
                extraBonuses: mergeBonuses(
                  collectTraitBonuses(c.traits ?? [], ctx),
                  resolveCapstoneBonuses(
                    c.statInputs.capstone,
                    capstoneEarned(c.level, c.blessings ?? {}),
                    ctx,
                  ),
                ),
              })
            : c.stats, // fixtures / defs still loading: context-free stats
        currentHp: c.currentHp,
        damageSchool: c.damageSchool,
      })),
      enemies,
      timeLimitSeconds,
    })
  }, [party, enemies, timeLimitSeconds, mapKey, itemDefs.data])

  const color = winPct == null ? 'var(--color-text-muted)' : winPct >= 70 ? '#5fc77e' : winPct >= 40 ? '#d89a4f' : '#e0635c'
  const border = winPct == null ? 'var(--color-gold-dark)' : winPct >= 70 ? '#2d6b45' : winPct >= 40 ? '#8c6020' : '#8a2e29'
  const glow = winPct == null ? 'transparent' : winPct >= 70 ? 'rgba(95,199,126,0.4)' : winPct >= 40 ? 'rgba(216,154,79,0.4)' : 'rgba(224,99,92,0.4)'
  return (
    <div className="atom-heavy" style={{
      flex: '1 1 220px', minWidth: 220, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px',
      padding: '12px 16px', borderRadius: '5px',
      border: `2px solid ${border}`,
      background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
    }}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
        Estimated success
        <span style={{ display: 'block', fontSize: '9px', letterSpacing: '0.5px', textTransform: 'none', fontStyle: 'italic', marginTop: '2px' }}>
          Traits included
        </span>
      </span>
      <span style={{ fontSize: '18px', fontWeight: 'bold', color, textShadow: winPct == null ? 'none' : `0 0 10px ${glow}` }}>
        {winPct == null ? '—' : `${winPct}%`}
      </span>
    </div>
  )
}
