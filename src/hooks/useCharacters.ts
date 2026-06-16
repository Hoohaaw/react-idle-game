import { useQuery } from '@tanstack/react-query'
import { fetchCharacterDefs } from '../services/characters'

// Loads the authored character roster from Sanity. Read-only content, so it can cache freely.
export function useCharacters() {
  return useQuery({ queryKey: ['characterDefs'], queryFn: fetchCharacterDefs })
}
