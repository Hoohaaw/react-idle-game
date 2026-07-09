import { supabase } from '@/lib/supabase'
import { invokeError } from './_invoke'

// The player's loot stacks. RLS scopes rows to the caller (owner-read, SELECT-only grant) —
// all writes happen server-side (mission-claim loot inserts, equip/unequip RPCs; ADR-0003).
// Stacks are fungible per (item_def_id, rarity); display metadata comes from ['itemDefs'].

export type InventoryStack = {
  id: string
  itemDefId: string
  rarity: string
  quantity: number
  acquiredAt: string
}

export type UpgradeOp = {
  itemDefId: string
  fromRarity: string
  consumeCount: number
}

export async function upgradeItems(ops: UpgradeOp[]): Promise<void> {
  const { data, error } = await supabase.functions.invoke('item-upgrade', { body: { ops } })
  if (error) await invokeError(error, 'Could not upgrade items')
  return data
}

export async function fetchInventory(): Promise<InventoryStack[]> {
  const { data, error } = await supabase
    .from('player_inventory')
    .select('id, item_def_id, rarity, quantity, acquired_at')
    .order('acquired_at', { ascending: false })
  if (error) throw error
  return data.map((row) => ({
    id: row.id,
    itemDefId: row.item_def_id,
    rarity: row.rarity,
    quantity: row.quantity,
    acquiredAt: row.acquired_at,
  }))
}
