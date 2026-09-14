import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'
import { invokeError } from './_invoke'

// The Skill-training data layer:
//  - Skill CONFIG (interval/xp per skill) is code — src/lib/skills.ts (shared with the Edge Functions).
//  - RUNTIME state (active skill_assignments) is read from Supabase (RLS owner-scoped, SELECT-only).
//  - WRITES (start / collect / stop) go through the server-authoritative Edge Functions (ADR-0003).

export type SkillAssignment = Tables<'skill_assignments'>

export async function fetchSkillAssignments(): Promise<SkillAssignment[]> {
  const { data, error } = await supabase
    .from('skill_assignments')
    .select('*')
    .order('last_collected_at', { ascending: true })
  if (error) throw error
  return data
}

export async function startSkillTraining(characterId: string, skillKey: string): Promise<SkillAssignment> {
  const { data, error } = await supabase.functions.invoke('skill-start', {
    body: { characterId, skillKey },
  })
  if (error) await invokeError(error, 'Could not start training')
  return data.assignment as SkillAssignment
}

export type CollectSkillResult = {
  gainedXp: number
  skillKey: string
  newLevel: number
  newXp: number
  stopped: boolean
}

export async function collectSkillTraining(assignmentId: string, stop = false): Promise<CollectSkillResult> {
  const { data, error } = await supabase.functions.invoke('skill-collect', {
    body: { assignmentId, stop },
  })
  if (error) await invokeError(error, 'Could not collect')
  return data as CollectSkillResult
}
