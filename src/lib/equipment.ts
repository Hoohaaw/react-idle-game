// The equipment slot model — the single source of truth for what gear slots a character has and
// which itemDef `slot` each accepts, imported by BOTH the client (equipped grid, slot picker) and
// the gear Edge Functions (equip-time slot validation). Like combat.ts/gather.ts, this module MUST
// stay Deno-safe: pure data + pure functions, no browser/node deps. See ADR-0022.
//
// 14 equipped keys = the 8 unique gear slots (keyed by the Sanity itemDef `slot` value directly)
// + 4 ring slots + 2 trinket slots. Multi-slots (ringN/trinketN) map back to their base itemDef
// slot for compatibility checks — a `ring` item can go in any of ring1..ring4.
// `player_characters.equipped` uses these keys: { "<slotKey>": { itemDefId, rarity } }.

export const GEAR_SLOT_KEYS = [
  'head', 'shoulders', 'chest', 'hands', 'legs', 'feet', 'weapon', 'offhand',
  'ring1', 'ring2', 'ring3', 'ring4',
  'trinket1', 'trinket2',
] as const

export type GearSlotKey = (typeof GEAR_SLOT_KEYS)[number]

export function isGearSlotKey(key: string): key is GearSlotKey {
  return (GEAR_SLOT_KEYS as readonly string[]).includes(key)
}

/** The itemDef `slot` value a slot key accepts ('ring2' → 'ring', 'head' → 'head'); null if unknown. */
export function itemSlotForSlotKey(slotKey: string): string | null {
  if (!isGearSlotKey(slotKey)) return null
  const base = slotKey.replace(/\d+$/, '')
  return base
}

/** Display label for a slot key ('ring1' → 'Ring 1', 'offhand' → 'Offhand'). */
export function slotKeyLabel(slotKey: GearSlotKey): string {
  const match = slotKey.match(/^([a-z]+?)(\d+)?$/)
  const base = match?.[1] ?? slotKey
  const index = match?.[2]
  const word = base.charAt(0).toUpperCase() + base.slice(1)
  return index ? `${word} ${index}` : word
}

// ---- Level requirement (ADR-0043) ---------------------------------------------------------
// A character must be at least this level to equip an item. Authored `minLevel` is the Common
// requirement; a rarer roll of the SAME item adds a flat per-rarity step on top. Flat (not
// proportional to stats.ts's RARITY_MULT) so an early map's BiS Legendary can't out-level-gate a
// later map's Common item — each map's own `minLevel` anchor already does the real gating.

export const LEVEL_REQ_STEP_BY_RARITY: Record<string, number> = {
  Common: 0,
  Uncommon: 2,
  Rare: 5,
  Epic: 9,
  Legendary: 14,
}

/** The level required to equip an item authored with `minLevel` at the given rolled rarity. */
export function requiredLevelForRarity(minLevel: number, rarity: string): number {
  return minLevel + (LEVEL_REQ_STEP_BY_RARITY[rarity] ?? 0)
}
