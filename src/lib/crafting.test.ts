import { describe, it, expect } from 'vitest'
import { resolveReagents, canAfford, defaultRarityChoice, rarityChances, type ReagentLine, type OwnedStack } from './crafting'

const RES = { Iron: 5, Coal: 2 }
const STACKS: OwnedStack[] = [
  { itemDefId: 'rusted-blade', rarity: 'Common', quantity: 1 },
  { itemDefId: 'rusted-blade', rarity: 'Rare', quantity: 3 },
  { itemDefId: 'iron-band', rarity: 'Common', quantity: 2 },
]

describe('resolveReagents', () => {
  it('resource-only recipe: reports have/need and ok per line', () => {
    const lines: ReagentLine[] = [
      { kind: 'resource', resource: 'Iron', quantity: 3 },
      { kind: 'resource', resource: 'Coal', quantity: 4 },
    ]
    const r = resolveReagents(lines, RES, [], [])
    expect(r).toEqual([
      { index: 0, kind: 'resource', code: 'Iron', quantity: 3, have: 5, ok: true },
      { index: 1, kind: 'resource', code: 'Coal', quantity: 4, have: 2, ok: false },
    ])
  })

  it('missing resource key counts as zero', () => {
    const r = resolveReagents([{ kind: 'resource', resource: 'Platinum', quantity: 1 }], RES, [], [])
    expect(r[0]).toMatchObject({ have: 0, ok: false })
  })

  it('item line with a rarity choice checks that stack', () => {
    const lines: ReagentLine[] = [{ kind: 'item', itemKey: 'rusted-blade', quantity: 2 }]
    const r = resolveReagents(lines, RES, STACKS, [{ reagentIndex: 0, rarity: 'Rare' }])
    expect(r[0]).toEqual({
      index: 0, kind: 'item', itemKey: 'rusted-blade', rarity: 'Rare', quantity: 2, have: 3, ok: true,
      owned: [{ rarity: 'Common', have: 1 }, { rarity: 'Rare', have: 3 }],
    })
  })

  it('item line with a rarity choice the player lacks enough of is not ok', () => {
    const lines: ReagentLine[] = [{ kind: 'item', itemKey: 'rusted-blade', quantity: 2 }]
    const r = resolveReagents(lines, RES, STACKS, [{ reagentIndex: 0, rarity: 'Common' }])
    expect(r[0]).toMatchObject({ rarity: 'Common', have: 1, ok: false })
  })

  it('item line with no choice yet is not ok and has rarity null', () => {
    const r = resolveReagents([{ kind: 'item', itemKey: 'rusted-blade', quantity: 1 }], RES, STACKS, [])
    expect(r[0]).toMatchObject({ rarity: null, have: 0, ok: false, owned: [{ rarity: 'Common', have: 1 }, { rarity: 'Rare', have: 3 }] })
  })

  it('mixed recipe resolves both kinds in line order', () => {
    const lines: ReagentLine[] = [
      { kind: 'item', itemKey: 'iron-band', quantity: 1 },
      { kind: 'resource', resource: 'Iron', quantity: 1 },
    ]
    const r = resolveReagents(lines, RES, STACKS, [{ reagentIndex: 0, rarity: 'Common' }])
    expect(r.map((x) => x.ok)).toEqual([true, true])
    expect(r.map((x) => x.kind)).toEqual(['item', 'resource'])
  })
})

describe('canAfford', () => {
  it('is true only when every line is ok', () => {
    expect(canAfford([{ index: 0, kind: 'resource', code: 'Iron', quantity: 1, have: 1, ok: true }])).toBe(true)
    expect(canAfford([
      { index: 0, kind: 'resource', code: 'Iron', quantity: 1, have: 1, ok: true },
      { index: 1, kind: 'resource', code: 'Coal', quantity: 9, have: 2, ok: false },
    ])).toBe(false)
  })
  it('is false for an empty recipe', () => {
    expect(canAfford([])).toBe(false)
  })
})

describe('defaultRarityChoice', () => {
  it('prefers the lowest-rarity stack that covers the quantity', () => {
    expect(defaultRarityChoice({ kind: 'item', itemKey: 'rusted-blade', quantity: 2 }, STACKS)).toBe('Rare')
  })
  it('falls back to the lowest owned rarity when nothing covers the quantity', () => {
    expect(defaultRarityChoice({ kind: 'item', itemKey: 'rusted-blade', quantity: 99 }, STACKS)).toBe('Common')
  })
  it('is null when the item is not owned at all', () => {
    expect(defaultRarityChoice({ kind: 'item', itemKey: 'hollow-ward', quantity: 1 }, STACKS)).toBeNull()
  })
})

describe('rarityChances', () => {
  it('converts weights to percentages', () => {
    expect(rarityChances([{ rarity: 'Common', weight: 3 }, { rarity: 'Uncommon', weight: 1 }])).toEqual([
      { rarity: 'Common', chance: 75 },
      { rarity: 'Uncommon', chance: 25 },
    ])
  })
  it('ignores zero weights and defaults to Common 100 when empty', () => {
    expect(rarityChances([{ rarity: 'Epic', weight: 0 }, { rarity: 'Rare', weight: 2 }])).toEqual([{ rarity: 'Rare', chance: 100 }])
    expect(rarityChances(undefined)).toEqual([{ rarity: 'Common', chance: 100 }])
    expect(rarityChances([])).toEqual([{ rarity: 'Common', chance: 100 }])
  })
})
