import { supabase } from '@/lib/supabase'

// Thin wrappers over supabase.auth for email + password auth. Each throws the Supabase
// AuthError on failure so callers (TanStack mutations / form handlers) can surface the message.
// Session state itself is tracked in src/stores/authStore.ts, which subscribes to auth events.

type Credentials = { email: string; password: string }
type SignUpCredentials = Credentials & { username: string }

// Registers a new user. With email confirmation ON (Supabase default), `data.session` is null
// until the user clicks the confirmation link; with it OFF, a session is returned immediately and
// the store's onAuthStateChange listener signs them straight in.
//
// `username` rides in as signup metadata (`options.data`), landing in `auth.users.
// raw_user_meta_data` — the `handle_new_user()` trigger reads it from there to populate
// `profiles.username` (see supabase/migrations/20260915120000_profiles_username.sql). Callers
// should call `checkUsernameAvailable` first for a friendly pre-check; this still guards against
// the rare same-instant race by turning the trigger's unique-index violation into the same
// friendly message instead of Supabase's generic "Database error saving new user".
export async function signUp({ email, password, username }: SignUpCredentials) {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } })
  if (error) {
    if (error.message.toLowerCase().includes('profiles_username_lower_idx')) {
      throw new Error('That username is already taken.')
    }
    throw error
  }
  // Supabase returns 200 with no error and an empty `identities` array (not an error code) when
  // the email already belongs to a confirmed account — anti-enumeration behavior, so it can't say
  // "email taken" at the API level. Without this check the caller treats it as a normal signup and
  // shows "check your email", but no email is actually sent.
  if (data.user && data.user.identities?.length === 0) {
    throw new Error('An account with that email already exists. Try signing in instead.')
  }
  return data
}

// Pre-signup availability check, via the username-available Edge Function — the register form
// runs anon (no session yet), and every RPC in this project is service_role-only (ADR-0003), so
// this can't call the RPC directly; the function is this codebase's one deliberately
// unauthenticated Edge Function (verify_jwt = false in supabase/config.toml). A UX nicety, not
// the source of truth: the unique index on profiles is what actually prevents a duplicate.
export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke<{ available: boolean }>('username-available', {
    body: { username },
  })
  if (error) throw error
  return data?.available ?? false
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
