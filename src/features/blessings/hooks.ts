import { useMutation, useQueryClient } from '@tanstack/react-query'
import { chooseBlessing } from '@/services/blessings'

// Mirrors useEquipItem/useUnequipItem (src/features/team/hooks.ts) exactly: plain mutation, no
// optimistic update (none exist anywhere in this codebase), invalidate the roster's underlying
// query on success so level/stats/the newly-picked row all refetch and recompute.
export function useChooseBlessing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: chooseBlessing,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ownedCharacters'] })
    },
  })
}
