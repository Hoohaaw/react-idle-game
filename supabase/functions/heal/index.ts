import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'

// heal: fully restore a character's HP (server-authoritative write, ADR-0003). Clients have a
// SELECT-only grant on player_characters, so healing goes through here. "Fully heal" = set current_hp
// to NULL, which the read path treats as max HP (ADR-0013). First-pass infirmary: instant + free
// (heal rate / resource cost / capacity are future tuning).

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

  // Scoped to the caller's own character; service role bypasses RLS but player_id keeps it owner-only.
  const { data, error } = await admin
    .from('player_characters')
    .update({ current_hp: null })
    .eq('id', characterId)
    .eq('player_id', playerId)
    .select('id, current_hp')
    .maybeSingle()

  if (error) {
    console.error('heal failed', error)
    return json({ error: 'Could not heal character' }, 500)
  }
  if (!data) return json({ error: 'Character not found' }, 404)

  return json({ character: data }, 200)
})
