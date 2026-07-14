import { COMBAT } from './combat'

// Attack values are a SPAN, not a point (ADR-0038): each fight rolls the party member's attack
// power uniformly within ±PARTY_POWER_ROLL. The UI shows that honestly — an attack-type stat
// renders as its per-fight range (e.g. "45–55") wherever a single number used to sit.

/** Stat keys the per-fight attack roll applies to — display these as a span. */
export const SPAN_STATS = new Set(['attack', 'spellPower'])

/** "45–55" — the ±PARTY_POWER_ROLL band around an attack-type stat value. */
export function powerSpan(value: number): string {
  const lo = Math.round(value * (1 - COMBAT.PARTY_POWER_ROLL))
  const hi = Math.round(value * (1 + COMBAT.PARTY_POWER_ROLL))
  return lo === hi ? String(lo) : `${lo}–${hi}`
}
