import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'

// recruit: the atomic acquisition write (ADR-0003, docs/superpowers/specs/2026-08-20-character-
// acquisition-design.md §7). Fetches the character's acquisition (goldCost + whether it has an
// unlock condition) from Sanity, then hands off to the recruit_character RPC, which re-validates
// eligibility + gold server-side and does the atomic deduct+insert. Replaces the old zero-gate bare
// insert.

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type AcquisitionRow = {
  charKey: string
  acquisition?: { goldCost?: number; condition?: { type?: string } } | null
}

const ACQUISITION_GROQ = `*[_type == "characterDef" && charKey == $key][0]{
  charKey, acquisition{ goldCost, condition{ type } }
}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  const admin = createAdminClient()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
  const playerId = userData.user.id

  let body: { characterDefId?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  // NOTE: despite the field name, this is the character's charKey — the client/service layer names
  // it characterDefId for historical reasons (see src/services/recruit.ts), unchanged by this task.
  const characterDefId = body.characterDefId
  if (typeof characterDefId !== 'string' || characterDefId.length === 0) {
    return json({ error: 'characterDefId is required' }, 400)
  }

  let row: AcquisitionRow | null
  try {
    row = await sanityQuery<AcquisitionRow | null>(ACQUISITION_GROQ, { key: characterDefId })
  } catch (e) {
    console.error('Sanity acquisition lookup failed', e)
    return json({ error: 'Could not validate character' }, 502)
  }
  if (!row?.acquisition || typeof row.acquisition.goldCost !== 'number') {
    return json({ error: 'Unknown character' }, 404)
  }
  const goldCost = row.acquisition.goldCost
  const conditionExists = row.acquisition.condition != null

  const { data: charRow, error: rpcErr } = await admin.rpc('recruit_character', {
    p_player: playerId,
    p_character_def_id: characterDefId,
    p_char_key: characterDefId,
    p_gold_cost: goldCost,
    p_condition_exists: conditionExists,
  })

  if (rpcErr) {
    if (rpcErr.code === '23505') return json({ error: 'Character already recruited' }, 409)
    const reason = rpcErr.message.replace(/^.*recruit_character:\s*/, '')
    if (reason.includes('not unlocked')) return json({ error: reason }, 403)
    if (reason.includes('insufficient gold')) return json({ error: reason }, 402)
    console.error('recruit_character failed', rpcErr)
    return json({ error: reason || 'Could not recruit character' }, 500)
  }

  return json({ character: charRow }, 201)
})
