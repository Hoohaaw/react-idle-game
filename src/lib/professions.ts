// The profession registry + leveling math — mirrors src/lib/leveling.ts's applyXp shape exactly
// (xp is progress toward the NEXT level, resets to the remainder on each level-up), but with a
// linear curve (100 × level) and a 10-level cap instead of character leveling's 50-level power
// curve. See docs/superpowers/specs/2026-10-16-profession-system-design.md Decision 2.
//
// Account-wide (profiles.professions), not per-character — do not confuse with src/lib/skills.ts
// (SKILL_DEFS), which is per-character and passive.

export type ProfessionDef = {
  professionKey: string
  label: string
}

export const PROFESSION_DEFS: ProfessionDef[] = [
  { professionKey: 'alchemy', label: 'Alchemy' },
  { professionKey: 'carving', label: 'Carving' },
  { professionKey: 'prospecting', label: 'Prospecting' },
  { professionKey: 'tempering', label: 'Tempering' },
  { professionKey: 'arcaneWriting', label: 'Arcane Writing' },
]

export const PROFESSION_KEYS: string[] = PROFESSION_DEFS.map((p) => p.professionKey)

export const PROFESSION_LABELS: Record<string, string> = Object.fromEntries(
  PROFESSION_DEFS.map((p) => [p.professionKey, p.label]),
)

/** Hard level ceiling for every profession. */
export const PROFESSION_LEVEL_CAP = 10

/** XP required to advance FROM `level` to `level + 1`. Linear: 100, 200, 300... 900. */
export function xpToNextProfessionLevel(level: number): number {
  if (level >= PROFESSION_LEVEL_CAP) return Infinity
  return 100 * level
}

/**
 * Apply earned XP to a profession's (level, xp). Same shape as leveling.ts's applyXp: xp resets
 * to the remainder on each level-up, rolls over as many levels as the gain covers, discards any
 * XP earned once the cap is reached.
 */
export function applyProfessionXp(level: number, xp: number, gained: number): { level: number; xp: number } {
  let lvl = level
  let cur = xp + gained
  while (lvl < PROFESSION_LEVEL_CAP && cur >= xpToNextProfessionLevel(lvl)) {
    cur -= xpToNextProfessionLevel(lvl)
    lvl += 1
  }
  if (lvl >= PROFESSION_LEVEL_CAP) cur = 0
  return { level: lvl, xp: cur }
}
