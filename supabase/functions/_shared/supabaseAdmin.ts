import { createClient } from 'jsr:@supabase/supabase-js@2'

// Service-role Supabase client for use inside Edge Functions. It bypasses RLS, so it is the only
// thing allowed to write the gameplay tables (clients have SELECT-only grants). SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are injected automatically into every deployed function.
export function createAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
