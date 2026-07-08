import { useQuery } from '@tanstack/react-query'
import { fetchInventory } from '@/services/inventory'

// Shared read of the player's loot stacks — consumed by the Inventory page and the team
// feature's slot picker (ADR-0010: shared via @/hooks, features don't reach into each other).
// Gear mutations invalidate ['inventory'] alongside ['ownedCharacters'].
export function useInventory() {
  return useQuery({ queryKey: ['inventory'], queryFn: fetchInventory })
}
