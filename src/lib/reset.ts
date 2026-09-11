// The soft-Reset formula and gate (ADR-0053), mirroring reset_player's SQL exactly (see
// supabase/migrations/20260911100000_reset_echoes.sql) so the client can preview a reset before
// committing to it. The RPC is the authoritative calculation; this is a tested parallel
// implementation, not a shared import (Postgres can't import TypeScript).

/** Stages cleared on the order-1 map (Sanity mapDef.order) required before a Reset is allowed. */
export const RESET_GATE_STAGE = 7

/** Total world-content progress across every map — breadth + depth, not just one map. */
export function sumStagesCleared(mapProgress: Record<string, number>): number {
  return Object.values(mapProgress).reduce((sum, stage) => sum + stage, 0)
}

export function isResetGateMet(gateStageCleared: number): boolean {
  return gateStageCleared >= RESET_GATE_STAGE
}

// STAGE_RATE=10, GOLD_RATE=2 — first-pass provisional constants, same treatment as combat.ts's
// COMBAT block: shape is final, numbers are tuned later against real playtest data.
const STAGE_RATE = 10
const GOLD_RATE = 2

/** sqrt on the gold term deliberately flattens it — gold accumulates unbounded over a long run
 *  and would otherwise dwarf the stage term, defeating "a combination of both" (spec §5b). */
export function computeEchoesAward(totalStagesCleared: number, lifetimeGoldEarned: number): number {
  return Math.floor(totalStagesCleared * STAGE_RATE) + Math.floor(Math.sqrt(Math.max(0, lifetimeGoldEarned)) * GOLD_RATE)
}
