import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchMissions, startMission, claimMission } from '@/services/missions'

// Mission-specific hooks. The shared roster + runtime reads (useRoster, useMissionRuns, owned chars, …)
// live in @/hooks/useRoster — imported directly by the pages that need them.

// --- Query hooks -------------------------------------------------------------------------------
export function useMissions() {
  return useQuery({ queryKey: ['missions'], queryFn: fetchMissions })
}

// --- Mutations ---------------------------------------------------------------------------------
export function useStartMission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ missionDefId, party }: { missionDefId: string; party: string[] }) =>
      startMission(missionDefId, party),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['missionRuns'] }) // roster busy derives from this
    },
  })
}

export function useClaimMission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (runId: string) => claimMission(runId),
    onSuccess: () => {
      // Run deleted; levels/xp/HP changed; wallet + inventory changed.
      void qc.invalidateQueries({ queryKey: ['missionRuns'] })
      void qc.invalidateQueries({ queryKey: ['ownedCharacters'] })
      void qc.invalidateQueries({ queryKey: ['profile'] })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}
