import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { MINE_BY_RESOURCE, accrue } from '../../../src/lib/gather.ts'
import { statsByCharacter } from '../_shared/charMaxHp.ts'
import { evaluateCondition, type PlayerAcquisitionState } from '../../../src/lib/acquisition.ts'
import { fetchAcquisitionCandidates } from '../_shared/characterAcquisition.ts'

// gather-collect: bank a gatherer's accrued yield, optionally stopping (unassigning). ADR-0019. Computes the
// payout in TS from elapsed ticks (src/lib/gather.ts — the same math the client displays), then applies it
// via the atomic `collect_gather` RPC. `new_last_collected_at` is the old timestamp advanced by exactly the
// consumed ticks, so the partial-tick remainder carries over (continuous, uncapped, offline-safe accrual).

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

  // Load the owner-scoped assignment (RLS would also scope a client read; the admin client bypasses it, so
  // we filter by player_id explicitly).
  const { data: assignment, error: loadErr } = await admin
    .from('gather_assignments')
    .select('id, resource_id, last_collected_at, player_character_id')
    .eq('id', assignmentId)
    .eq('player_id', playerId)
    .maybeSingle()
  if (loadErr) {
    console.error('assignment lookup failed', loadErr)
    return json({ error: 'Could not load assignment' }, 500)
  }
  if (!assignment) return json({ error: 'Assignment not found' }, 404)

  const { data: profile } = await admin
    .from('profiles')
    .select('lifetime_stats, unlocked_characters')
    .eq('player_id', playerId)
    .maybeSingle()
  const lifetimeStats = (profile?.lifetime_stats ?? {}) as Record<string, number>
  const unlockedCharacters = (profile?.unlocked_characters ?? {}) as Record<string, string>

  const mine = MINE_BY_RESOURCE[assignment.resource_id]
  if (!mine) return json({ error: 'Unknown mine' }, 500)

  // The gatherer's effective gatherSpeed/gatherYield (traits + gear + blessings, ADR-0035) scale
  // the accrual. A missing character row (shouldn't happen) falls back to unmodified rates.
  let gatherSpeed = 0
  let gatherYield = 0
  try {
    const { data: charRow } = await admin
      .from('player_characters')
      .select('id, character_def_id, level, blessings, equipped')
      .eq('id', assignment.player_character_id)
      .eq('player_id', playerId)
      .maybeSingle()
    if (charRow) {
      const stats = await statsByCharacter([charRow], { resource: assignment.resource_id })
      gatherSpeed = stats[charRow.id]?.gatherSpeed ?? 0
      gatherYield = stats[charRow.id]?.gatherYield ?? 0
    }
  } catch (e) {
    console.error('gatherer stats lookup failed — collecting unmodified', e)
  }

  const lastMs = new Date(assignment.last_collected_at).getTime()
  const { gained, consumedSec } = accrue(
    Date.now() - lastMs,
    mine.intervalSec,
    mine.yieldPerTick,
    gatherSpeed,
    gatherYield,
  )
  const newLastCollectedAt = new Date(lastMs + consumedSec * 1000).toISOString()

  const lifetimeStatsDelta: Record<string, number> =
    gained > 0 ? { [`resourceGathered.${assignment.resource_id}`]: gained } : {}

  let newlyUnlockedCharKeys: string[] = []
  let candidateByKey = new Map<string, { name: string; role: string | null }>()
  if (gained > 0) {
    try {
      const postCollectLifetimeStats = { ...lifetimeStats }
      for (const [key, delta] of Object.entries(lifetimeStatsDelta)) {
        postCollectLifetimeStats[key] = (postCollectLifetimeStats[key] ?? 0) + delta
      }
      const acquisitionState: PlayerAcquisitionState = {
        characters: [],
        lifetimeStats: postCollectLifetimeStats,
        mapProgress: {},
      }
      const candidates = await fetchAcquisitionCandidates(Object.keys(unlockedCharacters))
      const relevant = candidates.filter(
        (c) => c.condition.type === 'resourceTotal' && c.condition.resource === assignment.resource_id,
      )
      candidateByKey = new Map(relevant.map((c) => [c.charKey, { name: c.name, role: c.role }]))
      newlyUnlockedCharKeys = relevant
        .filter((c) => evaluateCondition(c.condition, acquisitionState))
        .map((c) => c.charKey)
    } catch (e) {
      console.error('acquisition candidate fetch failed — skipping unlock checks this collect', e)
    }
  }

  const { data: rpcData, error: rpcErr } = await admin.rpc('collect_gather', {
    p_player: playerId,
    p_assignment_id: assignment.id,
    p_resource: assignment.resource_id,
    p_gained: gained,
    p_new_last_collected_at: newLastCollectedAt,
    p_stop: stop,
    p_lifetime_stats: lifetimeStatsDelta,
    p_newly_unlocked: newlyUnlockedCharKeys,
  })
  if (rpcErr) {
    console.error('collect_gather failed', rpcErr)
    const reason = rpcErr.message.replace(/^.*collect_gather:\s*/, '')
    return json({ error: reason || 'Could not collect' }, 409)
  }

  const actuallyUnlocked = ((rpcData as { actually_unlocked?: string[] } | null)?.actually_unlocked ?? [])
  const newlyUnlocked = actuallyUnlocked.map((charKey) => ({
    charKey,
    name: candidateByKey.get(charKey)?.name ?? charKey,
    role: candidateByKey.get(charKey)?.role ?? null,
  }))

  return json({ gained, resource: assignment.resource_id, stopped: stop, newlyUnlocked }, 200)
})
