import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { RESPEC_COST } from '../../../src/lib/blessings.ts'

// blessing-respec: pay gold to wipe a character's entire blessing tree back to `{}` (ADR-0047).
// All-or-nothing — see respec_blessings's header for why partial-row respec isn't offered.
// RESPEC_COST is a fixed engine constant, resolved here server-side and passed to the RPC as
// p_cost — the client never supplies or influences the price (mirrors infirmary-upgrade
// resolving UPGRADE_COSTS itself rather than trusting the request body).

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

  let body: { characterId?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const { characterId } = body
  if (typeof characterId !== 'string' || characterId.length === 0) {
    return json({ error: 'characterId is required' }, 400)
  }

  const { data, error: rpcErr } = await admin.rpc('respec_blessings', {
    p_player: playerId,
    p_char: characterId,
    p_cost: RESPEC_COST,
  })
  if (rpcErr) {
    // respec_blessings raises 'respec_blessings: <reason>' for every validation failure
    // (nothing-to-respec/busy/insufficient gold).
    const reason = rpcErr.message.replace(/^.*respec_blessings:\s*/, '')
    return json({ error: reason || 'Could not respec' }, 409)
  }

  return json(data, 200)
})
