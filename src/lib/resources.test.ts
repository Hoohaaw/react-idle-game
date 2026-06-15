import { describe, it, expect } from 'vitest'
import { RESOURCE_COLOR, RESOURCE_SOURCE, resourceHeaderStyle, mineRate } from './resources'

const RESOURCE_NAMES = ['Wood', 'Copper', 'Stone', 'Coal', 'Iron', 'Silver', 'Bronze', 'Gold', 'Platinum']

describe('RESOURCE_COLOR', () => {
  it('defines a color for every known resource', () => {
    for (const name of RESOURCE_NAMES) {
      expect(RESOURCE_COLOR[name]).toBeDefined()
    }
  })

  it('every color value is a non-empty RGB triple string', () => {
    for (const name of RESOURCE_NAMES) {
      const c = RESOURCE_COLOR[name]
      expect(c.length).toBeGreaterThan(0)
      // RGB triple format: "R,G,B"
      expect(c).toMatch(/^\d+,\d+,\d+$/)
    }
  })

  it('has the same number of entries as resources', () => {
    expect(Object.keys(RESOURCE_COLOR)).toHaveLength(RESOURCE_NAMES.length)
  })
})

describe('RESOURCE_SOURCE', () => {
  it('defines a source for every known resource', () => {
    for (const name of RESOURCE_NAMES) {
      expect(RESOURCE_SOURCE[name]).toBeDefined()
    }
  })

  it('every entry has a non-empty tier and from string', () => {
    for (const name of RESOURCE_NAMES) {
      const src = RESOURCE_SOURCE[name]
      expect(src.tier.length).toBeGreaterThan(0)
      expect(src.from.length).toBeGreaterThan(0)
    }
  })

  it('ores have tier "Ore"', () => {
    const ores = ['Copper', 'Silver', 'Gold', 'Platinum']
    for (const name of ores) {
      expect(RESOURCE_SOURCE[name].tier).toBe('Ore')
    }
  })

  it('materials have tier "Material"', () => {
    const materials = ['Wood', 'Stone', 'Coal', 'Iron', 'Bronze']
    for (const name of materials) {
      expect(RESOURCE_SOURCE[name].tier).toBe('Material')
    }
  })

  it('from strings mention the resource name and "mine"', () => {
    for (const name of RESOURCE_NAMES) {
      const src = RESOURCE_SOURCE[name]
      expect(src.from.toLowerCase()).toContain(name.toLowerCase())
      expect(src.from.toLowerCase()).toContain('mine')
    }
  })
})

describe('resourceHeaderStyle', () => {
  it('returns a CSSProperties object with background and borderBottom', () => {
    const style = resourceHeaderStyle('Wood')
    expect(style).toHaveProperty('background')
    expect(style).toHaveProperty('borderBottom')
  })

  it('includes the resource color in the background gradient', () => {
    const style = resourceHeaderStyle('Iron')
    const ironColor = RESOURCE_COLOR['Iron']
    expect(String(style.background)).toContain(ironColor)
  })

  it('includes the resource color in the border', () => {
    const style = resourceHeaderStyle('Gold')
    const goldColor = RESOURCE_COLOR['Gold']
    expect(String(style.borderBottom)).toContain(goldColor)
  })

  it('falls back gracefully for unknown resources, using the default color', () => {
    const style = resourceHeaderStyle('Mithril')
    // Should not throw and should return a valid style object
    expect(style).toHaveProperty('background')
    expect(style).toHaveProperty('borderBottom')
    // Default fallback color
    expect(String(style.background)).toContain('200,145,42')
  })
})

describe('mineRate', () => {
  it('formats seconds less than 60 as "Xs"', () => {
    expect(mineRate(1)).toBe('1s')
    expect(mineRate(30)).toBe('30s')
    expect(mineRate(59)).toBe('59s')
  })

  it('formats exactly 60 seconds as "1m"', () => {
    expect(mineRate(60)).toBe('1m')
  })

  it('formats minutes with no remainder as "Xm"', () => {
    expect(mineRate(120)).toBe('2m')
    expect(mineRate(300)).toBe('5m')
    expect(mineRate(600)).toBe('10m')
  })

  it('formats minutes with a second remainder as "Xm Ys"', () => {
    expect(mineRate(90)).toBe('1m 30s')
    expect(mineRate(61)).toBe('1m 1s')
    expect(mineRate(125)).toBe('2m 5s')
  })

  it('handles zero seconds', () => {
    expect(mineRate(0)).toBe('0s')
  })
})
