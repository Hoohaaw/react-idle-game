import { useQuery } from '@tanstack/react-query'
import { fetchActivity } from '@/services/activity'

export function useActivity() {
  return useQuery({ queryKey: ['activity'], queryFn: fetchActivity })
}
