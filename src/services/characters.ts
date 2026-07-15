import { sanity } from './sanity'
import type { StatValue, StatGrowth, BlessingNodeDef, NodeEffect } from '../lib/stats'
import type { CharacterRole } from '../lib/roles'
import type { School } from '../lib/schools'
import type { TraitDef } from '../lib/traits'
import { flattenBlessingTree, type CapstoneDef } from '../lib/blessings'

// Fetches authored character definitions from Sanity and maps them onto the stat engine's input
// shapes (src/lib/stats.ts). Identity (name/class/role) + the def's baseStats/growth/blessing tree;
// per-player instance state (level/xp/gear/picks) is NOT here — that's Supabase.

/** One row of a character's bespoke blessing tree (ADR-0045) — the rich, UI-facing shape. */
export type CharacterBlessingRow = {
  row: number
  choices: Array<{ choiceId: 'a' | 'b'; title: string; description?: string; effects: NodeEffect[] }>
}

export type GameCharacter = {
  charKey: string
  name: string
  charClass: string
  role?: CharacterRole
  damageSchool?: School
  baseStats: StatValue[]
  growth: StatGrowth[]
  /** Rich, UI-facing tree (title/description/choiceId intact) — for the blessings page. */
  blessingTree: CharacterBlessingRow[]
  /** Flattened engine input for `effectiveStats` (nodeId = `row<N>-<choice>`) — derived from
   *  `blessingTree`, not a second query. */
  blessingNodes: BlessingNodeDef[]
  capstone?: CapstoneDef
  traits: TraitDef[]
}

// Projects exactly the engine-needed fields and strips Sanity's _key/_type wrappers. abilityKind/
// abilityParams are projected even though Phase A's schema doesn't author them yet (Phase B adds
// the schema fields) — GROQ returns null for not-yet-existing fields, so this needs no revisit.
const CHARACTER_DEFS_QUERY = `*[_type == "characterDef" && defined(charKey)]{
  charKey, name, charClass, role, damageSchool,
  baseStats[]{stat, value},
  growth[]{stat, perLevel, milestones[]{level, bonus}},
  blessingTree[]{row, choices[]{choiceId, title, description, effects[]{stat, kind, value}}},
  capstone{title, description, kind, effects[]{stat, kind, value}, condition{type, value}, abilityKind, abilityParams{stat, kind, value}},
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
  blessingTree?: Array<{
    row: number
    choices?: Array<{ choiceId: 'a' | 'b'; title: string; description?: string; effects?: NodeEffect[] }>
  }>
  capstone?: {
    title: string
    description?: string
    kind: 'stat' | 'conditional' | 'ability'
    effects?: NodeEffect[]
    condition?: CapstoneDef['condition']
    abilityKind?: string
    abilityParams?: CapstoneDef['abilityParams']
  }
  traits?: TraitDef[]
}

export async function fetchCharacterDefs(): Promise<GameCharacter[]> {
  const raw = await sanity.fetch<RawCharacterDef[]>(CHARACTER_DEFS_QUERY)
  return raw.map((c) => {
    const blessingTree: CharacterBlessingRow[] = (c.blessingTree ?? []).map((r) => ({
      row: r.row,
      choices: (r.choices ?? []).map((ch) => ({
        choiceId: ch.choiceId,
        title: ch.title,
        description: ch.description,
        effects: ch.effects ?? [],
      })),
    }))
    return {
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
      blessingTree,
      blessingNodes: flattenBlessingTree(c.blessingTree),
      capstone: c.capstone
        ? {
            title: c.capstone.title,
            description: c.capstone.description,
            kind: c.capstone.kind,
            effects: c.capstone.effects ?? [],
            condition: c.capstone.condition,
            abilityKind: c.capstone.abilityKind,
            abilityParams: c.capstone.abilityParams,
          }
        : undefined,
      traits: c.traits ?? [],
    }
  })
}
