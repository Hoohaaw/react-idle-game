// The mine registry + gather accrual math — the single source of truth for the gathering loop,
// imported by BOTH the client (Mines page display) and the gather Edge Functions (server-authoritative
// accrual). Like combat.ts, this module MUST stay Deno-safe: pure data + pure functions, no browser/node
// deps, `.ts` import extensions if it ever imports a sibling. See ADR-0016 / ADR-0019.
//
// A character continuously gathers one resource; yield accrues every `intervalSec` while assigned. On
// collect/stop an Edge Function credits `floor(elapsed/interval) × yieldPerTick` and advances the
// assignment's `last_collected_at` by the CONSUMED ticks — the partial-tick remainder carries over, so
// accrual is continuous, uncapped and offline-safe (a mine left running while away banks the whole time).
//
// `resourceKey` uses the full resource-registry names (src/lib/resources.ts) so credited wallet keys line
// up with what the header reads. Interval/yield are the carried-over GATHER_CONFIG values — a starting
// point, pending rebalance for this continuous model.

export type MineDef = {
  resourceKey: string
  tier: 'Ore' | 'Material'
  intervalSec: number
  yieldPerTick: number
}

export const MINE_DEFS: MineDef[] = [
  { resourceKey: 'Wood', tier: 'Material', intervalSec: 20, yieldPerTick: 4 },
  { resourceKey: 'Copper', tier: 'Ore', intervalSec: 30, yieldPerTick: 5 },
  { resourceKey: 'Stone', tier: 'Material', intervalSec: 30, yieldPerTick: 5 },
  { resourceKey: 'Coal', tier: 'Material', intervalSec: 45, yieldPerTick: 6 },
  { resourceKey: 'Iron', tier: 'Material', intervalSec: 60, yieldPerTick: 8 },
  { resourceKey: 'Silver', tier: 'Ore', intervalSec: 90, yieldPerTick: 10 },
  { resourceKey: 'Bronze', tier: 'Material', intervalSec: 120, yieldPerTick: 15 },
  { resourceKey: 'Gold', tier: 'Ore', intervalSec: 300, yieldPerTick: 25 },
  { resourceKey: 'Platinum', tier: 'Ore', intervalSec: 900, yieldPerTick: 75 },
]

export const MINE_BY_RESOURCE: Record<string, MineDef> = Object.fromEntries(
  MINE_DEFS.map((m) => [m.resourceKey, m]),
)

/**
 * How much a mine has banked over `elapsedMs`, plus the time that reward consumed. Only whole ticks pay
 * out; the leftover (`elapsedMs − consumedSec×1000`) stays uncredited so the caller can advance
 * `last_collected_at` by exactly `consumedSec` and keep the remainder for next time.
 */
export function accrue(
  elapsedMs: number,
  intervalSec: number,
  yieldPerTick: number,
): { gained: number; consumedSec: number } {
  if (elapsedMs <= 0 || intervalSec <= 0) return { gained: 0, consumedSec: 0 }
  const ticks = Math.floor(elapsedMs / 1000 / intervalSec)
  return { gained: ticks * yieldPerTick, consumedSec: ticks * intervalSec }
}
