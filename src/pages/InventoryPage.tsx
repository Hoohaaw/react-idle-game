import { useMemo, useState } from 'react'
import { CustomSelect } from '../components/atoms/CustomSelect'
import { ItemTile } from '../components/molecules/ItemTile'
import { ItemTooltip } from '../components/organisms/ItemTooltip'
import { useInventory } from '../hooks/useInventory'
import { useItemDefs } from '../hooks/useRoster'
import { scaledItemStats } from '../lib/itemStats'
import { RARITY_ORDER } from '../lib/rarity'
import type { Item } from '../types/item'

// Real player_inventory stacks (RLS-scoped read) joined with the authored item defs for
// display. `value` stays 0 until items get an authored coin value (the tooltip hides it).

const SORT_OPTIONS = [
  { value: 'rarity', label: 'Sort: Rarity' },
  { value: 'slot', label: 'Sort: Slot' },
  { value: 'name', label: 'Sort: Name' },
  { value: 'newest', label: 'Sort: Newest' },
]

type Row = Item & { id: string; acquiredAt: string }

export default function InventoryPage() {
  const inventory = useInventory()
  const itemDefs = useItemDefs()
  const [sort, setSort] = useState('rarity')

  const items = useMemo<Row[]>(() => {
    const rows = (inventory.data ?? []).map((stack) => {
      const def = itemDefs.data?.[stack.itemDefId]
      return {
        id: stack.id,
        acquiredAt: stack.acquiredAt,
        name: def?.name ?? stack.itemDefId,
        rarity: stack.rarity,
        slot: def?.slot ?? '',
        stats: scaledItemStats(def?.statBonuses, stack.rarity),
        value: 0,
        quantity: stack.quantity,
      }
    })
    const rarityRank = (r: string) => RARITY_ORDER.indexOf(r as (typeof RARITY_ORDER)[number])
    switch (sort) {
      case 'slot':
        return rows.sort((a, b) => a.slot.localeCompare(b.slot) || a.name.localeCompare(b.name))
      case 'name':
        return rows.sort((a, b) => a.name.localeCompare(b.name))
      case 'newest':
        return rows.sort((a, b) => b.acquiredAt.localeCompare(a.acquiredAt))
      default: // rarity, highest first
        return rows.sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || a.name.localeCompare(b.name))
    }
  }, [inventory.data, itemDefs.data, sort])

  return (
    <div>
      {/* Header: title + count + sort */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
        marginBottom: '18px', paddingBottom: '8px', borderBottom: '1px solid var(--color-gold-dark)',
      }}>
        <h2 style={{ color: 'var(--color-gold-mid)', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase' }}>
          Inventory <span style={{ color: 'var(--color-text-muted)' }}>· {items.length}</span>
        </h2>
        <CustomSelect options={SORT_OPTIONS} initial={sort} onChange={setSort} />
      </div>

      {inventory.isLoading && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', fontStyle: 'italic' }}>Loading inventory…</p>
      )}
      {inventory.isError && (
        <p style={{ color: '#e0635c', fontSize: '13px', fontStyle: 'italic' }}>
          Couldn’t load inventory: {inventory.error instanceof Error ? inventory.error.message : 'unknown error'}
        </p>
      )}
      {!inventory.isLoading && !inventory.isError && items.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
          No items yet — loot drops from successful missions.
        </p>
      )}

      {/* Item grid */}
      {items.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
          {items.map(item => (
            <ItemTooltip key={item.id} item={item}>
              <ItemTile item={item} />
            </ItemTooltip>
          ))}
        </div>
      )}
    </div>
  )
}
