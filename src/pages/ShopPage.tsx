import { IconSlot } from '../components/atoms/IconSlot'
import { RarityBadge } from '../components/atoms/RarityBadge'
import { PrimaryButton } from '../components/atoms/Button'
import { CoinDisplay } from '../components/atoms/CoinDisplay'
import { ItemTooltip } from '../components/organisms/ItemTooltip'
import { RARITY_STYLES } from '../lib/rarity'
import type { Item } from '../types/item'

// Mock shop data for the prototype (replaced by real shop/service data later).
// Per design: 2 weapons + 2 armor, refreshed every 8h. Prices in coins only —
// whether the shop also charges resources is an undecided economy question.
const SHOP: Item[] = [
  { name: 'Emberforged Greataxe', slot: 'Weapon', rarity: 'Rare', value: 1850, stats: [{ key: 'ATK', value: '+24' }, { key: 'STR', value: '+9' }] },
  { name: 'Dagger of Whispers', slot: 'Weapon', rarity: 'Epic', value: 4200, stats: [{ key: 'ATK', value: '+18' }, { key: 'AGI', value: '+14' }], flavor: 'It hums faintly, as if remembering every throat it has met.' },
  { name: 'Warden Plate', slot: 'Chest', rarity: 'Uncommon', value: 980, stats: [{ key: 'DEF', value: '+16' }, { key: 'HP', value: '+40' }] },
  { name: 'Helm of the Vigil', slot: 'Head', rarity: 'Rare', value: 1450, stats: [{ key: 'DEF', value: '+11' }, { key: 'INT', value: '+8' }] },
]

const MERCHANT = {
  name: 'Thaldrin the Trader',
  title: 'Wandering Merchant',
  flavor: '"Fresh from the forge, friend. Pick wisely — these wares won\'t linger."',
  restock: '5h 42m',
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      color: 'var(--color-gold-mid)', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase',
      marginBottom: '14px', paddingBottom: '6px', borderBottom: '1px solid var(--color-gold-dark)',
    }}>{children}</h2>
  )
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ color: 'var(--color-text-gold)', fontSize: '13px', fontWeight: 'bold', textShadow: '0 0 6px rgba(232,192,80,0.3)' }}>{value}</span>
    </div>
  )
}

function ShopItemCard({ item }: { item: Item }) {
  const rarityColor = (RARITY_STYLES[item.rarity] ?? RARITY_STYLES.Common).color
  return (
    <div className="atom-heavy" style={{
      display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px',
      borderRadius: '6px', border: '2px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
    }}>
      {/* Header: icon + name + slot/rarity (hover for full item card) */}
      <ItemTooltip item={item}>
        <div style={{ display: 'flex', gap: '12px', cursor: 'pointer' }}>
          <IconSlot size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: rarityColor, fontSize: '14px', fontWeight: 'bold', marginBottom: '6px', textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>{item.name}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RarityBadge rarity={item.rarity} />
              <span style={{ color: 'var(--color-text-muted)', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>{item.slot}</span>
            </div>
          </div>
        </div>
      </ItemTooltip>

      {/* Stats */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 12px', borderRadius: '4px',
        border: '1px solid var(--color-gold-dark)', background: 'rgba(0,0,0,0.25)', boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.5)',
      }}>
        {item.stats.map(s => <StatLine key={s.key} label={s.key} value={s.value} />)}
      </div>

      {/* Footer: price + buy */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', paddingTop: '4px', borderTop: '1px solid var(--color-gold-dark)' }}>
        <CoinDisplay amount={item.value} />
        <PrimaryButton>Buy</PrimaryButton>
      </div>
    </div>
  )
}

export default function ShopPage() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start' }}>
      {/* Left: merchant portrait */}
      <aside style={{ flex: '1 1 260px', maxWidth: '320px', minWidth: '240px' }}>
        <div style={{
          borderRadius: '8px', border: '3px solid var(--color-gold-mid)', overflow: 'hidden',
          background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
          boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', 'inset 0 2px 8px rgba(0,0,0,0.6)', '0 6px 20px rgba(0,0,0,0.8)'].join(', '),
        }}>
          {/* Portrait image placeholder (4:5) */}
          <div style={{
            aspectRatio: '4 / 5', width: '100%',
            borderBottom: '2px solid var(--color-gold-dark)',
            background: 'radial-gradient(circle at 50% 35%, #2a0e10 0%, #0d0304 80%)',
            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.5 }}>Merchant Art</span>
          </div>

          {/* Merchant details */}
          <div style={{ padding: '16px' }}>
            <p style={{ color: 'var(--color-gold-light)', fontSize: '16px', fontWeight: 'bold', letterSpacing: '0.5px', textShadow: '0 0 12px rgba(240,208,96,0.4)' }}>{MERCHANT.name}</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '3px' }}>{MERCHANT.title}</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', lineHeight: 1.5, fontStyle: 'italic', margin: '14px 0' }}>{MERCHANT.flavor}</p>

            {/* Restock timer */}
            <div className="atom-heavy" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
              padding: '8px 12px', borderRadius: '4px', border: '2px solid var(--color-gold-dark)',
              background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
            }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Restocks in</span>
              <span style={{ color: 'var(--color-text-gold)', fontSize: '14px', fontWeight: 'bold', fontFamily: '"Consolas", ui-monospace, monospace', fontVariantNumeric: 'tabular-nums' }}>{MERCHANT.restock}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Right: wares */}
      <section style={{ flex: '3 1 480px', minWidth: '280px' }}>
        <SectionTitle>Wares</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
          {SHOP.map(item => <ShopItemCard key={item.name} item={item} />)}
        </div>
      </section>
    </div>
  )
}
