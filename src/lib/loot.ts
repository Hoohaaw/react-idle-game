// Loot-rolling helpers shared by mission-claim and group-claim-stage (dungeons/raids). Pure and
// framework-agnostic so both the Deno Edge Functions (via relative import) and this repo's Vitest
// suite can use/test the exact same logic — single source of truth, same reasoning as combat.ts.

export type RarityWeight = { rarity: string; weight: number }
export type LootLine = {
  itemKey: string | null
  dropChance?: number
  quantityMin?: number
  quantityMax?: number
  rarityWeights?: RarityWeight[]
}
export type RolledLoot = { item_def_id: string; rarity: string; quantity: number }

/** Weighted rarity pick (independent per-item roll — ADR-0017). Empty/zero weights → Common. */
export function rollRarity(weights: RarityWeight[] | undefined, rng: () => number): string {
  const list = (weights ?? []).filter((w) => (w.weight ?? 0) > 0)
  if (list.length === 0) return 'Common'
  const total = list.reduce((s, w) => s + w.weight, 0)
  let r = rng() * total
  for (const w of list) {
    r -= w.weight
    if (r < 0) return w.rarity
  }
  return list[list.length - 1].rarity
}

/** Rolls every loot line independently against its own dropChance (scaled by magicFind, capped at
 *  100), then a rarity roll and a quantity roll (± luck) for each that drops. */
export function rollItemLoot(
  lines: LootLine[],
  rng: () => number,
  opts: { magicFind: number; luck: number },
): RolledLoot[] {
  const loot: RolledLoot[] = []
  for (const drop of lines) {
    if (!drop.itemKey) continue
    const chance = Math.min(100, (drop.dropChance ?? 0) * (1 + opts.magicFind / 100))
    if (rng() * 100 >= chance) continue
    const rarity = rollRarity(drop.rarityWeights, rng)
    const qMin = drop.quantityMin ?? 1
    const qMax = Math.max(qMin, drop.quantityMax ?? qMin)
    let quantity = qMin + Math.floor(rng() * (qMax - qMin + 1))
    if (rng() * 100 < opts.luck) quantity += 1
    loot.push({ item_def_id: drop.itemKey, rarity, quantity })
  }
  return loot
}
