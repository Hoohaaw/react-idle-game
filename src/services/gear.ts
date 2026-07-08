import { supabase } from '@/lib/supabase'
import { invokeError } from './_invoke'
import type { EquippedItem } from './playerCharacters'
import type { GearSlotKey } from '@/lib/equipment'

// Gear writes (ADR-0022): equip/unequip go through the server-authoritative Edge Functions,
// which validate slot compatibility (Sanity) and hand off to the atomic equip_item/unequip_item
// RPCs (ownership / busy / stack checks + the swap, under row locks).

export type GearMutationResult = {
  equipped: Record<string, EquippedItem>
  returned: EquippedItem | null // the displaced (swap) or removed item, now back in inventory
}

export async function equipItem(args: {
  characterId: string
  slotKey: GearSlotKey
  itemDefId: string
  rarity: string
}): Promise<GearMutationResult> {
  const { data, error } = await supabase.functions.invoke('gear-equip', { body: args })
  if (error) await invokeError(error, 'Could not equip item')
  return data as GearMutationResult
}

export async function unequipItem(args: {
  characterId: string
  slotKey: GearSlotKey
}): Promise<GearMutationResult> {
  const { data, error } = await supabase.functions.invoke('gear-unequip', { body: args })
  if (error) await invokeError(error, 'Could not unequip item')
  return data as GearMutationResult
}
