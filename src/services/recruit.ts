import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'

// Calls the recruit Edge Function — the server-authoritative write that adds an owned character.
// The client cannot insert into player_characters directly (SELECT-only grant), so this is the path.

export type RecruitedCharacter = Tables<'player_characters'>

export async function recruitCharacter(characterDefId: string): Promise<RecruitedCharacter> {
  const { data, error } = await supabase.functions.invoke('recruit', {
    body: { characterDefId },
  })

  if (error) {
    // A non-2xx response arrives as FunctionsHttpError; surface the function's { error } message
    // (e.g. "Character already recruited") rather than a generic one.
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null)
      throw new Error(body?.error ?? 'Recruit failed')
    }
    throw error
  }

  return data.character as RecruitedCharacter
}
