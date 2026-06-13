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

import { STAT_DEFS } from './statDefinitions'

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
  statBonus?: number
  partyBonus?: number
  transcendenceBonus?: number
}

/**
 * The reward pipeline:
 *
 *   final = base × (1 + statBonus) × (1 + partyBonus) × (1 + transcendenceBonus)
 *
 * The modifier VALUES (party-size, transcendence) are tuning numbers that live with their systems
 * and are passed in here — this function only combines them. Returns a raw number; callers round
 * for the specific reward type (e.g. coins are integers).
 */
export function finalReward(base: number, mods: RewardModifiers = {}): number {
  const stat = 1 + (mods.statBonus ?? 0)
  const party = 1 + (mods.partyBonus ?? 0)
  const transcendence = 1 + (mods.transcendenceBonus ?? 0)
  return base * stat * party * transcendence
}
