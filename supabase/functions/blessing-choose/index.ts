import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'

// blessing-choose: pick one of the two choices for a blessing row (ADR-0045), permanent. No
// Sanity fetch — unlike gear (which needs the itemDef's authored slot/minLevel), a blessing pick
// is just player intent; row/choice validity and the level + strict-sequence gate are fixed
// engine constants the `choose_blessing` RPC already knows (compute-on-read, ADR-0002). This
// function only authenticates, validates shape, and translates the RPC's error.

const ROWS = ['row1', 'row2', 'row3', 'row4']
const CHOICES = ['a', 'b']

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

  let body: { characterId?: unknown; row?: unknown; choice?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const { characterId, row, choice } = body
  if (typeof characterId !== 'string' || characterId.length === 0) {
    return json({ error: 'characterId is required' }, 400)
  }
  if (typeof row !== 'string' || !ROWS.includes(row)) {
    return json({ error: 'row must be one of ' + ROWS.join(', ') }, 400)
  }
  if (typeof choice !== 'string' || !CHOICES.includes(choice)) {
    return json({ error: 'choice must be one of ' + CHOICES.join(', ') }, 400)
  }

  const { data, error: rpcErr } = await admin.rpc('choose_blessing', {
    p_player: playerId,
    p_char: characterId,
    p_row: row,
    p_choice: choice,
  })
  if (rpcErr) {
    // choose_blessing raises 'choose_blessing: <reason>' for every validation failure
    // (level/sequence/already-chosen/busy).
    const reason = rpcErr.message.replace(/^.*choose_blessing:\s*/, '')
    return json({ error: reason || 'Could not choose blessing' }, 409)
  }

  return json(data, 200)
})
