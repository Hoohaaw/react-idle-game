// The damage-school registry (ADR-0033) — the single source of truth for every school the game
// knows about. Same pattern as stats/resources (ADR-0004): adding a school = one entry here; the
// Sanity schemas and the sim both read this list.
//
// 'physical' is mitigated by Defense; every other school is magic-family. 'magic' is the NEUTRAL
// school (a caster with no authored school) and is mitigated by an enemy's generic Resistance;
// named schools check the enemy's per-school resistances first and fall back to generic
// Resistance. Healing is schoolless (decided 2026-07-11).

export type School = 'physical' | 'magic' | 'fire' | 'ice' | 'earth' | 'wind' | 'holy' | 'shadow'

export type SchoolDef = { key: School; label: string; icon: string; color: string }

export const SCHOOL_DEFS: SchoolDef[] = [
  { key: 'physical', label: 'Physical', icon: '⚔', color: '#c9b08a' },
  { key: 'magic', label: 'Magic', icon: '✦', color: '#b48ce0' },
  { key: 'fire', label: 'Fire', icon: '🔥', color: '#e06c3a' },
  { key: 'ice', label: 'Ice', icon: '❄', color: '#7ec3e0' },
  { key: 'earth', label: 'Earth', icon: '⛰', color: '#a08a52' },
  { key: 'wind', label: 'Wind', icon: '🌪', color: '#9ad0b8' },
  { key: 'holy', label: 'Holy', icon: '✨', color: '#f0d060' },
  { key: 'shadow', label: 'Shadow', icon: '🌑', color: '#7a5ea0' },
]

export const SCHOOL_KEYS: School[] = SCHOOL_DEFS.map((s) => s.key)

/** The schools an enemy can hold a resistance against (everything but physical — that's Defense). */
export const RESISTIBLE_SCHOOLS: School[] = SCHOOL_KEYS.filter((k) => k !== 'physical')

export const SCHOOL_LABELS: Record<School, string> = Object.fromEntries(
  SCHOOL_DEFS.map((s) => [s.key, s.label]),
) as Record<School, string>
