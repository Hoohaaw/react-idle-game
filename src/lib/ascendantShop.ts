// src/lib/ascendantShop.ts
// The Ascendant Shop registry (ADR-0023, spec docs/superpowers/specs/2026-09-12-transcendence-
// ascendant-shards-design.md §4d) — spent with Ascendant Shards, far more impactful per level and
// far more expensive than the Echo Shop's equivalents. Two node shapes: 6 flat, account-wide
// nodes, and 2 per-character nodes (Power/Vitality) purchasable for any valid charKey.

import type { StatBonus } from './stats.ts'

export type FlatAscendantKind = 'missionSpeed' | 'goldFind' | 'magicFind' | 'xpGain' | 'resourceGain' | 'rarityBias'
export type CharAscendantKind = 'power' | 'vitality'

export type FlatAscendantNode = {
  key: FlatAscendantKind
  label: string
  description: string
  costBase: number
  costGrowth: number
}

/** +%/level for each flat node. Provisional (spec §3, tuned later) — an order of magnitude
 *  bigger than the Echo Shop's equivalents (2-3%/level) since Shards are far rarer than Echoes. */
const FLAT_PER_LEVEL_BONUS: Record<FlatAscendantKind, number> = {
  missionSpeed: 0.05,
  goldFind: 0.08,
  magicFind: 0.08,
  xpGain: 0.08,
  resourceGain: 0.06,
  rarityBias: 0.04,
}

export const FLAT_ASCENDANT_NODES: Record<FlatAscendantKind, FlatAscendantNode> = {
  missionSpeed: { key: 'missionSpeed', label: 'Ascendant Haste', description: 'Missions and dungeon/raid stages take even less real-world time to finish.', costBase: 200, costGrowth: 1.35 },
  goldFind:     { key: 'goldFind',     label: 'Ascendant Fortune', description: 'Every character gains Gold Find, account-wide.', costBase: 200, costGrowth: 1.35 },
  magicFind:    { key: 'magicFind',    label: 'Ascendant Sight', description: 'Every character gains Magic Find, account-wide.', costBase: 200, costGrowth: 1.35 },
  xpGain:       { key: 'xpGain',       label: 'Ascendant Wisdom', description: 'Every character gains XP Gain, account-wide.', costBase: 200, costGrowth: 1.35 },
  resourceGain: { key: 'resourceGain', label: 'Ascendant Bounty', description: 'More of every resource from mission and dungeon/raid loot.', costBase: 200, costGrowth: 1.35 },
  rarityBias:   { key: 'rarityBias',   label: 'Ascendant Fate', description: 'Loot rolls favor higher rarities.', costBase: 250, costGrowth: 1.4 },
}

/** Cost to buy the NEXT level of a flat node. */
export function flatNodeCost(node: FlatAscendantNode, currentLevel: number): number {
  return Math.floor(node.costBase * node.costGrowth ** currentLevel)
}

/** Multiplier form (1 + level*rate) for the three PURE multiplier nodes: missionSpeed (duration
 *  division), resourceGain (reward multiplication), rarityBias (passed straight to rollRarity). */
export function resolveFlatAscendantBonus(shop: Record<string, number>, kind: FlatAscendantKind): number {
  const level = shop[kind] ?? 0
  return 1 + level * FLAT_PER_LEVEL_BONUS[kind]
}

/** goldFind/magicFind/xpGain feed the STAT engine as FLAT percentage-point additions — the same
 *  consumption a trait/gear "+N goldFind" effect already uses — NOT the "1 + rate" multiplier
 *  form above, since those three are pure reward/duration multipliers, never stats. A level-0 node
 *  contributes nothing (omitted from the map entirely, matching collectTraitBonuses' convention). */
export function resolveFlatAscendantStatBonuses(shop: Record<string, number>): Record<string, StatBonus> {
  const out: Record<string, StatBonus> = {}
  for (const kind of ['goldFind', 'magicFind', 'xpGain'] as const) {
    const level = shop[kind] ?? 0
    if (level > 0) out[kind] = { flat: level * FLAT_PER_LEVEL_BONUS[kind] * 100, pct: 0 }
  }
  return out
}

/** Per-character nodes: NOT a static registry (characters are Sanity content, not a code list —
 *  unlike RESOURCE_SOURCE, there's no fixed array to derive keys from). Cost and effect size are
 *  the same for every character; only the LEVEL (read from ascendant_shop) varies. Callers
 *  validate a given charKey against Sanity (characterDefExists) at purchase time. */
const CHAR_COST_BASE = 500
const CHAR_COST_GROWTH = 1.5
const CHAR_PER_LEVEL_BONUS = 0.10 // +10%/level to the bundled stat group

export function charNodeKey(charKey: string, kind: CharAscendantKind): string {
  return `${charKey}.${kind}`
}

export function charNodeCost(currentLevel: number): number {
  return Math.floor(CHAR_COST_BASE * CHAR_COST_GROWTH ** currentLevel)
}

/** Bare fraction (e.g. 0.30 = +30%), NOT "1 + ..." — this feeds the {flat, pct} stat engine as a
 *  StatBonus.pct contribution (see resolveCharAscendantBonuses), which expects a bare number to
 *  add, not a pre-multiplied factor. */
export function resolveCharAscendantBonus(shop: Record<string, number>, charKey: string, kind: CharAscendantKind): number {
  const level = shop[charNodeKey(charKey, kind)] ?? 0
  return level * CHAR_PER_LEVEL_BONUS
}

const OFFENSE_STATS = ['attack', 'strength', 'agility', 'speed', 'intelligence', 'spellPower', 'haste']
const VITALITY_STATS = ['health', 'defense']

/** Resolves a character's Power/Vitality investment into a StatBonus map, same shape as
 *  collectTraitBonuses/resolveCapstoneBonuses — pass into effectiveStats' extraBonuses. */
export function resolveCharAscendantBonuses(shop: Record<string, number>, charKey: string): Record<string, StatBonus> {
  const power = resolveCharAscendantBonus(shop, charKey, 'power') * 100
  const vitality = resolveCharAscendantBonus(shop, charKey, 'vitality') * 100
  const out: Record<string, StatBonus> = {}
  if (power > 0) for (const stat of OFFENSE_STATS) out[stat] = { flat: 0, pct: power }
  if (vitality > 0) for (const stat of VITALITY_STATS) out[stat] = { flat: 0, pct: vitality }
  return out
}
