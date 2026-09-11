import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'
import { isResetGateMet } from '../../../src/lib/reset.ts'

// reset-player: the soft-reset action (ADR-0053). Validates the caller, checks the gate (the
// order-1 map's boss cleared) against the player's OWN profile — a UX gate, not a security
// boundary; reset_player itself doesn't re-check it (nothing bad happens if bypassed beyond
// "reset with fewer stages cleared than intended," which only costs the player who did it) —
// then hands off to the atomic reset_player RPC, which recomputes the award from the player's
// OWN locked profile row (never from numbers this function could pass in) and owns the wipe.

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

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('map_progress')
    .eq('player_id', playerId)
    .maybeSingle()
  if (profileErr) {
    console.error('reset-player: profile lookup failed', profileErr)
    return json({ error: 'Could not load profile' }, 500)
  }
  const mapProgress = (profile?.map_progress ?? {}) as Record<string, number>

  let gateMap: { mapKey?: string } | null
  try {
    gateMap = await sanityQuery<{ mapKey?: string } | null>(
      `*[_type == "mapDef" && order == 1][0]{ mapKey }`,
    )
  } catch (e) {
    console.error('reset-player: gate map lookup failed', e)
    return json({ error: 'Could not validate reset eligibility' }, 502)
  }
  if (!gateMap?.mapKey) return json({ error: 'No starter map configured' }, 500)

  const gateStageCleared = mapProgress[gateMap.mapKey] ?? 0
  if (!isResetGateMet(gateStageCleared)) {
    return json({ error: "Clear the first map's boss before resetting" }, 403)
  }

  const { data: result, error: rpcErr } = await admin.rpc('reset_player', {
    p_player: playerId,
  })
  if (rpcErr) {
    console.error('reset-player: reset_player failed', rpcErr)
    const reason = rpcErr.message.replace(/^.*reset_player:\s*/, '')
    return json({ error: reason || 'Could not reset' }, 409)
  }

  return json(result, 200)
})
