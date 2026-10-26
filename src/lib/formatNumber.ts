// K/M/B-suffix number formatting (e.g. 1500 -> "1.5K", 2_340_000 -> "2.34M"). Below 1,000,
// falls back to a plain locale-formatted integer — unchanged from how these values displayed
// before this formatter existed. Decimal precision narrows as the scaled value grows (2 decimals
// under 10, 1 under 100, 0 at 100+) so the string never gets longer than ~5-6 characters.
const SUFFIXES: [number, string][] = [
  [1_000_000_000, 'B'],
  [1_000_000, 'M'],
  [1_000, 'K'],
]

function formatTier(scaled: number, suffix: string): string {
  const decimals = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2
  const formatted = decimals === 0
    ? scaled.toFixed(0)
    : scaled.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '')
  return `${formatted}${suffix}`
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)

  for (let i = 0; i < SUFFIXES.length; i++) {
    const [threshold, suffix] = SUFFIXES[i]
    if (abs < threshold) continue
    const scaled = abs / threshold
    const decimals = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2
    if (decimals === 0 && Math.round(scaled) >= 1000 && i > 0) {
      // Rounds up into the next-larger tier — format against that tier instead.
      const [nextThreshold, nextSuffix] = SUFFIXES[i - 1]
      return `${sign}${formatTier(abs / nextThreshold, nextSuffix)}`
    }
    return `${sign}${formatTier(scaled, suffix)}`
  }
  return `${sign}${abs.toLocaleString()}`
}
