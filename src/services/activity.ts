import { supabase } from '@/lib/supabase'
import type { PlayerEvent, EventType } from '@/lib/events'

// The player's activity feed, read directly from player_events (RLS owner-read, SELECT-only grant
// — ADR-0003). Already capped at 200 rows server-side by log_event, so one query is the whole feed;
// no pagination. Newest first.
export async function fetchActivity(): Promise<PlayerEvent[]> {
  const { data, error } = await supabase
    .from('player_events')
    .select('id, type, payload, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id as string,
    type: row.type as EventType,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    createdAt: row.created_at as string,
  }))
}
