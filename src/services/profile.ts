import { supabase } from '@/lib/supabase'

// The player's account wallet + scalars, read from `profiles` (RLS owner-read, SELECT-only grant).
// Balances are JSONB maps keyed by the code registries (currencies -> src/lib/currencies.ts;
// resources -> src/lib/resources.ts); an absent key means a zero balance. All WRITES happen
// server-side (Edge Functions / claim_mission) — the client only reads this (ADR-0003).

export type PlayerProfile = {
  currencies: Record<string, number>
  resources: Record<string, number>
  transcendenceCount: number
}

export async function fetchProfile(): Promise<PlayerProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('currencies, resources, transcendence_count')
    .maybeSingle()
  if (error) throw error
  return {
    currencies: (data?.currencies ?? {}) as Record<string, number>,
    resources: (data?.resources ?? {}) as Record<string, number>,
    transcendenceCount: data?.transcendence_count ?? 0,
  }
}
