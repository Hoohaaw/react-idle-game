import { useQuery } from '@tanstack/react-query'
import { fetchRecruitCandidates } from '../services/recruits'

// Loads the player's unlocked-but-not-owned characters — the /recruits screen's data. Keyed
// ['recruits'] — useRecruit invalidates this on a successful hire (character moves from here to
// the owned roster), and any Edge Function response carrying newlyUnlocked should too (Task 15).
export function useRecruits() {
  return useQuery({ queryKey: ['recruits'], queryFn: fetchRecruitCandidates })
}
