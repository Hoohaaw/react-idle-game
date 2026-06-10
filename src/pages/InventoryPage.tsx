import { CustomSelect } from '../components/atoms/CustomSelect'
import { ItemTile } from '../components/molecules/ItemTile'
import { ItemTooltip } from '../components/organisms/ItemTooltip'
import { MOCK_INVENTORY } from '../lib/mockInventory'

const SORT_OPTIONS = [
  { value: 'rarity', label: 'Sort: Rarity' },
  { value: 'slot', label: 'Sort: Slot' },
  { value: 'name', label: 'Sort: Name' },
  { value: 'newest', label: 'Sort: Newest' },
]

export default function InventoryPage() {
  return (
    <div>
      {/* Header: title + count + sort */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
        marginBottom: '18px', paddingBottom: '8px', borderBottom: '1px solid var(--color-gold-dark)',
      }}>
        <h2 style={{ color: 'var(--color-gold-mid)', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase' }}>
          Inventory <span style={{ color: 'var(--color-text-muted)' }}>· {MOCK_INVENTORY.length}</span>
        </h2>
        <CustomSelect options={SORT_OPTIONS} />
      </div>

      {/* Item grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
        {MOCK_INVENTORY.map(item => (
          <ItemTooltip key={`${item.name}-${item.rarity}`} item={item}>
            <ItemTile item={item} />
          </ItemTooltip>
        ))}
      </div>
    </div>
  )
}
