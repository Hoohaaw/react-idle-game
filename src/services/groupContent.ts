import { supabase } from '@/lib/supabase'
import { sanity } from './sanity'
import type { School } from '@/lib/schools'
import type { Tables } from '@/types/database.types'
import { invokeError } from './_invoke'

// Dungeons & raids data layer (docs/superpowers/specs/2026-09-08-dungeons-and-raids-design.md) —
// same three-layer shape as src/services/missions.ts: authored content from Sanity, runtime state
// from Supabase (RLS owner-scoped read), writes through the server-authoritative Edge Functions.

export type GroupKind = 'dungeon' | 'raid'
export type GroupRun = Tables<'group_runs'>

export type GroupContentView = {
  dungeonKey?: string
  raidKey?: string
  name: string
  theme: School
  description?: string
  stageCount: number
  mapGate?: string
}

const DUNGEONS_QUERY = `*[_type == "dungeonDef"]{ dungeonKey, name, theme, description, "stageCount": count(stages), "mapGate": mapGate->mapKey }`
const RAIDS_QUERY = `*[_type == "raidDef"]{ raidKey, name, theme, description, "stageCount": count(stages), "mapGate": mapGate->mapKey }`

export async function fetchDungeons(): Promise<GroupContentView[]> {
  return sanity.fetch(DUNGEONS_QUERY)
}

export async function fetchRaids(): Promise<GroupContentView[]> {
  return sanity.fetch(RAIDS_QUERY)
}

export async function fetchGroupRuns(): Promise<GroupRun[]> {
  const { data, error } = await supabase.from('group_runs').select('*')
  if (error) throw error
  return data
}

/** Character ids currently mid-stage on ANY dungeon/raid run (party is only non-empty while a
 *  stage is in flight, spec §5) — feeds useRoster's `busy` derivation. */
export async function fetchGroupBusyCharacterIds(): Promise<string[]> {
  const { data, error } = await supabase.from('group_runs').select('party').not('party', 'eq', '{}')
  if (error) throw error
  return (data ?? []).flatMap((r) => r.party as string[])
}

export type GroupClaimResponse = {
  outcome: 'win' | 'loss'
  reason: string
  survivingHpPct: number
  durationSeconds: number
  rewards: { currencies: Record<string, number>; resources: Record<string, number>; loot: { item_def_id: string; rarity: string; quantity: number }[] }
  characters: { id: string; level: number; xp: number; current_hp: number }[]
  stageIndex: number
  runComplete: boolean
}

export async function startGroupStage(kind: GroupKind, defKey: string, party: string[]): Promise<GroupRun> {
  const { data, error } = await supabase.functions.invoke('group-start-stage', { body: { kind, defKey, party } })
  if (error) await invokeError(error, 'Could not start stage')
  return data.run as GroupRun
}

export async function claimGroupStage(kind: GroupKind, defKey: string): Promise<GroupClaimResponse> {
  const { data, error } = await supabase.functions.invoke('group-claim-stage', { body: { kind, defKey } })
  if (error) await invokeError(error, 'Could not claim stage')
  return data as GroupClaimResponse
}
