import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { MINE_BY_RESOURCE } from '../../../src/lib/gather.ts'

// gather-start: assign a character to a mine (ADR-0003 server-authoritative write, ADR-0019). Validates the
// caller + that the resource is a known mine (config is code — src/lib/gather.ts), then hands off to the
// atomic `start_gather` RPC which owns character validation (owned / not-downed / not-busy / one-per-node)
// + the insert under a row lock.

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

  let body: { characterId?: unknown; resourceId?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const characterId = body.characterId
  const resourceId = body.resourceId
  if (typeof characterId !== 'string' || characterId.length === 0) {
    return json({ error: 'characterId is required' }, 400)
  }
  if (typeof resourceId !== 'string' || !MINE_BY_RESOURCE[resourceId]) {
    return json({ error: 'Unknown mine' }, 404)
  }

  const { data: assignment, error: rpcErr } = await admin.rpc('start_gather', {
    p_player: playerId,
    p_char: characterId,
    p_resource_id: resourceId,
  })

  if (rpcErr) {
    // The RPC raises 'start_gather: <reason>' for every validation failure (owned/downed/busy/one-per-node).
    const reason = rpcErr.message.replace(/^.*start_gather:\s*/, '')
    return json({ error: reason || 'Could not start gathering' }, 409)
  }

  return json({ assignment }, 201)
})
