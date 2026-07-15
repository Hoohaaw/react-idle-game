import { sanityQuery } from './sanity.ts'

// Item-def lookups the gear functions need. The equip-time slot-compatibility check AND the
// level-requirement check (ADR-0043) are both Sanity-dependent (itemDef.slot / .minLevel), so
// they live at the Edge Function layer — the RPCs only validate ownership/stack/busy/level
// (ADR-0022; equip_item's level check is structural once the Edge Function hands it a number).

const ITEM_DEF_GROQ = `*[_type == "itemDef" && itemKey == $key][0]{ slot, minLevel }`

/** The authored `slot` + `minLevel` for an itemDef key, or null when no such item exists. Throws on Sanity failure. */
export async function fetchItemDef(itemKey: string): Promise<{ slot: string; minLevel: number } | null> {
  const row = await sanityQuery<{ slot?: string; minLevel?: number } | null>(ITEM_DEF_GROQ, { key: itemKey })
  if (!row?.slot) return null
  return { slot: row.slot, minLevel: row.minLevel ?? 0 }
}
