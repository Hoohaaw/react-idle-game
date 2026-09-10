import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchRecipes, fetchCraftRun, startCraft, claimCraft } from '@/services/crafting'
import type { ItemRarityChoice } from '@/lib/crafting'

export function useRecipes() {
  return useQuery({ queryKey: ['recipes'], queryFn: fetchRecipes })
}

export function useCraftRun() {
  return useQuery({ queryKey: ['craftRun'], queryFn: fetchCraftRun })
}

export function useStartCraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ recipeDefId, choices }: { recipeDefId: string; choices: ItemRarityChoice[] }) =>
      startCraft(recipeDefId, choices),
    onSuccess: () => {
      // Reagents were spent: wallet + stacks changed, and there is now a run.
      void qc.invalidateQueries({ queryKey: ['craftRun'] })
      void qc.invalidateQueries({ queryKey: ['profile'] })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}

export function useClaimCraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (recipeDefId: string) => claimCraft(recipeDefId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['craftRun'] })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}
