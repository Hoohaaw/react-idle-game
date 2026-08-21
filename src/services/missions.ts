import { supabase } from '@/lib/supabase'
import { sanity } from './sanity'
import type { School } from '@/lib/schools'
import type { Tables } from '@/types/database.types'
import { invokeError } from './_invoke'

// The Missions data layer:
//  - AUTHORED content (missions + their loot tables) is read from Sanity (drafts perspective).
//  - RUNTIME state (active mission_runs) is read from Supabase (RLS owner-scoped, SELECT-only).
//  - WRITES (dispatch / claim) go through the server-authoritative Edge Functions (ADR-0003).

// ---- Authored missions (Sanity) ---------------------------------------------------------------

export type LootRarityChance = { rarity: string; chance: number } // chance = P(this item drops at this rarity), %
export type MissionLootView = { itemKey: string; name: string; slot: string; chances: LootRarityChance[] }
export type MissionEnemyView = {
  name: string
  count: number
  damageType: School
  /** Enemy archetype (bruiser/caster/tank/swarm/boss) — drives Slayer-trait matching. */
  archetype?: string
  resistances: { school: School; value: number }[]
  /** Full combat stat block (same fields mission-claim feeds the sim) — powers the client-side
   *  win-chance estimate. Optional so display-only fixtures can omit it. */
  stats?: {
    health: number
    attack: number
    speed: number
    defense?: number
    resistance?: number
    block?: number
    critChance?: number
    critDamage?: number
    armorPen?: number
    dodge?: number
    healthRegen?: number
    spikeEverySeconds?: number
    spikeMultiplier?: number
  }
}
export type MissionMapView = { mapKey: string; name: string; order: number }
export type GameMission = {
  missionKey: string
  name: string
  description: string
  durationSeconds: number
  baseXp: number
  baseGold: number
  resources: { code: string; amount: number }[]
  loot: MissionLootView[]
  enemies: MissionEnemyView[]
  /** World map + stage (ADR-0034). null = mission not yet assigned to a map (legacy drafts). */
  map: MissionMapView | null
  stage: number | null
  /** The encounter's in-fight clock — needed to run the estimate sim client-side. */
  timeLimitSeconds: number | null
}

const MISSIONS_QUERY = `*[_type == "missionDef" && defined(missionKey)]{
  missionKey, name, description, durationSeconds, baseXp, stage,
  "map": map->{ mapKey, name, order },
  rewards[]{ kind, code, amount },
  loot[]{ dropChance, "itemKey": item->itemKey, "name": item->name, "slot": item->slot, rarityWeights[]{ rarity, weight } },
  "timeLimitSeconds": encounter->timeLimitSeconds,
  "enemies": encounter->enemies[]{ count, "name": enemy->name, "damageType": enemy->damageType, "archetype": enemy->archetype, "resistances": enemy->resistances[]{ school, value },
    "stats": enemy->{ health, attack, speed, defense, resistance, block, critChance, critDamage, armorPen, dodge, healthRegen, spikeEverySeconds, spikeMultiplier } }
}`

type RawMission = {
  missionKey: string
  name: string
  description?: string
  durationSeconds: number
  baseXp?: number
  stage?: number
  map?: { mapKey?: string; name?: string; order?: number } | null
  rewards?: { kind: 'currency' | 'resource'; code: string; amount: number }[]
  loot?: {
    dropChance?: number
    itemKey?: string
    name?: string
    slot?: string
    rarityWeights?: { rarity: string; weight: number }[]
  }[]
  timeLimitSeconds?: number
  enemies?: {
    count?: number
    name?: string
    damageType?: School
    archetype?: string
    resistances?: { school: School; value: number }[]
    stats?: MissionEnemyView['stats'] & { health?: number; attack?: number; speed?: number }
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
      baseGold: rewards.filter((r) => r.kind === 'currency').reduce((s, r) => s + r.amount, 0),
      resources: rewards.filter((r) => r.kind === 'resource').map((r) => ({ code: r.code, amount: r.amount })),
      loot: (m.loot ?? [])
        .filter((l): l is Required<Pick<typeof l, 'itemKey'>> & typeof l => Boolean(l.itemKey))
        .map((l) => ({
          itemKey: l.itemKey!,
          name: l.name ?? l.itemKey!,
          slot: l.slot ?? '',
          chances: rarityChances(l.dropChance ?? 0, l.rarityWeights),
        })),
      enemies: (m.enemies ?? [])
        .filter((e): e is typeof e & { name: string } => Boolean(e.name))
        .map((e) => ({
          name: e.name,
          count: e.count ?? 1,
          damageType: e.damageType ?? 'physical',
          archetype: e.archetype,
          resistances: e.resistances ?? [],
          stats:
            e.stats && typeof e.stats.health === 'number' && typeof e.stats.attack === 'number'
              ? { ...e.stats, health: e.stats.health, attack: e.stats.attack, speed: e.stats.speed ?? 10 }
              : undefined,
        })),
      timeLimitSeconds: m.timeLimitSeconds ?? null,
      map: m.map?.mapKey
        ? { mapKey: m.map.mapKey, name: m.map.name ?? m.map.mapKey, order: m.map.order ?? 0 }
        : null,
      stage: m.stage ?? null,
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
  /** True when this win cleared the stage for the first time — XP/gold/resources paid ×1.5 (ADR-0041). */
  firstClear?: boolean
  rewards: {
    currencies: Record<string, number>
    resources: Record<string, number>
    loot: { item_def_id: string; rarity: string; quantity: number }[]
  }
  characters: { id: string; level: number; xp: number; current_hp: number }[]
  newlyUnlocked: { charKey: string; name: string; role: string | null }[]
}

export async function claimMission(runId: string): Promise<ClaimResponse> {
  const { data, error } = await supabase.functions.invoke('mission-claim', {
    body: { runId },
  })
  if (error) await invokeError(error, 'Could not claim mission')
  return data as ClaimResponse
}
