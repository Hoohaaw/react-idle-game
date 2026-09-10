import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./sanity', () => ({ sanity: { fetch: vi.fn() } }))
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(), functions: { invoke: vi.fn() } },
}))

import { sanity } from './sanity'
import { supabase } from '@/lib/supabase'
import { fetchRecipes, fetchCraftRun, startCraft, claimCraft } from './crafting'

describe('fetchRecipes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('drops a recipe entirely when any reagent line is malformed, keeps a well-formed one', async () => {
    vi.mocked(sanity.fetch).mockResolvedValue([
      {
        recipeKey: 'forge-rusted-blade',
        name: 'Forge a Rusted Blade',
        description: 'x',
        durationSeconds: 300,
        result: { itemKey: 'rusted-blade', name: 'Rusted Blade', slot: 'weapon' },
        resultRarityWeights: [{ rarity: 'Common', weight: 3 }],
        reagents: [
          { kind: 'resource', resource: 'Iron', quantity: 3, item: null },
          { kind: 'item', resource: null, quantity: 1, item: { itemKey: 'iron-band', name: 'Iron Band', slot: 'ring' } },
          { kind: 'item', resource: null, quantity: 1, item: null }, // dangling ref → whole recipe dropped
        ],
      },
      {
        recipeKey: 'forge-iron-ring',
        name: 'Forge an Iron Ring',
        description: 'y',
        durationSeconds: 120,
        result: { itemKey: 'iron-ring', name: 'Iron Ring', slot: 'ring' },
        resultRarityWeights: [{ rarity: 'Common', weight: 3 }],
        reagents: [
          { kind: 'resource', resource: 'Iron', quantity: 2, item: null },
          { kind: 'item', resource: null, quantity: 1, item: { itemKey: 'iron-band', name: 'Iron Band', slot: 'ring' } },
        ],
      },
      { recipeKey: 'broken', name: 'No result', durationSeconds: 1, result: null, reagents: [] }, // no result → dropped
    ] as never)

    const result = await fetchRecipes()

    expect(result).toEqual([{
      recipeKey: 'forge-iron-ring',
      name: 'Forge an Iron Ring',
      description: 'y',
      durationSeconds: 120,
      result: { itemKey: 'iron-ring', name: 'Iron Ring', slot: 'ring' },
      resultRarityWeights: [{ rarity: 'Common', weight: 3 }],
      reagents: [
        { kind: 'resource', resource: 'Iron', quantity: 2 },
        { kind: 'item', itemKey: 'iron-band', quantity: 1 },
      ],
      reagentNames: { 'iron-band': 'Iron Band' },
    }])
    const [query] = vi.mocked(sanity.fetch).mock.calls[0]
    expect(query).toContain('recipeDef')
  })
})

describe('fetchCraftRun', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when there is no row', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue({ select: vi.fn().mockReturnValue({ maybeSingle }) } as never)
    expect(await fetchCraftRun()).toBeNull()
  })
})

describe('startCraft', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invokes craft-start with recipeDefId and the rarity choices', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { run: { recipe_def_id: 'x' } }, error: null } as never)
    const result = await startCraft('x', [{ reagentIndex: 1, rarity: 'Rare' }])
    expect(supabase.functions.invoke).toHaveBeenCalledWith('craft-start', {
      body: { recipeDefId: 'x', itemReagentChoices: [{ reagentIndex: 1, rarity: 'Rare' }] },
    })
    expect(result).toEqual({ recipe_def_id: 'x' })
  })
})

describe('claimCraft', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invokes craft-claim with recipeDefId and returns the granted item', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { itemDefId: 'rusted-blade', rarity: 'Rare' }, error: null } as never)
    const result = await claimCraft('x')
    expect(supabase.functions.invoke).toHaveBeenCalledWith('craft-claim', { body: { recipeDefId: 'x' } })
    expect(result).toEqual({ itemDefId: 'rusted-blade', rarity: 'Rare' })
  })
})
