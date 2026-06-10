export type ItemStat = { key: string; value: string }

// Canonical item shape used by the inventory, shop, and item tooltip.
export type Item = {
  name: string
  rarity: string
  slot: string
  stats: ItemStat[]
  value: number // coin value — shop presents it as the buy price; inventory as sell value
  flavor?: string // optional flavour text, shown in the tooltip when present
  quantity?: number // how many copies the player owns; duplicates are consumed to upgrade the item. Inventory only; absent/1 = single copy
}
