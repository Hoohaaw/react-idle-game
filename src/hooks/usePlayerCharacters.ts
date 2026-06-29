import { useQuery } from '@tanstack/react-query'
import { fetchRecruitedDefIds } from '../services/playerCharacters'

// Loads the IDs of characters the signed-in player has recruited. Keyed ['playerCharacters'] — the
// same key useRecruit invalidates on success, so the roster (and the Recruit button) refresh after a
// recruit. Player runtime state, so it doesn't cache as freely as the authored defs.
export function usePlayerCharacters() {
  return useQuery({ queryKey: ['playerCharacters'], queryFn: fetchRecruitedDefIds })
}
