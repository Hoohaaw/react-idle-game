import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { isGearSlotKey } from '../../../src/lib/equipment.ts'

// gear-unequip: remove the item in a character's slot back to inventory (ADR-0003/0022).
// No Sanity lookup needed — the atomic `unequip_item` RPC owns ownership / not-busy /
// slot-occupied checks and the inventory return under row locks.

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

  let body: { characterId?: unknown; slotKey?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const { characterId, slotKey } = body
  if (typeof characterId !== 'string' || characterId.length === 0) {
    return json({ error: 'characterId is required' }, 400)
  }
  if (typeof slotKey !== 'string' || !isGearSlotKey(slotKey)) {
    return json({ error: 'slotKey is not a valid gear slot' }, 400)
  }

  const { data, error: rpcErr } = await admin.rpc('unequip_item', {
    p_player: playerId,
    p_char: characterId,
    p_slot_key: slotKey,
  })
  if (rpcErr) {
    // The RPC raises 'unequip_item: <reason>' for every validation failure (owned/busy/empty).
    const reason = rpcErr.message.replace(/^.*unequip_item:\s*/, '')
    return json({ error: reason || 'Could not unequip item' }, 409)
  }

  return json(data, 200)
})
