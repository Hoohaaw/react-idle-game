import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recordLogin } from '../services/achievements'

// Records a login once per UTC day (spec 2026-09-13 §4c). Lives in the shared hooks layer, not the
// achievements feature, because its only consumer is GameLayout (the app shell) — not the
// achievements feature's own page, which only reads useProfile().
export function useRecordLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: recordLogin,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
