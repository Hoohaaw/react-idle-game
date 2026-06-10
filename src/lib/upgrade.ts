import type { Item } from '../types/item'
import { RARITY_ORDER } from './rarity'

// Five copies of one (item + rarity) combine into one of the next rarity.
export const UPGRADE_COST = 5

const keyOf = (name: string, rarity: string) => `${name}::${rarity}`

// Cascade-upgrade: repeatedly combine UPGRADE_COST of an (item + rarity) into 1 of the
// next rarity — folding into existing higher stacks — until no cascaded tier has ≥5.
// Pass `names` to limit the cascade to specific items; omit to cascade everything.
// One low→high pass per item suffices: produced items land in a still-to-be-processed
// tier, so they get re-combined in the same pass.
export function cascade(inventory: Item[], names?: string[]): Item[] {
  const map = new Map<string, Item>()
  for (const it of inventory) map.set(keyOf(it.name, it.rarity), { ...it })

  const targets = names ?? [...new Set(inventory.map(i => i.name))]
  for (const name of targets) {
    for (let i = 0; i < RARITY_ORDER.length - 1; i++) {
      const k = keyOf(name, RARITY_ORDER[i])
      const stack = map.get(k)
      if (!stack) continue
      const qty = stack.quantity ?? 1
      if (qty < UPGRADE_COST) continue

      const produced = Math.floor(qty / UPGRADE_COST)
      const remainder = qty % UPGRADE_COST
      if (remainder > 0) map.set(k, { ...stack, quantity: remainder })
      else map.delete(k)

      const nk = keyOf(name, RARITY_ORDER[i + 1])
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
