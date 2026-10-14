import { describe, it, expect } from 'vitest'
import { resolveTotemPartyBuffs } from './totems'

describe('resolveTotemPartyBuffs', () => {
  it('returns an empty array when no totem is equipped (null)', () => {
    expect(resolveTotemPartyBuffs(null)).toEqual([])
  })

  it('returns an empty array when the totem reference is stale/undefined (deleted in Sanity)', () => {
    expect(resolveTotemPartyBuffs(undefined)).toEqual([])
  })

  it('passes through effects on the allowed-stat list unchanged', () => {
    const out = resolveTotemPartyBuffs({
      totemKey: 'totem-of-minor-warding',
      effects: [{ stat: 'resistance', kind: 'flat', value: 3 }],
    })
    expect(out).toEqual([{ stat: 'resistance', kind: 'flat', value: 3 }])
  })

  it('drops an effect targeting a stat outside the allowlist, rather than throwing', () => {
    const out = resolveTotemPartyBuffs({
      totemKey: 'bad-totem',
      // 'attack' is not in TOTEM_ALLOWED_STATS — pre-routed into `power` by combat.ts's
      // partyUnit(), same reason capstone's partyBuffOnStart restricts to the same list.
      effects: [
        { stat: 'attack', kind: 'flat', value: 999 },
        { stat: 'block', kind: 'flat', value: 3 },
      ],
    })
    expect(out).toEqual([{ stat: 'block', kind: 'flat', value: 3 }])
  })
})
