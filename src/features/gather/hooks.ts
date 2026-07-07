import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchGatherAssignments, startGather, collectGather } from '@/services/gather'

// Gather feature hooks. The shared roster (who's free to assign) comes from @/hooks/useRoster.

export function useGatherAssignments() {
  return useQuery({ queryKey: ['gatherAssignments'], queryFn: fetchGatherAssignments })
}

// Assign/stop change who's busy, so both invalidate the roster's gather-busy query too.
function invalidateGather(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['gatherAssignments'] })
  void qc.invalidateQueries({ queryKey: ['gatherCharacterIds'] }) // roster busy derives from this
}

export function useStartGather() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ characterId, resourceId }: { characterId: string; resourceId: string }) =>
      startGather(characterId, resourceId),
    onSuccess: () => invalidateGather(qc),
  })
}

export function useCollectGather() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ assignmentId, stop }: { assignmentId: string; stop?: boolean }) =>
      collectGather(assignmentId, stop),
    onSuccess: () => {
      invalidateGather(qc)
      void qc.invalidateQueries({ queryKey: ['profile'] }) // wallet gained resources → header
    },
  })
}
