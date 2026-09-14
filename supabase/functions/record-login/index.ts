import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'

// record-login: bumps days_played once per UTC calendar day and runs the achievements check
// (spec 2026-09-13 §4c) — the one genuinely new write path in the achievements system, since
// nothing else in this codebase tracks player sessions. Idempotent server-side via
// profiles.last_login_date, so the client can call this on every app mount without needing a
// perfectly reliable throttle of its own (Task 12 still throttles client-side too, to avoid an
// unnecessary network call on every mount).

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

  const { data, error } = await admin.rpc('record_login', { p_player: playerId })
  if (error) {
    console.error('record_login failed', error)
    return json({ error: 'Could not record login' }, 500)
  }

  return json(data, 200)
})
