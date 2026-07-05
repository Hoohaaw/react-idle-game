import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// Calls the heal Edge Function — fully restores a character's HP (server-authoritative; clients can't
// write player_characters directly). Returns the updated { id, current_hp }.

export async function healCharacter(characterId: string): Promise<{ id: string; current_hp: number | null }> {
  const { data, error } = await supabase.functions.invoke('heal', { body: { characterId } })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null)
      throw new Error(body?.error ?? 'Heal failed')
    }
    throw error
  }
  return data.character
}
