// Formats a remaining duration (ms) as "Hh Mm" (>= 1h) or "MM:SS", or "Ready" at 0.
export function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Ready'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
