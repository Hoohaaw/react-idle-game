import type { StatBonus, StatMap } from './stats'

// Character traits (ADR-0035, docs/TRAITS.md): innate, authored, CONDITIONAL stat bonuses.
// The core rule: traits modify the sim's INPUTS (stats, timers, yields) — never win chance
// post-hoc. A trait's effects target the ordinary stat registry, so they stack through the
// same {flat, pct} rule as blessings and gear (src/lib/stats.ts), and the dispatch estimator
// picks their value up as real success-percentage movement for free.
//
// Pure and dependency-light on purpose: imported by the client, the Edge Functions, AND the
// Sanity studio's validation (like characterBudget.ts).

export type TraitConditionType = 'always' | 'map' | 'enemyArchetype' | 'enemySchool' | 'resource'

export type TraitCondition = {
  type: TraitConditionType
  /** The map key / archetype / school / resource the condition matches. Unused for 'always'. */
  value?: string
}

/** One stat modifier a trait grants while its condition holds — same shape as gear/blessings. */
export type TraitEffect = { stat: string; kind: 'flat' | 'pct'; value: number }

export type TraitDef = {
  traitKey: string
  name: string
  description?: string
  condition: TraitCondition
  effects: TraitEffect[]
}

/** What the character is currently doing — the sim/site fills in what it knows. A condition
 *  that needs a field the context doesn't carry simply doesn't match (e.g. resource traits
 *  during a mission). */
export type TraitContext = {
  mapKey?: string | null
  enemyArchetypes?: string[]
  enemySchools?: string[]
  resource?: string
}

export function traitActive(trait: TraitDef, ctx: TraitContext): boolean {
  const { type, value } = trait.condition
  switch (type) {
    case 'always':
      return true
    case 'map':
      return value != null && ctx.mapKey === value
    case 'enemyArchetype':
      return value != null && (ctx.enemyArchetypes ?? []).includes(value)
    case 'enemySchool':
      return value != null && (ctx.enemySchools ?? []).includes(value)
    case 'resource':
      return value != null && ctx.resource === value
    default:
      return false
  }
}

/** Total the {flat, pct} bonus per stat from every trait whose condition matches the context —
 *  ready to merge into effectiveStats via its `extraBonuses` input. */
export function collectTraitBonuses(
  traits: TraitDef[],
  ctx: TraitContext,
): Record<string, StatBonus> {
  const out: Record<string, StatBonus> = {}
  for (const trait of traits) {
    if (!traitActive(trait, ctx)) continue
    for (const effect of trait.effects) {
      const bonus = (out[effect.stat] ??= { flat: 0, pct: 0 })
      if (effect.kind === 'flat') bonus.flat += effect.value
      else bonus.pct += effect.value
    }
  }
  return out
}

/** Party-wide mission-duration reduction is capped so stacked Pathfinders can't trivialize
 *  timers: 3 × 10% still means −30%, but never more. */
export const MISSION_SPEED_CAP = 0.3

/** Multiplier on a mission's authored durationSeconds from the party's `missionSpeedDecrease`
 *  stats (percent points, summed across members, capped). 1 = unchanged. */
export function missionDurationMultiplier(partyStats: StatMap[]): number {
  const totalPct = partyStats.reduce((sum, s) => sum + (s.missionSpeedDecrease ?? 0), 0)
  return 1 - Math.min(MISSION_SPEED_CAP, Math.max(0, totalPct) / 100)
}

/** Party AVERAGE of an economy stat (goldFind / magicFind / luck), as percent points.
 *  Averaged — not summed — so a solo specialist matters and a full party can't triple-dip. */
export function partyAverageStat(partyStats: StatMap[], stat: string): number {
  if (partyStats.length === 0) return 0
  return partyStats.reduce((sum, s) => sum + (s[stat] ?? 0), 0) / partyStats.length
}
