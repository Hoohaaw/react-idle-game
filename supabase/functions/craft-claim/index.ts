import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'
import { makeRng } from '../../../src/lib/combat.ts'
import { rollRarity } from '../../../src/lib/loot.ts'

// craft-claim: close a finished craft and grant ONE copy of the recipe's result at a rarity rolled
// from the authored weights (docs/superpowers/specs/2026-09-09-crafting-create-recipes-design.md
// §5). Mirrors mission-claim: guard on ends_at, decide the numbers here (the roll), let the
// claim_craft RPC own atomicity and the double-claim guard. The roll is seeded from the run so a
// retry of the same claim can't re-roll.

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type RecipeDef = { resultItemKey?: string | null; resultRarityWeights?: { rarity: string; weight: number }[] | null } | null

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  const admin = createAdminClient()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
  const playerId = userData.user.id

  let body: { recipeDefId?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const recipeDefId = body.recipeDefId
  if (typeof recipeDefId !== 'string' || recipeDefId.length === 0) return json({ error: 'recipeDefId is required' }, 400)

  // 1. The player's craft (owner-scoped) — friendly early-out; the RPC re-guards atomically.
  const { data: run, error: runErr } = await admin
    .from('craft_runs')
    .select('recipe_def_id, started_at, ends_at')
    .eq('player_id', playerId)
    .maybeSingle()
  if (runErr) {
    console.error('craft-claim: run lookup failed', runErr)
    return json({ error: 'Could not load craft' }, 500)
  }
  if (!run || run.recipe_def_id !== recipeDefId) return json({ error: 'No such craft in progress' }, 404)
  if (new Date(run.ends_at).getTime() > Date.now()) return json({ error: 'Craft not finished' }, 409)

  // 2. Authored result + weights (server-trusted).
  let def: RecipeDef
  try {
    def = await sanityQuery<RecipeDef>(
      `*[_type == "recipeDef" && recipeKey == $key][0]{ "resultItemKey": result->itemKey, resultRarityWeights[]{ rarity, weight } }`,
      { key: recipeDefId },
    )
  } catch (e) {
    console.error('Sanity recipe lookup failed', e)
    return json({ error: 'Could not load recipe' }, 502)
  }
  if (!def?.resultItemKey) return json({ error: 'Recipe has no result item' }, 500)

  // 3. Roll the rarity — deterministic per run, so a retried claim can't re-roll.
  // NOTE: the seed is derivable by the client (player id, recipe key, started_at are all
  // readable under RLS), so the outcome is predictable at start time. Harmless while there is
  // no cancel/abandon path; any future cancel feature must re-seed or refund, or it becomes a
  // re-roll exploit.
  const rng = makeRng(`${playerId}:${recipeDefId}:${run.started_at}:craft`)
  const rarity = rollRarity(def.resultRarityWeights ?? undefined, rng)

  // 4. Apply atomically (the RPC owns the double-claim guard).
  const { data: claimData, error: claimErr } = await admin.rpc('claim_craft', {
    p_player: playerId,
    p_recipe_def_id: recipeDefId,
    p_result_item_def_id: def.resultItemKey,
    p_result_rarity: rarity,
  })
  if (claimErr) {
    console.error('craft-claim: claim_craft failed', claimErr)
    const reason = claimErr.message.replace(/^.*claim_craft:\s*/, '')
    return json({ error: reason || 'Could not claim the craft' }, 409)
  }

  const granted = claimData as { item_def_id: string; rarity: string }
  return json({ itemDefId: granted.item_def_id, rarity: granted.rarity }, 200)
})
