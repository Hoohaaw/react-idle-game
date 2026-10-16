import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { withSentry } from '../_shared/sentry.ts'

// submit-feedback: the write boundary for the player support/feedback mailbox (TODO.md D9).
// submit_feedback enforces the 5-minute per-player cooldown and the 1000-char cap server-side
// (ADR-0003) — this Edge Function also checks both up front purely so a client-side mistake
// gets a fast, specific 400 instead of a round trip to find out.

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(withSentry(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  const admin = createAdminClient()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
  const playerId = userData.user.id

  let body: { message?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (message.length === 0) return json({ error: 'Message is required' }, 400)
  if (message.length > 1000) return json({ error: 'Message is too long (max 1000 characters)' }, 400)

  const { data, error: rpcErr } = await admin.rpc('submit_feedback', {
    p_player: playerId,
    p_message: message,
  })
  if (rpcErr) {
    const reason = rpcErr.message.replace(/^.*submit_feedback:\s*/, '')
    const status = reason.includes('wait') ? 429 : 400
    return json({ error: reason || 'Could not submit feedback' }, status)
  }

  return json(data, 201)
}))
