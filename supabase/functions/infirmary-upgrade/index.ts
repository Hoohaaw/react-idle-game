import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { statsByCharacter, type CharRowForHp } from '../_shared/charMaxHp.ts'
import { INFIRMARY, UPGRADE_COSTS, settleForUpgrade } from '../../../src/lib/infirmary.ts'

// infirmary-upgrade: raise the infirmary one level (ADR-0003/0021) — more beds, faster regen,
// shorter stabilize. Costs gold + gathered resources (the first real resource sink; PROVISIONAL
// table in src/lib/infirmary.ts). Active admissions are settled so in-flight heals/stabilizes
// continue equivalently at the new rate; the atomic `upgrade_infirmary` RPC owns fund checks,
// the deduction, the level bump and the settlements in one transaction.

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
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

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('infirmary_level')
    .eq('player_id', playerId)
    .maybeSingle()
  if (profileErr || !profile) {
    console.error('profile lookup failed', profileErr)
    return json({ error: 'Could not load profile' }, 500)
  }
  const currentLevel = profile.infirmary_level
  if (currentLevel >= INFIRMARY.MAX_LEVEL) {
    return json({ error: 'Infirmary is already at max level' }, 409)
  }
  const newLevel = currentLevel + 1
  const cost = UPGRADE_COSTS[newLevel]

  // Settle active admissions so healing continues equivalently at the new rate.
  const { data: admissions, error: admErr } = await admin
    .from('infirmary_admissions')
    .select('player_character_id, admitted_at, hp_at_admission')
    .eq('player_id', playerId)
  if (admErr) {
    console.error('admissions lookup failed', admErr)
    return json({ error: 'Could not load admissions' }, 500)
  }

  const settlements: {
    character_id: string
    current_hp: number | null
    admitted_at: string
    hp_at_admission: number
  }[] = []
  if (admissions && admissions.length > 0) {
    const ids = admissions.map((a) => a.player_character_id)
    const { data: charsData, error: charsErr } = await admin
      .from('player_characters')
      .select('id, character_def_id, level, blessings, equipped')
      .in('id', ids)
      .eq('player_id', playerId)
    if (charsErr || !charsData || charsData.length !== ids.length) {
      console.error('characters lookup failed', charsErr)
      return json({ error: 'Could not load admitted characters' }, 500)
    }
    const chars = charsData as CharRowForHp[]
    let statsById: Record<string, Record<string, number>>
    try {
      statsById = await statsByCharacter(chars, {})
    } catch (e) {
      console.error('Sanity fetch failed', e)
      return json({ error: 'Could not load character content' }, 502)
    }
    const charById = new Map(chars.map((c) => [c.id, c]))
    const nowMs = Date.now()
    for (const a of admissions) {
      const c = charById.get(a.player_character_id)!
      const maxHp = Math.max(1, Math.round(statsById[c.id].health ?? 0))
      const settled = settleForUpgrade({
        hpAtAdmission: a.hp_at_admission,
        admittedAtMs: new Date(a.admitted_at).getTime(),
        nowMs,
        charLevel: c.level,
        infirmaryLevel: currentLevel,
        maxHp,
        recoverySpeedPct: statsById[c.id].recoverySpeed ?? 0,
        newInfirmaryLevel: newLevel,
      })
      settlements.push({
        character_id: c.id,
        current_hp: settled.currentHp >= maxHp ? null : settled.currentHp,
        admitted_at: new Date(settled.admittedAtMs).toISOString(),
        hp_at_admission: settled.hpAtAdmission,
      })
    }
  }

  const { error: rpcErr } = await admin.rpc('upgrade_infirmary', {
    p_player: playerId,
    p_new_level: newLevel,
    p_cost_currencies: cost.currencies,
    p_cost_resources: cost.resources,
    p_settlements: settlements,
  })
  if (rpcErr) {
    // Most likely insufficient funds or a concurrent upgrade (level assertion).
    const reason = rpcErr.message.replace(/^.*upgrade_infirmary:\s*/, '')
    return json({ error: reason || 'Could not upgrade infirmary' }, 409)
  }

  return json({ infirmary_level: newLevel }, 200)
})
