import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recruitCharacter } from '../services/recruit'

// Recruits a character via the Edge Function, then invalidates the player's roster so any reader of
// ['playerCharacters'] refetches.
export function useRecruit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: recruitCharacter,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['playerCharacters'] })
      void queryClient.invalidateQueries({ queryKey: ['recruits'] }) // hired character leaves the pool
      void queryClient.invalidateQueries({ queryKey: ['profile'] }) // gold spent
    },
  })
}
