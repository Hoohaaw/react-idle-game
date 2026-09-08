import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchDungeons, fetchRaids, fetchGroupRuns, startGroupStage, claimGroupStage, type GroupKind } from '@/services/groupContent'

export function useDungeons() {
  return useQuery({ queryKey: ['dungeons'], queryFn: fetchDungeons })
}
export function useRaids() {
  return useQuery({ queryKey: ['raids'], queryFn: fetchRaids })
}
export function useGroupRuns() {
  return useQuery({ queryKey: ['groupRuns'], queryFn: fetchGroupRuns })
}

export function useStartGroupStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ kind, defKey, party }: { kind: GroupKind; defKey: string; party: string[] }) =>
      startGroupStage(kind, defKey, party),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['groupRuns'] })
      void qc.invalidateQueries({ queryKey: ['groupBusyCharacterIds'] })
    },
  })
}

export function useClaimGroupStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ kind, defKey }: { kind: GroupKind; defKey: string }) => claimGroupStage(kind, defKey),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['groupRuns'] })
      void qc.invalidateQueries({ queryKey: ['groupBusyCharacterIds'] })
      void qc.invalidateQueries({ queryKey: ['ownedCharacters'] })
      void qc.invalidateQueries({ queryKey: ['profile'] })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}
