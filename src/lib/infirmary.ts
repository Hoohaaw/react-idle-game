// Infirmary math — the single source of truth for healing, imported by BOTH the client
// (Infirmary page projections + live bed progress) and the infirmary Edge Functions
// (server-authoritative settlement). Like gather.ts, this module MUST stay Deno-safe:
// pure data + pure functions, no browser/node deps. See ADR-0021.
//
// The infirmary is a leveled building: beds = level, plus a flat HP/s regen rate per bed.
// Healing is compute-on-read (ADR-0002): an admission stores only `admitted_at` +
// `hp_at_admission`; current HP is derived from elapsed time and settled to the DB only
// when an Edge Function acts (discharge, upgrade). A character admitted at 0 HP first
// spends a "stabilize" phase (no regen), scaling with character level and reduced by
// infirmary level, then regens from 0 normally.

export const INFIRMARY = {
  MAX_LEVEL: 5,
  /** Flat HP/s per bed, by infirmary level (ADR-0021 first-pass curve). */
  HPS_BY_LEVEL: { 1: 10, 2: 25, 3: 50, 4: 75, 5: 100 } as Record<number, number>,
  /** Stabilize = charLevel × this ÷ infirmaryLevel (first-pass, tune like ADR-0015). */
  STABILIZE_SEC_PER_CHAR_LEVEL: 30,
} as const

/** Concurrent admission slots — beds = infirmary level (ADR-0021). */
export const bedsForLevel = (level: number): number => level

/** Gold + gathered-resource cost to reach each level. PROVISIONAL values — the real
 *  table lands with the gather-economy balancing pass. Keys match src/lib/resources.ts. */
export const UPGRADE_COSTS: Record<
  number,
  { currencies: Record<string, number>; resources: Record<string, number> }
> = {
  2: { currencies: { gold: 100 }, resources: { Wood: 50 } },
  3: { currencies: { gold: 300 }, resources: { Wood: 150, Copper: 75 } },
  4: { currencies: { gold: 800 }, resources: { Wood: 300, Copper: 200, Iron: 100 } },
  5: { currencies: { gold: 2000 }, resources: { Wood: 600, Copper: 400, Iron: 250 } },
}

export function regenPerSec(infirmaryLevel: number): number {
  return INFIRMARY.HPS_BY_LEVEL[infirmaryLevel] ?? INFIRMARY.HPS_BY_LEVEL[1]
}

/** Seconds a downed (0 HP) character spends stabilizing before regen begins. */
export function stabilizeSeconds(charLevel: number, infirmaryLevel: number): number {
  return Math.ceil((charLevel * INFIRMARY.STABILIZE_SEC_PER_CHAR_LEVEL) / Math.max(1, infirmaryLevel))
}

export type HealStateInput = {
  hpAtAdmission: number
  admittedAtMs: number
  nowMs: number
  charLevel: number
  infirmaryLevel: number
  maxHp: number
}

export type HealState = {
  phase: 'stabilizing' | 'healing' | 'full'
  /** Derived current HP at `nowMs`, clamped to [hpAtAdmission, maxHp]. */
  currentHp: number
  /** Seconds of stabilize left (0 unless phase is 'stabilizing'). */
  stabilizeRemainingSec: number
  /** Total seconds from `nowMs` until fully healed (0 when full). */
  secondsToFull: number
}

/**
 * Where an admission stands at `nowMs`. Also serves as the admit-now projection:
 * pass `admittedAtMs = nowMs` with the character's live HP.
 */
export function healState(input: HealStateInput): HealState {
  const { hpAtAdmission, admittedAtMs, nowMs, charLevel, infirmaryLevel, maxHp } = input
  const rate = regenPerSec(infirmaryLevel)
  const stabilizeMs =
    hpAtAdmission === 0 ? stabilizeSeconds(charLevel, infirmaryLevel) * 1000 : 0
  const healStartMs = admittedAtMs + stabilizeMs

  const healElapsedSec = Math.max(0, (nowMs - healStartMs) / 1000)
  const currentHp = Math.min(maxHp, hpAtAdmission + Math.floor(healElapsedSec * rate))

  if (currentHp >= maxHp) {
    return { phase: 'full', currentHp: maxHp, stabilizeRemainingSec: 0, secondsToFull: 0 }
  }
  const stabilizeRemainingSec = Math.max(0, Math.ceil((healStartMs - nowMs) / 1000))
  const secondsToFull = stabilizeRemainingSec + Math.ceil((maxHp - currentHp) / rate)
  return {
    phase: stabilizeRemainingSec > 0 ? 'stabilizing' : 'healing',
    currentHp,
    stabilizeRemainingSec,
    secondsToFull,
  }
}

/**
 * Rewrite an admission so it continues equivalently after an infirmary level change:
 * healing characters bank their derived HP and restart the clock at the new rate; a
 * stabilizing character keeps its elapsed FRACTION of the (now shorter) stabilize window.
 * The caller persists the result atomically inside the upgrade RPC.
 */
export function settleForUpgrade(
  input: HealStateInput & { newInfirmaryLevel: number },
): { admittedAtMs: number; hpAtAdmission: number; currentHp: number } {
  const state = healState(input)
  if (state.phase === 'stabilizing') {
    const oldDur = stabilizeSeconds(input.charLevel, input.infirmaryLevel)
    const newDur = stabilizeSeconds(input.charLevel, input.newInfirmaryLevel)
    const elapsedFrac = Math.min(1, Math.max(0, (input.nowMs - input.admittedAtMs) / 1000 / oldDur))
    return {
      admittedAtMs: input.nowMs - elapsedFrac * newDur * 1000,
      hpAtAdmission: 0,
      currentHp: 0,
    }
  }
  return { admittedAtMs: input.nowMs, hpAtAdmission: state.currentHp, currentHp: state.currentHp }
}
