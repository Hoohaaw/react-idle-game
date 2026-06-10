import { IconSlot } from '../components/atoms/IconSlot'
import { CustomSelect } from '../components/atoms/CustomSelect'
import { ItemTooltip } from '../components/organisms/ItemTooltip'
import { RARITY_STYLES } from '../lib/rarity'
import type { Item } from '../types/item'

// Mock inventory data for the prototype (replaced by real inventory/service data later).
// Sorting is UI-only for now — the actual sort behaviour is not wired up yet.
const ITEMS: Item[] = [
  { name: 'Emberforged Greataxe', slot: 'Weapon', rarity: 'Rare', value: 1850, stats: [{ key: 'ATK', value: '+24' }, { key: 'STR', value: '+9' }] },
  { name: 'Dagger of Whispers', slot: 'Weapon', rarity: 'Epic', value: 4200, stats: [{ key: 'ATK', value: '+18' }, { key: 'AGI', value: '+14' }], flavor: 'It hums faintly, as if remembering every throat it has met.' },
  { name: 'Warden Plate', slot: 'Chest', rarity: 'Uncommon', value: 980, stats: [{ key: 'DEF', value: '+16' }, { key: 'HP', value: '+40' }] },
  { name: 'Helm of the Vigil', slot: 'Head', rarity: 'Rare', value: 1450, stats: [{ key: 'DEF', value: '+11' }, { key: 'INT', value: '+8' }] },
  { name: 'Coif', slot: 'Head', rarity: 'Common', value: 45, stats: [{ key: 'DEF', value: '+3' }] },
  { name: 'Band of Embers', slot: 'Ring', rarity: 'Legendary', value: 9800, stats: [{ key: 'ATK', value: '+30' }, { key: 'STR', value: '+22' }, { key: 'AGI', value: '+18' }], flavor: 'Forged in the heart of a dying star. The wearer never feels the cold again.' },
  { name: 'Tattered Cloak', slot: 'Chest', rarity: 'Common', value: 30, stats: [{ key: 'DEF', value: '+2' }] },
  { name: 'Boots of the Swift', slot: 'Boots', rarity: 'Uncommon', value: 720, stats: [{ key: 'AGI', value: '+10' }, { key: 'SPD', value: '+6' }] },
  { name: 'Sigil of the Vigil', slot: 'Trinket', rarity: 'Epic', value: 3600, stats: [{ key: 'INT', value: '+20' }], flavor: 'A token of an order long since scattered to the winds.' },
  { name: 'Bent Dagger', slot: 'Weapon', rarity: 'Common', value: 25, stats: [{ key: 'ATK', value: '+4' }] },
  { name: 'Frostweave Gloves', slot: 'Hands', rarity: 'Rare', value: 1320, stats: [{ key: 'INT', value: '+12' }, { key: 'DEF', value: '+7' }] },
  { name: 'Girdle of Might', slot: 'Belt', rarity: 'Uncommon', value: 640, stats: [{ key: 'STR', value: '+11' }, { key: 'HP', value: '+25' }] },
  { name: 'Pauldrons of Dusk', slot: 'Shoulder', rarity: 'Rare', value: 1280, stats: [{ key: 'DEF', value: '+13' }, { key: 'AGI', value: '+6' }] },
  { name: 'Signet of Ash', slot: 'Ring', rarity: 'Common', value: 60, stats: [{ key: 'STR', value: '+3' }] },
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
    <ItemTooltip item={item}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
        padding: '12px 10px', borderRadius: '6px', cursor: 'pointer',
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
    </ItemTooltip>
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
