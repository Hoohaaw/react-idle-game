// The stat registry — the single source of truth for every stat the game knows about.
// Adding a stat = one entry here. No DB migration, no Sanity schema edit: the Sanity
// content schema and the game both read their stat list from STAT_DEFS.
//
// Categories drive the reward multiplier (see project_design_decisions):
//   offensive + defensive  → count toward the 0.1%/point reward multiplier
//   misc                   → has an effect (e.g. time/gather) but NOT the reward multiplier
//
// SEED: this is the minimal registry (keys + categories, both already decided). The
// per-stat `effect`/`formula` definitions arrive with the stat-system build (next-steps #9).

export type StatCategory = 'offensive' | 'defensive' | 'misc'

export type StatDef = {
  key: string
  label: string
  category: StatCategory
}

export const STAT_DEFS: StatDef[] = [
  { key: 'attack', label: 'Attack', category: 'offensive' },
  { key: 'strength', label: 'Strength', category: 'offensive' },
  { key: 'agility', label: 'Agility', category: 'offensive' },
  { key: 'speed', label: 'Speed', category: 'offensive' },
  { key: 'intelligence', label: 'Intelligence', category: 'offensive' },
  { key: 'health', label: 'Health', category: 'defensive' },
  { key: 'defense', label: 'Defense', category: 'defensive' },
  { key: 'missionSpeedDecrease', label: 'Mission Speed Decrease', category: 'misc' },
  { key: 'gatherSpeed', label: 'Gather Speed', category: 'misc' },
  { key: 'gatherYield', label: 'Gather Yield', category: 'misc' },
]

export const STAT_KEYS: string[] = STAT_DEFS.map((s) => s.key)

export const STAT_LABELS: Record<string, string> = Object.fromEntries(
  STAT_DEFS.map((s) => [s.key, s.label]),
)
