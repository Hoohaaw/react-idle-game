import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'

// transcend-player: the hard-reset action (ADR-0023). Validates the caller, checks the gate
// (every currently-authored raid cleared at least once, ever — a permanent lifetime_stats flag,
// since group_runs itself is wiped by every Reset, spec §5a), then hands off to the atomic
// transcend_player RPC, which recomputes the Ascendant Shard award from the player's OWN locked
// profile row (never from numbers this function could pass in) and owns the wipe.

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

  let body: { protectedIds?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const protectedIds = body.protectedIds
  if (protectedIds !== undefined && (!Array.isArray(protectedIds) || !protectedIds.every((p) => typeof p === 'string'))) {
    return json({ error: 'protectedIds must be an array of character ids' }, 400)
  }

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('lifetime_stats')
    .eq('player_id', playerId)
    .maybeSingle()
  if (profileErr) {
    console.error('transcend-player: profile lookup failed', profileErr)
    return json({ error: 'Could not load profile' }, 500)
  }
  const lifetimeStats = (profile?.lifetime_stats ?? {}) as Record<string, number>

  let raidKeys: string[]
  try {
    raidKeys = await sanityQuery<string[]>(`*[_type == "raidDef"].raidKey`)
  } catch (e) {
    console.error('transcend-player: raid list lookup failed', e)
    return json({ error: 'Could not validate transcend eligibility' }, 502)
  }
  const missingRaids = raidKeys.filter((key) => !lifetimeStats[`raidCleared.${key}`])
  if (missingRaids.length > 0) {
    return json({ error: 'Clear every raid before Transcending', missingRaids }, 403)
  }

  const { data: result, error: rpcErr } = await admin.rpc('transcend_player', {
    p_player: playerId,
    p_protected_ids: protectedIds ?? [],
  })
  if (rpcErr) {
    console.error('transcend-player: transcend_player failed', rpcErr)
    const reason = rpcErr.message.replace(/^.*transcend_player:\s*/, '')
    return json({ error: reason || 'Could not transcend' }, 409)
  }

  return json(result, 200)
})
