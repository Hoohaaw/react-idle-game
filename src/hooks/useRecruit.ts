import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recruitCharacter } from '../services/recruit'

// Recruits a character via the Edge Function, then invalidates the player's roster so any reader of
// ['playerCharacters'] refetches. (That query doesn't exist yet — invalidation is a harmless no-op
// until the player-roster read is wired.)
export function useRecruit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: recruitCharacter,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['playerCharacters'] })
    },
  })
}
