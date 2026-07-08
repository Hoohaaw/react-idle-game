import { useMutation, useQueryClient } from '@tanstack/react-query'
import { equipItem, unequipItem } from '@/services/gear'

// Gear mutations (ADR-0022). Equipping changes player_characters.equipped (stats are
// compute-on-read, so refetching ['ownedCharacters'] recomputes effective stats/maxHp
// everywhere) and moves items between the slot and the ['inventory'] stacks. Busy state
// can't change from equipping, so runs/gather/admissions keys stay untouched.

export function useEquipItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: equipItem,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ownedCharacters'] })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}

export function useUnequipItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: unequipItem,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ownedCharacters'] })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}
