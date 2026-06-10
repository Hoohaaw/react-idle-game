import { useState } from 'react'
import { SegmentedControl } from '../components/atoms/SegmentedControl'
import { ItemTile } from '../components/molecules/ItemTile'
import { ItemTooltip } from '../components/organisms/ItemTooltip'
import { RarityBadge } from '../components/atoms/RarityBadge'
import { Modal } from '../components/organisms/Modal'
import { PrimaryButton, SecondaryButton } from '../components/atoms/Button'
import { RARITY_ORDER, nextRarity } from '../lib/rarity'
import { cascade, distribution, UPGRADE_COST } from '../lib/upgrade'
import { MOCK_INVENTORY } from '../lib/mockInventory'
import type { Item } from '../types/item'

const FILTERS = ['All Items', 'Upgradable']
type Filter = (typeof FILTERS)[number]

// Upgradable = enough copies of a non-Legendary stack to perform at least one combine.
function canUpgrade(item: Item): boolean {
  return (item.quantity ?? 1) >= UPGRADE_COST && nextRarity(item.rarity) !== null
}

export default function UpgradingPage() {
  const [inventory, setInventory] = useState<Item[]>(MOCK_INVENTORY)
  const [filter, setFilter] = useState<Filter>('All Items')
  const [target, setTarget] = useState<Item | null>(null) // stack pending the per-item modal
  const [bulkOpen, setBulkOpen] = useState(false)

  const upgradableCount = inventory.filter(canUpgrade).length
  const shown = filter === 'Upgradable' ? inventory.filter(canUpgrade) : inventory

  // One combine on the clicked stack: 5 of its rarity → 1 of the next.
  const upgradeOnce = (stack: Item) => {
    const next = nextRarity(stack.rarity)
    if (!next) return
    setInventory(inv => {
      let out = inv
        .map(it => it.name === stack.name && it.rarity === stack.rarity ? { ...it, quantity: (it.quantity ?? 1) - UPGRADE_COST } : it)
        .filter(it => (it.quantity ?? 1) > 0)
      const existing = out.find(it => it.name === stack.name && it.rarity === next)
      out = existing
        ? out.map(it => it === existing ? { ...it, quantity: (it.quantity ?? 1) + 1 } : it)
        : [...out, { ...stack, rarity: next, quantity: 1 }]
      return out
    })
    setTarget(null)
  }

  const upgradeMax = (stack: Item) => { setInventory(inv => cascade(inv, [stack.name])); setTarget(null) }
  const upgradeAll = () => { setInventory(inv => cascade(inv)); setBulkOpen(false) }

  // Derived previews (only computed when a modal is open).
  const targetBefore = target ? inventory.filter(i => i.name === target.name) : []
  const targetAfter = target ? cascade(inventory, [target.name]).filter(i => i.name === target.name) : []
  const bulkChanges = bulkOpen ? changedItems(inventory) : []

  return (
    <div>
      {/* Header: title + count + bulk action + filter */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
        marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--color-gold-dark)',
      }}>
        <h2 style={{ color: 'var(--color-gold-mid)', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase' }}>
          Upgrading <span style={{ color: 'var(--color-text-muted)' }}>· {upgradableCount} upgradable</span>
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {upgradableCount > 0 && <SecondaryButton onClick={() => setBulkOpen(true)}>⬆ Upgrade All</SecondaryButton>}
          <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
        </div>
      </div>

      <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', fontStyle: 'italic', marginBottom: '18px' }}>
        Combine {UPGRADE_COST} of the same item at the same quality into 1 of the next rarity — or upgrade a stack as high as it goes.
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

      {/* Per-item: once or to-max */}
      <Modal open={target !== null} onClose={() => setTarget(null)}>
        {target && (
          <UpgradeModal
            item={target}
            before={targetBefore}
            after={targetAfter}
            onOnce={() => upgradeOnce(target)}
            onMax={() => upgradeMax(target)}
            onCancel={() => setTarget(null)}
          />
        )}
      </Modal>

      {/* Global: cascade the whole inventory */}
      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)}>
        {bulkOpen && (
          <BulkUpgradeModal changes={bulkChanges} onConfirm={upgradeAll} onCancel={() => setBulkOpen(false)} />
        )}
      </Modal>
    </div>
  )
}

// Whole-inventory cascade preview: per-item before → after, only for items that change.
function changedItems(inventory: Item[]): { name: string; before: string; after: string }[] {
  const after = cascade(inventory)
  return [...new Set(inventory.map(i => i.name))]
    .map(name => ({
      name,
      before: distribution(inventory.filter(i => i.name === name)),
      after: distribution(after.filter(i => i.name === name)),
    }))
    .filter(c => c.before !== c.after)
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

// Compact "rarity badge + ×count" rows for an item's stacks, high → low.
function StackList({ stacks }: { stacks: Item[] }) {
  const order = RARITY_ORDER as readonly string[]
  const sorted = [...stacks].sort((a, b) => order.indexOf(b.rarity) - order.indexOf(a.rarity))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {sorted.map(s => (
        <div key={s.rarity} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RarityBadge rarity={s.rarity} size="sm" />
          <span style={{ color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 'bold' }}>×{s.quantity ?? 1}</span>
        </div>
      ))}
    </div>
  )
}

// Modal body: this item's current stacks → the maxed result, with Once / Max / Cancel.
function UpgradeModal({ item, before, after, onOnce, onMax, onCancel }: {
  item: Item; before: Item[]; after: Item[]; onOnce: () => void; onMax: () => void; onCancel: () => void
}) {
  const onceNext = nextRarity(item.rarity)
  return (
    <div style={modalFrame}>
      <div style={modalHeader}>
        <p style={modalEyebrow}>Upgrade to Max</p>
        <p style={modalTitle}>{item.name}</p>
      </div>

      <div style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <StackList stacks={before} />
          <span style={{ color: 'var(--color-gold-mid)', fontSize: 26, lineHeight: 1 }}>→</span>
          <StackList stacks={after} />
        </div>
        {onceNext && (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 11, marginTop: 16 }}>
            Or upgrade once: {UPGRADE_COST} {item.rarity} → 1 {onceNext}
          </p>
        )}
      </div>

      <div style={modalActions}>
        <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
        {onceNext && <SecondaryButton onClick={onOnce}>Upgrade Once</SecondaryButton>}
        <PrimaryButton onClick={onMax}>Upgrade to Max</PrimaryButton>
      </div>
    </div>
  )
}

// Modal body: summary of cascading the entire inventory.
function BulkUpgradeModal({ changes, onConfirm, onCancel }: {
  changes: { name: string; before: string; after: string }[]; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div style={{ ...modalFrame, width: 420 }}>
      <div style={modalHeader}>
        <p style={modalEyebrow}>Upgrade All</p>
        <p style={modalTitle}>Combine everything as high as possible</p>
      </div>

      <div style={{ padding: '14px 16px', maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {changes.map(c => (
          <div key={c.name} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 'bold' }}>{c.name}</span>
            <span style={{ fontSize: 12, textAlign: 'right' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>{c.before}</span>
              <span style={{ color: 'var(--color-gold-mid)' }}> → </span>
              <span style={{ color: 'var(--color-text-gold)', fontWeight: 'bold' }}>{c.after}</span>
            </span>
          </div>
        ))}
      </div>

      <div style={modalActions}>
        <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
        <PrimaryButton onClick={onConfirm}>Upgrade All</PrimaryButton>
      </div>
    </div>
  )
}

const modalFrame = {
  width: 400, maxWidth: '90vw', borderRadius: 8, overflow: 'hidden',
  border: '3px solid var(--color-gold-mid)',
  background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
  boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', 'inset 0 2px 8px rgba(0,0,0,0.6)', '0 10px 30px rgba(0,0,0,0.85)'].join(', '),
} as const

const modalHeader = {
  padding: '14px 16px', borderBottom: '2px solid var(--color-gold-dark)',
  background: 'linear-gradient(180deg, rgba(200,145,42,0.16) 0%, rgba(200,145,42,0.03) 100%)',
} as const

const modalEyebrow = { color: 'var(--color-text-muted)', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' } as const
const modalTitle = { color: 'var(--color-gold-light)', fontSize: 16, fontWeight: 'bold', textShadow: '0 0 10px rgba(240,208,96,0.4)' } as const
const modalActions = { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--color-gold-dark)' } as const
