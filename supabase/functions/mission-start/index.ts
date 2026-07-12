import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'

// mission-start: dispatch a party on a mission (ADR-0003 server-authoritative write). Validates the
// caller, resolves the mission's authored duration from Sanity (the client is NOT trusted for it), and
// hands off to the atomic `start_mission` RPC which owns party validation (owned / not-downed / not-busy
// / size 1..3) + the insert under a row lock. See ADR-0016.

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

  let body: { missionDefId?: unknown; party?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const missionDefId = body.missionDefId
  const party = body.party
  if (typeof missionDefId !== 'string' || missionDefId.length === 0) {
    return json({ error: 'missionDefId is required' }, 400)
  }
  if (!Array.isArray(party) || party.length < 1 || party.length > 3 || !party.every((p) => typeof p === 'string')) {
    return json({ error: 'party must be 1–3 character ids' }, 400)
  }

  // Authored mission duration + map/stage placement (server-trusted). Also validates the mission
  // exists. `prevMapKey` = the map immediately before this mission's map in world order — the RPC
  // gates on its boss being cleared (ADR-0034); null for the first map or unplaced legacy missions.
  type MissionDef = {
    durationSeconds?: number
    stage?: number
    map?: { mapKey?: string; order?: number; prevMapKey?: string | null } | null
  }
  let def: MissionDef | null
  try {
    def = await sanityQuery<MissionDef | null>(
      `*[_type == "missionDef" && missionKey == $id][0]{
        durationSeconds, stage,
        "map": map->{
          mapKey, order,
          "prevMapKey": *[_type == "mapDef" && order < ^.order] | order(order desc)[0].mapKey
        }
      }`,
      { id: missionDefId },
    )
  } catch (e) {
    console.error('Sanity mission lookup failed', e)
    return json({ error: 'Could not validate mission' }, 502)
  }
  if (!def) return json({ error: 'Unknown mission' }, 404)
  if (typeof def.durationSeconds !== 'number' || def.durationSeconds < 1) {
    return json({ error: 'Mission has no valid duration' }, 500)
  }

  const { data: run, error: rpcErr } = await admin.rpc('start_mission', {
    p_player: playerId,
    p_mission_def_id: missionDefId,
    p_party: party as string[],
    p_duration_seconds: def.durationSeconds,
    p_map_key: def.map?.mapKey ?? null,
    p_stage: def.stage ?? null,
    p_prev_map_key: def.map?.prevMapKey ?? null,
  })

  if (rpcErr) {
    // The RPC raises 'start_mission: <reason>' for every validation failure (owned/downed/busy/size).
    const reason = rpcErr.message.replace(/^.*start_mission:\s*/, '')
    return json({ error: reason || 'Could not start mission' }, 409)
  }

  return json({ run }, 201)
})
