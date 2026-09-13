// src/features/reset/hooks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchGateMap, resetPlayer, purchaseEchoShopNode } from '@/services/reset'
import { fetchRaidKeys, transcendPlayer, purchaseAscendantShopNode } from '@/services/transcend'
import { useProfile } from '@/hooks/useProfile'

export function useGateMap() {
  return useQuery({ queryKey: ['resetGateMap'], queryFn: fetchGateMap })
}

export function useResetPlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: resetPlayer,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export function usePurchaseEchoShopNode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (nodeKey: string) => purchaseEchoShopNode(nodeKey),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export function useRaidKeys() {
  return useQuery({ queryKey: ['raidKeys'], queryFn: fetchRaidKeys })
}

/** Every currently-authored raid the player has NOT cleared, ever — the Transcend gate (spec §5a).
 *  Computed here (not in the service layer) because it needs the player's own lifetime_stats,
 *  already available via useProfile(). */
export function useRaidEligibility() {
  const raidKeys = useRaidKeys()
  const profile = useProfile()
  const lifetimeStats = profile.data?.lifetimeStats ?? {}
  const missingRaids = (raidKeys.data ?? []).filter((key) => !lifetimeStats[`raidCleared.${key}`])
  return {
    isLoading: raidKeys.isLoading || profile.isLoading,
    error: raidKeys.error ?? profile.error ?? null,
    missingRaids,
    isEligible: (raidKeys.data?.length ?? 0) > 0 && missingRaids.length === 0,
  }
}

export function useTranscendPlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: transcendPlayer,
    onSuccess: () => {
      void qc.invalidateQueries()
    },
  })
}

export function usePurchaseAscendantShopNode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (nodeKey: string) => purchaseAscendantShopNode(nodeKey),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
