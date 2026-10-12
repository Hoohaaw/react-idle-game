import { supabase } from '@/lib/supabase'
import { sanity } from './sanity'
import { invokeError } from './_invoke'

// Totem equip/unequip — account-level writes, same Edge-Function-invoke pattern as every
// other server-authoritative write (ADR-0003).

// Authored totem definitions (Sanity), keyed by totemKey — just enough metadata (name) for
// the Inventory page's equip picker to display. Mirrors src/services/items.ts's shape.
export type TotemDefMeta = { name: string }

const TOTEM_DEFS_QUERY = `*[_type == "totemDef" && defined(totemKey)]{ totemKey, name }`

type RawTotemDef = { totemKey: string; name?: string }

export async function fetchTotemDefs(): Promise<Record<string, TotemDefMeta>> {
  const raw = await sanity.fetch<RawTotemDef[]>(TOTEM_DEFS_QUERY)
  return Object.fromEntries(raw.map((t) => [t.totemKey, { name: t.name ?? t.totemKey }]))
}

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
