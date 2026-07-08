import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'
import { invokeError } from './_invoke'

// The Infirmary data layer (ADR-0021):
//  - CONFIG (beds/regen per level, stabilize, upgrade costs) is code — src/lib/infirmary.ts
//    (shared with the Edge Functions).
//  - RUNTIME state (active infirmary_admissions) is read from Supabase (RLS owner-scoped,
//    SELECT-only). Current HP while admitted is DERIVED client-side with healState() — the
//    server settles the real value on discharge/upgrade (ADR-0002/0003).
//  - WRITES (admit / discharge / upgrade) go through the server-authoritative Edge Functions.

export type InfirmaryAdmission = Tables<'infirmary_admissions'>

export async function fetchAdmissions(): Promise<InfirmaryAdmission[]> {
  const { data, error } = await supabase
    .from('infirmary_admissions')
    .select('*')
    .order('admitted_at', { ascending: true })
  if (error) throw error
  return data
}

export async function admitCharacter(characterId: string): Promise<InfirmaryAdmission> {
  const { data, error } = await supabase.functions.invoke('infirmary-admit', {
    body: { characterId },
  })
  if (error) await invokeError(error, 'Could not admit character')
  return data.admission as InfirmaryAdmission
}

export type DischargeResult = {
  characterId: string
  current_hp: number | null // null = fully healed
  phase: 'stabilizing' | 'healing' | 'full'
}

export async function dischargeCharacter(characterId: string): Promise<DischargeResult> {
  const { data, error } = await supabase.functions.invoke('infirmary-discharge', {
    body: { characterId },
  })
  if (error) await invokeError(error, 'Could not discharge character')
  return data as DischargeResult
}

export async function upgradeInfirmary(): Promise<{ infirmary_level: number }> {
  const { data, error } = await supabase.functions.invoke('infirmary-upgrade', {
    body: {},
  })
  if (error) await invokeError(error, 'Could not upgrade the infirmary')
  return data as { infirmary_level: number }
}
