import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CraftingCircle } from '../components/organisms/CraftingCircle'
import { CraftingInventory } from '../components/organisms/CraftingInventory'
import { RecipeBook } from '../components/organisms/RecipeBook'
import { SecondaryButton } from '../components/atoms/Button'
import { RECIPES } from '../lib/mockRecipes'
import type { Item } from '../types/item'

const COUNT = 6 // reagent slots

// The crafting circle + recipe book sit in a row at the top; the inventory spans the full
// width below them. Reagent state lives here so the circle and the (separate, wider)
// inventory share it. Mock data — recipe matching + crafting wired to the backend later
// (server-authoritative). See [[project-crafting]]. Desktop-only layout for now — mobile is
// a deferred follow-up (see [[project-mobile-responsive]]).
export default function CraftingPage() {
  const [bookOpen, setBookOpen] = useState(true)
  const [reagents, setReagents] = useState<(Item | null)[]>(Array(COUNT).fill(null))

  const place = (item: Item) => setReagents(prev => {
    const idx = prev.findIndex(r => r === null)
    if (idx === -1) return prev
    const next = [...prev]; next[idx] = item; return next
  })
  const removeAt = (i: number) => setReagents(prev => prev.map((r, idx) => idx === i ? null : r))
  const clearAll = () => setReagents(Array(COUNT).fill(null))
  const filled = reagents.filter(Boolean).length

  return (
    <div>
      {/* Crafting circle + recipe book — grouped in a row. Grid (1fr auto 1fr) centers the
          circle and pins the fixed-width book in the right column. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 24, alignItems: 'start', marginBottom: 32 }}>
        <div style={{ gridColumn: '2' }}>
          <CraftingCircle reagents={reagents} onRemoveAt={removeAt} onClear={clearAll} />
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
              <RecipeBook recipes={RECIPES} onClose={() => setBookOpen(false)} />
            </motion.div>
          ) : (
            <motion.div key="opener" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.11 }} style={{ gridColumn: '3', justifySelf: 'start' }}>
              <SecondaryButton onClick={() => setBookOpen(true)}>📖 Show Recipe Book</SecondaryButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Inventory — full width below the circle + book */}
      <CraftingInventory onPlace={place} filled={filled} count={COUNT} />
    </div>
  )
}
