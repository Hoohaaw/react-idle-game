import { sanity } from './sanity'
import type { ItemDefBonuses } from '../lib/stats'

// Authored item definitions (Sanity) — just the equip-time stat bonuses, keyed by itemKey. Used to
// compute a character's effective stats (incl. gear) the same way the combat sim does, so the roster's
// max-HP matches the ending HP the resolver returns.

const ITEM_DEFS_QUERY = `*[_type == "itemDef" && defined(itemKey)]{ itemKey, statBonuses[]{ stat, kind, value } }`

type RawItemDef = { itemKey: string; statBonuses?: { stat: string; kind: 'flat' | 'pct'; value: number }[] }

export async function fetchItemDefBonuses(): Promise<Record<string, ItemDefBonuses>> {
  const raw = await sanity.fetch<RawItemDef[]>(ITEM_DEFS_QUERY)
  return Object.fromEntries(raw.map((i) => [i.itemKey, { statBonuses: i.statBonuses }]))
}
