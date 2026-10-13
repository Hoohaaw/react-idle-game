import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./sanity', () => ({ sanity: { fetch: vi.fn() } }))
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(), functions: { invoke: vi.fn() } },
}))

import { sanity } from './sanity'
import { supabase } from '@/lib/supabase'
import { fetchRecipes, fetchCraftRun, startCraft, claimCraft, cancelCraft, RECIPES_QUERY } from './crafting'

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

  it('does not drop a recipe whose result is a consumableDef/totemDef (no slot, no itemKey field)', async () => {
    // The GROQ query projects "itemKey": coalesce(itemKey, consumableKey, totemKey) so a
    // consumableDef/totemDef result (which has no `itemKey` or `slot` of its own) still comes
    // back with a populated `itemKey` and no `slot` — regression test for the bug where these
    // recipes were silently dropped because the query hardcoded result->itemKey.
    vi.mocked(sanity.fetch).mockResolvedValue([
      {
        recipeKey: 'brew-minor-healing-potion',
        name: 'Brew a Minor Healing Potion',
        description: 'z',
        durationSeconds: 60,
        result: { itemKey: 'minor-healing-potion', name: 'Minor Healing Potion' }, // no slot
        resultRarityWeights: [],
        reagents: [{ kind: 'resource', resource: 'Herb', quantity: 2, item: null }],
      },
    ] as never)

    const result = await fetchRecipes()

    expect(result).toEqual([{
      recipeKey: 'brew-minor-healing-potion',
      name: 'Brew a Minor Healing Potion',
      description: 'z',
      durationSeconds: 60,
      result: { itemKey: 'minor-healing-potion', name: 'Minor Healing Potion', slot: '' },
      resultRarityWeights: [],
      reagents: [{ kind: 'resource', resource: 'Herb', quantity: 2 }],
      reagentNames: {},
    }])
  })

  it('queries result with a coalesce across itemKey/consumableKey/totemKey so no result type is dropped', () => {
    expect(RECIPES_QUERY).toContain('coalesce(itemKey, consumableKey, totemKey)')
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

describe('cancelCraft', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invokes craft-cancel with recipeDefId', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { ok: true }, error: null } as never)
    await cancelCraft('x')
    expect(supabase.functions.invoke).toHaveBeenCalledWith('craft-cancel', { body: { recipeDefId: 'x' } })
  })
})
