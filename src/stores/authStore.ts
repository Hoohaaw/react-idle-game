import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// Global session store — the single source of truth for "is the player signed in?".
// `status` starts at 'loading' so the app can show a loader until the initial getSession()
// resolves, avoiding an auth-screen flash for already-signed-in users.

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

type AuthState = {
  status: AuthStatus
  session: Session | null
  user: User | null
}

export const useAuthStore = create<AuthState>(() => ({
  status: 'loading',
  session: null,
  user: null,
}))

function setSession(session: Session | null) {
  useAuthStore.setState({
    session,
    user: session?.user ?? null,
    status: session ? 'authenticated' : 'anonymous',
  })
}

// Call once at app startup (see main.tsx). Loads the persisted session, then keeps the store in
// sync with every auth event (sign-in, sign-out, token refresh, confirmation).
export function initAuth() {
  void supabase.auth.getSession().then(({ data }) => setSession(data.session))
  supabase.auth.onAuthStateChange((_event, session) => setSession(session))
}
