// A crafting recipe. `kind` is the crafting model: `infuse` adds/improves stats on a
// base item; `create` produces a brand-new item. `discovered` gates visibility — locked
// recipes are hidden in the recipe book until found in-game. See [[project-crafting]].
export type Recipe = {
  id: string
  name: string
  kind: 'infuse' | 'create'
  result: string
  resources: { resource: string; qty: number }[]
  discovered: boolean
}
