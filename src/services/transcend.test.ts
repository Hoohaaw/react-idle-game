import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./sanity', () => ({ sanity: { fetch: vi.fn() } }))
vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}))

import { sanity } from './sanity'
import { supabase } from '@/lib/supabase'
import { fetchRaidKeys, transcendPlayer, purchaseAscendantShopNode } from './transcend'

describe('fetchRaidKeys', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries every authored raidDef and returns the raid keys', async () => {
    vi.mocked(sanity.fetch).mockResolvedValue(['gravemarch_raid', 'ashfall_raid'] as never)

    const result = await fetchRaidKeys()

    expect(result).toEqual(['gravemarch_raid', 'ashfall_raid'])
    const [query] = vi.mocked(sanity.fetch).mock.calls[0]
    expect(query).toContain('raidDef')
    expect(query).toContain('raidKey')
  })
})

describe('transcendPlayer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invokes transcend-player with the protected character ids and returns the award', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { shardsAwarded: 42, transcendCount: 3 },
      error: null,
    } as never)

    const result = await transcendPlayer(['ember_knight', 'frost_mage'])

    expect(supabase.functions.invoke).toHaveBeenCalledWith('transcend-player', {
      body: { protectedIds: ['ember_knight', 'frost_mage'] },
    })
    expect(result).toEqual({ shardsAwarded: 42, transcendCount: 3 })
  })
})

describe('purchaseAscendantShopNode', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invokes ascendant-shop-purchase with the node key and returns the updated shop', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { ascendantShop: { critChance: 2 } },
      error: null,
    } as never)

    const result = await purchaseAscendantShopNode('critChance')

    expect(supabase.functions.invoke).toHaveBeenCalledWith('ascendant-shop-purchase', {
      body: { nodeKey: 'critChance' },
    })
    expect(result).toEqual({ ascendantShop: { critChance: 2 } })
  })
})
