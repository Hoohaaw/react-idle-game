import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SecondaryButton } from '@/components/atoms/Button'
import { useInventory } from '@/hooks/useInventory'
import { useItemDefs } from '@/hooks/useRoster'
import { useProfile } from '@/hooks/useProfile'
import { resolveReagents, canAfford, defaultRarityChoice, type ItemRarityChoice } from '@/lib/crafting'
import { useRecipes, useCraftRun, useStartCraft, useClaimCraft } from './hooks'
import { CraftingCircle } from './components/CraftingCircle'
import { CraftingInventory } from './components/CraftingInventory'
import { RecipeBook } from './components/RecipeBook'

// Crafting (create recipes): pick a recipe → its reagents fill the circle → Craft spends them and
// starts the timer → Claim after ends_at grants the rolled result. One craft at a time (the
// craft_runs row); while one is running the page locks to that recipe. Desktop-only layout for
// now — mobile is a deferred follow-up.
export default function CraftingPage() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const profile = useProfile()
  const inventory = useInventory()
  const itemDefs = useItemDefs()
  const recipes = useRecipes()
  const run = useCraftRun()
  const startCraft = useStartCraft()
  const claimCraft = useClaimCraft()

  const [bookOpen, setBookOpen] = useState(true)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [choices, setChoices] = useState<ItemRarityChoice[]>([])

  // A running craft owns the selection.
  const activeKey = run.data?.recipe_def_id ?? selectedKey
  const recipe = recipes.data?.find((r) => r.recipeKey === activeKey) ?? null
  const inProgress = Boolean(run.data)
  const remainingMs = run.data ? new Date(run.data.ends_at).getTime() - now : 0

  const stacks = useMemo(() => inventory.data ?? [], [inventory.data])
  const resources = profile.data?.resources ?? {}

  // Default each item line's rarity when a recipe is picked (or the inventory changes).
  useEffect(() => {
    if (!recipe || inProgress) return
    // Syncing editable local state (rarity choices) to a default derived from external data
    // (recipe/inventory); the player can then override via onPickRarity.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoices(recipe.reagents.flatMap((line, index) => {
      if (line.kind !== 'item') return []
      const rarity = defaultRarityChoice(line, stacks)
      return rarity ? [{ reagentIndex: index, rarity }] : []
    }))
  }, [recipe, stacks, inProgress])

  const resolved = recipe ? resolveReagents(recipe.reagents, resources, stacks, choices) : []
  const pickRarity = (reagentIndex: number, rarity: string) =>
    setChoices((prev) => [...prev.filter((c) => c.reagentIndex !== reagentIndex), { reagentIndex, rarity }])
  const clear = () => { setSelectedKey(null); setChoices([]) }

  const mutationError = (startCraft.error ?? claimCraft.error) as Error | null

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 24, alignItems: 'start', marginBottom: 32 }}>
        <div style={{ gridColumn: '2' }}>
          <CraftingCircle
            reagents={resolved}
            resultName={recipe?.result.name ?? null}
            rarityChoices={choices}
            onPickRarity={pickRarity}
            inProgress={inProgress}
            remainingMs={remainingMs}
            canCraft={Boolean(recipe) && canAfford(resolved)}
            pending={startCraft.isPending || claimCraft.isPending}
            error={mutationError?.message ?? null}
            onCraft={() => { if (recipe) startCraft.mutate({ recipeDefId: recipe.recipeKey, choices }) }}
            onClaim={() => { if (run.data) claimCraft.mutate(run.data.recipe_def_id, { onSuccess: clear }) }}
            onClear={clear}
          />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {bookOpen ? (
            <motion.div
              key="book"
              initial={{ opacity: 0, x: 24, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.98 }}
              transition={{ duration: 0.17, ease: 'easeOut' }}
              style={{ gridColumn: '3', justifySelf: 'start', width: 280 }}
            >
              <RecipeBook
                recipes={recipes.data ?? []}
                selectedKey={activeKey}
                onSelect={(key) => { if (!inProgress) setSelectedKey(key) }}
                onClose={() => setBookOpen(false)}
              />
            </motion.div>
          ) : (
            <motion.div key="opener" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.11 }} style={{ gridColumn: '3', justifySelf: 'start' }}>
              <SecondaryButton onClick={() => setBookOpen(true)}>Show Recipe Book</SecondaryButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CraftingInventory resources={resources} stacks={stacks} itemDefs={itemDefs.data ?? {}} />
    </div>
  )
}
