import { useMutation, useQueryClient } from '@tanstack/react-query'
import { respecBlessings } from '@/services/blessings'

// Mirrors useChooseBlessing (src/features/blessings/hooks.ts) but invalidates both queries a
// respec actually changes: blessings reset to {} (ownedCharacters) and gold spent (profile).
export function useRespecBlessing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: respecBlessings,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ownedCharacters'] })
      void qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
