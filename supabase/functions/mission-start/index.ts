import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'
import { statsByCharacter } from '../_shared/charMaxHp.ts'
import { missionDurationMultiplier } from '../../../src/lib/traits.ts'
import { resolveShopBonus } from '../../../src/lib/echoShop.ts'
import { resolveFlatAscendantBonus } from '../../../src/lib/ascendantShop.ts'
import { validateMissionLoadout, type LoadoutEntry } from '../../../src/lib/consumables.ts'
import { withSentry } from '../_shared/sentry.ts'

// mission-start: dispatch a party on a mission (ADR-0003 server-authoritative write). Validates the
// caller, resolves the mission's authored duration from Sanity (the client is NOT trusted for it), and
// hands off to the atomic `start_mission` RPC which owns party validation (owned / not-downed / not-busy
// / size 1..3) + the insert under a row lock. See ADR-0016.

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(withSentry(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  const admin = createAdminClient()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
  const playerId = userData.user.id

  let body: { missionDefId?: unknown; party?: unknown; consumables?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const missionDefId = body.missionDefId
  const party = body.party
  const consumablesInput = body.consumables ?? []
  if (typeof missionDefId !== 'string' || missionDefId.length === 0) {
    return json({ error: 'missionDefId is required' }, 400)
  }
  if (!Array.isArray(party) || party.length < 1 || party.length > 3 || !party.every((p) => typeof p === 'string')) {
    return json({ error: 'party must be 1–3 character ids' }, 400)
  }
  if (!Array.isArray(consumablesInput)) {
    return json({ error: 'consumables must be an array' }, 400)
  }

  // Authored mission duration + map/stage placement (server-trusted). Also validates the mission
  // exists. `prevMapKey` = the map immediately before this mission's map in world order — the RPC
  // gates on its boss being cleared (ADR-0034); null for the first map or unplaced legacy missions.
  type MissionDef = {
    name?: string
    durationSeconds?: number
    stage?: number
    map?: { mapKey?: string; order?: number; prevMapKey?: string | null } | null
  }
  let def: MissionDef | null
  try {
    def = await sanityQuery<MissionDef | null>(
      `*[_type == "missionDef" && missionKey == $id][0]{
        name, durationSeconds, stage,
        "map": map->{
          mapKey, order,
          "prevMapKey": *[_type == "mapDef" && order < ^.order] | order(order desc)[0].mapKey
        }
      }`,
      { id: missionDefId },
    )
  } catch (e) {
    console.error('Sanity mission lookup failed', e)
    return json({ error: 'Could not validate mission' }, 502)
  }
  if (!def) return json({ error: 'Unknown mission' }, 404)
  if (typeof def.durationSeconds !== 'number' || def.durationSeconds < 1) {
    return json({ error: 'Mission has no valid duration' }, 500)
  }

  // Echo Shop + Ascendant Shop levels (ADR-0053/ADR-0054) — fetched up front so the same
  // ascendantShop map feeds both the party's effective-stats lookup below and the mission-speed
  // multiplier further down (keeps this function's Ascendant wiring consistent with charMaxHp.ts's
  // other three callers — Task 8 — rather than silently excluding this one).
  const { data: profile } = await admin
    .from('profiles')
    .select('echo_shop, ascendant_shop')
    .eq('player_id', playerId)
    .maybeSingle()
  const shop = (profile?.echo_shop ?? {}) as Record<string, number>
  const ascendantShop = (profile?.ascendant_shop ?? {}) as Record<string, number>

  // Party missionSpeedDecrease (traits/gear/blessings, ADR-0035) shortens the wait — summed
  // across members, capped 30% (src/lib/traits.ts). Stat lookup failure = unmodified duration
  // (the RPC still owns ownership/busy validation; this is a bonus, not a gate).
  let durationSeconds = def.durationSeconds
  try {
    const { data: partyRows } = await admin
      .from('player_characters')
      .select('id, character_def_id, level, blessings, equipped')
      .in('id', party as string[])
      .eq('player_id', playerId)
    if (partyRows && partyRows.length === party.length) {
      const stats = await statsByCharacter(partyRows, { mapKey: def.map?.mapKey ?? null }, ascendantShop)
      const mult = missionDurationMultiplier(partyRows.map((r) => stats[r.id]))
      durationSeconds = Math.max(1, Math.round(def.durationSeconds * mult))
    }
  } catch (e) {
    console.error('party stats lookup failed — using authored duration', e)
  }

  // Mission-prep consumables (2026-10-12 spec): resolve each party member's level/
  // bonusConsumableSlot and each submitted item's category from Sanity, then validate the
  // loadout with the pure function (Task 2) before it ever reaches the RPC. consumablesInput
  // entries are expected as { characterId: string, consumableDefId: string }.
  let validatedConsumables: LoadoutEntry[] = []
  if (consumablesInput.length > 0) {
    if (!consumablesInput.every((c) => typeof c === 'object' && c !== null && typeof (c as { characterId?: unknown }).characterId === 'string' && typeof (c as { consumableDefId?: unknown }).consumableDefId === 'string')) {
      return json({ error: 'Each consumable entry needs characterId and consumableDefId' }, 400)
    }
    const raw = consumablesInput as { characterId: string; consumableDefId: string }[]

    type CharLevelRow = { id: string; character_def_id: string; level: number }
    const { data: charRows } = await admin
      .from('player_characters')
      .select('id, character_def_id, level')
      .in('id', party as string[])
      .eq('player_id', playerId)

    const charDefKeys = [...new Set((charRows as CharLevelRow[] | null ?? []).map((r) => r.character_def_id))]
    type CharFlagRow = { charKey: string; bonusConsumableSlot?: boolean }
    let bonusSlotByCharKey = new Map<string, boolean>()
    try {
      const flagRows = await sanityQuery<CharFlagRow[]>(
        `*[_type == "characterDef" && charKey in $keys]{ charKey, bonusConsumableSlot }`,
        { keys: charDefKeys },
      )
      bonusSlotByCharKey = new Map(flagRows.map((r) => [r.charKey, r.bonusConsumableSlot ?? false]))
    } catch (e) {
      console.error('Sanity bonusConsumableSlot lookup failed — treating as no bonus slots', e)
    }

    const consumableDefIds = [...new Set(raw.map((c) => c.consumableDefId))]
    type ConsumableCategoryRow = { consumableKey: string; category: 'heal' | 'buff' }
    let categoryByDefId = new Map<string, 'heal' | 'buff'>()
    try {
      const catRows = await sanityQuery<ConsumableCategoryRow[]>(
        `*[_type == "consumableDef" && consumableKey in $keys]{ consumableKey, category }`,
        { keys: consumableDefIds },
      )
      categoryByDefId = new Map(catRows.map((r) => [r.consumableKey, r.category]))
    } catch (e) {
      console.error('Sanity consumableDef category lookup failed', e)
      return json({ error: 'Could not validate consumables' }, 502)
    }

    const partyForValidation = (charRows as CharLevelRow[] | null ?? []).map((r) => ({
      characterId: r.id,
      level: r.level,
      bonusSlot: bonusSlotByCharKey.get(r.character_def_id) ?? false,
    }))
    const loadout: LoadoutEntry[] = raw.map((c) => ({
      characterId: c.characterId,
      consumableDefId: c.consumableDefId,
      category: categoryByDefId.get(c.consumableDefId) ?? 'buff',
    }))
    if (loadout.some((l) => !categoryByDefId.has(l.consumableDefId))) {
      return json({ error: 'Unknown consumable' }, 400)
    }

    const error = validateMissionLoadout(partyForValidation, loadout)
    if (error) return json({ error }, 400)
    validatedConsumables = loadout
  }

  // Echo Shop Mission Speed (ADR-0053) — a separate multiplier layered on top of the
  // trait/gear/blessing one above, applied last.
  durationSeconds = Math.max(1, Math.round(
    durationSeconds / resolveShopBonus(shop, 'missionSpeed') / resolveFlatAscendantBonus(ascendantShop, 'missionSpeed')
  ))

  const { data: run, error: rpcErr } = await admin.rpc('start_mission', {
    p_player: playerId,
    p_mission_def_id: missionDefId,
    p_party: party as string[],
    p_duration_seconds: durationSeconds,
    p_map_key: def.map?.mapKey ?? null,
    p_stage: def.stage ?? null,
    p_prev_map_key: def.map?.prevMapKey ?? null,
    p_consumables: validatedConsumables.map((c) => ({ characterId: c.characterId, consumableDefId: c.consumableDefId })),
  })

  if (rpcErr) {
    // The RPC raises 'start_mission: <reason>' for every validation failure (owned/downed/busy/size).
    const reason = rpcErr.message.replace(/^.*start_mission:\s*/, '')
    return json({ error: reason || 'Could not start mission' }, 409)
  }

  try {
    const { error: logErr } = await admin.rpc('log_event', {
      p_player: playerId,
      p_type: 'mission_started',
      p_payload: { missionName: def.name ?? 'Unknown Mission' },
    })
    if (logErr) console.error('activity log failed (mission_started) — continuing', logErr)
  } catch (e) {
    console.error('activity log failed (mission_started) — continuing', e)
  }

  return json({ run }, 201)
}))
