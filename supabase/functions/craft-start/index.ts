import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'

// craft-start: spend a recipe's reagents and open the timed craft (ADR-0003 server-authoritative
// write; docs/superpowers/specs/2026-09-09-crafting-create-recipes-design.md §5). Mirrors
// mission-start: validate the caller, resolve the authored recipe from Sanity (the client is NOT
// trusted for costs or duration), hand off to the atomic start_craft RPC. The only thing the
// client contributes is WHICH owned rarity to spend for each item-typed reagent line.

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']

type RecipeDef = {
  durationSeconds?: number
  reagents?: { kind?: string; resource?: string | null; quantity?: number; itemKey?: string | null }[]
} | null

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  const admin = createAdminClient()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
  const playerId = userData.user.id

  let body: { recipeDefId?: unknown; itemReagentChoices?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const recipeDefId = body.recipeDefId
  if (typeof recipeDefId !== 'string' || recipeDefId.length === 0) return json({ error: 'recipeDefId is required' }, 400)
  const rawChoices = Array.isArray(body.itemReagentChoices) ? body.itemReagentChoices : []
  const choices = new Map<number, string>()
  for (const c of rawChoices as unknown[]) {
    const idx = (c as Record<string, unknown>)?.reagentIndex
    const rarity = (c as Record<string, unknown>)?.rarity
    if (typeof idx !== 'number' || !Number.isInteger(idx) || typeof rarity !== 'string' || !RARITIES.includes(rarity)) {
      return json({ error: 'Invalid itemReagentChoices entry' }, 400)
    }
    choices.set(idx, rarity)
  }

  let def: RecipeDef
  try {
    def = await sanityQuery<RecipeDef>(
      `*[_type == "recipeDef" && recipeKey == $key][0]{
        durationSeconds,
        reagents[]{ kind, resource, quantity, "itemKey": item->itemKey }
      }`,
      { key: recipeDefId },
    )
  } catch (e) {
    console.error('Sanity recipe lookup failed', e)
    return json({ error: 'Could not validate recipe' }, 502)
  }
  if (!def || !def.reagents || def.reagents.length === 0) return json({ error: 'Unknown recipe' }, 404)
  if (typeof def.durationSeconds !== 'number' || def.durationSeconds < 1) return json({ error: 'Recipe has no valid duration' }, 500)

  // Resolve each authored line to a concrete requirement. Costs come from Sanity; the client only
  // supplies the rarity choice for item lines.
  const resourceReagents: { code: string; quantity: number }[] = []
  const itemReagents: { item_def_id: string; rarity: string; quantity: number }[] = []
  for (const [index, line] of def.reagents.entries()) {
    const quantity = line.quantity ?? 0
    if (!Number.isInteger(quantity) || quantity < 1) return json({ error: `Recipe reagent ${index} has an invalid quantity` }, 500)
    if (line.kind === 'resource') {
      if (!line.resource) return json({ error: `Recipe reagent ${index} has no resource` }, 500)
      resourceReagents.push({ code: line.resource, quantity })
    } else if (line.kind === 'item') {
      if (!line.itemKey) return json({ error: `Recipe reagent ${index} has no item` }, 500)
      const rarity = choices.get(index)
      if (!rarity) return json({ error: `Pick a rarity for reagent ${index}` }, 400)
      itemReagents.push({ item_def_id: line.itemKey, rarity, quantity })
    } else {
      return json({ error: `Recipe reagent ${index} has an unknown kind` }, 500)
    }
  }

  const { data: run, error: rpcErr } = await admin.rpc('start_craft', {
    p_player: playerId,
    p_recipe_def_id: recipeDefId,
    p_resource_reagents: resourceReagents,
    p_item_reagents: itemReagents,
    p_duration_seconds: def.durationSeconds,
  })
  if (rpcErr) {
    const reason = rpcErr.message.replace(/^.*start_craft:\s*/, '')
    return json({ error: reason || 'Could not start crafting' }, 409)
  }

  return json({ run }, 201)
})
