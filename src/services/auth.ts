import { supabase } from '@/lib/supabase'

// Thin wrappers over supabase.auth for email + password auth. Each throws the Supabase
// AuthError on failure so callers (TanStack mutations / form handlers) can surface the message.
// Session state itself is tracked in src/stores/authStore.ts, which subscribes to auth events.

type Credentials = { email: string; password: string }

// Registers a new user. With email confirmation ON (Supabase default), `data.session` is null
// until the user clicks the confirmation link; with it OFF, a session is returned immediately and
// the store's onAuthStateChange listener signs them straight in.
export async function signUp({ email, password }: Credentials) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function signIn({ email, password }: Credentials) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
