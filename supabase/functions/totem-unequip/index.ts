import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { withSentry } from '../_shared/sentry.ts'

// totem-unequip: clear the player's account-level totem slot back to none.

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

  const { error: rpcErr } = await admin.rpc('unequip_totem', { p_player: playerId })
  if (rpcErr) {
    const reason = rpcErr.message.replace(/^.*unequip_totem:\s*/, '')
    return json({ error: reason || 'Could not unequip totem' }, 409)
  }

  return json({ ok: true }, 200)
}))
