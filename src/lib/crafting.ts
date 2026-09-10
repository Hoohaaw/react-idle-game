// Pure crafting logic shared by the crafting feature's UI (enable/disable Craft, drive the
// rarity picker) and its service layer (docs/superpowers/specs/2026-09-09-crafting-create-
// recipes-design.md §6). Framework-agnostic and tested, same reasoning as loot.ts.

import { RARITY_ORDER } from './rarity'

export type ReagentLine =
  | { kind: 'resource'; resource: string; quantity: number }
  | { kind: 'item'; itemKey: string; quantity: number }

/** Structurally satisfied by src/services/inventory.ts's InventoryStack. */
export type OwnedStack = { itemDefId: string; rarity: string; quantity: number }

/** The player's pick of which owned rarity to spend for an item-typed reagent line. */
export type ItemRarityChoice = { reagentIndex: number; rarity: string }

export type ResolvedReagent =
  | { index: number; kind: 'resource'; code: string; quantity: number; have: number; ok: boolean }
  | {
      index: number
      kind: 'item'
      itemKey: string
      rarity: string | null
      quantity: number
      have: number
      ok: boolean
      /** Every rarity the player holds of this item, low → high, with quantities (feeds the picker). */
      owned: { rarity: string; have: number }[]
    }

const rarityRank = (r: string) => (RARITY_ORDER as readonly string[]).indexOf(r)

function ownedStacksFor(itemKey: string, stacks: OwnedStack[]): OwnedStack[] {
  return stacks
    .filter((s) => s.itemDefId === itemKey && s.quantity > 0)
    .sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity))
}

/** Resolves every authored reagent line against what the player holds. Item lines use the
 *  player's rarity choice for that line index (null = not chosen yet → never ok). */
export function resolveReagents(
  lines: ReagentLine[],
  resources: Record<string, number>,
  stacks: OwnedStack[],
  choices: ItemRarityChoice[],
): ResolvedReagent[] {
  return lines.map((line, index) => {
    if (line.kind === 'resource') {
      const have = resources[line.resource] ?? 0
      return { index, kind: 'resource', code: line.resource, quantity: line.quantity, have, ok: have >= line.quantity }
    }
    const owned = ownedStacksFor(line.itemKey, stacks)
    const rarity = choices.find((c) => c.reagentIndex === index)?.rarity ?? null
    const have = rarity ? (owned.find((s) => s.rarity === rarity)?.quantity ?? 0) : 0
    return {
      index,
      kind: 'item',
      itemKey: line.itemKey,
      rarity,
      quantity: line.quantity,
      have,
      ok: rarity !== null && have >= line.quantity,
      owned: owned.map((s) => ({ rarity: s.rarity, have: s.quantity })),
    }
  })
}

/** Craft is allowed only when every line is satisfied (and there is at least one line). */
export function canAfford(resolved: ResolvedReagent[]): boolean {
  return resolved.length > 0 && resolved.every((r) => r.ok)
}

/** Default pick for an item line: the lowest-rarity stack that covers the quantity (so a
 *  hard-won Epic isn't spent by accident), else the lowest owned rarity, else null. */
export function defaultRarityChoice(line: Extract<ReagentLine, { kind: 'item' }>, stacks: OwnedStack[]): string | null {
  const owned = ownedStacksFor(line.itemKey, stacks)
  return owned.find((s) => s.quantity >= line.quantity)?.rarity ?? owned[0]?.rarity ?? null
}

/** Weighted rarity list → display percentages. Mirrors rollRarity's rules (src/lib/loot.ts):
 *  zero weights are ignored, an empty list means "always Common". */
export function rarityChances(weights: { rarity: string; weight: number }[] | undefined): { rarity: string; chance: number }[] {
  const list = (weights ?? []).filter((w) => w.weight > 0)
  if (list.length === 0) return [{ rarity: 'Common', chance: 100 }]
  const total = list.reduce((s, w) => s + w.weight, 0)
  return list.map((w) => ({ rarity: w.rarity, chance: Math.round((w.weight / total) * 100) }))
}
