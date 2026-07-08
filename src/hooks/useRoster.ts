import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchMissionRuns } from '@/services/missions'
import { fetchOwnedCharacters, fetchGatherCharacterIds, type EquippedItem } from '@/services/playerCharacters'
import { fetchAdmissions } from '@/services/infirmary'
import { fetchItemDefs } from '@/services/items'
import { fetchCharacterDefs } from '@/services/characters'
import { effectiveStats } from '@/lib/stats'
import { resolveRole, type CharacterRole } from '@/lib/roles'

// Shared player-state reads + the composed roster. Used by every feature that needs "the player's
// characters and what they're doing" — missions (dispatch/claim), infirmary (heal), gather (assign).
// Promoted here from features/missions once a third consumer appeared (ADR-0010 import rules: features
// share via @/hooks, they don't reach into each other).

// --- Query hooks -------------------------------------------------------------------------------
// Runtime state (runs, owned chars, gather) is player state; authored defs (char/item) cache freely.
export function useMissionRuns() {
  return useQuery({ queryKey: ['missionRuns'], queryFn: fetchMissionRuns })
}
function useOwnedCharacters() {
  return useQuery({ queryKey: ['ownedCharacters'], queryFn: fetchOwnedCharacters })
}
export function useItemDefs() {
  return useQuery({ queryKey: ['itemDefs'], queryFn: fetchItemDefs })
}
function useGatherCharacterIds() {
  return useQuery({ queryKey: ['gatherCharacterIds'], queryFn: fetchGatherCharacterIds })
}
function useInfirmaryAdmissions() {
  return useQuery({ queryKey: ['infirmaryAdmissions'], queryFn: fetchAdmissions })
}
function useCharacterDefs() {
  return useQuery({ queryKey: ['characterDefs'], queryFn: fetchCharacterDefs })
}

// --- Composed roster ---------------------------------------------------------------------------
// Joins owned characters (Supabase) with their authored defs + item defs (Sanity) into the shape the
// dispatch/assign pickers and the claim card need — including EFFECTIVE max HP (level + blessings + gear,
// the same computation the sim uses) and busy state (mission vs gathering).
export type RosterMember = {
  id: string
  characterDefId: string
  name: string
  charClass: string
  role: CharacterRole
  level: number
  xp: number
  maxHp: number
  currentHp: number | null
  equipped: Record<string, EquippedItem>
  blessings: Record<string, number>
  busy: 'mission' | 'gathering' | 'infirmary' | null
}

export function useRoster() {
  const owned = useOwnedCharacters()
  const defs = useCharacterDefs()
  const items = useItemDefs()
  const runs = useMissionRuns()
  const gather = useGatherCharacterIds()
  const admissions = useInfirmaryAdmissions()

  const roster = useMemo<RosterMember[]>(() => {
    if (!owned.data || !defs.data || !items.data) return []
    const defByKey = new Map(defs.data.map((d) => [d.charKey, d]))
    const onMission = new Set((runs.data ?? []).flatMap((r) => r.party))
    const gathering = new Set(gather.data ?? [])
    const admitted = new Set((admissions.data ?? []).map((a) => a.player_character_id))

    return owned.data.flatMap((c) => {
      const def = defByKey.get(c.characterDefId)
      if (!def) return [] // owned a character whose def isn't loaded/authored — skip
      const stats = effectiveStats({
        level: c.level,
        baseStats: def.baseStats,
        growth: def.growth,
        blessingAllocations: c.blessings,
        blessingNodes: def.blessingNodes,
        equipped: c.equipped,
        itemDefs: items.data!,
      })
      return [{
        id: c.id,
        characterDefId: c.characterDefId,
        name: def.name,
        charClass: def.charClass,
        role: resolveRole(def.charClass, def.role),
        level: c.level,
        xp: c.xp,
        maxHp: Math.max(1, Math.round(stats.health ?? 0)),
        currentHp: c.currentHp,
        equipped: c.equipped,
        blessings: c.blessings,
        busy: gathering.has(c.id)
          ? 'gathering'
          : onMission.has(c.id)
            ? 'mission'
            : admitted.has(c.id)
              ? 'infirmary'
              : null,
      }]
    })
  }, [owned.data, defs.data, items.data, runs.data, gather.data, admissions.data])

  return {
    roster,
    isLoading: owned.isLoading || defs.isLoading || items.isLoading,
    error: owned.error ?? defs.error ?? items.error ?? null,
  }
}
