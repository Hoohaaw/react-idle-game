import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { ECHO_SHOP_NODES } from '../../../src/lib/echoShop.ts'

// echo-shop-purchase: buy the next level of one Echo Shop node (ADR-0053). The cost is resolved
// authoritatively INSIDE the RPC now (supabase/migrations/20260915150000_lock_shop_purchase_price.sql),
// under the same row lock that reads the current level — a client-computed price read here,
// before the lock, would let two concurrent purchases both validate against the same
// correct-at-the-time price and both succeed off one price check (ADR-0003). This function only
// checks the node key exists in the CODE registry (early 400 on garbage input) and forwards it.

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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

  let body: { nodeKey?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const nodeKey = body.nodeKey
  if (typeof nodeKey !== 'string' || !ECHO_SHOP_NODES[nodeKey]) {
    return json({ error: 'Unknown shop node' }, 400)
  }

  const { data: result, error: rpcErr } = await admin.rpc('purchase_echo_shop_node', {
    p_player: playerId,
    p_node_key: nodeKey,
  })
  if (rpcErr) {
    console.error('echo-shop-purchase: purchase_echo_shop_node failed', rpcErr)
    const reason = rpcErr.message.replace(/^.*purchase_echo_shop_node:\s*/, '')
    return json({ error: reason || 'Could not purchase upgrade' }, 409)
  }

  try {
    const { error: logErr } = await admin.rpc('log_event', {
      p_player: playerId,
      p_type: 'echo_purchased',
      p_payload: { nodeLabel: ECHO_SHOP_NODES[nodeKey].label },
    })
    if (logErr) console.error('activity log failed (echo_purchased) — continuing', logErr)
  } catch (e) {
    console.error('activity log failed (echo_purchased) — continuing', e)
  }

  return json(result, 200)
})
