import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { ECHO_SHOP_NODES, nodeCost } from '../../../src/lib/echoShop.ts'

// echo-shop-purchase: buy the next level of one Echo Shop node (ADR-0053). The cost is resolved
// authoritatively here from the CODE registry (no Sanity round-trip — the shop is mechanical
// content, not Sanity-authored) using the player's CURRENT level for that node; the client is
// never trusted for the price (ADR-0003). A concurrent purchase in another tab can make this
// read stale — the RPC still applies the level increment atomically under its own row lock
// regardless, so the level is always correct; only the exact price of a rare simultaneous
// double-buy could be off by one growth step, which only affects the same player's own wallet.

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
  const node = ECHO_SHOP_NODES[nodeKey]

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('echo_shop')
    .eq('player_id', playerId)
    .maybeSingle()
  if (profileErr) {
    console.error('echo-shop-purchase: profile lookup failed', profileErr)
    return json({ error: 'Could not load shop levels' }, 500)
  }
  const shop = (profile?.echo_shop ?? {}) as Record<string, number>
  const currentLevel = shop[nodeKey] ?? 0
  const cost = nodeCost(node, currentLevel)

  const { data: result, error: rpcErr } = await admin.rpc('purchase_echo_shop_node', {
    p_player: playerId,
    p_node_key: nodeKey,
    p_cost: cost,
  })
  if (rpcErr) {
    console.error('echo-shop-purchase: purchase_echo_shop_node failed', rpcErr)
    const reason = rpcErr.message.replace(/^.*purchase_echo_shop_node:\s*/, '')
    return json({ error: reason || 'Could not purchase upgrade' }, 409)
  }

  return json(result, 200)
})
