// The Echo Shop registry (ADR-0053) — permanent, repeatable-purchase upgrades bought with
// Echoes (earned by Resetting, spec's data model). A CODE registry, not Sanity content: these
// are mechanical, account-wide multipliers, the same category as statDefinitions.ts/
// currencies.ts (ADR-0004), not narrative per-character content. Character-power nodes are
// explicitly reserved for a future Transcendence tier — this shop is economy/logistics only.

import { RESOURCE_SOURCE } from './resources.ts'

export type ShopEffectKind = 'missionSpeed' | 'goldGain' | 'gatherRate' | 'resourceGain'

export type ShopNode = {
  key: string
  label: string
  description: string
  /** `resource` is set only for the per-resource kinds (gatherRate/resourceGain). */
  effect: { kind: ShopEffectKind; resource?: string }
  costBase: number
  costGrowth: number
}

/** +%/level for each effect kind. Provisional first-pass values (spec §3's non-goal on tuning),
 *  same treatment as combat.ts's COMBAT block — shape is final, numbers are tuned later. */
const PER_LEVEL_BONUS: Record<ShopEffectKind, number> = {
  missionSpeed: 0.02,
  goldGain: 0.02,
  gatherRate: 0.03,
  resourceGain: 0.03,
}

const FLAT_NODES: Record<string, ShopNode> = {
  missionSpeed: {
    key: 'missionSpeed',
    label: 'Mission Speed',
    description: 'Missions and dungeon/raid stages take less real-world time to finish.',
    effect: { kind: 'missionSpeed' },
    costBase: 20,
    costGrowth: 1.15,
  },
  goldGain: {
    key: 'goldGain',
    label: 'Gold Gain',
    description: 'More gold from every mission and dungeon/raid win.',
    effect: { kind: 'goldGain' },
    costBase: 20,
    costGrowth: 1.15,
  },
}

// Derived from RESOURCE_SOURCE's keys (src/lib/resources.ts) — a future 10th resource
// automatically gets both shop lanes with zero registry edits (ADR-0004's registry-driven
// promise extends to resource growth, not just adding an unrelated new node).
const RESOURCE_NODES: Record<string, ShopNode> = Object.fromEntries(
  Object.keys(RESOURCE_SOURCE).flatMap((resource) => [
    [
      `gatherRate.${resource}`,
      {
        key: `gatherRate.${resource}`,
        label: `${resource} Gather Rate`,
        description: `Gather ${resource} faster at the mines.`,
        effect: { kind: 'gatherRate' as const, resource },
        costBase: 15,
        costGrowth: 1.12,
      },
    ],
    [
      `resourceGain.${resource}`,
      {
        key: `resourceGain.${resource}`,
        label: `${resource} Gain`,
        description: `More ${resource} from mission and dungeon/raid loot.`,
        effect: { kind: 'resourceGain' as const, resource },
        costBase: 15,
        costGrowth: 1.12,
      },
    ],
  ]),
)

export const ECHO_SHOP_NODES: Record<string, ShopNode> = { ...FLAT_NODES, ...RESOURCE_NODES }

/** Cost to buy the NEXT level (i.e. going from `currentLevel` to `currentLevel + 1`). */
export function nodeCost(node: ShopNode, currentLevel: number): number {
  return Math.floor(node.costBase * node.costGrowth ** currentLevel)
}

/** Total multiplier from the player's current level of one effect (+ the matching resource for
 *  the per-resource kinds). A missing key in `shop` is level 0 → multiplier 1 (no bonus). */
export function resolveShopBonus(shop: Record<string, number>, kind: ShopEffectKind, resource?: string): number {
  const key = resource ? `${kind}.${resource}` : kind
  const level = shop[key] ?? 0
  return 1 + level * PER_LEVEL_BONUS[kind]
}

/** Display helper: the bonus percent at a given level (e.g. level 5 missionSpeed → 10). */
export function effectPercent(kind: ShopEffectKind, level: number): number {
  return level * PER_LEVEL_BONUS[kind] * 100
}
