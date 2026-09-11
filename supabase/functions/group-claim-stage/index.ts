import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'
import { simulateCombat, marginBonus, levelRewardBonus, makeRng, type Combatant, type Enemy } from '../../../src/lib/combat.ts'
import {
  effectiveStats, finalReward, mergeBonuses,
  type StatValue, type StatGrowth, type ItemDefBonuses, type EquippedItem,
} from '../../../src/lib/stats.ts'
import { applyXp } from '../../../src/lib/leveling.ts'
import { resolveRole, type CharacterRole } from '../../../src/lib/roles.ts'
import type { School } from '../../../src/lib/schools.ts'
import { collectTraitBonuses, partyAverageStat, type TraitDef, type TraitContext } from '../../../src/lib/traits.ts'
import {
  flattenBlessingTree, resolveBlessingAllocations, capstoneEarned,
  resolveCapstoneBonuses, resolveCapstoneAbility,
  type RawBlessingRow, type CapstoneDef, type BlessingPicks,
} from '../../../src/lib/blessings.ts'
import { rollItemLoot } from '../../../src/lib/loot.ts'
import { resolveShopBonus } from '../../../src/lib/echoShop.ts'

// group-claim-stage: the dungeon/raid combat resolver (spec §5). Combatant-building is IDENTICAL to
// mission-claim (character-intrinsic, not mission-specific) — deliberately not extracted into a
// shared module in this plan (spec's non-goals keep the refactor surface small; Task 3 already
// extracted the one piece that's pure ROI, the loot roll). No map progress, no first-clear
// multiplier, no acquisition-condition checks here (spec §3 non-goals).

const PARTY_BONUS_PER_EXTRA_MEMBER = 0.1

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type EnemyRow = {
  enemyKey: string; archetype?: string; health: number; attack: number; damageType: School; speed: number
  defense?: number; resistance?: number; resistances?: { school: School; value: number }[]
  block?: number; critChance?: number; critDamage?: number; armorPen?: number; dodge?: number
  healthRegen?: number; spikeEverySeconds?: number; spikeMultiplier?: number
}
type StageRow = {
  baseXp?: number
  rewards?: { kind: 'currency' | 'resource'; code: string; amount: number }[]
  loot?: { itemKey: string | null; dropChance?: number; quantityMin?: number; quantityMax?: number; rarityWeights?: { rarity: string; weight: number }[] }[]
  encounter?: { timeLimitSeconds: number; enemies: { count?: number; enemy: EnemyRow }[] } | null
}
type GroupDefRow = { stages?: StageRow[] } | null
type CharDefRow = {
  charKey: string; charClass: string; role?: CharacterRole | null; damageSchool?: School | null
  baseStats?: StatValue[]; growth?: StatGrowth[]; blessingTree?: RawBlessingRow[]
  capstone?: CapstoneDef; traits?: TraitDef[]
}
type ItemDefRow = { itemKey: string; statBonuses?: ItemDefBonuses['statBonuses'] }
type CharRow = {
  id: string; character_def_id: string; level: number; xp: number
  blessings: BlessingPicks | null; equipped: Record<string, EquippedItem> | null; current_hp: number | null
}

const CHARDEFS_GROQ = `*[_type == "characterDef" && charKey in $keys]{
  charKey, charClass, role, damageSchool,
  baseStats[]{ stat, value },
  growth[]{ stat, perLevel, milestones[]{ level, bonus } },
  blessingTree[]{ row, choices[]{ choiceId, effects[]{ stat, kind, value } } },
  capstone{ title, kind, effects[]{ stat, kind, value }, condition{ type, value }, abilityKind, abilityParams{ stat, kind, value } },
  traits[]->{ traitKey, name, condition{ type, value }, effects[]{ stat, kind, value } }
}`
const ITEMDEFS_GROQ = `*[_type == "itemDef" && itemKey in $keys]{ itemKey, statBonuses[]{ stat, kind, value } }`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  const admin = createAdminClient()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
  const playerId = userData.user.id

  let body: { kind?: unknown; defKey?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const kind = body.kind
  const defKey = body.defKey
  if (kind !== 'dungeon' && kind !== 'raid') return json({ error: 'kind must be "dungeon" or "raid"' }, 400)
  if (typeof defKey !== 'string' || defKey.length === 0) return json({ error: 'defKey is required' }, 400)

  const { data: run, error: runErr } = await admin
    .from('group_runs')
    .select('current_stage_index, party, stage_started_at, stage_ends_at')
    .eq('player_id', playerId).eq('kind', kind).eq('def_key', defKey)
    .maybeSingle()
  if (runErr) return json({ error: 'Could not load run' }, 500)
  if (!run || !run.stage_ends_at) return json({ error: 'No stage in flight' }, 404)
  if (new Date(run.stage_ends_at).getTime() > Date.now()) return json({ error: 'Stage not finished' }, 409)

  const party = run.party as string[]
  const stageIndex = run.current_stage_index

  const { data: charsData, error: charsErr } = await admin
    .from('player_characters')
    .select('id, character_def_id, level, xp, blessings, equipped, current_hp')
    .in('id', party).eq('player_id', playerId)
  if (charsErr) return json({ error: 'Could not load party' }, 500)
  const chars = (charsData ?? []) as CharRow[]
  if (chars.length !== party.length) return json({ error: 'Party is missing characters' }, 500)

  const sanityType = kind === 'dungeon' ? 'dungeonDef' : 'raidDef'
  const keyField = kind === 'dungeon' ? 'dungeonKey' : 'raidKey'
  let groupDef: GroupDefRow
  let charDefs: CharDefRow[]
  let itemDefs: ItemDefRow[]
  try {
    groupDef = await sanityQuery<GroupDefRow>(
      `*[_type == "${sanityType}" && ${keyField} == $key][0]{
        stages[]{
          baseXp, rewards[]{ kind, code, amount },
          loot[]{ dropChance, quantityMin, quantityMax, rarityWeights[]{ rarity, weight }, "itemKey": item->itemKey },
          encounter->{ timeLimitSeconds, enemies[]{ count, "enemy": enemy->{ enemyKey, archetype, health, attack, damageType, speed, defense, resistance, resistances[]{ school, value }, block, critChance, critDamage, armorPen, dodge, healthRegen, spikeEverySeconds, spikeMultiplier } } }
        }
      }`,
      { key: defKey },
    )
    const charKeys = [...new Set(chars.map((c) => c.character_def_id))]
    charDefs = await sanityQuery<CharDefRow[]>(CHARDEFS_GROQ, { keys: charKeys })
    const itemKeys = [...new Set(chars.flatMap((c) => Object.values(c.equipped ?? {}).map((e) => e.itemDefId)))]
    itemDefs = itemKeys.length ? await sanityQuery<ItemDefRow[]>(ITEMDEFS_GROQ, { keys: itemKeys }) : []
  } catch (e) {
    console.error('Sanity fetch failed', e)
    return json({ error: 'Could not load stage content' }, 502)
  }
  const stage = groupDef?.stages?.[stageIndex]
  if (!stage || !stage.encounter) return json({ error: 'Stage or encounter not found' }, 404)
  const isLastStage = stageIndex === (groupDef!.stages!.length - 1)

  const charDefByKey = new Map(charDefs.map((d) => [d.charKey, d]))
  const itemDefById: Record<string, ItemDefBonuses> = Object.fromEntries(itemDefs.map((i) => [i.itemKey, { statBonuses: i.statBonuses }]))

  const traitCtx: TraitContext = {
    mapKey: null,
    enemyArchetypes: [...new Set(stage.encounter.enemies.map((l) => l.enemy.archetype).filter((a): a is string => Boolean(a)))],
    enemySchools: [...new Set(stage.encounter.enemies.map((l) => l.enemy.damageType))],
  }
  const statsById: Record<string, Record<string, number>> = {}
  const combatants: Combatant[] = []
  for (const c of chars) {
    const def = charDefByKey.get(c.character_def_id)
    if (!def) return json({ error: `Missing character definition: ${c.character_def_id}` }, 500)
    const picks = c.blessings ?? {}
    const earnedCapstone = capstoneEarned(c.level, picks)
    const stats = effectiveStats({
      level: c.level, baseStats: def.baseStats ?? [], growth: def.growth ?? [],
      blessingAllocations: resolveBlessingAllocations(picks), blessingNodes: flattenBlessingTree(def.blessingTree),
      equipped: c.equipped ?? {}, itemDefs: itemDefById,
      extraBonuses: mergeBonuses(
        collectTraitBonuses(def.traits ?? [], traitCtx),
        resolveCapstoneBonuses(def.capstone, earnedCapstone, traitCtx),
      ),
    })
    statsById[c.id] = stats
    combatants.push({
      id: c.id, role: resolveRole(def.charClass, def.role), stats,
      currentHp: c.current_hp ?? undefined, damageSchool: def.damageSchool ?? undefined,
      ability: resolveCapstoneAbility(def.capstone, earnedCapstone),
    })
  }

  const enemies: Enemy[] = []
  stage.encounter.enemies.forEach((line, li) => {
    const e = line.enemy
    for (let k = 0; k < (line.count ?? 1); k++) {
      enemies.push({
        id: `${e.enemyKey}-${li}-${k}`, health: e.health, attack: e.attack, damageType: e.damageType, speed: e.speed,
        defense: e.defense, resistance: e.resistance,
        resistances: e.resistances ? Object.fromEntries(e.resistances.map((r) => [r.school, r.value])) : undefined,
        block: e.block, critChance: e.critChance, critDamage: e.critDamage, armorPen: e.armorPen, dodge: e.dodge,
        healthRegen: e.healthRegen, spikeEverySeconds: e.spikeEverySeconds, spikeMultiplier: e.spikeMultiplier,
      })
    }
  })

  const runId = `${playerId}:${kind}:${defKey}:${stageIndex}`
  const result = simulateCombat({ party: combatants, encounter: { enemies, timeLimitSeconds: stage.encounter.timeLimitSeconds }, seed: runId })
  const win = result.outcome === 'win'

  // Echo Shop levels (ADR-0053) — this retires the old "group content doesn't fold in
  // transcendence" workaround entirely: there is no more count-based bonus for it to skip, so
  // dungeons/raids and missions are on equal footing again.
  const { data: profile } = await admin
    .from('profiles')
    .select('echo_shop')
    .eq('player_id', playerId)
    .maybeSingle()
  const shop = (profile?.echo_shop ?? {}) as Record<string, number>

  const mods = {
    marginBonus: marginBonus(result.survivingHpPct),
    levelBonus: levelRewardBonus(chars.map((c) => c.level)),
    partyBonus: (chars.length - 1) * PARTY_BONUS_PER_EXTRA_MEMBER,
  }
  const baseXp = typeof stage.baseXp === 'number' ? stage.baseXp : 0

  const charUpdates = chars.map((c) => {
    const endHp = Math.round(result.endingHp[c.id] ?? 0)
    let level = c.level
    let xp = c.xp
    if (win && endHp > 0 && baseXp > 0) {
      const xpMult = 1 + Math.max(0, statsById[c.id]?.xpGain ?? 0) / 100
      const gained = Math.round(finalReward(baseXp, mods) * xpMult)
      const rolled = applyXp(c.level, c.xp, gained)
      level = rolled.level
      xp = rolled.xp
    }
    return { id: c.id, level, xp, current_hp: endHp }
  })

  const partyStats = chars.map((c) => statsById[c.id] ?? {})
  const goldMult = 1 + Math.max(0, partyAverageStat(partyStats, 'goldFind')) / 100
  const magicFind = Math.max(0, partyAverageStat(partyStats, 'magicFind'))
  const luck = Math.max(0, partyAverageStat(partyStats, 'luck'))
  const currencies: Record<string, number> = {}
  const resources: Record<string, number> = {}
  let loot: { item_def_id: string; rarity: string; quantity: number }[] = []
  if (win) {
    for (const r of stage.rewards ?? []) {
      const isGold = r.kind === 'currency' && r.code === 'gold'
      const shopMult = isGold
        ? resolveShopBonus(shop, 'goldGain')
        : r.kind === 'resource'
          ? resolveShopBonus(shop, 'resourceGain', r.code)
          : 1
      const amount = Math.round(finalReward(r.amount, mods) * (isGold ? goldMult : 1) * shopMult)
      if (amount <= 0) continue
      const bucket = r.kind === 'resource' ? resources : currencies
      bucket[r.code] = (bucket[r.code] ?? 0) + amount
    }
    const lootRng = makeRng(`${runId}:loot`)
    loot = rollItemLoot(stage.loot ?? [], lootRng, { magicFind, luck })
  }

  const { error: claimErr } = await admin.rpc('claim_group_stage', {
    p_player: playerId, p_kind: kind, p_def_key: defKey, p_won: win,
    p_char_updates: charUpdates, p_loot: loot, p_currencies: currencies, p_resources: resources,
    p_is_last_stage: isLastStage,
  })
  if (claimErr) {
    console.error('claim_group_stage failed', claimErr)
    const reason = claimErr.message.replace(/^.*claim_group_stage:\s*/, '')
    return json({ error: reason || 'Could not claim stage' }, 409)
  }

  return json({
    outcome: result.outcome, reason: result.reason, survivingHpPct: result.survivingHpPct,
    durationSeconds: result.durationSeconds,
    rewards: { currencies, resources, loot },
    characters: charUpdates,
    stageIndex, runComplete: win && isLastStage,
  }, 200)
})
