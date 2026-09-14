import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchSkillAssignments, startSkillTraining, collectSkillTraining } from '@/services/skills'

// Skills feature hooks. The shared roster (who's free to assign, and each character's skill
// levels) comes from @/hooks/useRoster.

export function useSkillAssignments() {
  return useQuery({ queryKey: ['skillAssignments'], queryFn: fetchSkillAssignments })
}

// Assign/collect/stop change who's busy and their skill level, so invalidate the roster's
// skill-busy query and the owned-characters query (skills live on player_characters, not the
// wallet — unlike gather, there's no ['profile'] invalidation needed here).
function invalidateSkills(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['skillAssignments'] })
  void qc.invalidateQueries({ queryKey: ['skillCharacterIds'] })
  void qc.invalidateQueries({ queryKey: ['ownedCharacters'] })
}

export function useStartSkill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ characterId, skillKey }: { characterId: string; skillKey: string }) =>
      startSkillTraining(characterId, skillKey),
    onSuccess: () => invalidateSkills(qc),
  })
}

export function useCollectSkill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ assignmentId, stop }: { assignmentId: string; stop?: boolean }) =>
      collectSkillTraining(assignmentId, stop),
    onSuccess: () => invalidateSkills(qc),
  })
}
