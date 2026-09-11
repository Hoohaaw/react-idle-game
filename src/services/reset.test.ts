import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./sanity', () => ({ sanity: { fetch: vi.fn() } }))
vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}))

import { sanity } from './sanity'
import { supabase } from '@/lib/supabase'
import { fetchGateMap, resetPlayer, purchaseEchoShopNode } from './reset'

describe('fetchGateMap', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries the order-1 mapDef and returns its key/name', async () => {
    vi.mocked(sanity.fetch).mockResolvedValue({ mapKey: 'gravemarch', name: 'Gravemarch' } as never)

    const result = await fetchGateMap()

    expect(result).toEqual({ mapKey: 'gravemarch', name: 'Gravemarch' })
    const [query] = vi.mocked(sanity.fetch).mock.calls[0]
    expect(query).toContain('order == 1')
  })

  it('returns null when no map is authored yet', async () => {
    vi.mocked(sanity.fetch).mockResolvedValue(null as never)
    expect(await fetchGateMap()).toBeNull()
  })
})

describe('resetPlayer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invokes reset-player with an empty body and returns the award', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { echoesAwarded: 114 }, error: null } as never)

    const result = await resetPlayer()

    expect(supabase.functions.invoke).toHaveBeenCalledWith('reset-player', { body: {} })
    expect(result).toEqual({ echoesAwarded: 114 })
  })
})

describe('purchaseEchoShopNode', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invokes echo-shop-purchase with the node key and returns the updated shop', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { echoShop: { missionSpeed: 1 } }, error: null } as never)

    const result = await purchaseEchoShopNode('missionSpeed')

    expect(supabase.functions.invoke).toHaveBeenCalledWith('echo-shop-purchase', { body: { nodeKey: 'missionSpeed' } })
    expect(result).toEqual({ echoShop: { missionSpeed: 1 } })
  })
})
