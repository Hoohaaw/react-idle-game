import { useState } from 'react'
import { SegmentedControl } from '../components/atoms/SegmentedControl'
import { ItemTile } from '../components/molecules/ItemTile'
import { ItemTooltip } from '../components/organisms/ItemTooltip'
import { RarityBadge } from '../components/atoms/RarityBadge'
import { Modal } from '../components/organisms/Modal'
import { PrimaryButton, SecondaryButton } from '../components/atoms/Button'
import { nextRarity } from '../lib/rarity'
import { MOCK_INVENTORY } from '../lib/mockInventory'
import type { Item } from '../types/item'

// Five copies of the same item at the same quality combine into one of the next rarity.
const UPGRADE_COST = 5
const FILTERS = ['All Items', 'Upgradable']
type Filter = (typeof FILTERS)[number]

// Upgradable = enough copies of a non-Legendary stack to perform at least one combine.
function canUpgrade(item: Item): boolean {
  return (item.quantity ?? 1) >= UPGRADE_COST && nextRarity(item.rarity) !== null
}

export default function CraftingPage() {
  const [inventory, setInventory] = useState<Item[]>(MOCK_INVENTORY)
  const [filter, setFilter] = useState<Filter>('All Items')
  const [target, setTarget] = useState<Item | null>(null) // stack pending the upgrade confirm

  const upgradableCount = inventory.filter(canUpgrade).length
  const shown = filter === 'Upgradable' ? inventory.filter(canUpgrade) : inventory

  const confirmUpgrade = () => {
    const next = target && nextRarity(target.rarity)
    if (!target || !next) return
    setInventory(inv => {
      // Consume 5 from the source stack (drop the stack if it empties).
      let out = inv
        .map(it => it.name === target.name && it.rarity === target.rarity ? { ...it, quantity: (it.quantity ?? 1) - UPGRADE_COST } : it)
        .filter(it => (it.quantity ?? 1) > 0)
      // Add 1 to the same item's next-rarity stack (or create it).
      const existing = out.find(it => it.name === target.name && it.rarity === next)
      out = existing
        ? out.map(it => it === existing ? { ...it, quantity: (it.quantity ?? 1) + 1 } : it)
        : [...out, { ...target, rarity: next, quantity: 1 }]
      return out
    })
    setTarget(null)
  }

  return (
    <div>
      {/* Header: title + upgradable count + filter */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
        marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--color-gold-dark)',
      }}>
        <h2 style={{ color: 'var(--color-gold-mid)', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase' }}>
          Crafting <span style={{ color: 'var(--color-text-muted)' }}>· {upgradableCount} upgradable</span>
        </h2>
        <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', fontStyle: 'italic', marginBottom: '18px' }}>
        Combine {UPGRADE_COST} of the same item at the same quality into 1 of the next rarity.
      </p>

      {shown.length === 0 ? (
        <div style={{
          padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', lineHeight: 1.6,
          border: '1px dashed var(--color-gold-dark)', borderRadius: 8,
        }}>
          Nothing ready to upgrade yet.<br />
          Collect {UPGRADE_COST} of the same item at the same quality to combine them into the next rarity.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
          {shown.map(item => {
            const ready = canUpgrade(item)
            return (
              <ItemTooltip key={`${item.name}-${item.rarity}`} item={item}>
                <ItemTile
                  item={item}
                  onClick={ready ? () => setTarget(item) : undefined}
                  footer={<UpgradeFooter item={item} />}
                />
              </ItemTooltip>
            )
          })}
        </div>
      )}

      {/* Upgrade confirm — before → after preview */}
      <Modal open={target !== null} onClose={() => setTarget(null)}>
        {target && <UpgradePreview item={target} onConfirm={confirmUpgrade} onCancel={() => setTarget(null)} />}
      </Modal>
    </div>
  )
}

// Per-tile hint: ready-to-upgrade pill, or progress toward the next 5.
function UpgradeFooter({ item }: { item: Item }) {
  const qty = item.quantity ?? 1
  if (nextRarity(item.rarity) === null) return null // Legendary — no upgrade
  if (qty >= UPGRADE_COST) {
    const times = Math.floor(qty / UPGRADE_COST)
    return (
      <span style={{
        marginTop: 2, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5,
        color: '#8ee59c', border: '1px solid #2d6b45',
        background: 'linear-gradient(180deg, rgba(76,175,110,0.20) 0%, rgba(76,175,110,0.05) 100%)',
        whiteSpace: 'nowrap',
      }}>⬆ Upgrade{times > 1 ? ` ×${times}` : ''}</span>
    )
  }
  if (qty > 1) {
    return <span style={{ marginTop: 2, fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: 0.5 }}>{qty}/{UPGRADE_COST} to upgrade</span>
  }
  return null
}

// Modal body: 5× current → 1× next rarity, with Confirm/Cancel.
function UpgradePreview({ item, onConfirm, onCancel }: { item: Item; onConfirm: () => void; onCancel: () => void }) {
  const next = nextRarity(item.rarity)
  if (!next) return null
  const before: Item = { ...item, quantity: UPGRADE_COST }
  const after: Item = { ...item, rarity: next, quantity: 1 }

  return (
    <div style={{
      width: 380, maxWidth: '90vw', borderRadius: 8, overflow: 'hidden',
      border: '3px solid var(--color-gold-mid)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', 'inset 0 2px 8px rgba(0,0,0,0.6)', '0 10px 30px rgba(0,0,0,0.85)'].join(', '),
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: '2px solid var(--color-gold-dark)',
        background: 'linear-gradient(180deg, rgba(200,145,42,0.16) 0%, rgba(200,145,42,0.03) 100%)',
      }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>Upgrade Item</p>
        <p style={{ color: 'var(--color-gold-light)', fontSize: 16, fontWeight: 'bold', textShadow: '0 0 10px rgba(240,208,96,0.4)' }}>{item.name}</p>
      </div>

      {/* Before → after */}
      <div style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{ width: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <ItemTile item={before} />
            <RarityBadge rarity={item.rarity} size="sm" />
          </div>
          <span style={{ color: 'var(--color-gold-mid)', fontSize: 26, lineHeight: 1 }}>→</span>
          <div style={{ width: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <ItemTile item={after} />
            <RarityBadge rarity={next} size="sm" />
          </div>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: 0.5, marginTop: 14 }}>
          Consumes {UPGRADE_COST} · Produces 1
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--color-gold-dark)' }}>
        <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
        <PrimaryButton onClick={onConfirm}>Confirm Upgrade</PrimaryButton>
      </div>
    </div>
  )
}
