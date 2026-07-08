import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { fetchItemDefSlot } from '../_shared/itemDefs.ts'
import { isGearSlotKey, itemSlotForSlotKey } from '../../../src/lib/equipment.ts'

// gear-equip: equip an inventory item into a character slot (ADR-0003/0022). Validates the
// caller + that the item's authored slot matches the target slot key (Sanity-dependent, so it
// lives here), then hands off to the atomic `equip_item` RPC which owns ownership / not-busy /
// stack checks and the swap (old item returns to inventory) under row locks.

const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  const admin = createAdminClient()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
  const playerId = userData.user.id

  let body: { characterId?: unknown; slotKey?: unknown; itemDefId?: unknown; rarity?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const { characterId, slotKey, itemDefId, rarity } = body
  if (typeof characterId !== 'string' || characterId.length === 0) {
    return json({ error: 'characterId is required' }, 400)
  }
  if (typeof itemDefId !== 'string' || itemDefId.length === 0) {
    return json({ error: 'itemDefId is required' }, 400)
  }
  if (typeof rarity !== 'string' || !RARITIES.includes(rarity)) {
    return json({ error: 'rarity must be one of ' + RARITIES.join(', ') }, 400)
  }
  if (typeof slotKey !== 'string' || !isGearSlotKey(slotKey)) {
    return json({ error: 'slotKey is not a valid gear slot' }, 400)
  }

  let defSlot: string | null
  try {
    defSlot = await fetchItemDefSlot(itemDefId)
  } catch (e) {
    console.error('Sanity fetch failed', e)
    return json({ error: 'Could not load item content' }, 502)
  }
  if (defSlot === null) return json({ error: 'Unknown item' }, 404)
  if (itemSlotForSlotKey(slotKey) !== defSlot) {
    return json({ error: 'That item cannot go in that slot' }, 409)
  }

  const { data, error: rpcErr } = await admin.rpc('equip_item', {
    p_player: playerId,
    p_char: characterId,
    p_slot_key: slotKey,
    p_item_def_id: itemDefId,
    p_rarity: rarity,
  })
  if (rpcErr) {
    // The RPC raises 'equip_item: <reason>' for every validation failure (owned/busy/stack).
    const reason = rpcErr.message.replace(/^.*equip_item:\s*/, '')
    return json({ error: reason || 'Could not equip item' }, 409)
  }

  return json(data, 200)
})
