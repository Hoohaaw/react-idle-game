import type { StatBonus, NodeEffect, BlessingNodeDef } from './stats.ts'
import { collectTraitBonuses, type TraitDef, type TraitCondition, type TraitContext } from './traits.ts'
import type { CombatAbility, AbilityStat } from './combat.ts'

// The blessing-tree picks/gating model (ADR-0045): 4 rows, 2 mutually-exclusive choices per row,
// permanent once picked, plus a capstone earned (not chosen) after row 4. Deno-safe, no browser/
// node deps — imported by the client, the blessing-choose Edge Function, and mission-claim.

export const BLESSING_ROWS = [1, 2, 3, 4] as const
export type BlessingRowNumber = (typeof BLESSING_ROWS)[number]

/** Character level required to pick each row (row N unlocks at level N×10). */
export const BLESSING_ROW_LEVELS: Record<BlessingRowNumber, number> = {
  1: 10,
  2: 20,
  3: 30,
  4: 40,
}

/** Level at which the capstone is earned, once row 4 is already picked. Ten past the last row. */
export const CAPSTONE_LEVEL = 50

/** Flat gold cost to respec a character — wipes the entire blessing tree back to `{}` in one shot
 *  (ADR-0047). All-or-nothing: row2/3/4 structurally require the previous row picked
 *  (`choose_blessing` enforces this), so a partial clear would leave the tree invalid unless it
 *  also cascaded — respec sidesteps that by clearing everything at once. PROVISIONAL value, same
 *  "tune later" status as `UPGRADE_COSTS` (src/lib/infirmary.ts). */
export const RESPEC_COST = 500

/** Player intent stored on `player_characters.blessings` — which choice ('a'|'b') was picked per
 *  row. No capstone key: the capstone is computed on read (ADR-0002), never written. */
export type BlessingPicks = Partial<Record<`row${BlessingRowNumber}`, 'a' | 'b'>>

/** A character's earned capstone (ADR-0045) — mirrors the Sanity `capstoneBlessing` shape. The
 *  `ability` fields are unused until Phase B's combat-engine support lands. */
export type CapstoneDef = {
  title: string
  description?: string
  kind: 'stat' | 'conditional' | 'ability'
  effects?: NodeEffect[]
  condition?: TraitCondition
  abilityKind?: string
  abilityParams?: { stat: AbilityStat; kind: 'flat' | 'pct'; value: number }
}

/** Whether `row` can be picked right now — level met AND the previous row already picked AND not
 *  already picked itself. Client-side UX mirror only; `choose_blessing` re-enforces this
 *  server-side (same non-trusted-shortcut pattern as `requiredLevelForRarity`'s client use). */
export function canPickRow(row: BlessingRowNumber, level: number, picks: BlessingPicks): boolean {
  if (picks[`row${row}`] != null) return false
  if (level < BLESSING_ROW_LEVELS[row]) return false
  if (row > 1 && picks[`row${(row - 1) as BlessingRowNumber}`] == null) return false
  return true
}

/** Whether `row` is blocked by sequence alone (the previous row isn't picked yet) — lets the UI
 *  distinguish "wrong level" from "pick the row above first" as the locked reason. Row 1 is never
 *  sequence-blocked. */
export function rowSequenceBlocked(row: BlessingRowNumber, picks: BlessingPicks): boolean {
  if (row === 1) return false
  return picks[`row${(row - 1) as BlessingRowNumber}`] == null
}

/** The next unpicked row in sequence, or null once all 4 are picked. Ignores level — pair with
 *  `canPickRow` to know whether it's actually pickable yet. */
export function nextUnpickedRow(picks: BlessingPicks): BlessingRowNumber | null {
  for (const row of BLESSING_ROWS) {
    if (picks[`row${row}`] == null) return row
  }
  return null
}

/** The capstone is earned once level 50 is reached and row 4 has been picked — never stored. */
export function capstoneEarned(level: number, picks: BlessingPicks): boolean {
  return level >= CAPSTONE_LEVEL && picks.row4 != null
}

/** How many of the 4 rows are currently picked — 0 means nothing to respec. */
export function pickedRowCount(picks: BlessingPicks): number {
  return BLESSING_ROWS.filter((row) => picks[`row${row}`] != null).length
}

/** A minimal Sanity-shape blessing row — just enough to flatten into engine input. */
export type RawBlessingRow = {
  row: number
  choices?: Array<{ choiceId: string; effects?: NodeEffect[] }>
}

/**
 * Flattens the authored row/choice tree into the flat `BlessingNodeDef[]` `collectBlessingBonuses`
 * wants (nodeId = `row<N>-<choice>`). Shared by the client fetch (`src/services/characters.ts`)
 * and every Edge Function that independently queries `characterDef` (mission-claim, charMaxHp),
 * so the id format can never drift between them.
 */
export function flattenBlessingTree(tree: RawBlessingRow[] | undefined): BlessingNodeDef[] {
  return (tree ?? []).flatMap((r) =>
    (r.choices ?? []).map((ch) => ({ nodeId: `row${r.row}-${ch.choiceId}`, effects: ch.effects ?? [] })),
  )
}

/**
 * Turns stored picks into the `{ nodeId: ranks }` map `collectBlessingBonuses` expects. nodeId is
 * `row<N>-<choice>` (e.g. `"row2-b"`) — matches how `characters.ts` flattens the authored rows
 * into a flat `BlessingNodeDef[]`. A rank is always 0 or 1; there is no multi-rank in this model.
 */
export function resolveBlessingAllocations(picks: BlessingPicks): Record<string, number> {
  const out: Record<string, number> = {}
  for (const row of BLESSING_ROWS) {
    const choice = picks[`row${row}`]
    if (choice) out[`row${row}-${choice}`] = 1
  }
  return out
}

/**
 * The capstone's stat bonuses, if earned — folds into `effectiveStats`'s `extraBonuses` alongside
 * traits. A conditional capstone is resolved by treating it as a one-element trait list, reusing
 * `traits.ts`'s condition engine verbatim (no new evaluation code). An `ability` capstone grants
 * no stat bonus here — its effect is a Combatant-level sim behavior (Phase B).
 */
export function resolveCapstoneBonuses(
  capstone: CapstoneDef | undefined,
  earned: boolean,
  ctx: TraitContext,
): Record<string, StatBonus> {
  if (!capstone || !earned || capstone.kind === 'ability') return {}
  const asTrait: TraitDef = {
    traitKey: 'capstone',
    name: capstone.title,
    condition: capstone.kind === 'conditional' && capstone.condition ? capstone.condition : { type: 'always' },
    effects: capstone.effects ?? [],
  }
  return collectTraitBonuses([asTrait], ctx)
}

/**
 * The capstone's scripted ability, if earned and its kind is 'ability' — resolved into the combat
 * engine's `Combatant.ability` shape (ADR-0045 Phase B). Absent for stat/conditional capstones
 * (already handled by `resolveCapstoneBonuses`) and for anyone who hasn't earned it yet.
 */
export function resolveCapstoneAbility(
  capstone: CapstoneDef | undefined,
  earned: boolean,
): CombatAbility | undefined {
  if (!capstone || !earned || capstone.kind !== 'ability') return undefined
  if (capstone.abilityKind === 'surviveFatal') return { kind: 'surviveFatal' }
  if (capstone.abilityKind === 'partyBuffOnStart' && capstone.abilityParams) {
    const { stat, kind, value } = capstone.abilityParams
    return { kind: 'partyBuffOnStart', stat, statKind: kind, value }
  }
  return undefined
}
