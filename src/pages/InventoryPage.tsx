import { IconSlot } from '../components/atoms/IconSlot'
import { CustomSelect } from '../components/atoms/CustomSelect'
import { RARITY_STYLES } from '../lib/rarity'

// Mock inventory data for the prototype (replaced by real inventory/service data later).
// Sorting is UI-only for now — the actual sort behaviour is not wired up yet.
type Item = { name: string; slot: string; rarity: string }

const ITEMS: Item[] = [
  { name: 'Emberforged Greataxe', slot: 'Weapon', rarity: 'Rare' },
  { name: 'Dagger of Whispers', slot: 'Weapon', rarity: 'Epic' },
  { name: 'Warden Plate', slot: 'Chest', rarity: 'Uncommon' },
  { name: 'Helm of the Vigil', slot: 'Head', rarity: 'Rare' },
  { name: 'Coif', slot: 'Head', rarity: 'Common' },
  { name: 'Band of Embers', slot: 'Ring', rarity: 'Legendary' },
  { name: 'Tattered Cloak', slot: 'Chest', rarity: 'Common' },
  { name: 'Boots of the Swift', slot: 'Boots', rarity: 'Uncommon' },
  { name: 'Sigil of the Vigil', slot: 'Trinket', rarity: 'Epic' },
  { name: 'Bent Dagger', slot: 'Weapon', rarity: 'Common' },
  { name: 'Frostweave Gloves', slot: 'Hands', rarity: 'Rare' },
  { name: 'Girdle of Might', slot: 'Belt', rarity: 'Uncommon' },
  { name: 'Pauldrons of Dusk', slot: 'Shoulder', rarity: 'Rare' },
  { name: 'Signet of Ash', slot: 'Ring', rarity: 'Common' },
]

const SORT_OPTIONS = [
  { value: 'rarity', label: 'Sort: Rarity' },
  { value: 'slot', label: 'Sort: Slot' },
  { value: 'name', label: 'Sort: Name' },
  { value: 'newest', label: 'Sort: Newest' },
]

function ItemTile({ item }: { item: Item }) {
  const s = RARITY_STYLES[item.rarity] ?? RARITY_STYLES.Common
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      padding: '12px 10px', borderRadius: '6px',
      border: `2px solid ${s.border}`,
      background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
      boxShadow: [
        '0 0 0 1px #080101',
        'inset 0 1px 0 rgba(255,255,255,0.05)',
        `0 0 10px ${s.glow}`,
        '0 3px 8px rgba(0,0,0,0.6)',
      ].join(', '),
    }}>
      <IconSlot size={56} />
      <div style={{ textAlign: 'center', minWidth: 0, width: '100%' }}>
        <p style={{ color: s.color, fontSize: '12px', fontWeight: 'bold', textShadow: '0 1px 2px rgba(0,0,0,0.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '3px' }}>{item.slot}</p>
      </div>
    </div>
  )
}

export default function InventoryPage() {
  return (
    <div>
      {/* Header: title + count + sort */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
        marginBottom: '18px', paddingBottom: '8px', borderBottom: '1px solid var(--color-gold-dark)',
      }}>
        <h2 style={{ color: 'var(--color-gold-mid)', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase' }}>
          Inventory <span style={{ color: 'var(--color-text-muted)' }}>· {ITEMS.length}</span>
        </h2>
        <CustomSelect options={SORT_OPTIONS} />
      </div>

      {/* Item grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
        {ITEMS.map(item => <ItemTile key={item.name} item={item} />)}
      </div>
    </div>
  )
}
