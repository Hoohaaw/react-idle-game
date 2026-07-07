import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { maxHpByCharacter, type CharRowForHp } from '../_shared/charMaxHp.ts'
import { bedsForLevel } from '../../../src/lib/infirmary.ts'

// infirmary-admit: put a damaged character in an infirmary bed (ADR-0003/0021). Validates the
// caller + that the character actually has HP to recover, then hands off to the atomic
// `admit_infirmary` RPC which owns ownership / not-busy / bed-capacity checks under a row lock.
// Healing itself is compute-on-read — admission just records admitted_at + hp_at_admission.

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

  const { data: charData, error: charErr } = await admin
    .from('player_characters')
    .select('id, character_def_id, level, blessings, equipped, current_hp')
    .eq('id', characterId)
    .eq('player_id', playerId)
    .maybeSingle()
  if (charErr) {
    console.error('character lookup failed', charErr)
    return json({ error: 'Could not load character' }, 500)
  }
  if (!charData) return json({ error: 'Character not found' }, 404)
  const char = charData as CharRowForHp & { current_hp: number | null }
  if (char.current_hp === null) return json({ error: 'Character is already at full health' }, 409)

  let maxHp: number
  try {
    maxHp = (await maxHpByCharacter([char]))[char.id]
  } catch (e) {
    console.error('Sanity fetch failed', e)
    return json({ error: 'Could not load character content' }, 502)
  }
  if (char.current_hp >= maxHp) return json({ error: 'Character is already at full health' }, 409)

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('infirmary_level')
    .eq('player_id', playerId)
    .maybeSingle()
  if (profileErr || !profile) {
    console.error('profile lookup failed', profileErr)
    return json({ error: 'Could not load profile' }, 500)
  }

  const { data: admission, error: rpcErr } = await admin.rpc('admit_infirmary', {
    p_player: playerId,
    p_char: characterId,
    p_max_beds: bedsForLevel(profile.infirmary_level),
  })
  if (rpcErr) {
    // The RPC raises 'admit_infirmary: <reason>' for every validation failure (owned/busy/beds).
    const reason = rpcErr.message.replace(/^.*admit_infirmary:\s*/, '')
    return json({ error: reason || 'Could not admit character' }, 409)
  }

  return json({ admission }, 201)
})
