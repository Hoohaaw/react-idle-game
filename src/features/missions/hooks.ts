import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchMissions, fetchMissionRuns, startMission, claimMission } from '@/services/missions'
import { fetchOwnedCharacters, fetchGatherCharacterIds } from '@/services/playerCharacters'
import { fetchItemDefBonuses } from '@/services/items'
import { fetchCharacterDefs } from '@/services/characters'
import { effectiveStats } from '@/lib/stats'
import { resolveRole, type CharacterRole } from '@/lib/roles'

// --- Query hooks -------------------------------------------------------------------------------
// Authored content caches freely; runtime state (runs, owned chars, gather) is player state.
export function useMissions() {
  return useQuery({ queryKey: ['missions'], queryFn: fetchMissions })
}
export function useMissionRuns() {
  return useQuery({ queryKey: ['missionRuns'], queryFn: fetchMissionRuns })
}
function useOwnedCharacters() {
  return useQuery({ queryKey: ['ownedCharacters'], queryFn: fetchOwnedCharacters })
}
function useItemDefs() {
  return useQuery({ queryKey: ['itemDefs'], queryFn: fetchItemDefBonuses })
}
function useGatherCharacterIds() {
  return useQuery({ queryKey: ['gatherCharacterIds'], queryFn: fetchGatherCharacterIds })
}
function useCharacterDefs() {
  return useQuery({ queryKey: ['characterDefs'], queryFn: fetchCharacterDefs })
}

// --- Composed roster ---------------------------------------------------------------------------
// Joins owned characters (Supabase) with their authored defs + item defs (Sanity) into the shape the
// dispatch picker and the claim card need — including EFFECTIVE max HP (level + blessings + gear, the
// same computation the sim uses) and busy state (mission vs gathering).
export type RosterMember = {
  id: string
  name: string
  charClass: string
  role: CharacterRole
  level: number
  xp: number
  maxHp: number
  currentHp: number | null
  busy: 'mission' | 'gathering' | null
}

export function useRoster() {
  const owned = useOwnedCharacters()
  const defs = useCharacterDefs()
  const items = useItemDefs()
  const runs = useMissionRuns()
  const gather = useGatherCharacterIds()

  const roster = useMemo<RosterMember[]>(() => {
    if (!owned.data || !defs.data || !items.data) return []
    const defByKey = new Map(defs.data.map((d) => [d.charKey, d]))
    const onMission = new Set((runs.data ?? []).flatMap((r) => r.party))
    const gathering = new Set(gather.data ?? [])

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
        name: def.name,
        charClass: def.charClass,
        role: resolveRole(def.charClass, def.role),
        level: c.level,
        xp: c.xp,
        maxHp: Math.max(1, Math.round(stats.health ?? 0)),
        currentHp: c.currentHp,
        busy: gathering.has(c.id) ? 'gathering' : onMission.has(c.id) ? 'mission' : null,
      }]
    })
  }, [owned.data, defs.data, items.data, runs.data, gather.data])

  return {
    roster,
    isLoading: owned.isLoading || defs.isLoading || items.isLoading,
    error: owned.error ?? defs.error ?? items.error ?? null,
  }
}

// --- Mutations ---------------------------------------------------------------------------------
export function useStartMission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ missionDefId, party }: { missionDefId: string; party: string[] }) =>
      startMission(missionDefId, party),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['missionRuns'] }) // roster busy derives from this
    },
  })
}

export function useClaimMission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (runId: string) => claimMission(runId),
    onSuccess: () => {
      // Run deleted; levels/xp/HP changed; wallet + inventory changed.
      void qc.invalidateQueries({ queryKey: ['missionRuns'] })
      void qc.invalidateQueries({ queryKey: ['ownedCharacters'] })
      void qc.invalidateQueries({ queryKey: ['profile'] })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}
