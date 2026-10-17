import { supabase } from '@/lib/supabase'
import { invokeError } from './_invoke'

// Profession-expert writes (docs/superpowers/specs/2026-10-16-profession-system-design.md) —
// same Edge-Function-invoke pattern as every other server-authoritative write (ADR-0003).
// Profession STATE (level/xp/knownRecipes) is read directly off the profile row — see
// src/hooks/useProfile.ts — not fetched here; this file only owns the two write paths.

export type ProfessionState = {
  level: number
  xp: number
  knownRecipes: string[]
  completedQuests: string[]
}

export async function learnProfessionRecipe(recipeKey: string): Promise<void> {
  const { error } = await supabase.functions.invoke('profession-learn-recipe', {
    body: { recipeKey },
  })
  if (error) await invokeError(error, 'Could not learn recipe')
}

export async function claimProfessionQuest(
  questKey: string,
  itemCostChoices: { costIndex: number; rarity: string }[] = [],
): Promise<void> {
  const { error } = await supabase.functions.invoke('profession-claim-quest', {
    body: { questKey, itemCostChoices },
  })
  if (error) await invokeError(error, 'Could not complete quest')
}
