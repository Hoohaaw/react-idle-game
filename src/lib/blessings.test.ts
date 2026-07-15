import { describe, it, expect } from 'vitest'
import {
  BLESSING_ROW_LEVELS,
  CAPSTONE_LEVEL,
  canPickRow,
  rowSequenceBlocked,
  nextUnpickedRow,
  capstoneEarned,
  resolveBlessingAllocations,
  flattenBlessingTree,
  resolveCapstoneBonuses,
  resolveCapstoneAbility,
  type BlessingPicks,
  type CapstoneDef,
} from './blessings'

// ---------------------------------------------------------------------------
// BLESSING_ROW_LEVELS
// ---------------------------------------------------------------------------

describe('BLESSING_ROW_LEVELS', () => {
  it('is a strictly increasing ladder, row N at level N×10', () => {
    expect(BLESSING_ROW_LEVELS).toEqual({ 1: 10, 2: 20, 3: 30, 4: 40 })
  })

  it('capstone unlocks 10 past the last row', () => {
    expect(CAPSTONE_LEVEL).toBe(BLESSING_ROW_LEVELS[4] + 10)
  })
})

// ---------------------------------------------------------------------------
// canPickRow / rowSequenceBlocked
// ---------------------------------------------------------------------------

describe('canPickRow', () => {
  it('row 1 is pickable at level 10 with no prior picks', () => {
    expect(canPickRow(1, 10, {})).toBe(true)
  })

  it('row 1 is not pickable below level 10', () => {
    expect(canPickRow(1, 9, {})).toBe(false)
  })

  it('row 2 is blocked until row 1 is picked, even at level 20', () => {
    expect(canPickRow(2, 20, {})).toBe(false)
    expect(canPickRow(2, 20, { row1: 'a' })).toBe(true)
  })

  it('a row already picked is never pickable again (permanence)', () => {
    expect(canPickRow(1, 50, { row1: 'a' })).toBe(false)
  })

  it('a character who skipped ahead can pick every eligible row in one sitting', () => {
    // level 45, never visited before — rows 1-4 all become pickable in sequence as each is chosen.
    let picks: BlessingPicks = {}
    expect(canPickRow(1, 45, picks)).toBe(true)
    picks = { ...picks, row1: 'a' }
    expect(canPickRow(2, 45, picks)).toBe(true)
    picks = { ...picks, row2: 'b' }
    expect(canPickRow(3, 45, picks)).toBe(true)
    picks = { ...picks, row3: 'a' }
    expect(canPickRow(4, 45, picks)).toBe(true)
  })
})

describe('rowSequenceBlocked', () => {
  it('row 1 is never sequence-blocked', () => {
    expect(rowSequenceBlocked(1, {})).toBe(false)
  })

  it('row N is blocked exactly when row N-1 is unpicked', () => {
    expect(rowSequenceBlocked(3, { row1: 'a', row2: 'b' })).toBe(false)
    expect(rowSequenceBlocked(3, { row1: 'a' })).toBe(true)
  })
})

describe('nextUnpickedRow', () => {
  it('returns row 1 with no picks', () => {
    expect(nextUnpickedRow({})).toBe(1)
  })

  it('returns the first gap in sequence', () => {
    expect(nextUnpickedRow({ row1: 'a', row2: 'b' })).toBe(3)
  })

  it('returns null once all 4 are picked', () => {
    expect(nextUnpickedRow({ row1: 'a', row2: 'a', row3: 'a', row4: 'a' })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// capstoneEarned
// ---------------------------------------------------------------------------

describe('capstoneEarned', () => {
  it('requires both level 50 AND row 4 picked', () => {
    expect(capstoneEarned(50, { row4: 'a' })).toBe(true)
    expect(capstoneEarned(49, { row4: 'a' })).toBe(false)
    expect(capstoneEarned(50, {})).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// resolveBlessingAllocations / flattenBlessingTree
// ---------------------------------------------------------------------------

describe('resolveBlessingAllocations', () => {
  it('maps each picked row to a 1-ranked nodeId, skipping unpicked rows', () => {
    expect(resolveBlessingAllocations({ row1: 'a', row3: 'b' })).toEqual({
      'row1-a': 1,
      'row3-b': 1,
    })
  })

  it('returns an empty map with no picks', () => {
    expect(resolveBlessingAllocations({})).toEqual({})
  })
})

describe('flattenBlessingTree', () => {
  it('flattens rows/choices into row<N>-<choiceId> nodeIds the engine expects', () => {
    const flat = flattenBlessingTree([
      { row: 1, choices: [{ choiceId: 'a', effects: [{ stat: 'attack', kind: 'flat', value: 5 }] }, { choiceId: 'b', effects: [] }] },
    ])
    expect(flat).toEqual([
      { nodeId: 'row1-a', effects: [{ stat: 'attack', kind: 'flat', value: 5 }] },
      { nodeId: 'row1-b', effects: [] },
    ])
  })

  it('returns an empty list for undefined/empty input', () => {
    expect(flattenBlessingTree(undefined)).toEqual([])
    expect(flattenBlessingTree([])).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// resolveCapstoneBonuses
// ---------------------------------------------------------------------------

describe('resolveCapstoneBonuses', () => {
  const statCapstone: CapstoneDef = {
    title: 'Ascendant',
    kind: 'stat',
    effects: [{ stat: 'attack', kind: 'flat', value: 20 }],
  }

  it('grants nothing when not earned', () => {
    expect(resolveCapstoneBonuses(statCapstone, false, {})).toEqual({})
  })

  it('grants nothing when no capstone is authored', () => {
    expect(resolveCapstoneBonuses(undefined, true, {})).toEqual({})
  })

  it('grants a flat capstone unconditionally once earned', () => {
    expect(resolveCapstoneBonuses(statCapstone, true, {})).toEqual({
      attack: { flat: 20, pct: 0 },
    })
  })

  it('gates a conditional capstone on the matching context, reusing the trait condition engine', () => {
    const conditional: CapstoneDef = {
      title: 'Gravebound Ascendance',
      kind: 'conditional',
      effects: [{ stat: 'attack', kind: 'pct', value: 40 }],
      condition: { type: 'map', value: 'gravemarch' },
    }
    expect(resolveCapstoneBonuses(conditional, true, { mapKey: 'gravemarch' })).toEqual({
      attack: { flat: 0, pct: 40 },
    })
    expect(resolveCapstoneBonuses(conditional, true, { mapKey: 'embercrag' })).toEqual({})
  })

  it('grants no stat bonus for an ability capstone — that flavor is resolved by the combat sim, not the stat engine', () => {
    const ability: CapstoneDef = { title: 'Avatar', kind: 'ability', abilityKind: 'surviveFatal' }
    expect(resolveCapstoneBonuses(ability, true, {})).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// resolveCapstoneAbility (ADR-0045 Phase B)
// ---------------------------------------------------------------------------

describe('resolveCapstoneAbility', () => {
  const surviveFatal: CapstoneDef = { title: 'Avatar', kind: 'ability', abilityKind: 'surviveFatal' }
  const partyBuff: CapstoneDef = {
    title: 'Bulwark',
    kind: 'ability',
    abilityKind: 'partyBuffOnStart',
    abilityParams: { stat: 'defense', kind: 'flat', value: 25 },
  }

  it('grants nothing when not earned', () => {
    expect(resolveCapstoneAbility(surviveFatal, false)).toBeUndefined()
  })

  it('grants nothing when no capstone is authored', () => {
    expect(resolveCapstoneAbility(undefined, true)).toBeUndefined()
  })

  it('grants nothing for a stat/conditional capstone — ability resolution is Ability-kind only', () => {
    const stat: CapstoneDef = { title: 'Ascendant', kind: 'stat', effects: [{ stat: 'attack', kind: 'flat', value: 20 }] }
    expect(resolveCapstoneAbility(stat, true)).toBeUndefined()
  })

  it('resolves an earned surviveFatal capstone to its combat-engine shape', () => {
    expect(resolveCapstoneAbility(surviveFatal, true)).toEqual({ kind: 'surviveFatal' })
  })

  it('resolves an earned partyBuffOnStart capstone, carrying stat/kind/value through', () => {
    expect(resolveCapstoneAbility(partyBuff, true)).toEqual({
      kind: 'partyBuffOnStart',
      stat: 'defense',
      statKind: 'flat',
      value: 25,
    })
  })

  it('grants nothing for partyBuffOnStart missing its params (incomplete authoring)', () => {
    const incomplete: CapstoneDef = { title: 'Bulwark', kind: 'ability', abilityKind: 'partyBuffOnStart' }
    expect(resolveCapstoneAbility(incomplete, true)).toBeUndefined()
  })
})
