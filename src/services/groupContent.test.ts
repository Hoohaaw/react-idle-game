// src/services/groupContent.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./sanity', () => ({ sanity: { fetch: vi.fn() } }))
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(), functions: { invoke: vi.fn() } },
}))

import { sanity } from './sanity'
import { supabase } from '@/lib/supabase'
import { fetchDungeons, fetchGroupBusyCharacterIds, startGroupStage } from './groupContent'

describe('fetchDungeons', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries Sanity for dungeonDef documents', async () => {
    vi.mocked(sanity.fetch).mockResolvedValue([{ dungeonKey: 'emberdeep-vault', name: 'Emberdeep Vault', theme: 'fire', stages: [] }] as never)
    const result = await fetchDungeons()
    expect(result).toEqual([{ dungeonKey: 'emberdeep-vault', name: 'Emberdeep Vault', theme: 'fire', stages: [] }])
    expect(sanity.fetch).toHaveBeenCalledTimes(1)
    const [query] = vi.mocked(sanity.fetch).mock.calls[0]
    expect(query).toContain('dungeonDef')
    expect(query).toContain('kind')
    expect(query).toContain('loot')
  })

  it('maps a stage with loot into display-ready rarity chances, defaulting name/slot when unauthored', async () => {
    vi.mocked(sanity.fetch).mockResolvedValue([{
      dungeonKey: 'emberdeep-vault', name: 'Emberdeep Vault', theme: 'fire',
      stages: [
        { kind: 'trash', durationSeconds: 90, baseXp: 40, loot: null },
        {
          kind: 'boss', durationSeconds: 180, baseXp: 120,
          loot: [
            { dropChance: 40, itemKey: 'cinderfang-rod', name: 'Cinderfang Rod', slot: 'Weapon', rarityWeights: [{ rarity: 'Rare', weight: 3 }, { rarity: 'Epic', weight: 1 }] },
            { dropChance: 20, itemKey: null },
            { dropChance: 10 },
          ],
        },
      ],
    }] as never)

    const result = await fetchDungeons()

    expect(result[0].stages[0]).toEqual({ kind: 'trash', durationSeconds: 90, baseXp: 40, loot: [] })
    expect(result[0].stages[1].loot).toEqual([
      { itemKey: 'cinderfang-rod', name: 'Cinderfang Rod', slot: 'Weapon', chances: [{ rarity: 'Rare', chance: 30 }, { rarity: 'Epic', chance: 10 }] },
    ])
  })

  it('falls back name/slot to itemKey/empty string when unauthored', async () => {
    vi.mocked(sanity.fetch).mockResolvedValue([{
      dungeonKey: 'emberdeep-vault', name: 'Emberdeep Vault', theme: 'fire',
      stages: [{ kind: 'trash', loot: [{ dropChance: 60, itemKey: 'charred-bone' }] }],
    }] as never)

    const result = await fetchDungeons()

    expect(result[0].stages[0]).toEqual({
      kind: 'trash', durationSeconds: 0, baseXp: 0,
      loot: [{ itemKey: 'charred-bone', name: 'charred-bone', slot: '', chances: [{ rarity: 'Common', chance: 60 }] }],
    })
  })
})

describe('fetchGroupBusyCharacterIds', () => {
  beforeEach(() => vi.clearAllMocks())

  it('flattens the party arrays of every in-flight group run', async () => {
    const not = vi.fn().mockResolvedValue({
      data: [{ party: ['a', 'b'] }, { party: ['c'] }],
      error: null,
    })
    vi.mocked(supabase.from).mockReturnValue({ select: vi.fn().mockReturnThis(), not } as never)
    const result = await fetchGroupBusyCharacterIds()
    expect(result).toEqual(['a', 'b', 'c'])
  })
})

describe('startGroupStage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invokes group-start-stage with kind/defKey/party', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { run: { def_key: 'x' } }, error: null } as never)
    const result = await startGroupStage('dungeon', 'emberdeep-vault', ['a', 'b'])
    expect(supabase.functions.invoke).toHaveBeenCalledWith('group-start-stage', {
      body: { kind: 'dungeon', defKey: 'emberdeep-vault', party: ['a', 'b'] },
    })
    expect(result).toEqual({ def_key: 'x' })
  })
})
