import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'

// username-available: the one deliberately UNAUTHENTICATED Edge Function in this codebase (see
// verify_jwt = false in supabase/config.toml). Every other function requires a signed-in caller
// because it reads/writes that player's own row; this one runs on the register form BEFORE any
// account exists, so there is no session to check. It only ever returns a boolean — no data that
// isn't already implied by "is this name taken" — and the real guard against a duplicate is still
// the unique index on profiles.username (see supabase/migrations/20260915120000_profiles_username.sql).
// This is a UX nicety, not the source of truth.

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const { username } = await req.json().catch(() => ({}))
  if (typeof username !== 'string' || username.length === 0) {
    return json({ error: 'Missing username' }, 400)
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('username_available', { p_username: username })
  if (error) {
    console.error('username_available failed', error)
    return json({ error: 'Could not check username' }, 500)
  }

  return json({ available: data }, 200)
})
