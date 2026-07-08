import { sanity } from './sanity'
import type { ItemDefBonuses } from '../lib/stats'

// Authored item definitions (Sanity), keyed by itemKey. Carries the equip-time stat bonuses the
// stat engine consumes (so the roster's max-HP matches the resolver's) plus the display metadata
// (name/slot) the inventory grid and the slot picker need. One query, one cache (['itemDefs']).

export type ItemDefMeta = ItemDefBonuses & { name: string; slot: string }

const ITEM_DEFS_QUERY = `*[_type == "itemDef" && defined(itemKey)]{ itemKey, name, slot, statBonuses[]{ stat, kind, value } }`

type RawItemDef = {
  itemKey: string
  name?: string
  slot?: string
  statBonuses?: { stat: string; kind: 'flat' | 'pct'; value: number }[]
}

export async function fetchItemDefs(): Promise<Record<string, ItemDefMeta>> {
  const raw = await sanity.fetch<RawItemDef[]>(ITEM_DEFS_QUERY)
  return Object.fromEntries(
    raw.map((i) => [
      i.itemKey,
      { name: i.name ?? i.itemKey, slot: i.slot ?? '', statBonuses: i.statBonuses },
    ]),
  )
}
