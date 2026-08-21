// The lifetime-counter registry — cumulative, increments-only totals that never existed anywhere
// in this codebase before (confirmed: mission_runs rows are DELETED on claim, gather_assignments
// only tracks the live cycle — there was no ledger). Backs the character-acquisition conditions
// that need a running total (resourceTotal / goldTotal / missionTimeTotal — docs/superpowers/specs/
// 2026-08-20-character-acquisition-design.md §5b). Mirrors src/lib/currencies.ts's registry shape:
// balances live in profiles.lifetime_stats (JSONB) keyed by `key`, an absent key means zero, so
// adding a tracked stat needs no migration.
//
// Unlike currencies/resources, spending never decrements these — they only ever go up.

import { RESOURCE_SOURCE } from './resources'

export type LifetimeStatDef = {
  key: string
  label: string
}

/** The JSONB key for "total of this resource ever gathered" — `resourceGathered.<Resource>`. */
export function resourceGatheredKey(resource: string): string {
  return `resourceGathered.${resource}`
}

export const LIFETIME_STAT_DEFS: LifetimeStatDef[] = [
  { key: 'goldEarned', label: 'Gold earned' },
  { key: 'missionSecondsSent', label: 'Time spent on missions' },
  ...Object.keys(RESOURCE_SOURCE).map((resource) => ({
    key: resourceGatheredKey(resource),
    label: `${resource} gathered`,
  })),
]

export const LIFETIME_STAT_KEYS: string[] = LIFETIME_STAT_DEFS.map((d) => d.key)

export const LIFETIME_STAT_LABELS: Record<string, string> = Object.fromEntries(
  LIFETIME_STAT_DEFS.map((d) => [d.key, d.label]),
)
