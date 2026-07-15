import { sanityQuery } from './sanity.ts'
import {
  effectiveStats,
  mergeBonuses,
  type StatValue,
  type StatGrowth,
  type ItemDefBonuses,
  type EquippedItem,
  type StatMap,
} from '../../../src/lib/stats.ts'
import { collectTraitBonuses, type TraitDef, type TraitContext } from '../../../src/lib/traits.ts'
import {
  flattenBlessingTree,
  resolveBlessingAllocations,
  capstoneEarned,
  resolveCapstoneBonuses,
  type RawBlessingRow,
  type CapstoneDef,
  type BlessingPicks,
} from '../../../src/lib/blessings.ts'

// Shared effective-stats fetcher for Edge Functions: stats are never stored (ADR-0002), so any
// function that needs them recomputes the same way mission-claim builds combatants — Sanity
// character def + blessings + equipped gear + condition-matched traits (ADR-0035).

export type CharRowForHp = {
  id: string
  character_def_id: string
  level: number
  blessings: BlessingPicks | null
  equipped: Record<string, EquippedItem> | null
}

type CharDefRow = {
  charKey: string
  baseStats?: StatValue[]
  growth?: StatGrowth[]
  blessingTree?: RawBlessingRow[]
  capstone?: CapstoneDef
  traits?: TraitDef[]
}
type ItemDefRow = { itemKey: string; statBonuses?: ItemDefBonuses['statBonuses'] }

const CHARDEFS_GROQ = `*[_type == "characterDef" && charKey in $keys]{
  charKey,
  baseStats[]{ stat, value },
  growth[]{ stat, perLevel, milestones[]{ level, bonus } },
  blessingTree[]{ row, choices[]{ choiceId, effects[]{ stat, kind, value } } },
  capstone{ title, kind, effects[]{ stat, kind, value }, condition{ type, value }, abilityKind, abilityParams{ stat, kind, value } },
  traits[]->{ traitKey, name, condition{ type, value }, effects[]{ stat, kind, value } }
}`
const ITEMDEFS_GROQ = `*[_type == "itemDef" && itemKey in $keys]{ itemKey, statBonuses[]{ stat, kind, value } }`

/** Full effective stat map per character id, with traits matched against `ctx`
 *  (pass {} for always-on traits only). Throws on Sanity failure or a missing def. */
export async function statsByCharacter(
  chars: CharRowForHp[],
  ctx: TraitContext,
): Promise<Record<string, StatMap>> {
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

  const out: Record<string, StatMap> = {}
  for (const c of chars) {
    const def = charDefByKey.get(c.character_def_id)
    if (!def) throw new Error(`Missing character definition: ${c.character_def_id}`)
    const picks = c.blessings ?? {}
    out[c.id] = effectiveStats({
      level: c.level,
      baseStats: def.baseStats ?? [],
      growth: def.growth ?? [],
      blessingAllocations: resolveBlessingAllocations(picks),
      blessingNodes: flattenBlessingTree(def.blessingTree),
      equipped: c.equipped ?? {},
      itemDefs: itemDefById,
      extraBonuses: mergeBonuses(
        collectTraitBonuses(def.traits ?? [], ctx),
        resolveCapstoneBonuses(def.capstone, capstoneEarned(c.level, picks), ctx),
      ),
    })
  }
  return out
}

/** Max HP per character id (infirmary settling). Context-free: only always-on traits apply. */
export async function maxHpByCharacter(chars: CharRowForHp[]): Promise<Record<string, number>> {
  const stats = await statsByCharacter(chars, {})
  return Object.fromEntries(
    chars.map((c) => [c.id, Math.max(1, Math.round(stats[c.id].health ?? 0))]),
  )
}
