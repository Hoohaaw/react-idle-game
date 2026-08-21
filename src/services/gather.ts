import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'
import { invokeError } from './_invoke'

// The Gathering data layer:
//  - Mine CONFIG (interval/yield per resource) is code — src/lib/gather.ts (shared with the Edge Functions).
//  - RUNTIME state (active gather_assignments) is read from Supabase (RLS owner-scoped, SELECT-only).
//  - WRITES (assign / collect / stop) go through the server-authoritative Edge Functions (ADR-0003).

export type GatherAssignment = Tables<'gather_assignments'>

export async function fetchGatherAssignments(): Promise<GatherAssignment[]> {
  const { data, error } = await supabase
    .from('gather_assignments')
    .select('*')
    .order('started_at', { ascending: true })
  if (error) throw error
  return data
}

export async function startGather(characterId: string, resourceId: string): Promise<GatherAssignment> {
  const { data, error } = await supabase.functions.invoke('gather-start', {
    body: { characterId, resourceId },
  })
  if (error) await invokeError(error, 'Could not start gathering')
  return data.assignment as GatherAssignment
}

export type CollectResult = {
  gained: number
  resource: string
  stopped: boolean
  newlyUnlocked: { charKey: string; name: string; role: string | null }[]
}

export async function collectGather(assignmentId: string, stop = false): Promise<CollectResult> {
  const { data, error } = await supabase.functions.invoke('gather-collect', {
    body: { assignmentId, stop },
  })
  if (error) await invokeError(error, 'Could not collect')
  return data as CollectResult
}
