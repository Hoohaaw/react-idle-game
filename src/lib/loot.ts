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

// Canonical rarity ordering, lowest to highest — matches src/lib/stats.ts's RARITY_MULT key
// order. Array POSITION in an authored rarityWeights list is NOT a reliable "lowest tier" signal
// (confirmed by reading loot.test.ts's own fixtures: they list Legendary before Rare in one case)
// — only this explicit order is trustworthy.
const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']

/** Weighted rarity pick (independent per-item roll — ADR-0017). Empty/zero weights -> Common.
 *  `bias` (Ascendant Shop's rarityBias node, ADR-0023/spec 2026-09-12) multiplies every weight
 *  EXCEPT the lowest rarity actually present in this line (by RARITY_ORDER, not array position)
 *  before the roll, shifting probability toward higher tiers without making the lowest-tier
 *  outcome impossible. Defaults to 1 = no change (every existing caller that doesn't pass it
 *  behaves byte-for-byte as before this was added). An unrecognized rarity string sorts as
 *  "lowest" (index -1 loses every comparison), so a typo'd rarity is never accidentally biased up. */
export function rollRarity(weights: RarityWeight[] | undefined, rng: () => number, bias = 1): string {
  const list = (weights ?? []).filter((w) => (w.weight ?? 0) > 0)
  if (list.length === 0) return 'Common'
  const lowestRarity = list.reduce(
    (lowest, w) => (RARITY_ORDER.indexOf(w.rarity) < RARITY_ORDER.indexOf(lowest) ? w.rarity : lowest),
    list[0].rarity,
  )
  const biased = list.map((w) => ({ rarity: w.rarity, weight: w.rarity === lowestRarity ? w.weight : w.weight * bias }))
  const total = biased.reduce((s, w) => s + w.weight, 0)
  let r = rng() * total
  for (const w of biased) {
    r -= w.weight
    if (r < 0) return w.rarity
  }
  return biased[biased.length - 1].rarity
}

/** Rolls every loot line independently against its own dropChance (scaled by magicFind, capped at
 *  100), then a rarity roll and a quantity roll (± luck) for each that drops. */
export function rollItemLoot(
  lines: LootLine[],
  rng: () => number,
  opts: { magicFind: number; luck: number; bias?: number },
): RolledLoot[] {
  const loot: RolledLoot[] = []
  for (const drop of lines) {
    if (!drop.itemKey) continue
    const chance = Math.min(100, (drop.dropChance ?? 0) * (1 + opts.magicFind / 100))
    if (rng() * 100 >= chance) continue
    const rarity = rollRarity(drop.rarityWeights, rng, opts.bias ?? 1)
    const qMin = drop.quantityMin ?? 1
    const qMax = Math.max(qMin, drop.quantityMax ?? qMin)
    let quantity = qMin + Math.floor(rng() * (qMax - qMin + 1))
    if (rng() * 100 < opts.luck) quantity += 1
    loot.push({ item_def_id: drop.itemKey, rarity, quantity })
  }
  return loot
}
