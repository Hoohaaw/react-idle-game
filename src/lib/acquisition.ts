// Character acquisition — condition types + the pure evaluator. Deno-safe (no browser/node deps):
// imported by BOTH mission-claim and gather-collect Edge Functions with a `.ts` extension, same
// convention as combat.ts/gather.ts. See docs/superpowers/specs/2026-08-20-character-acquisition-
// design.md §4/§5a for the full design.
//
// `evaluateCondition` checks against the state the CALLING Edge Function can cheaply build from its
// own mutation — not the player's whole roster/history. characterLevel/statThreshold check the
// characters passed in (the party that just claimed, or the gatherer that just collected);
// resourceTotal/goldTotal/missionTimeTotal/mapCompletion check the player's lifetime totals /
// map progress. Every non-`gold` condition type from the spec is represented; elementalMastery and
// comebackMoment are OUT OF SCOPE (spec §3, §12 — wave 2).

export type AcquisitionConditionType =
  | 'characterLevel'
  | 'statThreshold'
  | 'resourceTotal'
  | 'goldTotal'
  | 'missionTimeTotal'
  | 'mapCompletion'

export type AcquisitionCondition = {
  type: AcquisitionConditionType
  level?: number // characterLevel
  stat?: string // statThreshold — a key from STAT_DEFS (src/lib/statDefinitions.ts)
  threshold?: number // statThreshold / resourceTotal / goldTotal / missionTimeTotal
  resource?: string // resourceTotal — a key from RESOURCE_SOURCE (src/lib/resources.ts)
  map?: string // mapCompletion — a mapKey
  stage?: number // mapCompletion — stage required cleared; defaults to 7 (boss/full map) if omitted
}

export type CharacterAcquisition = {
  goldCost: number
  condition?: AcquisitionCondition
}

/** One character's level + effective stats, for characterLevel/statThreshold checks. */
export type AcquisitionCharacterState = { level: number; stats: Record<string, number> }

/** Everything evaluateCondition needs, built fresh by the caller from live data — nothing here is
 *  ever stored as a derived value (ADR-0002). */
export type PlayerAcquisitionState = {
  /** The characters whose state could have just changed in this call (the mission party, or the
   *  single gatherer who just collected) — NOT the player's whole roster (see Task 8's note). */
  characters: AcquisitionCharacterState[]
  /** profiles.lifetime_stats, keyed exactly like src/lib/lifetimeStats.ts's LIFETIME_STAT_KEYS. */
  lifetimeStats: Record<string, number>
  /** profiles.map_progress, keyed by mapKey. */
  mapProgress: Record<string, number>
}

const DEFAULT_MAP_STAGE = 7 // boss/full clear, matches the game's fixed 7-stage map shape

export function evaluateCondition(
  condition: AcquisitionCondition | undefined,
  state: PlayerAcquisitionState,
): boolean {
  if (!condition) return true // gold-only, no precondition
  switch (condition.type) {
    case 'characterLevel':
      return state.characters.some((c) => c.level >= (condition.level ?? Infinity))
    case 'statThreshold':
      return state.characters.some(
        (c) => (c.stats[condition.stat ?? ''] ?? 0) >= (condition.threshold ?? Infinity),
      )
    case 'resourceTotal':
      return (
        (state.lifetimeStats[`resourceGathered.${condition.resource}`] ?? 0) >=
        (condition.threshold ?? Infinity)
      )
    case 'goldTotal':
      return (state.lifetimeStats.goldEarned ?? 0) >= (condition.threshold ?? Infinity)
    case 'missionTimeTotal':
      return (state.lifetimeStats.missionSecondsSent ?? 0) >= (condition.threshold ?? Infinity)
    case 'mapCompletion':
      return (
        (state.mapProgress[condition.map ?? ''] ?? 0) >= (condition.stage ?? DEFAULT_MAP_STAGE)
      )
  }
}
