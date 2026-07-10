import type { Item } from '../types/item'
import { RARITY_ORDER } from './rarity'

// Five copies of one (item + rarity) combine into one of the next rarity.
export const UPGRADE_COST = 5

const keyOf = (id: string, rarity: string) => `${id}::${rarity}`

// Cascade-upgrade: repeatedly combine UPGRADE_COST of an (item + rarity) into 1 of the
// next rarity — folding into existing higher stacks — until no cascaded tier has ≥5.
// Pass `ids` (itemDefId, or name for items without one) to limit to specific items.
// One low→high pass per item suffices: produced items land in a still-to-be-processed
// tier, so they get re-combined in the same pass.
export function cascade(inventory: Item[], ids?: string[]): Item[] {
  const map = new Map<string, Item>()
  for (const it of inventory) map.set(keyOf(it.itemDefId ?? it.name, it.rarity), { ...it })

  const allIds = [...new Set(inventory.map(i => i.itemDefId ?? i.name))]
  const targets = ids ?? allIds
  for (const id of targets) {
    for (let i = 0; i < RARITY_ORDER.length - 1; i++) {
      const k = keyOf(id, RARITY_ORDER[i])
      const stack = map.get(k)
      if (!stack) continue
      const qty = stack.quantity ?? 1
      if (qty < UPGRADE_COST) continue

      const produced = Math.floor(qty / UPGRADE_COST)
      const remainder = qty % UPGRADE_COST
      if (remainder > 0) map.set(k, { ...stack, quantity: remainder })
      else map.delete(k)

      const nk = keyOf(id, RARITY_ORDER[i + 1])
      const existing = map.get(nk)
      map.set(nk, existing
        ? { ...existing, quantity: (existing.quantity ?? 1) + produced }
        : { ...stack, rarity: RARITY_ORDER[i + 1], quantity: produced })
    }
  }
  return [...map.values()]
}

// "2× Epic · 2× Rare" — high→low, non-zero tiers only — for one item's set of stacks.
export function distribution(stacks: Item[]): string {
  const counts: Record<string, number> = {}
  for (const s of stacks) counts[s.rarity] = (counts[s.rarity] ?? 0) + (s.quantity ?? 1)
  return [...RARITY_ORDER].reverse().filter(r => counts[r]).map(r => `${counts[r]}× ${r}`).join('  ·  ')
}
