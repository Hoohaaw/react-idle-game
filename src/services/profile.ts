import { supabase } from '@/lib/supabase'

// The player's account wallet + scalars, read from `profiles` (RLS owner-read, SELECT-only grant).
// Balances are JSONB maps keyed by the code registries (currencies -> src/lib/currencies.ts;
// resources -> src/lib/resources.ts); an absent key means a zero balance. All WRITES happen
// server-side (Edge Functions / claim_mission) — the client only reads this (ADR-0003).

export type PlayerProfile = {
  currencies: Record<string, number>
  resources: Record<string, number>
  /** How many times the player has done a soft Reset (ADR-0053). Display-only counter. */
  resetCount: number
  infirmaryLevel: number
  /** Highest stage cleared per map, keyed by mapKey (ADR-0034). Absent key = nothing cleared. */
  mapProgress: Record<string, number>
  /** charKey -> ISO timestamp first unlocked (spec §5c). Absent key = still locked — and per the
   *  full-blind-surprise rule, the client never asks which keys are missing. */
  unlockedCharacters: Record<string, string>
  /** Spendable Echo Shop currency (ADR-0053), earned by Resetting. */
  echoes: number
  /** nodeKey -> level purchased (ADR-0053, src/lib/echoShop.ts). Never wiped by a Reset. */
  echoShop: Record<string, number>
  /** Cumulative "ever earned" ledger (docs/superpowers/specs/2026-08-20-character-acquisition-
   *  design.md) — goldEarned, missionSecondsSent, resourceGathered.<key>. Never wiped by a Reset. */
  lifetimeStats: Record<string, number>
  /** Ascendant Shards currency (ADR-0023), earned via lifetime-stat milestones. Never wiped. */
  ascendantShards: number
  /** nodeKey -> level (ADR-0023, src/lib/ascendantShop.ts). Never wiped. */
  ascendantShop: Record<string, number>
  /** "<metricKey>.<i>" -> true for every permanently-claimed milestone. Never wiped. */
  ascendantMilestones: Record<string, boolean>
  /** How many times the player has Transcended. Never wiped. */
  transcendCount: number
}

export async function fetchProfile(): Promise<PlayerProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'currencies, resources, reset_count, infirmary_level, map_progress, unlocked_characters, echoes, echo_shop, lifetime_stats, ascendant_shards, ascendant_shop, ascendant_milestones, transcend_count',
    )
    .maybeSingle()
  if (error) throw error
  return {
    currencies: (data?.currencies ?? {}) as Record<string, number>,
    resources: (data?.resources ?? {}) as Record<string, number>,
    resetCount: data?.reset_count ?? 0,
    infirmaryLevel: data?.infirmary_level ?? 1,
    mapProgress: (data?.map_progress ?? {}) as Record<string, number>,
    unlockedCharacters: (data?.unlocked_characters ?? {}) as Record<string, string>,
    echoes: data?.echoes ?? 0,
    echoShop: (data?.echo_shop ?? {}) as Record<string, number>,
    lifetimeStats: (data?.lifetime_stats ?? {}) as Record<string, number>,
    ascendantShards: data?.ascendant_shards ?? 0,
    ascendantShop: (data?.ascendant_shop ?? {}) as Record<string, number>,
    ascendantMilestones: (data?.ascendant_milestones ?? {}) as Record<string, boolean>,
    transcendCount: data?.transcend_count ?? 0,
  }
}
