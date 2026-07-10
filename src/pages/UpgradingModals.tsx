import { RarityBadge } from '@/components/atoms/RarityBadge'
import { Modal } from '@/components/organisms/Modal'
import { PrimaryButton, SecondaryButton } from '@/components/atoms/Button'
import { RARITY_ORDER, nextRarity } from '@/lib/rarity'
import { UPGRADE_COST } from '@/lib/upgrade'
import type { Item } from '../types/item'

// Compact "rarity badge + ×count" rows for an item's stacks, high → low.
export function StackList({ stacks }: { stacks: Item[] }) {
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
export function UpgradeModal({ item, before, after, isPending, onOnce, onMax, onCancel, open }: {
  item: Item | null; before: Item[]; after: Item[]; isPending: boolean; open: boolean
  onOnce: () => void; onMax: () => void; onCancel: () => void
}) {
  const onceNext = item ? nextRarity(item.rarity) : null
  return (
    <Modal open={open} onClose={onCancel}>
      {item && (
        <div style={modalFrame}>
          <div style={modalHeader}>
            <p style={modalEyebrow}>Upgrade</p>
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
            {onceNext && <SecondaryButton onClick={isPending ? undefined : onOnce}>Upgrade Once</SecondaryButton>}
            <PrimaryButton disabled={isPending} onClick={onMax}>Upgrade to Max</PrimaryButton>
          </div>
        </div>
      )}
    </Modal>
  )
}

// Modal body: summary of cascading the entire inventory.
export function BulkUpgradeModal({ changes, isPending, onConfirm, onCancel, open }: {
  changes: { name: string; before: string; after: string }[]; isPending: boolean; open: boolean
  onConfirm: () => void; onCancel: () => void
}) {
  return (
    <Modal open={open} onClose={onCancel}>
      {open && (
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
            <PrimaryButton disabled={isPending} onClick={onConfirm}>Upgrade All</PrimaryButton>
          </div>
        </div>
      )}
    </Modal>
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
