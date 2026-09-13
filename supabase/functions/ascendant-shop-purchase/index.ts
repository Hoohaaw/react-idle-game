import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { characterDefExists } from '../_shared/sanity.ts'
import { FLAT_ASCENDANT_NODES, flatNodeCost, charNodeCost, type FlatAscendantKind } from '../../../src/lib/ascendantShop.ts'

// ascendant-shop-purchase: buy the next level of one Ascendant Shop node (ADR-0023). The cost is
// resolved authoritatively here — a flat node's cost comes straight from the CODE registry (no
// Sanity round-trip), a per-character node's cost is the same for every character (only the level
// varies) but the charKey itself is validated against Sanity, since it isn't enumerable from a
// static list the way flat nodes are.

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
  if (typeof nodeKey !== 'string' || nodeKey.length === 0) {
    return json({ error: 'nodeKey is required' }, 400)
  }

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('ascendant_shop')
    .eq('player_id', playerId)
    .maybeSingle()
  if (profileErr) {
    console.error('ascendant-shop-purchase: profile lookup failed', profileErr)
    return json({ error: 'Could not load shop levels' }, 500)
  }
  const shop = (profile?.ascendant_shop ?? {}) as Record<string, number>
  const currentLevel = shop[nodeKey] ?? 0

  let cost: number
  if (nodeKey in FLAT_ASCENDANT_NODES) {
    cost = flatNodeCost(FLAT_ASCENDANT_NODES[nodeKey as FlatAscendantKind], currentLevel)
  } else {
    const dot = nodeKey.lastIndexOf('.')
    const charKey = dot > 0 ? nodeKey.slice(0, dot) : ''
    const kind = dot > 0 ? nodeKey.slice(dot + 1) : ''
    if (kind !== 'power' && kind !== 'vitality') {
      return json({ error: 'Unknown shop node' }, 400)
    }
    let exists: boolean
    try {
      exists = await characterDefExists(charKey)
    } catch (e) {
      console.error('ascendant-shop-purchase: character lookup failed', e)
      return json({ error: 'Could not validate character' }, 502)
    }
    if (!exists) return json({ error: 'Unknown character' }, 400)
    cost = charNodeCost(currentLevel)
  }

  const { data: result, error: rpcErr } = await admin.rpc('purchase_ascendant_shop_node', {
    p_player: playerId,
    p_node_key: nodeKey,
    p_cost: cost,
  })
  if (rpcErr) {
    console.error('ascendant-shop-purchase: purchase_ascendant_shop_node failed', rpcErr)
    const reason = rpcErr.message.replace(/^.*purchase_ascendant_shop_node:\s*/, '')
    return json({ error: reason || 'Could not purchase upgrade' }, 409)
  }

  return json(result, 200)
})
