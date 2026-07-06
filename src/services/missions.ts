import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { sanity } from './sanity'
import type { Tables } from '@/types/database.types'

// The Missions data layer:
//  - AUTHORED content (missions + their loot tables) is read from Sanity (drafts perspective).
//  - RUNTIME state (active mission_runs) is read from Supabase (RLS owner-scoped, SELECT-only).
//  - WRITES (dispatch / claim) go through the server-authoritative Edge Functions (ADR-0003).

// ---- Authored missions (Sanity) ---------------------------------------------------------------

export type LootRarityChance = { rarity: string; chance: number } // chance = P(this item drops at this rarity), %
export type MissionLootView = { itemKey: string; name: string; slot: string; chances: LootRarityChance[] }
export type GameMission = {
  missionKey: string
  name: string
  description: string
  durationSeconds: number
  baseXp: number
  baseCoins: number
  resources: { code: string; amount: number }[]
  loot: MissionLootView[]
}

const MISSIONS_QUERY = `*[_type == "missionDef" && defined(missionKey)]{
  missionKey, name, description, durationSeconds, baseXp,
  rewards[]{ kind, code, amount },
  loot[]{ dropChance, "itemKey": item->itemKey, "name": item->name, "slot": item->slot, rarityWeights[]{ rarity, weight } }
}`

type RawMission = {
  missionKey: string
  name: string
  description?: string
  durationSeconds: number
  baseXp?: number
  rewards?: { kind: 'currency' | 'resource'; code: string; amount: number }[]
  loot?: {
    dropChance?: number
    itemKey?: string
    name?: string
    slot?: string
    rarityWeights?: { rarity: string; weight: number }[]
  }[]
}

// Turn a loot line's dropChance + rarity weights into a per-rarity display chance:
//   chance(rarity) = dropChance × weight / Σweights.  Empty weights → the whole dropChance as Common.
function rarityChances(dropChance: number, weights?: { rarity: string; weight: number }[]): LootRarityChance[] {
  const list = (weights ?? []).filter((w) => (w.weight ?? 0) > 0)
  if (list.length === 0) return [{ rarity: 'Common', chance: dropChance }]
  const total = list.reduce((s, w) => s + w.weight, 0)
  return list.map((w) => ({ rarity: w.rarity, chance: Math.round((dropChance * w.weight) / total) }))
}

export async function fetchMissions(): Promise<GameMission[]> {
  const raw = await sanity.fetch<RawMission[]>(MISSIONS_QUERY)
  return raw.map((m) => {
    const rewards = m.rewards ?? []
    return {
      missionKey: m.missionKey,
      name: m.name,
      description: m.description ?? '',
      durationSeconds: m.durationSeconds,
      baseXp: m.baseXp ?? 0,
      baseCoins: rewards.filter((r) => r.kind === 'currency').reduce((s, r) => s + r.amount, 0),
      resources: rewards.filter((r) => r.kind === 'resource').map((r) => ({ code: r.code, amount: r.amount })),
      loot: (m.loot ?? [])
        .filter((l): l is Required<Pick<typeof l, 'itemKey'>> & typeof l => Boolean(l.itemKey))
        .map((l) => ({
          itemKey: l.itemKey!,
          name: l.name ?? l.itemKey!,
          slot: l.slot ?? '',
          chances: rarityChances(l.dropChance ?? 0, l.rarityWeights),
        })),
    }
  })
}

// ---- Active runs (Supabase) -------------------------------------------------------------------

export type MissionRun = Tables<'mission_runs'>

export async function fetchMissionRuns(): Promise<MissionRun[]> {
  const { data, error } = await supabase
    .from('mission_runs')
    .select('*')
    .order('ends_at', { ascending: true })
  if (error) throw error
  return data
}

// ---- Writes via Edge Functions ----------------------------------------------------------------

async function invokeError(error: unknown, fallback: string): Promise<never> {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null)
    throw new Error(body?.error ?? fallback)
  }
  throw error
}

export async function startMission(missionDefId: string, party: string[]): Promise<MissionRun> {
  const { data, error } = await supabase.functions.invoke('mission-start', {
    body: { missionDefId, party },
  })
  if (error) await invokeError(error, 'Could not start mission')
  return data.run as MissionRun
}

export type ClaimResponse = {
  outcome: 'win' | 'loss'
  reason: 'enemies-defeated' | 'party-wiped' | 'timeout'
  survivingHpPct: number
  durationSeconds: number
  rewards: {
    currencies: Record<string, number>
    resources: Record<string, number>
    loot: { item_def_id: string; rarity: string; quantity: number }[]
  }
  characters: { id: string; level: number; xp: number; current_hp: number }[]
}

export async function claimMission(runId: string): Promise<ClaimResponse> {
  const { data, error } = await supabase.functions.invoke('mission-claim', {
    body: { runId },
  })
  if (error) await invokeError(error, 'Could not claim mission')
  return data as ClaimResponse
}
