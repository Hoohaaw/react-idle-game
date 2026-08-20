import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'
import {
  simulateCombat,
  marginBonus,
  levelRewardBonus,
  makeRng,
  type Combatant,
  type Enemy,
} from '../../../src/lib/combat.ts'
import {
  effectiveStats,
  finalReward,
  mergeBonuses,
  type StatValue,
  type StatGrowth,
  type ItemDefBonuses,
  type EquippedItem,
} from '../../../src/lib/stats.ts'
import { applyXp } from '../../../src/lib/leveling.ts'
import { resolveRole, type CharacterRole } from '../../../src/lib/roles.ts'
import type { School } from '../../../src/lib/schools.ts'
import { collectTraitBonuses, partyAverageStat, type TraitDef, type TraitContext } from '../../../src/lib/traits.ts'
import {
  flattenBlessingTree,
  resolveBlessingAllocations,
  capstoneEarned,
  resolveCapstoneBonuses,
  resolveCapstoneAbility,
  type RawBlessingRow,
  type CapstoneDef,
  type BlessingPicks,
} from '../../../src/lib/blessings.ts'

// mission-claim: the combat resolver (ADR-0012/0013/0016). Runs the server-authoritative auto-battle
// sim for a finished mission, then applies the outcome through the atomic `claim_mission` RPC.
//   win  → survivors gain XP, wallet gains scaled currencies/resources, loot rolls independently.
//   loss → nothing granted; persistent damage still written; party freed.
// The pure engine (sim, stat compute, leveling) is imported straight from src/lib (single source of
// truth so the client can replay the same fight) — ADR-0016. This function decides the numbers; the
// RPC owns atomicity + the double-claim guard.

const TRANSCENDENCE_BONUS_PER_COUNT = 0.1 // ADR-0014/design: transcendence_count × 10% to all rewards.
const PARTY_BONUS_PER_EXTRA_MEMBER = 0.1 // (partySize − 1) × 10%.
// First-time clear of a map stage pays this on XP/gold/resources (ADR-0041) — pushing new
// content is rewarded once; repeat clears (farming) pay the normal pipeline. Loot is untouched.
const FIRST_CLEAR_MULT = 1.5

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ---- Sanity-fetch shapes ----------------------------------------------------------------------

type EnemyRow = {
  enemyKey: string
  archetype?: string
  health: number
  attack: number
  damageType: School
  speed: number
  defense?: number
  resistance?: number
  resistances?: { school: School; value: number }[]
  block?: number
  critChance?: number
  critDamage?: number
  armorPen?: number
  dodge?: number
  healthRegen?: number
  spikeEverySeconds?: number
  spikeMultiplier?: number
}
type MissionForClaim = {
  baseXp?: number
  stage?: number
  map?: { mapKey?: string } | null
  rewards?: { kind: 'currency' | 'resource'; code: string; amount: number }[]
  loot?: {
    itemKey: string | null
    dropChance?: number
    quantityMin?: number
    quantityMax?: number
    rarityWeights?: { rarity: string; weight: number }[]
  }[]
  encounter?: { timeLimitSeconds: number; enemies: { count?: number; enemy: EnemyRow }[] } | null
}
type CharDefRow = {
  charKey: string
  charClass: string
  role?: CharacterRole | null
  damageSchool?: School | null
  baseStats?: StatValue[]
  growth?: StatGrowth[]
  blessingTree?: RawBlessingRow[]
  capstone?: CapstoneDef
  traits?: TraitDef[]
}
type ItemDefRow = { itemKey: string; statBonuses?: ItemDefBonuses['statBonuses'] }

// player_characters row (untyped admin client → declare what we read).
type CharRow = {
  id: string
  character_def_id: string
  level: number
  xp: number
  blessings: BlessingPicks | null
  equipped: Record<string, EquippedItem> | null
  current_hp: number | null
}

const MISSION_GROQ = `*[_type == "missionDef" && missionKey == $id][0]{
  baseXp, stage,
  "map": map->{ mapKey },
  rewards[]{ kind, code, amount },
  loot[]{ dropChance, quantityMin, quantityMax, rarityWeights[]{ rarity, weight }, "itemKey": item->itemKey },
  encounter->{
    timeLimitSeconds,
    enemies[]{ count, "enemy": enemy->{ enemyKey, archetype, health, attack, damageType, speed, defense, resistance, resistances[]{ school, value }, block, critChance, critDamage, armorPen, dodge, healthRegen, spikeEverySeconds, spikeMultiplier } }
  }
}`

const CHARDEFS_GROQ = `*[_type == "characterDef" && charKey in $keys]{
  charKey, charClass, role, damageSchool,
  baseStats[]{ stat, value },
  growth[]{ stat, perLevel, milestones[]{ level, bonus } },
  blessingTree[]{ row, choices[]{ choiceId, effects[]{ stat, kind, value } } },
  capstone{ title, kind, effects[]{ stat, kind, value }, condition{ type, value }, abilityKind, abilityParams{ stat, kind, value } },
  traits[]->{ traitKey, name, condition{ type, value }, effects[]{ stat, kind, value } }
}`

const ITEMDEFS_GROQ = `*[_type == "itemDef" && itemKey in $keys]{ itemKey, statBonuses[]{ stat, kind, value } }`

/** Weighted rarity pick (independent per-item roll — ADR-0017). Empty/zero weights → Common. */
function rollRarity(weights: { rarity: string; weight: number }[] | undefined, rng: () => number): string {
  const list = (weights ?? []).filter((w) => (w.weight ?? 0) > 0)
  if (list.length === 0) return 'Common'
  const total = list.reduce((s, w) => s + w.weight, 0)
  let r = rng() * total
  for (const w of list) {
    r -= w.weight
    if (r < 0) return w.rarity
  }
  return list[list.length - 1].rarity
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  const admin = createAdminClient()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
  const playerId = userData.user.id

  let body: { runId?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const runId = body.runId
  if (typeof runId !== 'string' || runId.length === 0) return json({ error: 'runId is required' }, 400)

  // 1. Load the run (owner-scoped) — the RPC re-guards atomically, this is a friendly early-out.
  const { data: run, error: runErr } = await admin
    .from('mission_runs')
    .select('id, mission_def_id, party, ends_at')
    .eq('id', runId)
    .eq('player_id', playerId)
    .maybeSingle()
  if (runErr) {
    console.error('run lookup failed', runErr)
    return json({ error: 'Could not load mission' }, 500)
  }
  if (!run) return json({ error: 'Mission not found' }, 404)
  if (new Date(run.ends_at).getTime() > Date.now()) return json({ error: 'Mission not finished' }, 409)

  const party = run.party as string[]

  // 2. Load the party's player_characters rows.
  const { data: charsData, error: charsErr } = await admin
    .from('player_characters')
    .select('id, character_def_id, level, xp, blessings, equipped, current_hp')
    .in('id', party)
    .eq('player_id', playerId)
  if (charsErr) {
    console.error('party lookup failed', charsErr)
    return json({ error: 'Could not load party' }, 500)
  }
  const chars = (charsData ?? []) as CharRow[]
  if (chars.length !== party.length) return json({ error: 'Party is missing characters' }, 500)

  // 3. Player profile: transcendence multiplier + map progress (for the first-clear check).
  const { data: profile } = await admin
    .from('profiles')
    .select('transcendence_count, map_progress')
    .eq('player_id', playerId)
    .maybeSingle()
  const transcendenceCount = profile?.transcendence_count ?? 0
  const mapProgress = (profile?.map_progress ?? {}) as Record<string, number>

  // 4. Fetch authored defs from Sanity: the mission (rewards/loot/encounter), the character defs, and
  //    every equipped item's bonuses.
  let mission: MissionForClaim | null
  let charDefs: CharDefRow[]
  let itemDefs: ItemDefRow[]
  try {
    mission = await sanityQuery<MissionForClaim | null>(MISSION_GROQ, { id: run.mission_def_id })
    const charKeys = [...new Set(chars.map((c) => c.character_def_id))]
    charDefs = await sanityQuery<CharDefRow[]>(CHARDEFS_GROQ, { keys: charKeys })
    const itemKeys = [
      ...new Set(chars.flatMap((c) => Object.values(c.equipped ?? {}).map((e) => e.itemDefId))),
    ]
    itemDefs = itemKeys.length ? await sanityQuery<ItemDefRow[]>(ITEMDEFS_GROQ, { keys: itemKeys }) : []
  } catch (e) {
    console.error('Sanity fetch failed', e)
    return json({ error: 'Could not load mission content' }, 502)
  }
  if (!mission) return json({ error: 'Mission definition not found' }, 404)
  if (!mission.encounter) return json({ error: 'Mission has no encounter' }, 500)

  const charDefByKey = new Map(charDefs.map((d) => [d.charKey, d]))
  const itemDefById: Record<string, ItemDefBonuses> = Object.fromEntries(
    itemDefs.map((i) => [i.itemKey, { statBonuses: i.statBonuses }]),
  )

  // 5. Build combatants: effective stats (level baselines + blessings + gear + condition-matched
  //    traits, ADR-0035) + role + carried HP. The trait context is this mission's map + enemy lineup.
  const traitCtx: TraitContext = {
    mapKey: mission.map?.mapKey ?? null,
    enemyArchetypes: [
      ...new Set(mission.encounter.enemies.map((l) => l.enemy.archetype).filter((a): a is string => Boolean(a))),
    ],
    enemySchools: [...new Set(mission.encounter.enemies.map((l) => l.enemy.damageType))],
  }
  const statsById: Record<string, Record<string, number>> = {}
  const combatants: Combatant[] = []
  for (const c of chars) {
    const def = charDefByKey.get(c.character_def_id)
    if (!def) return json({ error: `Missing character definition: ${c.character_def_id}` }, 500)
    const picks = c.blessings ?? {}
    const earnedCapstone = capstoneEarned(c.level, picks)
    const stats = effectiveStats({
      level: c.level,
      baseStats: def.baseStats ?? [],
      growth: def.growth ?? [],
      blessingAllocations: resolveBlessingAllocations(picks),
      blessingNodes: flattenBlessingTree(def.blessingTree),
      equipped: c.equipped ?? {},
      itemDefs: itemDefById,
      extraBonuses: mergeBonuses(
        collectTraitBonuses(def.traits ?? [], traitCtx),
        resolveCapstoneBonuses(def.capstone, earnedCapstone, traitCtx),
      ),
    })
    statsById[c.id] = stats
    combatants.push({
      id: c.id,
      role: resolveRole(def.charClass, def.role),
      stats,
      currentHp: c.current_hp ?? undefined, // null = full → sim uses maxHp
      damageSchool: def.damageSchool ?? undefined, // ADR-0033; sim defaults to neutral 'magic'
      ability: resolveCapstoneAbility(def.capstone, earnedCapstone), // ADR-0045 Phase B
    })
  }

  // 6. Expand the encounter (swarms → one Enemy per count).
  const enemies: Enemy[] = []
  mission.encounter.enemies.forEach((line, li) => {
    const e = line.enemy
    for (let k = 0; k < (line.count ?? 1); k++) {
      enemies.push({
        id: `${e.enemyKey}-${li}-${k}`,
        health: e.health,
        attack: e.attack,
        damageType: e.damageType,
        speed: e.speed,
        defense: e.defense,
        resistance: e.resistance,
        resistances: e.resistances
          ? Object.fromEntries(e.resistances.map((r) => [r.school, r.value]))
          : undefined,
        block: e.block,
        critChance: e.critChance,
        critDamage: e.critDamage,
        armorPen: e.armorPen,
        dodge: e.dodge,
        healthRegen: e.healthRegen,
        spikeEverySeconds: e.spikeEverySeconds,
        spikeMultiplier: e.spikeMultiplier,
      })
    }
  })

  // 7. Run the sim — seeded by the run id (deterministic, replayable).
  const result = simulateCombat({
    party: combatants,
    encounter: { enemies, timeLimitSeconds: mission.encounter.timeLimitSeconds },
    seed: run.id,
  })
  const win = result.outcome === 'win'

  // First clear (ADR-0041): this win advances map progress past the player's best stage.
  // Read from the pre-claim snapshot; the RPC's greatest() write stays the atomic authority
  // (double-claiming the SAME run is blocked there — this read only prices the reward).
  const firstClear =
    win && mission.map?.mapKey != null && typeof mission.stage === 'number' &&
    mission.stage > (mapProgress[mission.map.mapKey] ?? 0)
  const firstClearMult = firstClear ? FIRST_CLEAR_MULT : 1

  // 8. Reward multipliers (win-gated pipeline — ADR-0012/0014).
  const mods = {
    marginBonus: marginBonus(result.survivingHpPct),
    levelBonus: levelRewardBonus(chars.map((c) => c.level)),
    partyBonus: (chars.length - 1) * PARTY_BONUS_PER_EXTRA_MEMBER,
    transcendenceBonus: transcendenceCount * TRANSCENDENCE_BONUS_PER_COUNT,
  }
  const baseXp = typeof mission.baseXp === 'number' ? mission.baseXp : 0

  // 9. Per-character updates. HP is always persisted (win OR loss). XP only for SURVIVORS on a win
  //    (ending HP > 0) — a character that died mid-fight earns nothing (ADR-0017). A survivor's own
  //    `xpGain` stat (Scholar trait etc., ADR-0035 — self-only by design) scales their share.
  const charUpdates = chars.map((c) => {
    const endHp = Math.round(result.endingHp[c.id] ?? 0)
    let level = c.level
    let xp = c.xp
    if (win && endHp > 0 && baseXp > 0) {
      const xpMult = 1 + Math.max(0, statsById[c.id]?.xpGain ?? 0) / 100
      const gained = Math.round(finalReward(baseXp, mods) * xpMult * firstClearMult)
      const rolled = applyXp(c.level, c.xp, gained)
      level = rolled.level
      xp = rolled.xp
    }
    return { id: c.id, level, xp, current_hp: endHp }
  })

  // 10. Wallet + loot (win only). Economy stats stack as the party AVERAGE (ADR-0035):
  //     goldFind scales the gold payout, magicFind scales each drop's chance (capped at 100%),
  //     luck gives each drop a chance at +1 quantity.
  const partyStats = chars.map((c) => statsById[c.id] ?? {})
  const goldMult = 1 + Math.max(0, partyAverageStat(partyStats, 'goldFind')) / 100
  const magicFind = Math.max(0, partyAverageStat(partyStats, 'magicFind'))
  const luck = Math.max(0, partyAverageStat(partyStats, 'luck'))
  const currencies: Record<string, number> = {}
  const resources: Record<string, number> = {}
  const loot: { item_def_id: string; rarity: string; quantity: number }[] = []
  if (win) {
    for (const r of mission.rewards ?? []) {
      const isGold = r.kind === 'currency' && r.code === 'gold'
      const amount = Math.round(finalReward(r.amount, mods) * (isGold ? goldMult : 1) * firstClearMult)
      if (amount <= 0) continue
      const bucket = r.kind === 'resource' ? resources : currencies
      bucket[r.code] = (bucket[r.code] ?? 0) + amount
    }
    const lootRng = makeRng(`${run.id}:loot`)
    for (const drop of mission.loot ?? []) {
      if (!drop.itemKey) continue
      const chance = Math.min(100, (drop.dropChance ?? 0) * (1 + magicFind / 100))
      if (lootRng() * 100 >= chance) continue // this item didn't drop
      const rarity = rollRarity(drop.rarityWeights, lootRng)
      const qMin = drop.quantityMin ?? 1
      const qMax = Math.max(qMin, drop.quantityMax ?? qMin)
      let quantity = qMin + Math.floor(lootRng() * (qMax - qMin + 1))
      if (lootRng() * 100 < luck) quantity += 1
      loot.push({ item_def_id: drop.itemKey, rarity, quantity })
    }
  }

  // 11. Apply everything atomically (the RPC owns the double-claim guard). Map progression
  //     (ADR-0034) advances inside the RPC on a win; null map/stage = legacy mission, no-op.
  const { error: claimErr } = await admin.rpc('claim_mission', {
    p_player: playerId,
    p_run_id: run.id,
    p_char_updates: charUpdates,
    p_loot: loot,
    p_currencies: currencies,
    p_resources: resources,
    p_map_key: mission.map?.mapKey ?? null,
    p_stage: mission.stage ?? null,
    p_won: result.outcome === 'win',
  })
  if (claimErr) {
    // Most likely the double-claim guard: the row was already claimed or isn't finished.
    console.error('claim_mission failed', claimErr)
    const reason = claimErr.message.replace(/^.*claim_mission:\s*/, '')
    return json({ error: reason || 'Could not claim mission' }, 409)
  }

  return json(
    {
      outcome: result.outcome,
      reason: result.reason,
      survivingHpPct: result.survivingHpPct,
      durationSeconds: result.durationSeconds,
      firstClear,
      rewards: { currencies, resources, loot },
      characters: charUpdates,
    },
    200,
  )
})
