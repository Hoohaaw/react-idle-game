// src/features/reset/hooks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchGateMap, resetPlayer, purchaseEchoShopNode } from '@/services/reset'

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
