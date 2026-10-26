// K/M/B-suffix number formatting (e.g. 1500 -> "1.5K", 2_340_000 -> "2.34M"). Below 1,000,
// falls back to a plain locale-formatted integer — unchanged from how these values displayed
// before this formatter existed. Decimal precision narrows as the scaled value grows (2 decimals
// under 10, 1 under 100, 0 at 100+) so the string never gets longer than ~5-6 characters.
const SUFFIXES: [number, string][] = [
  [1_000_000_000, 'B'],
  [1_000_000, 'M'],
  [1_000, 'K'],
]

export function formatNumber(value: number): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)

  for (const [threshold, suffix] of SUFFIXES) {
    if (abs < threshold) continue
    const scaled = abs / threshold
    const decimals = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2
    const formatted = decimals === 0
      ? scaled.toFixed(0)
      : scaled.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '')
    return `${sign}${formatted}${suffix}`
  }
  return `${sign}${abs.toLocaleString()}`
}
