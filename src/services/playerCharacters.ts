import { supabase } from '@/lib/supabase'

// Reads the signed-in player's recruited characters. RLS scopes the rows to the caller (owner-read),
// and the client has a SELECT-only grant — writes still go through the recruit Edge Function. We only
// need which definitions are owned (to hide the Recruit button), so we project just character_def_id.

export async function fetchRecruitedDefIds(): Promise<string[]> {
  const { data, error } = await supabase.from('player_characters').select('character_def_id')
  if (error) throw error
  return data.map((row) => row.character_def_id)
}

// The player's owned characters with the runtime intent the roster/dispatch needs (level/xp + the
// blessing & equip maps for computing effective stats, and persisted current_hp). JSONB columns come
// back as `Json`; we narrow them to the shapes the stat engine expects.
export type EquippedItem = { itemDefId: string; rarity: string }
export type OwnedCharacter = {
  id: string
  characterDefId: string
  level: number
  xp: number
  blessings: Record<string, number>
  equipped: Record<string, EquippedItem>
  currentHp: number | null
}

export async function fetchOwnedCharacters(): Promise<OwnedCharacter[]> {
  const { data, error } = await supabase
    .from('player_characters')
    .select('id, character_def_id, level, xp, blessings, equipped, current_hp')
  if (error) throw error
  return data.map((row) => ({
    id: row.id,
    characterDefId: row.character_def_id,
    level: row.level,
    xp: row.xp,
    blessings: (row.blessings ?? {}) as Record<string, number>,
    equipped: (row.equipped ?? {}) as Record<string, EquippedItem>,
    currentHp: row.current_hp,
  }))
}

// Character ids currently gathering (busy, can't be dispatched). Missions-busy is derived from the
// mission_runs feed the roster already loads.
export async function fetchGatherCharacterIds(): Promise<string[]> {
  const { data, error } = await supabase.from('gather_assignments').select('player_character_id')
  if (error) throw error
  return data.map((row) => row.player_character_id)
}
