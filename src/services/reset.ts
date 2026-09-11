import { supabase } from '@/lib/supabase'
import { sanity } from './sanity'
import { invokeError } from './_invoke'

// Reset data layer (ADR-0053) — the one Sanity read (which map is "the first map," for the
// gate) plus the two Edge Function calls. Reads that don't need a network round-trip (map
// progress, lifetime gold) already come from useProfile() — see src/features/reset/hooks.ts.

export type GateMap = { mapKey: string; name: string }

const GATE_MAP_QUERY = `*[_type == "mapDef" && order == 1][0]{ mapKey, name }`

export async function fetchGateMap(): Promise<GateMap | null> {
  return sanity.fetch<GateMap | null>(GATE_MAP_QUERY)
}

export async function resetPlayer(): Promise<{ echoesAwarded: number }> {
  const { data, error } = await supabase.functions.invoke('reset-player', { body: {} })
  if (error) await invokeError(error, 'Could not reset')
  return data as { echoesAwarded: number }
}

export async function purchaseEchoShopNode(nodeKey: string): Promise<{ echoShop: Record<string, number> }> {
  const { data, error } = await supabase.functions.invoke('echo-shop-purchase', { body: { nodeKey } })
  if (error) await invokeError(error, 'Could not purchase upgrade')
  return data as { echoShop: Record<string, number> }
}
