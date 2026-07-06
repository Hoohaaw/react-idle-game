import { useQuery } from '@tanstack/react-query'
import { fetchProfile } from '../services/profile'

// Loads the signed-in player's wallet (currencies + resources) and account scalars. Keyed ['profile']
// — the key useClaimMission invalidates on success, so the header balances refresh after a claim.
export function useProfile() {
  return useQuery({ queryKey: ['profile'], queryFn: fetchProfile })
}
