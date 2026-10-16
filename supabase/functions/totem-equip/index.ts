import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'
import { withSentry } from '../_shared/sentry.ts'

// totem-equip: swap the player's single account-level totem slot (design spec §E). No
// busy-check (not scoped to any one character, unlike gear's equip_item) — free to swap
// anytime. Existence of the totemDef is validated here via Sanity, the same split every
// other content-referencing write in this codebase uses; equip_totem itself only writes.

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(withSentry(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  const admin = createAdminClient()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
  const playerId = userData.user.id

  let body: { totemDefId?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const totemDefId = body.totemDefId
  if (typeof totemDefId !== 'string' || totemDefId.length === 0) {
    return json({ error: 'totemDefId is required' }, 400)
  }

  try {
    const def = await sanityQuery<{ totemKey: string } | null>(
      `*[_type == "totemDef" && totemKey == $id][0]{ totemKey }`,
      { id: totemDefId },
    )
    if (!def) return json({ error: 'Unknown totem' }, 404)
  } catch (e) {
    console.error('Sanity totemDef lookup failed', e)
    return json({ error: 'Could not validate totem' }, 502)
  }

  const { data, error: rpcErr } = await admin.rpc('equip_totem', {
    p_player: playerId,
    p_totem_def_id: totemDefId,
  })
  if (rpcErr) {
    const reason = rpcErr.message.replace(/^.*equip_totem:\s*/, '')
    return json({ error: reason || 'Could not equip totem' }, 409)
  }

  return json({ activeTotemId: data }, 200)
}))
