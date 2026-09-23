import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'

// craft-cancel: abandon the player's in-progress (or finished-but-unclaimed) craft and refund every
// reagent it spent, in full. Mirrors craft-claim's auth/lookup shape but simpler — no Sanity lookup,
// no rng/roll, no lifetime-stats; the cancel_craft RPC owns the refund and atomically deletes the
// run. Safe to offer a full refund because roll_seed (the claim-time rarity roll's seed) is a
// server-only column the client cannot read (20260923100000_craft_cancel.sql), so cancelling and
// restarting cannot be used to predict or re-roll the result — see that migration and
// craft-claim/index.ts for the full exploit rationale.

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

  let body: { recipeDefId?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const recipeDefId = body.recipeDefId
  if (typeof recipeDefId !== 'string' || recipeDefId.length === 0) return json({ error: 'recipeDefId is required' }, 400)

  const { error: rpcErr } = await admin.rpc('cancel_craft', { p_player: playerId, p_recipe_def_id: recipeDefId })
  if (rpcErr) {
    const reason = rpcErr.message.replace(/^.*cancel_craft:\s*/, '')
    return json({ error: reason || 'Could not cancel the craft' }, 409)
  }

  return json({ ok: true }, 200)
})
