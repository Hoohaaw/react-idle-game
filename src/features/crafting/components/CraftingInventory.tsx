import { ItemTile } from '@/components/molecules/ItemTile'
import { ItemTooltip } from '@/components/organisms/ItemTooltip'
import { ResourceTooltip } from '@/components/organisms/ResourceTooltip'
import { RESOURCE_COLOR } from '@/lib/resources'
import { scaledItemStats } from '@/lib/itemStats'
import type { InventoryStack } from '@/services/inventory'
import type { ItemDefMeta } from '@/services/items'
import type { Item } from '@/types/item'

// What the player can spend on a recipe: resource balances up top, item stacks below. Read-only —
// selecting a recipe (RecipeBook) is what fills the circle, so nothing here is clickable.
export function CraftingInventory({ resources, stacks, itemDefs }: {
  resources: Record<string, number>
  stacks: InventoryStack[]
  itemDefs: Record<string, ItemDefMeta>
}) {
  const owned = Object.entries(resources).filter(([, v]) => v > 0)
  const items: Item[] = stacks.map((stack) => {
    const def = itemDefs[stack.itemDefId]
    return {
      itemDefId: stack.itemDefId,
      name: def?.name ?? stack.itemDefId,
      rarity: stack.rarity,
      slot: def?.slot ?? '',
      stats: scaledItemStats(def?.statBonuses, stack.rarity),
      value: 0,
      quantity: stack.quantity,
    }
  })

  return (
    <div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Materials</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
        {owned.length === 0 && <span style={{ color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic' }}>No materials yet — send someone to the mines.</span>}
        {owned.map(([code, qty]) => {
          const c = RESOURCE_COLOR[code] ?? '200,145,42'
          return (
            <ResourceTooltip key={code} resource={code}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 4, fontSize: 12, border: `1px solid rgba(${c},0.5)`, background: `rgba(${c},0.12)`, color: 'var(--color-text-primary)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: `rgb(${c})` }} />
                {code} <span style={{ color: 'var(--color-text-gold)', fontWeight: 'bold' }}>×{qty}</span>
              </span>
            </ResourceTooltip>
          )
        })}
      </div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Inventory</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 10 }}>
        {items.map((item) => (
          <ItemTooltip key={`${item.itemDefId}-${item.rarity}`} item={item}>
            <ItemTile item={item} />
          </ItemTooltip>
        ))}
      </div>
    </div>
  )
}
