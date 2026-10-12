import { supabase } from '@/lib/supabase'
import { invokeError } from './_invoke'

// Totem equip/unequip — account-level writes, same Edge-Function-invoke pattern as every
// other server-authoritative write (ADR-0003).

export async function equipTotem(totemDefId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('totem-equip', {
    body: { totemDefId },
  })
  if (error) await invokeError(error, 'Could not equip totem')
  return data.activeTotemId as string
}

export async function unequipTotem(): Promise<void> {
  const { error } = await supabase.functions.invoke('totem-unequip', { body: {} })
  if (error) await invokeError(error, 'Could not unequip totem')
}
