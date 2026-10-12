import { useMutation, useQueryClient } from '@tanstack/react-query'
import { equipTotem, unequipTotem } from '@/services/totems'

export function useEquipTotem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (totemDefId: string) => equipTotem(totemDefId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export function useUnequipTotem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => unequipTotem(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
