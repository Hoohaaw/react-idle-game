import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'
import { withSentry } from '../_shared/sentry.ts'

// profession-claim-quest: turn in a professionQuestDef's cost at the profession expert (Decision
// 4 channel 2). The cost lines and reward recipe are resolved from Sanity here — the client only
// supplies which quest it's completing and, for item-typed cost lines, which owned rarity to
// spend (mirrors craft-start's itemReagentChoices).

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']

type QuestDef = {
  professionKey?: string | null
  requiredLevel?: number | null
  rewardRecipeKey?: string | null
  cost?: { kind?: string; resource?: string | null; currency?: string | null; quantity?: number; itemKey?: string | null }[] | null
} | null

Deno.serve(withSentry(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  const admin = createAdminClient()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
  const playerId = userData.user.id

  let body: { questKey?: unknown; itemCostChoices?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const questKey = body.questKey
  if (typeof questKey !== 'string' || questKey.length === 0) return json({ error: 'questKey is required' }, 400)
  const rawChoices = Array.isArray(body.itemCostChoices) ? body.itemCostChoices : []
  const choices = new Map<number, string>()
  for (const c of rawChoices as unknown[]) {
    const idx = (c as Record<string, unknown>)?.costIndex
    const rarity = (c as Record<string, unknown>)?.rarity
    if (typeof idx !== 'number' || !Number.isInteger(idx) || typeof rarity !== 'string' || !RARITIES.includes(rarity)) {
      return json({ error: 'Invalid itemCostChoices entry' }, 400)
    }
    choices.set(idx, rarity)
  }

  let def: QuestDef
  try {
    def = await sanityQuery<QuestDef>(
      `*[_type == "professionQuestDef" && questKey == $key][0]{
        professionKey, requiredLevel, "rewardRecipeKey": rewardRecipe->recipeKey,
        cost[]{ kind, resource, currency, quantity, "itemKey": item->itemKey }
      }`,
      { key: questKey },
    )
  } catch (e) {
    console.error('Sanity quest lookup failed', e)
    return json({ error: 'Could not load quest' }, 502)
  }
  if (!def?.professionKey || !def.rewardRecipeKey || !def.cost) return json({ error: 'Unknown quest' }, 404)

  const resourceCost: { code: string; quantity: number }[] = []
  const itemCost: { item_def_id: string; rarity: string; quantity: number }[] = []
  const currencyCost: { code: string; quantity: number }[] = []
  for (const [index, line] of def.cost.entries()) {
    const quantity = line.quantity ?? 0
    if (!Number.isInteger(quantity) || quantity < 1) return json({ error: `Quest cost line ${index} has an invalid quantity` }, 500)
    if (line.kind === 'resource') {
      if (!line.resource) return json({ error: `Quest cost line ${index} has no resource` }, 500)
      resourceCost.push({ code: line.resource, quantity })
    } else if (line.kind === 'currency') {
      if (!line.currency) return json({ error: `Quest cost line ${index} has no currency` }, 500)
      currencyCost.push({ code: line.currency, quantity })
    } else if (line.kind === 'item') {
      if (!line.itemKey) return json({ error: `Quest cost line ${index} has no item` }, 500)
      const rarity = choices.get(index)
      if (!rarity) return json({ error: `Pick a rarity for cost line ${index}` }, 400)
      itemCost.push({ item_def_id: line.itemKey, rarity, quantity })
    } else {
      return json({ error: `Quest cost line ${index} has an unknown kind` }, 500)
    }
  }

  const { data, error: rpcErr } = await admin.rpc('claim_profession_quest', {
    p_player: playerId,
    p_profession_key: def.professionKey,
    p_quest_key: questKey,
    p_required_level: def.requiredLevel ?? 1,
    p_reward_recipe_key: def.rewardRecipeKey,
    p_resource_cost: resourceCost,
    p_item_cost: itemCost,
    p_currency_cost: currencyCost,
  })
  if (rpcErr) {
    const reason = rpcErr.message.replace(/^.*claim_profession_quest:\s*/, '')
    return json({ error: reason || 'Could not complete quest' }, 409)
  }

  return json(data, 201)
}))
