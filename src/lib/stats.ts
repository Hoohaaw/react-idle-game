// The stat engine — the rulebook that turns a character's level + allocations into real numbers,
// and those numbers into a reward multiplier. Pure functions, no I/O: callers (Edge Functions, the
// app) fetch the Sanity character definition and pass the relevant pieces in.
//
// Design references (see docs/DECISIONS.md):
//   ADR-0002  compute-on-read: never store derived stats; derive them from level + the immutable def.
//   ADR-0004  stats are an open registry (src/lib/statDefinitions.ts) — this engine is stat-agnostic.
//
// Deliberately NOT here yet:
//   - Per-stat COMBAT effects (what attack/speed/etc. DO in a fight) — waits on the combat model,
//     which is still an open question.
//   - Gear bonuses — wait on the Sanity item schema. They'll plug into the same {flat, pct} bonus
//     shape that blessings already use, so no rework is needed when they arrive.

import { STAT_DEFS } from './statDefinitions.ts'

// ---- Input shapes -----------------------------------------------------------------------------
// Lean, structurally matching the Sanity characterDef (minus Sanity's _key/_type wrappers). The
// (future) services layer maps a GROQ result onto these before calling the engine.

/** A flat starting value for a stat, e.g. `{ stat: 'strength', value: 10 }`. */
export type StatValue = { stat: string; value: number }

/** An additive spike at a given level (adds ON TOP of that level's normal per-level gain). */
export type Milestone = { level: number; bonus: number }

/** Per-stat growth: a flat per-level increment plus optional additive milestones. */
export type StatGrowth = { stat: string; perLevel: number; milestones?: Milestone[] }

/** A single blessing-node effect: adds `perRank` of `stat` (flat points or a percent) per rank. */
export type NodeEffect = { stat: string; kind: 'flat' | 'pct'; perRank: number }

/** The bits of a blessing node the engine needs to total bonuses. */
export type BlessingNodeDef = { nodeId: string; effects?: NodeEffect[] }

/** A map of stat key -> number (baselines or effective values). */
export type StatMap = Record<string, number>

/** Accumulated bonuses for one stat, kept split so percentages apply to the baseline. */
export type StatBonus = { flat: number; pct: number }

// ---- Layer 1: compute-on-read baselines -------------------------------------------------------

/**
 * Baseline value of one stat at a given level (ADR-0002).
 *
 *   baseline(L) = base + perLevel × (L − 1) + Σ(milestone.bonus where milestone.level ≤ L)
 *
 * Milestones are ADDITIVE — a milestone at level 10 adds to that level's normal gain, it does not
 * replace it.
 */
export function baselineForStat(level: number, base: number, growth?: StatGrowth): number {
  if (!growth) return base
  const perLevelGain = growth.perLevel * (level - 1)
  const milestoneGain = (growth.milestones ?? [])
    .filter((m) => m.level <= level)
    .reduce((sum, m) => sum + m.bonus, 0)
  return base + perLevelGain + milestoneGain
}

/**
 * Baselines for every stat the character defines, at the given level. Stats are the union of those
 * with a base value and those with a growth entry (a growth-only stat starts from base 0).
 */
export function computeBaselines(
  level: number,
  baseStats: StatValue[],
  growth: StatGrowth[],
): StatMap {
  const baseByStat = new Map(baseStats.map((b) => [b.stat, b.value]))
  const growthByStat = new Map(growth.map((g) => [g.stat, g]))
  const keys = new Set<string>([...baseByStat.keys(), ...growthByStat.keys()])

  const out: StatMap = {}
  for (const stat of keys) {
    out[stat] = baselineForStat(level, baseByStat.get(stat) ?? 0, growthByStat.get(stat))
  }
  return out
}

// ---- Layer 2: stacking ------------------------------------------------------------------------

/**
 * Effective stats from baselines + bonuses, per the stacking rule:
 *
 *   effective = baseline + flat + baseline × (pct / 100)
 *
 * (Percentages apply to the baseline, not to flat additions.) Stats with no bonus pass through.
 */
export function applyBonuses(baselines: StatMap, bonuses: Record<string, StatBonus>): StatMap {
  const out: StatMap = { ...baselines }
  for (const [stat, bonus] of Object.entries(bonuses)) {
    const baseline = baselines[stat] ?? 0
    out[stat] = baseline + bonus.flat + (baseline * bonus.pct) / 100
  }
  return out
}

/**
 * Total the {flat, pct} bonus each stat gets from a player's allocated blessing ranks.
 * `allocations` is the `{ nodeId: ranks }` map stored on the player row; nodes with 0 (or no)
 * ranks contribute nothing.
 */
export function collectBlessingBonuses(
  allocations: Record<string, number>,
  nodes: BlessingNodeDef[],
): Record<string, StatBonus> {
  const out: Record<string, StatBonus> = {}
  for (const node of nodes) {
    const ranks = allocations[node.nodeId] ?? 0
    if (ranks <= 0 || !node.effects) continue
    for (const effect of node.effects) {
      const bonus = (out[effect.stat] ??= { flat: 0, pct: 0 })
      const amount = effect.perRank * ranks
      if (effect.kind === 'flat') bonus.flat += amount
      else bonus.pct += amount
    }
  }
  return out
}

// ---- Layer 2b: equipped-gear bonuses ----------------------------------------------------------

/**
 * Per-rarity multiplier on an item's BASE (Common) stat bonuses (first-pass, ADR-0017). Authored
 * `itemDef.statBonuses` are the Common values; a rarer copy of the same item multiplies EACH bonus
 * (flat and pct) by this factor. Steep ×2 per step — provisional like the combat constants.
 */
export const RARITY_MULT: Record<string, number> = {
  Common: 1,
  Uncommon: 2,
  Rare: 4,
  Epic: 8,
  Legendary: 16,
}

/** A single equip-time stat bonus authored on an item (base/Common values). */
export type ItemStatDef = { stat: string; kind: 'flat' | 'pct'; value: number }

/** The bits of an item definition the engine needs to total gear bonuses. */
export type ItemDefBonuses = { statBonuses?: ItemStatDef[] }

/** One equipped slot on the player row: which item, at what rolled rarity. */
export type EquippedItem = { itemDefId: string; rarity: string }

/**
 * Total the {flat, pct} bonus each stat gets from a character's EQUIPPED gear. `equipped` is the
 * `{ slot: { itemDefId, rarity } }` map stored on the player row; `itemDefs` supplies each referenced
 * item's base statBonuses. Every bonus is scaled by RARITY_MULT[rarity] (ADR-0017). Unknown items are
 * skipped; an unknown rarity falls back to ×1.
 */
export function collectGearBonuses(
  equipped: Record<string, EquippedItem>,
  itemDefs: Record<string, ItemDefBonuses>,
): Record<string, StatBonus> {
  const out: Record<string, StatBonus> = {}
  for (const slot of Object.values(equipped)) {
    const def = slot && itemDefs[slot.itemDefId]
    if (!def?.statBonuses) continue
    const mult = RARITY_MULT[slot.rarity] ?? 1
    for (const s of def.statBonuses) {
      const bonus = (out[s.stat] ??= { flat: 0, pct: 0 })
      const amount = s.value * mult
      if (s.kind === 'flat') bonus.flat += amount
      else bonus.pct += amount
    }
  }
  return out
}

/** Merge several {stat: {flat, pct}} bonus maps into one, summing flat and pct per stat. */
export function mergeBonuses(...maps: Record<string, StatBonus>[]): Record<string, StatBonus> {
  const out: Record<string, StatBonus> = {}
  for (const map of maps) {
    for (const [stat, b] of Object.entries(map)) {
      const bonus = (out[stat] ??= { flat: 0, pct: 0 })
      bonus.flat += b.flat
      bonus.pct += b.pct
    }
  }
  return out
}

/**
 * A character's EFFECTIVE stats: level baselines + blessing bonuses + equipped-gear bonuses, stacked
 * with the {flat, pct} rule. This is the single computation the combat sim consumes on BOTH the client
 * (replay) and the server (resolve) — ADR-0016.
 */
export function effectiveStats(input: {
  level: number
  baseStats: StatValue[]
  growth: StatGrowth[]
  blessingAllocations: Record<string, number>
  blessingNodes: BlessingNodeDef[]
  equipped: Record<string, EquippedItem>
  itemDefs: Record<string, ItemDefBonuses>
}): StatMap {
  const baselines = computeBaselines(input.level, input.baseStats, input.growth)
  const bonuses = mergeBonuses(
    collectBlessingBonuses(input.blessingAllocations, input.blessingNodes),
    collectGearBonuses(input.equipped, input.itemDefs),
  )
  return applyBonuses(baselines, bonuses)
}

/** Per-stat, per-source contributions to an effective stat (the sheet's breakdown tooltip). */
export type StatSourceBreakdown = { base: number; items: number; blessings: number; total: number }

/**
 * effectiveStats, decomposed by source. Because percentages apply to the BASELINE (never to other
 * flats), each source's contribution is independent: `flat + baseline × pct/100`. Invariant:
 * `total = base + items + blessings` and equals effectiveStats' value for every stat.
 */
export function effectiveStatBreakdown(input: {
  level: number
  baseStats: StatValue[]
  growth: StatGrowth[]
  blessingAllocations: Record<string, number>
  blessingNodes: BlessingNodeDef[]
  equipped: Record<string, EquippedItem>
  itemDefs: Record<string, ItemDefBonuses>
}): Record<string, StatSourceBreakdown> {
  const baselines = computeBaselines(input.level, input.baseStats, input.growth)
  const blessing = collectBlessingBonuses(input.blessingAllocations, input.blessingNodes)
  const gear = collectGearBonuses(input.equipped, input.itemDefs)

  const keys = new Set([...Object.keys(baselines), ...Object.keys(blessing), ...Object.keys(gear)])
  const out: Record<string, StatSourceBreakdown> = {}
  for (const stat of keys) {
    const base = baselines[stat] ?? 0
    const contribution = (b?: StatBonus) => (b ? b.flat + (base * b.pct) / 100 : 0)
    const items = contribution(gear[stat])
    const blessings = contribution(blessing[stat])
    out[stat] = { base, items, blessings, total: base + items + blessings }
  }
  return out
}

// ---- Layer 3: stat-derived reward bonus -------------------------------------------------------

/** Reward multiplier contribution per point of a reward-contributing stat (0.1% — decided). */
export const REWARD_BONUS_PER_STAT_POINT = 0.001

/** Stats that feed the reward bonus: those flagged `reward` in the registry (ADR-0007 — decoupled
 *  from category, so combat-depth stats like crit/dodge can exist without inflating the economy). */
const REWARD_STAT_KEYS = new Set(
  STAT_DEFS.filter((d) => d.reward).map((d) => d.key),
)

/**
 * The reward bonus contributed by one character's EFFECTIVE stats: 0.1% per point of every
 * reward-flagged stat. Returned as a fraction (e.g. 0.15 = +15%). Non-reward stats are ignored.
 *
 * Note: how a whole PARTY's bonus is aggregated (sum vs. average), and whether real-time combat
 * changes the role of stats in rewards, are open questions — kept out of this function on purpose.
 */
export function statRewardBonus(effective: StatMap): number {
  let points = 0
  for (const [stat, value] of Object.entries(effective)) {
    if (REWARD_STAT_KEYS.has(stat)) points += value
  }
  return points * REWARD_BONUS_PER_STAT_POINT
}

// ---- Layer 4: reward pipeline -----------------------------------------------------------------

/** Multiplicative reward modifiers, each a fraction (0.2 = +20%). Missing = 0. */
export type RewardModifiers = {
  marginBonus?: number
  levelBonus?: number
  partyBonus?: number
  transcendenceBonus?: number
}

/**
 * The reward pipeline (ADR-0012/0014), applied on a WIN only:
 *
 *   final = base × (1 + marginBonus) × (1 + levelBonus) × (1 + partyBonus) × (1 + transcendenceBonus)
 *
 * Each modifier is an INDEPENDENT multiplier (not summed into one pool). `marginBonus` (combat
 * decisiveness) and `levelBonus` (avg party level) come from the combat result via the helpers in
 * `combat.ts`; party-size and transcendence are their systems' tuning numbers. Returns a raw number;
 * callers round for the specific reward type (coins/resources/XP are integers).
 */
export function finalReward(base: number, mods: RewardModifiers = {}): number {
  const margin = 1 + (mods.marginBonus ?? 0)
  const level = 1 + (mods.levelBonus ?? 0)
  const party = 1 + (mods.partyBonus ?? 0)
  const transcendence = 1 + (mods.transcendenceBonus ?? 0)
  return base * margin * level * party * transcendence
}
