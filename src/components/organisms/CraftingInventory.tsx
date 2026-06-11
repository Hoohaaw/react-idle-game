import { ItemTile } from '../molecules/ItemTile'
import { ItemTooltip } from './ItemTooltip'
import { MOCK_INVENTORY } from '../../lib/mockInventory'
import type { Item } from '../../types/item'

// The player's inventory laid out as a wide, auto-filling grid. Clicking an item adds it to
// the crafting circle's next open reagent slot. Mock data for now. See [[project-crafting]].
export function CraftingInventory({ onPlace, filled, count }: {
  onPlace: (item: Item) => void
  filled: number
  count: number
}) {
  return (
    <div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
        Inventory — click to add a reagent <span style={{ color: 'var(--color-text-gold)' }}>({filled}/{count})</span>
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 10 }}>
        {MOCK_INVENTORY.map(item => (
          <ItemTooltip key={`${item.name}-${item.rarity}`} item={item}>
            <ItemTile item={item} onClick={() => onPlace(item)} />
          </ItemTooltip>
        ))}
      </div>
    </div>
  )
}
