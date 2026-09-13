import { supabase } from '@/lib/supabase'
import { sanity } from './sanity'
import { invokeError } from './_invoke'

// Transcendence data layer (ADR-0023) — the one Sanity read (every authored raid's key, for the
// gate) plus the two Edge Function calls. The gate itself is computed client-side against the
// player's own lifetime_stats (already available via useProfile()) — this just supplies the full
// raid key list to compare against, same "services layer does the network call" split reset.ts uses.

export async function fetchRaidKeys(): Promise<string[]> {
  return sanity.fetch<string[]>(`*[_type == "raidDef"].raidKey`)
}

export async function transcendPlayer(protectedIds: string[]): Promise<{ shardsAwarded: number; transcendCount: number }> {
  const { data, error } = await supabase.functions.invoke('transcend-player', { body: { protectedIds } })
  if (error) await invokeError(error, 'Could not transcend')
  return data as { shardsAwarded: number; transcendCount: number }
}

export async function purchaseAscendantShopNode(nodeKey: string): Promise<{ ascendantShop: Record<string, number> }> {
  const { data, error } = await supabase.functions.invoke('ascendant-shop-purchase', { body: { nodeKey } })
  if (error) await invokeError(error, 'Could not purchase upgrade')
  return data as { ascendantShop: Record<string, number> }
}
