import { useMemo, useState } from 'react'
import { SegmentedControl } from '../components/atoms/SegmentedControl'
import { ItemTile } from '../components/molecules/ItemTile'
import { ItemTooltip } from '../components/organisms/ItemTooltip'
import { SecondaryButton } from '../components/atoms/Button'
import { nextRarity } from '../lib/rarity'
import { cascade, distribution, UPGRADE_COST } from '../lib/upgrade'
import { scaledItemStats } from '../lib/itemStats'
import { useInventory, useUpgradeItems } from '../hooks/useInventory'
import { useItemDefs } from '../hooks/useRoster'
import { UpgradeModal, BulkUpgradeModal } from './UpgradingModals'
import type { Item } from '../types/item'
import type { UpgradeOp } from '../services/inventory'

const FILTERS = ['All Items', 'Upgradable']
type Filter = (typeof FILTERS)[number]

function canUpgrade(item: Item): boolean {
  return (item.quantity ?? 1) >= UPGRADE_COST && nextRarity(item.rarity) !== null
}

// Diff inventory before/after cascade, emitting one UpgradeOp per decreased (itemDefId, rarity).
function computeOps(before: Item[], after: Item[]): UpgradeOp[] {
  const ops: UpgradeOp[] = []
  for (const b of before) {
    if (!b.itemDefId) continue
    const a = after.find(x => x.itemDefId === b.itemDefId && x.rarity === b.rarity)
    const delta = (b.quantity ?? 1) - (a?.quantity ?? 0)
    if (delta > 0) ops.push({ itemDefId: b.itemDefId, fromRarity: b.rarity, consumeCount: delta })
  }
  return ops
}

// Whole-inventory cascade preview: per-item before → after, only items that change.
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
  if (nextRarity(item.rarity) === null) return null
  if (qty >= UPGRADE_COST) {
    const times = Math.floor(qty / UPGRADE_COST)
    return (
      <span style={{
        marginTop: 2, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5,
        color: '#8ee59c', border: '1px solid #2d6b45',
        background: 'linear-gradient(180deg, rgba(76,175,110,0.20) 0%, rgba(76,175,110,0.05) 100%)',
        whiteSpace: 'nowrap',
      }}>Upgrade{times > 1 ? ` ×${times}` : ''}</span>
    )
  }
  if (qty > 1) {
    return <span style={{ marginTop: 2, fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: 0.5 }}>{qty}/{UPGRADE_COST} to upgrade</span>
  }
  return null
}

export default function UpgradingPage() {
  const inventoryQ = useInventory()
  const itemDefs = useItemDefs()
  const upgrade = useUpgradeItems()
  const [filter, setFilter] = useState<Filter>('All Items')
  const [target, setTarget] = useState<Item | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)

  const inventory = useMemo<Item[]>(() => {
    return (inventoryQ.data ?? []).map((stack) => {
      const def = itemDefs.data?.[stack.itemDefId]
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
  }, [inventoryQ.data, itemDefs.data])

  const upgradableCount = inventory.filter(canUpgrade).length
  const shown = filter === 'Upgradable' ? inventory.filter(canUpgrade) : inventory
  const isPending = upgrade.isPending
  const bulkChanges = useMemo(
    () => (bulkOpen ? changedItems(inventory) : []),
    [bulkOpen, inventory]
  )

  const upgradeOnce = (stack: Item) => {
    if (!stack.itemDefId || !nextRarity(stack.rarity)) return
    upgrade.mutate([{ itemDefId: stack.itemDefId, fromRarity: stack.rarity, consumeCount: 5 }], {
      onSuccess: () => setTarget(null),
    })
  }

  const upgradeMax = (stack: Item) => {
    const ops = computeOps(inventory, cascade(inventory, [stack.itemDefId ?? stack.name]))
    if (ops.length) upgrade.mutate(ops, { onSuccess: () => setTarget(null) })
    else setTarget(null)
  }

  const upgradeAll = () => {
    const ops = computeOps(inventory, cascade(inventory))
    if (ops.length) upgrade.mutate(ops, {
      onSuccess: () => setBulkOpen(false),
      onError:   () => setBulkOpen(false),
    })
    else setBulkOpen(false)
  }

  const targetBefore = target ? inventory.filter(i => i.name === target.name) : []
  const targetAfter  = target ? cascade(inventory, [target.itemDefId ?? target.name]).filter(i => i.name === target.name) : []

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
        marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--color-gold-dark)',
      }}>
        <h2 style={{ color: 'var(--color-gold-mid)', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase' }}>
          Upgrading <span style={{ color: 'var(--color-text-muted)' }}>· {upgradableCount} upgradable</span>
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {upgradableCount > 0 && <SecondaryButton onClick={() => setBulkOpen(true)}>Upgrade All</SecondaryButton>}
          <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
        </div>
      </div>

      <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', fontStyle: 'italic', marginBottom: '18px' }}>
        Combine {UPGRADE_COST} of the same item at the same quality into 1 of the next rarity — or upgrade a stack as high as it goes.
      </p>

      {inventoryQ.isLoading && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', fontStyle: 'italic' }}>Loading inventory…</p>
      )}
      {upgrade.error && (
        <p style={{ color: '#e0635c', fontSize: '12px', marginBottom: '12px' }}>
          {(upgrade.error as Error).message}
        </p>
      )}

      {!inventoryQ.isLoading && shown.length === 0 && (
        <div style={{
          padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', lineHeight: 1.6,
          border: '1px dashed var(--color-gold-dark)', borderRadius: 8,
        }}>
          Nothing ready to upgrade yet.<br />
          Collect {UPGRADE_COST} of the same item at the same quality to combine them into the next rarity.
        </div>
      )}

      {shown.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
          {shown.map(item => (
            <ItemTooltip key={`${item.itemDefId ?? item.name}-${item.rarity}`} item={item}>
              <ItemTile
                item={item}
                onClick={canUpgrade(item) && !isPending ? () => setTarget(item) : undefined}
                footer={<UpgradeFooter item={item} />}
              />
            </ItemTooltip>
          ))}
        </div>
      )}

      <UpgradeModal
        open={target !== null}
        item={target}
        before={targetBefore}
        after={targetAfter}
        isPending={isPending}
        onOnce={() => target && upgradeOnce(target)}
        onMax={() => target && upgradeMax(target)}
        onCancel={() => setTarget(null)}
      />

      <BulkUpgradeModal
        open={bulkOpen}
        changes={bulkChanges}
        isPending={isPending}
        onConfirm={upgradeAll}
        onCancel={() => setBulkOpen(false)}
      />
    </div>
  )
}
