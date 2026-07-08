import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchAdmissions,
  admitCharacter,
  dischargeCharacter,
  upgradeInfirmary,
} from '@/services/infirmary'

// Infirmary state + mutations (ADR-0021). Admissions share the ['infirmaryAdmissions'] key with
// useRoster's busy computation, so every admit/discharge automatically flips availability
// everywhere (dispatch, mines, roster). Discharge/upgrade also settle HP server-side, so
// ownedCharacters must refetch; upgrade spends the wallet, so profile must too.

export function useAdmissions() {
  return useQuery({ queryKey: ['infirmaryAdmissions'], queryFn: fetchAdmissions })
}

export function useAdmit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (characterId: string) => admitCharacter(characterId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['infirmaryAdmissions'] })
    },
  })
}

export function useDischarge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (characterId: string) => dischargeCharacter(characterId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['infirmaryAdmissions'] })
      void qc.invalidateQueries({ queryKey: ['ownedCharacters'] })
    },
  })
}

export function useUpgradeInfirmary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: upgradeInfirmary,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] })
      void qc.invalidateQueries({ queryKey: ['infirmaryAdmissions'] })
      void qc.invalidateQueries({ queryKey: ['ownedCharacters'] })
    },
  })
}
