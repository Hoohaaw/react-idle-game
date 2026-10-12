import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { equipTotem, unequipTotem, fetchTotemDefs } from '@/services/totems'

// Authored totem defs — cache freely, same as useItemDefs (useRoster.ts).
export function useTotemDefs() {
  return useQuery({ queryKey: ['totemDefs'], queryFn: fetchTotemDefs })
}

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
