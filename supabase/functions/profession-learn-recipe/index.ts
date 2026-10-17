import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'
import { withSentry } from '../_shared/sentry.ts'

// profession-learn-recipe: buy a recipe from the profession expert for gold (Decision 4 channel
// 1, docs/superpowers/specs/2026-10-16-profession-system-design.md). Cost and required level are
// resolved from the authored recipeDef here — the client only supplies which recipe it wants.

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type RecipeDef = { professionKey?: string | null; requiredLevel?: number | null; learnCost?: number | null } | null

Deno.serve(withSentry(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  const admin = createAdminClient()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
  const playerId = userData.user.id

  let body: { recipeKey?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const recipeKey = body.recipeKey
  if (typeof recipeKey !== 'string' || recipeKey.length === 0) return json({ error: 'recipeKey is required' }, 400)

  let def: RecipeDef
  try {
    def = await sanityQuery<RecipeDef>(
      `*[_type == "recipeDef" && recipeKey == $key][0]{ professionKey, requiredLevel, "learnCost": coalesce(learnCost, 0) }`,
      { key: recipeKey },
    )
  } catch (e) {
    console.error('Sanity recipe lookup failed', e)
    return json({ error: 'Could not load recipe' }, 502)
  }
  if (!def?.professionKey) return json({ error: 'Recipe is not a profession recipe' }, 404)
  if (!def.learnCost || def.learnCost <= 0) return json({ error: 'Recipe is not purchasable' }, 404)

  const { data, error: rpcErr } = await admin.rpc('learn_profession_recipe', {
    p_player: playerId,
    p_profession_key: def.professionKey,
    p_recipe_key: recipeKey,
    p_cost: def.learnCost ?? 0,
    p_required_level: def.requiredLevel ?? 1,
  })
  if (rpcErr) {
    const reason = rpcErr.message.replace(/^.*learn_profession_recipe:\s*/, '')
    return json({ error: reason || 'Could not learn recipe' }, 409)
  }

  return json(data, 201)
}))
