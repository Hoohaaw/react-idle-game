import { sanity } from './sanity'
import type { StatValue, StatGrowth, BlessingNodeDef } from '../lib/stats'
import type { CharacterRole } from '../lib/roles'
import type { School } from '../lib/schools'
import type { TraitDef } from '../lib/traits'

// Fetches authored character definitions from Sanity and maps them onto the stat engine's input
// shapes (src/lib/stats.ts). Identity (name/class/role) + the def's baseStats/growth/blessing nodes;
// per-player instance state (level/xp/gear/allocations) is NOT here — that's Supabase.

export type GameCharacter = {
  charKey: string
  name: string
  charClass: string
  role?: CharacterRole
  damageSchool?: School
  baseStats: StatValue[]
  growth: StatGrowth[]
  blessingNodes: BlessingNodeDef[]
  traits: TraitDef[]
}

// Projects exactly the engine-needed fields and strips Sanity's _key/_type wrappers.
const CHARACTER_DEFS_QUERY = `*[_type == "characterDef" && defined(charKey)]{
  charKey, name, charClass, role, damageSchool,
  baseStats[]{stat, value},
  growth[]{stat, perLevel, milestones[]{level, bonus}},
  blessingTree[]{nodeId, effects[]{stat, kind, perRank}},
  traits[]->{traitKey, name, description, condition{type, value}, effects[]{stat, kind, value}}
}`

// Raw GROQ result — Sanity fields are all optional, so guard on read. (Hand-typed on purpose:
// src/sanity.types.ts is stale — it predates the expanded stat registry + the `role` field.)
type RawCharacterDef = {
  charKey: string
  name: string
  charClass: string
  role?: CharacterRole
  damageSchool?: School
  baseStats?: Array<{ stat: string; value: number }>
  growth?: Array<{ stat: string; perLevel: number; milestones?: Array<{ level: number; bonus: number }> }>
  blessingTree?: Array<{ nodeId: string; effects?: Array<{ stat: string; kind: 'flat' | 'pct'; perRank: number }> }>
  traits?: TraitDef[]
}

export async function fetchCharacterDefs(): Promise<GameCharacter[]> {
  const raw = await sanity.fetch<RawCharacterDef[]>(CHARACTER_DEFS_QUERY)
  return raw.map((c) => ({
    charKey: c.charKey,
    name: c.name,
    charClass: c.charClass,
    role: c.role,
    damageSchool: c.damageSchool,
    baseStats: (c.baseStats ?? []).map((b) => ({ stat: b.stat, value: b.value })),
    growth: (c.growth ?? []).map((g) => ({
      stat: g.stat,
      perLevel: g.perLevel,
      milestones: g.milestones ?? [],
    })),
    blessingNodes: (c.blessingTree ?? []).map((n) => ({
      nodeId: n.nodeId,
      effects: n.effects ?? [],
    })),
    traits: c.traits ?? [],
  }))
}
