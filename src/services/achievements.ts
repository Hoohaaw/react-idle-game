import { supabase } from '@/lib/supabase'
import { invokeError } from './_invoke'

// Achievements data layer (spec 2026-09-13) — the one Edge Function call this feature needs.
// Everything else (the registry, the claimed-map, the counters) is read via useProfile().

export async function recordLogin(): Promise<{ daysPlayed: number; newlyClaimed: string[] }> {
  const { data, error } = await supabase.functions.invoke('record-login', { body: {} })
  if (error) await invokeError(error, 'Could not record login')
  return data as { daysPlayed: number; newlyClaimed: string[] }
}
