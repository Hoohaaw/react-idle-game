// src/features/achievements/hooks.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recordLogin } from '@/services/achievements'

export function useRecordLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: recordLogin,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
