import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

// Browser Supabase client. The URL + anon key are publishable (safe in the client) — access
// is enforced by RLS. Local values come from `supabase start`; production from the hosted
// project. Game-state mutations go through Edge Functions, not direct table writes — see
// memory: project_data_architecture.
//
// Typed with the generated `Database` from src/types/database.types.ts — regenerate that file
// (via `supabase gen types` / the Supabase MCP) after any migration.

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY environment variables')
}

export const supabase = createClient<Database>(url, anonKey)
