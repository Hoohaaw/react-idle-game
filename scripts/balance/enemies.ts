// Enemy generation for the balance harness — a code implementation of the enemy tier template
// (ADR-0015 §G, revised by ADR-0024, growth rate revised by ADR-0036). Real missions author
// enemyDefs by hand in Sanity; the harness generates the same shapes from (tier, archetype) so the
// sweep can probe difficulty bands that aren't authored yet.
//
//   Tier-1 base (= the seeded Rotting Ghoul): HP 120 · atk 12 · def 5 · speed 10.
//   Per-tier growth: HP/atk/def × 1.25^(tier−1); speed FLAT (ADR-0024 — scaling speed with tier
//   made effective enemy DPS grow ~×1.96/tier and produced binary 100%→0% difficulty cliffs).
//   1.4 (ADR-0024's value) still left ~117 flagged cliffs (findAnomalies, sweep.ts) at the level
//   actually facing each tier; 1.25 (ADR-0036) cuts that to ~64 with zero new healer inversions —
//   the frontier tier now grades through a real 30-70% band instead of flipping straight to 0%.
//   Archetype mods: tank ×2 HP / ×1.5 def / ×0.6 atk · caster magic dmg / ×1.2 atk / ×0.8 HP ·
//                   swarm ×0.4 HP / ×0.7 atk · boss ×5 HP / ×1.5 atk.
//
// Note: the template defines NO resistance, so generated enemies (like the two authored ones) have
// resistance 0 — magic damage bypasses all mitigation. Deliberately faithful; the sweep is meant to
// surface what that does to caster parties.

import type { Enemy, Encounter } from '../../src/lib/combat.ts'
import type { School } from '../../src/lib/schools.ts'

export type Archetype = 'basic' | 'tank' | 'caster' | 'swarm' | 'boss'

/**
 * Recommended `timeLimitSeconds` for authored encounters (ADR-0025). Flat across tiers: sweep data
 * shows legitimate slow wins (sustain comps grinding a fight down) run 60–170s at EVERY tier, so the
 * old 60s limit punished a play style, not a stall. Combat time is virtual (the fight resolves at
 * claim; real-world pacing is missionDef.durationSeconds) — the limit's only job is to turn
 * can't-ever-kill stalls into losses, which 180s still does.
 */
export const RECOMMENDED_TIME_LIMIT = 180

const TIER1 = { health: 120, attack: 12, defense: 5, speed: 10 }
const TIER_GROWTH = 1.25

const ARCHETYPE_MODS: Record<Archetype, { hp: number; atk: number; def: number; magic?: boolean }> = {
  basic: { hp: 1, atk: 1, def: 1 },
  tank: { hp: 2, atk: 0.6, def: 1.5 },
  caster: { hp: 0.8, atk: 1.2, def: 1, magic: true },
  swarm: { hp: 0.4, atk: 0.7, def: 1 },
  boss: { hp: 5, atk: 1.5, def: 1 },
}

// Damage schools + resistances are TIER-GATED (ADR-0033, Alex: schools surface mid/late game).
// Resist values are DR-curve absolute (% mitigation is level-independent), so flat numbers work
// at every tier: strong ≈ 120 (55% DR), broad ≈ 40 (29%). Weakness = simply not listed (generic
// resistance is 0 in the template, so off-school magic hits full).
const ELEMENT_CYCLE: School[] = ['fire', 'ice', 'earth', 'wind', 'holy', 'shadow']
const elementFor = (tier: number): School => ELEMENT_CYCLE[(tier - 1) % ELEMENT_CYCLE.length]

function resistancesFor(tier: number, archetype: Archetype): Partial<Record<School, number>> | undefined {
  if (tier <= 2) return undefined // early game: schools invisible
  const own = elementFor(tier)
  const next = ELEMENT_CYCLE[(tier) % ELEMENT_CYCLE.length]
  if (tier <= 5) {
    // mid game: casters/bosses resist their own school — first squad-choice moments
    if (archetype === 'caster' || archetype === 'boss') return { [own]: 100 }
    return undefined
  }
  // late game: broader walls, still always a way through
  switch (archetype) {
    case 'caster': return { [own]: 120, [next]: 40 }
    case 'boss': return { [own]: 120, [next]: 40, magic: 40 }
    case 'tank': return { [own]: 40, [next]: 40 }
    case 'basic': return { [own]: 40 }
    case 'swarm': return undefined
  }
}

export function makeEnemy(tier: number, archetype: Archetype, index = 0): Enemy {
  const scale = TIER_GROWTH ** (tier - 1)
  const mod = ARCHETYPE_MODS[archetype]
  return {
    id: `t${tier}-${archetype}-${index}`,
    health: Math.round(TIER1.health * scale * mod.hp),
    attack: Math.round(TIER1.attack * scale * mod.atk),
    damageType: mod.magic ? elementFor(tier) : 'physical',
    speed: TIER1.speed, // flat across tiers (ADR-0024)
    defense: Math.round(TIER1.defense * scale * mod.def),
    resistances: resistancesFor(tier, archetype),
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
