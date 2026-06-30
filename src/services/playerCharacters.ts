import { supabase } from '@/lib/supabase'

// Reads the signed-in player's recruited characters. RLS scopes the rows to the caller (owner-read),
// and the client has a SELECT-only grant — writes still go through the recruit Edge Function. We only
// need which definitions are owned (to hide the Recruit button), so we project just character_def_id.

export async function fetchRecruitedDefIds(): Promise<string[]> {
  const { data, error } = await supabase.from('player_characters').select('character_def_id')
  if (error) throw error
  return data.map((row) => row.character_def_id)
}
