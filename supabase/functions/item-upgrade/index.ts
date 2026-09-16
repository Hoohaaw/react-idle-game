import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'

// item-upgrade: atomic batch rarity upgrade of inventory stacks (5× rarity → 1× next).
// The client computes which ops are needed (via cascade() in src/lib/upgrade.ts) and
// sends them here for server-side validation + persistence (ADR-0003).

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

  let body: { ops?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (!Array.isArray(body.ops) || body.ops.length === 0) {
    return json({ error: 'ops must be a non-empty array' }, 400)
  }

  for (const op of body.ops as unknown[]) {
    if (
      typeof (op as Record<string, unknown>)?.itemDefId !== 'string' ||
      typeof (op as Record<string, unknown>)?.fromRarity !== 'string' ||
      typeof (op as Record<string, unknown>)?.consumeCount !== 'number' ||
      !Number.isInteger((op as Record<string, unknown>).consumeCount)
    ) return json({ error: 'Invalid op shape' }, 400)
  }

  // Remap camelCase from the client to snake_case for the RPC.
  const ops = (body.ops as Array<{ itemDefId: string; fromRarity: string; consumeCount: number }>)
    .map((op) => ({
      item_def_id:   op.itemDefId,
      from_rarity:   op.fromRarity,
      consume_count: op.consumeCount,
    }))

  // The RPC processes a batch where each op produces a variable number of upgraded items
  // (consumeCount / 5) — unlike the other lifetime-stats RPCs, which always increment by a
  // fixed amount per call, this function decides the total count and the RPC stays a dumb
  // generic applier. Safe to compute pre-validation: the whole transaction rolls back on any
  // raise exception, so an invalid op means nothing commits, including this delta.
  const itemsUpgraded = ops.reduce((sum, op) => sum + Math.floor(op.consume_count / 5), 0)

  const { error: rpcErr } = await admin.rpc('upgrade_items', {
    p_player: playerId,
    p_ops:    ops,
    p_lifetime_stats: { itemsUpgraded },
  })
  if (rpcErr) {
    const reason = rpcErr.message.replace(/^.*upgrade_items:\s*/, '')
    return json({ error: reason || 'Could not upgrade items' }, 409)
  }

  return json({ ok: true }, 200)
})
