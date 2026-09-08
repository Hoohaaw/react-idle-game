import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'
import { GROUP_PARTY_CAP, GROUP_LOCKOUT, type GroupKind } from '../../../src/lib/groupContent.ts'

// group-start-stage: dispatch the CURRENT stage of a dungeon/raid run (ADR-0003 server-authoritative
// write; docs/superpowers/specs/2026-09-08-dungeons-and-raids-design.md §5). Mirrors mission-start's
// shape: validate the caller, resolve authored content from Sanity (client not trusted for duration
// or stage count), hand off to the atomic start_group_stage RPC.

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type GroupDef = { stages?: { durationSeconds?: number }[] } | null

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  const admin = createAdminClient()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
  const playerId = userData.user.id

  let body: { kind?: unknown; defKey?: unknown; party?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const kind = body.kind
  const defKey = body.defKey
  const party = body.party
  if (kind !== 'dungeon' && kind !== 'raid') return json({ error: 'kind must be "dungeon" or "raid"' }, 400)
  if (typeof defKey !== 'string' || defKey.length === 0) return json({ error: 'defKey is required' }, 400)
  const cap = GROUP_PARTY_CAP[kind as GroupKind]
  if (!Array.isArray(party) || party.length < 1 || party.length > cap || !party.every((p) => typeof p === 'string')) {
    return json({ error: `party must be 1–${cap} character ids` }, 400)
  }

  // How many stages has this run already cleared? (group_runs row may not exist yet.)
  const { data: run } = await admin
    .from('group_runs')
    .select('current_stage_index, status')
    .eq('player_id', playerId)
    .eq('kind', kind)
    .eq('def_key', defKey)
    .maybeSingle()
  const stageIndex = run?.status === 'complete' ? 0 : (run?.current_stage_index ?? 0)

  const sanityType = kind === 'dungeon' ? 'dungeonDef' : 'raidDef'
  const keyField = kind === 'dungeon' ? 'dungeonKey' : 'raidKey'
  let def: GroupDef
  try {
    def = await sanityQuery<GroupDef>(
      `*[_type == "${sanityType}" && ${keyField} == $key][0]{ stages[]{ durationSeconds } }`,
      { key: defKey },
    )
  } catch (e) {
    console.error('Sanity group-content lookup failed', e)
    return json({ error: 'Could not validate content' }, 502)
  }
  if (!def || !def.stages) return json({ error: 'Unknown dungeon or raid' }, 404)
  const stage = def.stages[stageIndex]
  if (!stage || typeof stage.durationSeconds !== 'number' || stage.durationSeconds < 1) {
    return json({ error: 'Stage has no valid duration' }, 500)
  }

  const { data: groupRun, error: rpcErr } = await admin.rpc('start_group_stage', {
    p_player: playerId,
    p_kind: kind,
    p_def_key: defKey,
    p_party: party,
    p_stage_index: stageIndex,
    p_total_stages: def.stages.length,
    p_duration_seconds: stage.durationSeconds,
    p_lockout: GROUP_LOCKOUT[kind as GroupKind],
  })

  if (rpcErr) {
    const reason = rpcErr.message.replace(/^.*start_group_stage:\s*/, '')
    return json({ error: reason || 'Could not start stage' }, 409)
  }

  return json({ run: groupRun }, 201)
})
