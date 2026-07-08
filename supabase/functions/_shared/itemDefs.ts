import { sanityQuery } from './sanity.ts'

// Item-def lookups the gear functions need. The equip-time slot-compatibility check is
// Sanity-dependent (itemDef.slot), so it lives at the Edge Function layer — the RPCs only
// validate ownership/stack/busy (ADR-0022).

const ITEM_SLOT_GROQ = `*[_type == "itemDef" && itemKey == $key][0]{ slot }`

/** The authored `slot` for an itemDef key, or null when no such item exists. Throws on Sanity failure. */
export async function fetchItemDefSlot(itemKey: string): Promise<string | null> {
  const row = await sanityQuery<{ slot?: string } | null>(ITEM_SLOT_GROQ, { key: itemKey })
  return row?.slot ?? null
}
