// Party-size and lockout rules for dungeons/raids (docs/superpowers/specs/2026-09-08-dungeons-
// and-raids-design.md §4d) — rules of the TYPE, not authored per-def, same status as today's
// mission MAX_PARTY = 3 constant.

export type GroupKind = 'dungeon' | 'raid'
export type Lockout = 'daily' | 'weekly'

export const GROUP_PARTY_CAP: Record<GroupKind, number> = { dungeon: 5, raid: 10 }
export const GROUP_LOCKOUT: Record<GroupKind, Lockout> = { dungeon: 'daily', raid: 'weekly' }

/** The next fixed calendar boundary (UTC midnight for daily, Sunday UTC midnight for weekly)
 *  strictly AFTER `lastClearedAt`. A clear landing exactly ON a boundary rolls to the next one —
 *  the boundary is when the lockout LIFTS, not a moment you're still inside. */
export function nextResetBoundary(lastClearedAt: string, lockout: Lockout): Date {
  const cleared = new Date(lastClearedAt)
  const midnightAfter = new Date(Date.UTC(
    cleared.getUTCFullYear(), cleared.getUTCMonth(), cleared.getUTCDate() + 1,
  ))
  if (lockout === 'daily') return midnightAfter

  // Weekly: next Sunday 00:00 UTC strictly after `cleared`. getUTCDay(): 0=Sunday..6=Saturday.
  // Start from midnightAfter (already strictly after `cleared`) and walk forward to the next Sunday.
  const daysUntilSunday = (7 - midnightAfter.getUTCDay()) % 7
  return new Date(Date.UTC(
    midnightAfter.getUTCFullYear(), midnightAfter.getUTCMonth(),
    midnightAfter.getUTCDate() + daysUntilSunday,
  ))
}

/** Whether a fresh run is still blocked by the lockout from the last clear. */
export function isLockedOut(lastClearedAt: string | null, lockout: Lockout, now: Date = new Date()): boolean {
  if (!lastClearedAt) return false
  return now.getTime() < nextResetBoundary(lastClearedAt, lockout).getTime()
}
