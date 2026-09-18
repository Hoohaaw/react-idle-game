import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { characterDefExists, sanityQuery } from '../_shared/sanity.ts'
import { FLAT_ASCENDANT_NODES, type FlatAscendantKind } from '../../../src/lib/ascendantShop.ts'

// ascendant-shop-purchase: buy the next level of one Ascendant Shop node (ADR-0023). The cost is
// resolved authoritatively INSIDE the RPC now (supabase/migrations/20260915150000_lock_shop_purchase_price.sql),
// under the same row lock that reads the current level — a client-computed price read here,
// before the lock, would let two concurrent purchases both validate against the same
// correct-at-the-time price and both succeed off one price check (ADR-0003). This function still
// branches flat-vs-char node to validate a per-character node's charKey against Sanity (that
// can't move into SQL — it's an external content lookup); the price itself is resolved server-side.

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

  if (!(nodeKey in FLAT_ASCENDANT_NODES)) {
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
  }

  const { data: result, error: rpcErr } = await admin.rpc('purchase_ascendant_shop_node', {
    p_player: playerId,
    p_node_key: nodeKey,
  })
  if (rpcErr) {
    console.error('ascendant-shop-purchase: purchase_ascendant_shop_node failed', rpcErr)
    const reason = rpcErr.message.replace(/^.*purchase_ascendant_shop_node:\s*/, '')
    return json({ error: reason || 'Could not purchase upgrade' }, 409)
  }

  try {
    let nodeLabel: string = nodeKey
    if (nodeKey in FLAT_ASCENDANT_NODES) {
      nodeLabel = FLAT_ASCENDANT_NODES[nodeKey as FlatAscendantKind].label
    } else {
      const dot = nodeKey.lastIndexOf('.')
      const charKey = nodeKey.slice(0, dot)
      const kind = nodeKey.slice(dot + 1)
      const charDef = await sanityQuery<{ name?: string } | null>(
        `*[_type == "characterDef" && charKey == $key][0]{ name }`,
        { key: charKey },
      )
      nodeLabel = `${kind === 'power' ? 'Power' : 'Vitality'} (${charDef?.name ?? charKey})`
    }
    await admin.rpc('log_event', {
      p_player: playerId,
      p_type: 'ascendant_purchased',
      p_payload: { nodeLabel },
    })
  } catch (e) {
    console.error('activity log failed (ascendant_purchased) — continuing', e)
  }

  return json(result, 200)
})
