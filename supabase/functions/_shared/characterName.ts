import { sanityQuery } from './sanity.ts'
import type { createAdminClient } from './supabaseAdmin.ts'

type AdminClient = ReturnType<typeof createAdminClient>

// Best-effort character display-name lookup for activity-log payloads (docs/superpowers/specs/
// 2026-09-18-activity-log-design.md) — several call sites only have a characterId, not the
// character's Sanity-authored name, and don't otherwise fetch player_characters. Never throws —
// callers treat a lookup failure the same as their own log_event failure (best-effort, never
// blocks the real action); a failure just yields the 'Unknown' fallback.
export async function fetchCharacterName(admin: AdminClient, playerId: string, characterId: string): Promise<string> {
  try {
    const { data: charRow } = await admin
      .from('player_characters')
      .select('character_def_id')
      .eq('id', characterId)
      .eq('player_id', playerId)
      .maybeSingle()
    if (!charRow) return 'Unknown'
    const def = await sanityQuery<{ name?: string } | null>(
      `*[_type == "characterDef" && charKey == $key][0]{ name }`,
      { key: charRow.character_def_id },
    )
    return def?.name ?? 'Unknown'
  } catch (e) {
    console.error('fetchCharacterName failed', e)
    return 'Unknown'
  }
}
