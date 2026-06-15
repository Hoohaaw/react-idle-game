import { describe, it, expect } from 'vitest'
import {
  ROLE_STYLES,
  CLASS_ROLE,
  roleForClass,
  resolveRole,
  type CharacterRole,
} from './roles'

describe('ROLE_STYLES', () => {
  const EXPECTED_ROLES: CharacterRole[] = ['tank', 'damage', 'healer', 'utility', 'gatherer']

  it('defines a style entry for every CharacterRole', () => {
    for (const role of EXPECTED_ROLES) {
      expect(ROLE_STYLES[role]).toBeDefined()
    }
  })

  it('every entry has a non-empty label, icon, color, border, and glow', () => {
    for (const role of EXPECTED_ROLES) {
      const style = ROLE_STYLES[role]
      expect(style.label.length).toBeGreaterThan(0)
      expect(style.icon.length).toBeGreaterThan(0)
      expect(style.color.length).toBeGreaterThan(0)
      expect(style.border.length).toBeGreaterThan(0)
      expect(style.glow.length).toBeGreaterThan(0)
    }
  })

  it('has exactly five roles — one per CharacterRole variant', () => {
    expect(Object.keys(ROLE_STYLES)).toHaveLength(5)
  })
})

describe('CLASS_ROLE', () => {
  it('maps Warrior to tank', () => {
    expect(CLASS_ROLE['Warrior']).toBe('tank')
  })

  it('maps Priest and Shaman to healer', () => {
    expect(CLASS_ROLE['Priest']).toBe('healer')
    expect(CLASS_ROLE['Shaman']).toBe('healer')
  })

  it('maps Druid and Bard to utility', () => {
    expect(CLASS_ROLE['Druid']).toBe('utility')
    expect(CLASS_ROLE['Bard']).toBe('utility')
  })

  it('maps Miner and Forester to gatherer', () => {
    expect(CLASS_ROLE['Miner']).toBe('gatherer')
    expect(CLASS_ROLE['Forester']).toBe('gatherer')
  })

  it('maps Rogue, Hunter, and Mage to damage', () => {
    expect(CLASS_ROLE['Rogue']).toBe('damage')
    expect(CLASS_ROLE['Hunter']).toBe('damage')
    expect(CLASS_ROLE['Mage']).toBe('damage')
  })

  it('all values are valid CharacterRole literals', () => {
    const valid: CharacterRole[] = ['tank', 'damage', 'healer', 'utility', 'gatherer']
    for (const role of Object.values(CLASS_ROLE)) {
      expect(valid).toContain(role)
    }
  })
})

describe('roleForClass', () => {
  it('returns the mapped role for a known class', () => {
    expect(roleForClass('Warrior')).toBe('tank')
    expect(roleForClass('Priest')).toBe('healer')
    expect(roleForClass('Miner')).toBe('gatherer')
  })

  it('falls back to damage for an unknown class', () => {
    expect(roleForClass('Unknown')).toBe('damage')
    expect(roleForClass('')).toBe('damage')
    expect(roleForClass('Paladin')).toBe('damage')
  })
})

describe('resolveRole', () => {
  it('returns the authored role when provided', () => {
    expect(resolveRole('Warrior', 'healer')).toBe('healer')
    expect(resolveRole('Mage', 'tank')).toBe('tank')
  })

  it('falls back to the class default when no authored role is given', () => {
    expect(resolveRole('Warrior')).toBe('tank')
    expect(resolveRole('Priest')).toBe('healer')
  })

  it('falls back to the class default when authored role is null', () => {
    expect(resolveRole('Warrior', null)).toBe('tank')
    expect(resolveRole('Mage', null)).toBe('damage')
  })

  it('falls back to damage for an unknown class with no authored role', () => {
    expect(resolveRole('Paladin')).toBe('damage')
    expect(resolveRole('Paladin', null)).toBe('damage')
  })

  it('uses authored role even for an unknown class', () => {
    expect(resolveRole('Paladin', 'tank')).toBe('tank')
  })
})
