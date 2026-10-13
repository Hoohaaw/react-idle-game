import { sanity } from './sanity'

// Authored consumable definitions (Sanity) — mission-prep heal/buff items (docs/superpowers/
// specs/2026-10-12-mission-prep-consumables-design.md §B). Keyed by consumableKey, which is
// also player_inventory.item_def_id for an owned stack (same looseness itemDef already has).
// Just enough metadata for the dispatch loadout picker to label owned stacks. Mirrors
// src/services/items.ts's shape.

export type ConsumableDefMeta = { name: string; category: 'heal' | 'buff' }

const CONSUMABLE_DEFS_QUERY = `*[_type == "consumableDef" && defined(consumableKey)]{ consumableKey, name, category }`

type RawConsumableDef = { consumableKey: string; name?: string; category?: 'heal' | 'buff' }

export async function fetchConsumableDefs(): Promise<Record<string, ConsumableDefMeta>> {
  const raw = await sanity.fetch<RawConsumableDef[]>(CONSUMABLE_DEFS_QUERY)
  return Object.fromEntries(
    raw.map((c) => [c.consumableKey, { name: c.name ?? c.consumableKey, category: c.category ?? 'buff' }]),
  )
}
