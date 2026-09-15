// supabase/functions/skill-collect/index.ts
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { SKILL_BY_KEY } from '../../../src/lib/skills.ts'
import { accrue } from '../../../src/lib/gather.ts'
import { applyXp } from '../../../src/lib/leveling.ts'

// skill-collect: bank a trainee's accrued skill XP, optionally stopping (unassigning). Computes the
// gained XP from elapsed ticks (accrue(), src/lib/gather.ts — reused as-is, same math) then rolls it
// into the character's current skill level/xp (applyXp(), src/lib/leveling.ts — the identical
// capped-at-50 curve character levels use), then applies both via the atomic `collect_skill` RPC.
// No stat modifiers (no speed/yield equivalent — spec §3, deferred) and no lifetime-stats/
// acquisition tie-in (unlike gather-collect): skill training has no mechanical effect yet.

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

  let body: { assignmentId?: unknown; stop?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const assignmentId = body.assignmentId
  const stop = body.stop === true
  if (typeof assignmentId !== 'string' || assignmentId.length === 0) {
    return json({ error: 'assignmentId is required' }, 400)
  }

  const { data: assignment, error: loadErr } = await admin
    .from('skill_assignments')
    .select('id, skill_key, last_collected_at, player_character_id')
    .eq('id', assignmentId)
    .eq('player_id', playerId)
    .maybeSingle()
  if (loadErr) {
    console.error('assignment lookup failed', loadErr)
    return json({ error: 'Could not load assignment' }, 500)
  }
  if (!assignment) return json({ error: 'Assignment not found' }, 404)

  const skill = SKILL_BY_KEY[assignment.skill_key]
  if (!skill) return json({ error: 'Unknown skill' }, 500)

  const { data: charRow, error: charErr } = await admin
    .from('player_characters')
    .select('skills')
    .eq('id', assignment.player_character_id)
    .eq('player_id', playerId)
    .maybeSingle()
  if (charErr) {
    console.error('character lookup failed', charErr)
    return json({ error: 'Could not load character' }, 500)
  }
  const skills = (charRow?.skills ?? {}) as Record<string, { level: number; xp: number }>
  const current = skills[assignment.skill_key] ?? { level: 1, xp: 0 }

  const lastMs = new Date(assignment.last_collected_at).getTime()
  const { gained, consumedSec } = accrue(Date.now() - lastMs, skill.intervalSec, skill.xpPerTick)
  const { level: newLevel, xp: newXp } = applyXp(current.level, current.xp, gained)
  const newLastCollectedAt = new Date(lastMs + consumedSec * 1000).toISOString()

  const { error: rpcErr } = await admin.rpc('collect_skill', {
    p_player: playerId,
    p_assignment_id: assignment.id,
    p_skill_key: assignment.skill_key,
    p_new_level: newLevel,
    p_new_xp: newXp,
    p_new_last_collected_at: newLastCollectedAt,
    p_stop: stop,
  })
  if (rpcErr) {
    console.error('collect_skill failed', rpcErr)
    const reason = rpcErr.message.replace(/^.*collect_skill:\s*/, '')
    return json({ error: reason || 'Could not collect' }, 409)
  }

  return json({ gainedXp: gained, skillKey: assignment.skill_key, newLevel, newXp, stopped: stop }, 200)
})
