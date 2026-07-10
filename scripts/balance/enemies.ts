// Enemy generation for the balance harness — a code implementation of the enemy tier template
// (ADR-0015 §G, revised by ADR-0024). Real missions author enemyDefs by hand in Sanity; the harness
// generates the same shapes from (tier, archetype) so the sweep can probe difficulty bands that
// aren't authored yet.
//
//   Tier-1 base (= the seeded Rotting Ghoul): HP 120 · atk 12 · def 5 · speed 10.
//   Per-tier growth: HP/atk/def × 1.4^(tier−1); speed FLAT (ADR-0024 — scaling speed with tier
//   made effective enemy DPS grow ~×1.96/tier and produced binary 100%→0% difficulty cliffs).
//   Archetype mods: tank ×2 HP / ×1.5 def / ×0.6 atk · caster magic dmg / ×1.2 atk / ×0.8 HP ·
//                   swarm ×0.4 HP / ×0.7 atk · boss ×5 HP / ×1.5 atk.
//
// Note: the template defines NO resistance, so generated enemies (like the two authored ones) have
// resistance 0 — magic damage bypasses all mitigation. Deliberately faithful; the sweep is meant to
// surface what that does to caster parties.

import type { Enemy, Encounter } from '../../src/lib/combat.ts'

export type Archetype = 'basic' | 'tank' | 'caster' | 'swarm' | 'boss'

const TIER1 = { health: 120, attack: 12, defense: 5, speed: 10 }
const TIER_GROWTH = 1.4

const ARCHETYPE_MODS: Record<Archetype, { hp: number; atk: number; def: number; magic?: boolean }> = {
  basic: { hp: 1, atk: 1, def: 1 },
  tank: { hp: 2, atk: 0.6, def: 1.5 },
  caster: { hp: 0.8, atk: 1.2, def: 1, magic: true },
  swarm: { hp: 0.4, atk: 0.7, def: 1 },
  boss: { hp: 5, atk: 1.5, def: 1 },
}

export function makeEnemy(tier: number, archetype: Archetype, index = 0): Enemy {
  const scale = TIER_GROWTH ** (tier - 1)
  const mod = ARCHETYPE_MODS[archetype]
  return {
    id: `t${tier}-${archetype}-${index}`,
    health: Math.round(TIER1.health * scale * mod.hp),
    attack: Math.round(TIER1.attack * scale * mod.atk),
    damageType: mod.magic ? 'magic' : 'physical',
    speed: TIER1.speed, // flat across tiers (ADR-0024)
    defense: Math.round(TIER1.defense * scale * mod.def),
  }
}

// Encounter shapes — the 1–N compositions the sweep probes at every tier.
export type EncounterShape = 'solo' | 'pack' | 'boss'

export function makeEncounter(tier: number, shape: EncounterShape, timeLimitSeconds: number): Encounter {
  switch (shape) {
    case 'solo':
      return { enemies: [makeEnemy(tier, 'basic')], timeLimitSeconds }
    case 'pack':
      return {
        enemies: [0, 1, 2].map((i) => makeEnemy(tier, 'basic', i)),
        timeLimitSeconds,
      }
    case 'boss':
      return {
        enemies: [makeEnemy(tier, 'boss'), makeEnemy(tier, 'swarm', 1), makeEnemy(tier, 'swarm', 2)],
        timeLimitSeconds,
      }
  }
}
