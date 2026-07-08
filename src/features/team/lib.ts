import { isGearSlotKey, type GearSlotKey } from '@/lib/equipment'
import { scaledStatLines } from '@/lib/itemStats'
import type { GearSlotContent } from '@/components/organisms/GearSlotGrid'
import type { EquippedItem } from '@/services/playerCharacters'
import type { ItemDefMeta } from '@/services/items'

// Joins a character's equipped map (Supabase runtime) with the authored item defs (Sanity)
// into the GearSlotGrid's display shape. Falls back to the raw itemDefId when a def hasn't
// loaded/been authored, so real state is never hidden.
export function resolveGearSlots(
  equipped: Record<string, EquippedItem>,
  itemDefs: Record<string, ItemDefMeta> | undefined,
): Partial<Record<GearSlotKey, GearSlotContent>> {
  const slots: Partial<Record<GearSlotKey, GearSlotContent>> = {}
  for (const [slotKey, item] of Object.entries(equipped)) {
    if (!isGearSlotKey(slotKey)) continue
    const def = itemDefs?.[item.itemDefId]
    slots[slotKey] = {
      name: def?.name ?? item.itemDefId,
      rarity: item.rarity,
      stats: scaledStatLines(def?.statBonuses, item.rarity),
    }
  }
  return slots
}
