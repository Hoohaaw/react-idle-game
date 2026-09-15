// supabase/functions/skill-start/index.ts
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { SKILL_BY_KEY } from '../../../src/lib/skills.ts'

// skill-start: assign a character to train a skill (ADR-0003 server-authoritative write). Validates
// the caller + that the skill is known (config is code — src/lib/skills.ts), then hands off to the
// atomic `start_skill` RPC which owns character validation (owned / not-downed / not-busy) + the
// insert under a row lock.

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

  let body: { characterId?: unknown; skillKey?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const characterId = body.characterId
  const skillKey = body.skillKey
  if (typeof characterId !== 'string' || characterId.length === 0) {
    return json({ error: 'characterId is required' }, 400)
  }
  if (typeof skillKey !== 'string' || !SKILL_BY_KEY[skillKey]) {
    return json({ error: 'Unknown skill' }, 404)
  }

  const { data: assignment, error: rpcErr } = await admin.rpc('start_skill', {
    p_player: playerId,
    p_char: characterId,
    p_skill_key: skillKey,
  })

  if (rpcErr) {
    // The RPC raises 'start_skill: <reason>' for every validation failure.
    const reason = rpcErr.message.replace(/^.*start_skill:\s*/, '')
    return json({ error: reason || 'Could not start training' }, 409)
  }

  return json({ assignment }, 201)
})
