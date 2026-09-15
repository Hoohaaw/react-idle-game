import { supabase } from '@/lib/supabase'
import { sanity } from './sanity'
import type { School } from '@/lib/schools'
import type { Tables } from '@/types/database.types'
import { invokeError } from './_invoke'
import { rarityChances, type LootRarityChance } from '@/lib/loot'

// Dungeons & raids data layer (docs/superpowers/specs/2026-09-08-dungeons-and-raids-design.md) —
// same three-layer shape as src/services/missions.ts: authored content from Sanity, runtime state
// from Supabase (RLS owner-scoped read), writes through the server-authoritative Edge Functions.

export type GroupKind = 'dungeon' | 'raid'
export type GroupRun = Tables<'group_runs'>

export type GroupStageLootView = { itemKey: string; name: string; slot: string; chances: LootRarityChance[] }
export type GroupStageView = {
  kind: 'trash' | 'boss'
  durationSeconds: number
  baseXp: number
  loot: GroupStageLootView[]
}

export type GroupContentView = {
  dungeonKey?: string
  raidKey?: string
  name: string
  theme: School
  description?: string
  stages: GroupStageView[]
  mapGate?: string
}

// coalesce(..., []): a stage with no loot authored has no `loot` array at all, and GROQ's
// `loot[]{...}` projection over an absent field returns `null`, not `[]` — confirmed live for
// every trash stage in both reference dungeons/raids today. Without the coalesce this violates
// GroupStageView's `loot: {...}[]` (non-nullable) type at runtime.
const STAGE_PROJECTION = `stages[]{
  kind, durationSeconds, baseXp,
  "loot": coalesce(loot[]{ dropChance, "itemKey": item->itemKey, "name": item->name, "slot": item->slot, rarityWeights[]{ rarity, weight } }, [])
}`
const DUNGEONS_QUERY = `*[_type == "dungeonDef"]{ dungeonKey, name, theme, description, ${STAGE_PROJECTION}, "mapGate": mapGate->mapKey }`
const RAIDS_QUERY = `*[_type == "raidDef"]{ raidKey, name, theme, description, ${STAGE_PROJECTION}, "mapGate": mapGate->mapKey }`

type RawGroupStage = {
  kind: 'trash' | 'boss'
  durationSeconds?: number
  baseXp?: number
  loot?: {
    dropChance?: number
    itemKey?: string
    name?: string
    slot?: string
    rarityWeights?: { rarity: string; weight: number }[]
  }[]
}
type RawGroupContent = {
  dungeonKey?: string
  raidKey?: string
  name: string
  theme: School
  description?: string
  stages?: RawGroupStage[]
  mapGate?: string
}

function mapStages(stages?: RawGroupStage[]): GroupStageView[] {
  return (stages ?? []).map((s) => ({
    kind: s.kind,
    durationSeconds: s.durationSeconds ?? 0,
    baseXp: s.baseXp ?? 0,
    loot: (s.loot ?? [])
      .filter((l): l is Required<Pick<typeof l, 'itemKey'>> & typeof l => Boolean(l.itemKey))
      .map((l) => ({
        itemKey: l.itemKey!,
        name: l.name ?? l.itemKey!,
        slot: l.slot ?? '',
        chances: rarityChances(l.dropChance ?? 0, l.rarityWeights),
      })),
  }))
}

function mapContent(raw: RawGroupContent[]): GroupContentView[] {
  return raw.map((c) => ({ ...c, stages: mapStages(c.stages) }))
}

export async function fetchDungeons(): Promise<GroupContentView[]> {
  const raw = await sanity.fetch<RawGroupContent[]>(DUNGEONS_QUERY)
  return mapContent(raw)
}

export async function fetchRaids(): Promise<GroupContentView[]> {
  const raw = await sanity.fetch<RawGroupContent[]>(RAIDS_QUERY)
  return mapContent(raw)
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
  reason: 'enemies-defeated' | 'party-wiped' | 'timeout'
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
