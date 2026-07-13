import { simulateCombat, type Combatant, type Enemy } from '@/lib/combat'
import type { CharacterRole } from '@/lib/roles'
import type { School } from '@/lib/schools'
import type { MissionEnemyView } from '@/services/missions'

// Client-side win-chance estimate for the dispatch screen. Runs the REAL combat engine
// (src/lib/combat.ts — the same module mission-claim executes, ADR-0016) over many random
// seeds and counts wins. The actual mission is decided by one specific seed (the run id),
// so this is an honest probability, not a preview of the roll. Display-only — the server
// still resolves the fight, so there is nothing to tamper with.

export const ESTIMATE_RUNS = 200

export type EstimateMember = {
  id: string
  role: CharacterRole
  stats: Record<string, number>
  currentHp?: number | null
  damageSchool?: School
}

/** Win percentage (0–100) over ESTIMATE_RUNS simulated fights, or null when the mission's
 *  enemy stat blocks aren't loaded (display-only fixtures). Deterministic: fixed seed list. */
export function estimateWinChance(args: {
  party: EstimateMember[]
  enemies: MissionEnemyView[]
  timeLimitSeconds: number | null
}): number | null {
  const { party, enemies, timeLimitSeconds } = args
  if (party.length === 0 || enemies.length === 0 || timeLimitSeconds == null) return null
  if (enemies.some((e) => !e.stats)) return null

  // Mirror mission-claim's mapping exactly: expand swarms, resistances array → map.
  const simEnemies: Enemy[] = enemies.flatMap((e, li) =>
    Array.from({ length: e.count }, (_, k): Enemy => ({
      id: `${e.name}-${li}-${k}`,
      health: e.stats!.health,
      attack: e.stats!.attack,
      damageType: e.damageType,
      speed: e.stats!.speed,
      defense: e.stats!.defense,
      resistance: e.stats!.resistance,
      resistances: e.resistances.length
        ? Object.fromEntries(e.resistances.map((r) => [r.school, r.value]))
        : undefined,
      block: e.stats!.block,
      critChance: e.stats!.critChance,
      critDamage: e.stats!.critDamage,
      armorPen: e.stats!.armorPen,
      dodge: e.stats!.dodge,
      healthRegen: e.stats!.healthRegen,
    })),
  )

  const combatants: Combatant[] = party.map((m) => ({
    id: m.id,
    role: m.role,
    stats: m.stats,
    currentHp: m.currentHp ?? undefined,
    damageSchool: m.damageSchool,
  }))

  let wins = 0
  for (let i = 0; i < ESTIMATE_RUNS; i++) {
    const result = simulateCombat({
      party: combatants,
      encounter: { enemies: simEnemies, timeLimitSeconds },
      seed: `estimate-${i}`,
    })
    if (result.outcome === 'win') wins++
  }
  return Math.round((wins / ESTIMATE_RUNS) * 100)
}
