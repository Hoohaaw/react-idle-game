// Leveling rules — turns earned XP into (level, xp) progress. Pure, no I/O: the server-authoritative
// path (mission claim, ADR-0003) owns the only legitimate XP source and calls applyXp to roll level-ups.
// Stats are NOT touched here — under compute-on-read (ADR-0002) every stat derives from `level` + the
// def's growth curve, so bumping the level is all leveling needs to do.

/** Hard level ceiling — reached via successful missions only (see project memory: character development). */
export const LEVEL_CAP = 50

/**
 * XP required to advance FROM `level` to `level + 1`. Gentle→steep power curve:
 *
 *   xpToNext(L) = round(50 × L^1.5)
 *
 * e.g. 1→2 = 50, 10→11 ≈ 1581, 25→26 ≈ 6250, 49→50 ≈ 17150. At the cap there is no next level, so
 * this returns Infinity — UI should check `level >= LEVEL_CAP` and show "MAX" rather than a bar.
 */
export function xpToNext(level: number): number {
  if (level >= LEVEL_CAP) return Infinity
  return Math.round(50 * level ** 1.5)
}

/**
 * Apply earned XP to a character's (level, xp). `xp` is progress toward the NEXT level and resets to
 * the remainder on each level-up. Rolls over as many levels as the XP covers, stopping at LEVEL_CAP;
 * any XP earned at the cap is discarded (xp settles to 0).
 */
export function applyXp(level: number, xp: number, gained: number): { level: number; xp: number } {
  let lvl = level
  let cur = xp + gained
  while (lvl < LEVEL_CAP && cur >= xpToNext(lvl)) {
    cur -= xpToNext(lvl)
    lvl += 1
  }
  if (lvl >= LEVEL_CAP) cur = 0
  return { level: lvl, xp: cur }
}
