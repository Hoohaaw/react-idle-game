import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { characterDefExists } from '../_shared/sanity.ts'

// recruit: the first server-authoritative write. Adds one player_characters row for the signed-in
// player from a chosen characterDefId. The client has no INSERT grant on the table — every write
// goes through here (ADR-0003). Validates the def exists in Sanity first (anti-tamper: you can only
// recruit a real authored character), and relies on the UNIQUE(player_id, character_def_id)
// constraint to enforce "one of each character, ever" (no dupes).

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // 1. Authenticate the caller from the bearer token.
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  const admin = createAdminClient()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
  const playerId = userData.user.id

  // 2. Parse + validate the request body.
  let body: { characterDefId?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const characterDefId = body.characterDefId
  if (typeof characterDefId !== 'string' || characterDefId.length === 0) {
    return json({ error: 'characterDefId is required' }, 400)
  }

  // 3. The character must be a real authored definition.
  let exists: boolean
  try {
    exists = await characterDefExists(characterDefId)
  } catch (e) {
    console.error('Sanity validation failed', e)
    return json({ error: 'Could not validate character' }, 502)
  }
  if (!exists) return json({ error: 'Unknown character' }, 404)

  // 4. Insert the owned-character row (service role bypasses RLS).
  const { data: row, error: insertErr } = await admin
    .from('player_characters')
    .insert({ player_id: playerId, character_def_id: characterDefId })
    .select()
    .single()

  if (insertErr) {
    if (insertErr.code === '23505') return json({ error: 'Character already recruited' }, 409)
    console.error('Insert failed', insertErr)
    return json({ error: 'Could not recruit character' }, 500)
  }

  return json({ character: row }, 201)
})
