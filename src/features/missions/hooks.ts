import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchMissions, startMission, claimMission, type MissionLoadoutEntry } from '@/services/missions'
import { fetchConsumableDefs } from '@/services/consumables'

// Mission-specific hooks. The shared roster + runtime reads (useRoster, useMissionRuns, owned chars, …)
// live in @/hooks/useRoster — imported directly by the pages that need them.

// --- Query hooks -------------------------------------------------------------------------------
export function useMissions() {
  return useQuery({ queryKey: ['missions'], queryFn: fetchMissions })
}

// Authored consumable defs — only the dispatch loadout picker needs these, so this stays
// mission-local rather than moving to the shared @/hooks/useRoster (ADR-0010).
export function useConsumableDefs() {
  return useQuery({ queryKey: ['consumableDefs'], queryFn: fetchConsumableDefs })
}

// --- Mutations ---------------------------------------------------------------------------------
export function useStartMission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ missionDefId, party, consumables }: { missionDefId: string; party: string[]; consumables?: MissionLoadoutEntry[] }) =>
      startMission(missionDefId, party, consumables),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['missionRuns'] }) // roster busy derives from this
      void qc.invalidateQueries({ queryKey: ['inventory'] }) // consumables are consumed at dispatch
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
