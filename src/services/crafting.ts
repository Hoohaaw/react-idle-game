import { supabase } from '@/lib/supabase'
import { sanity } from './sanity'
import type { Tables } from '@/types/database.types'
import type { ReagentLine, ItemRarityChoice } from '@/lib/crafting'
import { invokeError } from './_invoke'

// Crafting data layer (docs/superpowers/specs/2026-09-09-crafting-create-recipes-design.md §6) —
// same three-layer shape as src/services/missions.ts: authored recipes from Sanity, the single
// in-progress craft from Supabase (RLS owner-read), writes through the Edge Functions (ADR-0003).

export type CraftRun = Tables<'craft_runs'>

export type RecipeView = {
  recipeKey: string
  name: string
  description?: string
  durationSeconds: number
  result: { itemKey: string; name: string; slot: string }
  resultRarityWeights: { rarity: string; weight: number }[]
  reagents: ReagentLine[]
  /** itemKey → display name for the item-typed reagent lines (resource lines display their key). */
  reagentNames: Record<string, string>
}

const RECIPES_QUERY = `*[_type == "recipeDef" && defined(recipeKey)]{
  recipeKey, name, description, durationSeconds,
  "result": result->{ itemKey, name, slot },
  resultRarityWeights[]{ rarity, weight },
  reagents[]{ kind, resource, quantity, "item": item->{ itemKey, name, slot } }
} | order(name asc)`

type RawRecipe = {
  recipeKey: string
  name: string
  description?: string | null
  durationSeconds: number
  result: { itemKey: string; name?: string; slot?: string } | null
  resultRarityWeights?: { rarity: string; weight: number }[] | null
  reagents?: {
    kind: 'resource' | 'item'
    resource?: string | null
    quantity: number
    item?: { itemKey: string; name?: string; slot?: string } | null
  }[] | null
}

export async function fetchRecipes(): Promise<RecipeView[]> {
  const raw = await sanity.fetch<RawRecipe[]>(RECIPES_QUERY)
  return raw.flatMap((r) => {
    if (!r.result?.itemKey) return [] // dangling result reference — unauthorable, skip
    const reagentNames: Record<string, string> = {}
    const reagents: ReagentLine[] = []
    // Invariant: the client's reagents[] must be index-identical to the authored array because
    // craft-start addresses item-rarity choices by authored index — never drop a single line. A
    // malformed line (resource line without `resource`, item line without a resolved
    // `item.itemKey`, or an unknown `kind`) drops the whole recipe instead.
    for (const line of r.reagents ?? []) {
      if (line.kind === 'resource' && line.resource) {
        reagents.push({ kind: 'resource', resource: line.resource, quantity: line.quantity })
      } else if (line.kind === 'item' && line.item?.itemKey) {
        reagents.push({ kind: 'item', itemKey: line.item.itemKey, quantity: line.quantity })
        reagentNames[line.item.itemKey] = line.item.name ?? line.item.itemKey
      } else {
        return [] // malformed reagent line — drop the whole recipe, not just the line
      }
    }
    return [{
      recipeKey: r.recipeKey,
      name: r.name,
      description: r.description ?? undefined,
      durationSeconds: r.durationSeconds,
      result: { itemKey: r.result.itemKey, name: r.result.name ?? r.result.itemKey, slot: r.result.slot ?? '' },
      resultRarityWeights: r.resultRarityWeights ?? [],
      reagents,
      reagentNames,
    }]
  })
}

/** The player's single in-progress craft, or null. */
export async function fetchCraftRun(): Promise<CraftRun | null> {
  const { data, error } = await supabase.from('craft_runs').select('*').maybeSingle()
  if (error) throw error
  return data
}

export type CraftClaimResponse = { itemDefId: string; rarity: string }

export async function startCraft(recipeDefId: string, itemReagentChoices: ItemRarityChoice[]): Promise<CraftRun> {
  const { data, error } = await supabase.functions.invoke('craft-start', { body: { recipeDefId, itemReagentChoices } })
  if (error) await invokeError(error, 'Could not start crafting')
  return data.run as CraftRun
}

export async function claimCraft(recipeDefId: string): Promise<CraftClaimResponse> {
  const { data, error } = await supabase.functions.invoke('craft-claim', { body: { recipeDefId } })
  if (error) await invokeError(error, 'Could not claim the craft')
  return data as CraftClaimResponse
}
