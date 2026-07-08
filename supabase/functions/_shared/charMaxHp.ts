import { sanityQuery } from './sanity.ts'
import {
  effectiveStats,
  type StatValue,
  type StatGrowth,
  type BlessingNodeDef,
  type ItemDefBonuses,
  type EquippedItem,
} from '../../../src/lib/stats.ts'

// Shared by the infirmary functions: max HP is never stored (ADR-0002), so any function
// that settles healing must recompute it the same way mission-claim builds combatants —
// effective stats from the Sanity character def + blessings + equipped gear.

export type CharRowForHp = {
  id: string
  character_def_id: string
  level: number
  blessings: Record<string, number> | null
  equipped: Record<string, EquippedItem> | null
}

type CharDefRow = {
  charKey: string
  baseStats?: StatValue[]
  growth?: StatGrowth[]
  blessingTree?: BlessingNodeDef[]
}
type ItemDefRow = { itemKey: string; statBonuses?: ItemDefBonuses['statBonuses'] }

const CHARDEFS_GROQ = `*[_type == "characterDef" && charKey in $keys]{
  charKey,
  baseStats[]{ stat, value },
  growth[]{ stat, perLevel, milestones[]{ level, bonus } },
  blessingTree[]{ nodeId, effects[]{ stat, kind, perRank } }
}`
const ITEMDEFS_GROQ = `*[_type == "itemDef" && itemKey in $keys]{ itemKey, statBonuses[]{ stat, kind, value } }`

/** Max HP per character id. Throws on Sanity failure or a missing character def. */
export async function maxHpByCharacter(chars: CharRowForHp[]): Promise<Record<string, number>> {
  const charKeys = [...new Set(chars.map((c) => c.character_def_id))]
  const charDefs = await sanityQuery<CharDefRow[]>(CHARDEFS_GROQ, { keys: charKeys })
  const itemKeys = [
    ...new Set(chars.flatMap((c) => Object.values(c.equipped ?? {}).map((e) => e.itemDefId))),
  ]
  const itemDefs = itemKeys.length
    ? await sanityQuery<ItemDefRow[]>(ITEMDEFS_GROQ, { keys: itemKeys })
    : []

  const charDefByKey = new Map(charDefs.map((d) => [d.charKey, d]))
  const itemDefById: Record<string, ItemDefBonuses> = Object.fromEntries(
    itemDefs.map((i) => [i.itemKey, { statBonuses: i.statBonuses }]),
  )

  const out: Record<string, number> = {}
  for (const c of chars) {
    const def = charDefByKey.get(c.character_def_id)
    if (!def) throw new Error(`Missing character definition: ${c.character_def_id}`)
    const stats = effectiveStats({
      level: c.level,
      baseStats: def.baseStats ?? [],
      growth: def.growth ?? [],
      blessingAllocations: c.blessings ?? {},
      blessingNodes: def.blessingTree ?? [],
      equipped: c.equipped ?? {},
      itemDefs: itemDefById,
    })
    out[c.id] = Math.max(1, Math.round(stats.health ?? 0))
  }
  return out
}
