import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { maxHpByCharacter, type CharRowForHp } from '../_shared/charMaxHp.ts'
import { healState } from '../../../src/lib/infirmary.ts'

// infirmary-discharge: settle an admission (ADR-0003/0021). The server derives the healed HP
// from admitted_at + hp_at_admission with the shared engine (compute-on-read, ADR-0002) and the
// atomic `discharge_infirmary` RPC frees the bed + persists it. Early discharge = partial heal;
// fully healed writes NULL (the read path treats NULL as max HP).

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

  let body: { characterId?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const characterId = body.characterId
  if (typeof characterId !== 'string' || characterId.length === 0) {
    return json({ error: 'characterId is required' }, 400)
  }

  const { data: admission, error: admErr } = await admin
    .from('infirmary_admissions')
    .select('id, admitted_at, hp_at_admission')
    .eq('player_character_id', characterId)
    .eq('player_id', playerId)
    .maybeSingle()
  if (admErr) {
    console.error('admission lookup failed', admErr)
    return json({ error: 'Could not load admission' }, 500)
  }
  if (!admission) return json({ error: 'Character is not in the infirmary' }, 404)

  const { data: charData, error: charErr } = await admin
    .from('player_characters')
    .select('id, character_def_id, level, blessings, equipped')
    .eq('id', characterId)
    .eq('player_id', playerId)
    .maybeSingle()
  if (charErr || !charData) {
    console.error('character lookup failed', charErr)
    return json({ error: 'Could not load character' }, 500)
  }
  const char = charData as CharRowForHp

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('infirmary_level')
    .eq('player_id', playerId)
    .maybeSingle()
  if (profileErr || !profile) {
    console.error('profile lookup failed', profileErr)
    return json({ error: 'Could not load profile' }, 500)
  }

  let maxHp: number
  try {
    maxHp = (await maxHpByCharacter([char]))[char.id]
  } catch (e) {
    console.error('Sanity fetch failed', e)
    return json({ error: 'Could not load character content' }, 502)
  }

  const state = healState({
    hpAtAdmission: admission.hp_at_admission,
    admittedAtMs: new Date(admission.admitted_at).getTime(),
    nowMs: Date.now(),
    charLevel: char.level,
    infirmaryLevel: profile.infirmary_level,
    maxHp,
  })
  const newHp = state.phase === 'full' ? null : state.currentHp

  const { error: rpcErr } = await admin.rpc('discharge_infirmary', {
    p_player: playerId,
    p_char: characterId,
    p_new_current_hp: newHp,
  })
  if (rpcErr) {
    const reason = rpcErr.message.replace(/^.*discharge_infirmary:\s*/, '')
    return json({ error: reason || 'Could not discharge character' }, 409)
  }

  return json({ characterId, current_hp: newHp, phase: state.phase }, 200)
})
