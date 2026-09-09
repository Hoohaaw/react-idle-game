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
    vi.mocked(sanity.fetch).mockResolvedValue([{ dungeonKey: 'emberdeep-vault', name: 'Emberdeep Vault', theme: 'fire' }] as never)
    const result = await fetchDungeons()
    expect(result).toEqual([{ dungeonKey: 'emberdeep-vault', name: 'Emberdeep Vault', theme: 'fire' }])
    expect(sanity.fetch).toHaveBeenCalledTimes(1)
    const [query] = vi.mocked(sanity.fetch).mock.calls[0]
    expect(query).toContain('dungeonDef')
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
