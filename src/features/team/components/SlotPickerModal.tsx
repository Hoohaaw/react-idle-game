import { Modal } from '@/components/organisms/Modal'
import { ItemTile } from '@/components/molecules/ItemTile'
import { Alert } from '@/components/atoms/Alert'
import { PrimaryButton } from '@/components/atoms/Button'
import { itemSlotForSlotKey, slotKeyLabel, type GearSlotKey } from '@/lib/equipment'
import { scaledItemStats } from '@/lib/itemStats'
import { useInventory } from '@/hooks/useInventory'
import { useItemDefs, type RosterMember } from '@/hooks/useRoster'
import { useEquipItem, useUnequipItem } from '../hooks'

// The slot picker (ADR-0022): click a slot on the character sheet → choose which inventory
// stack to equip there. Eligibility = the stack's authored slot matches the slot key's base
// slot (a ring item fits any of ring1..ring4). Equipping into an occupied slot swaps — the
// old item returns to inventory server-side.

export function SlotPickerModal({ member, slotKey, onClose }: {
  member: RosterMember
  slotKey: GearSlotKey | null
  onClose: () => void
}) {
  const inventory = useInventory()
  const itemDefs = useItemDefs()
  const equip = useEquipItem()
  const unequip = useUnequipItem()

  const baseSlot = slotKey ? itemSlotForSlotKey(slotKey) : null
  const current = slotKey ? (member.equipped[slotKey] ?? null) : null
  const eligible = (inventory.data ?? []).filter(
    (stack) => itemDefs.data?.[stack.itemDefId]?.slot === baseSlot,
  )
  const pending = equip.isPending || unequip.isPending
  const mutationError = equip.error ?? unequip.error

  const handleEquip = (itemDefId: string, rarity: string) => {
    if (!slotKey || pending) return
    equip.mutate({ characterId: member.id, slotKey, itemDefId, rarity }, { onSuccess: onClose })
  }
  const handleUnequip = () => {
    if (!slotKey || pending) return
    unequip.mutate({ characterId: member.id, slotKey }, { onSuccess: onClose })
  }

  return (
    <Modal open={slotKey !== null} onClose={onClose}>
      <div className="atom-heavy" style={{
        width: 460, maxWidth: '100%', padding: 20, borderRadius: 8,
        border: '3px solid var(--color-gold-mid)',
        background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      }}>
        <p style={{ color: 'var(--color-gold-mid)', fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>
          {slotKey ? slotKeyLabel(slotKey) : ''}
        </p>
        <p style={{ color: 'var(--color-text-primary)', fontSize: 13, marginBottom: 14 }}>
          {member.name}
        </p>

        {mutationError && (
          <div style={{ marginBottom: 12 }}>
            <Alert variant="error">
              {mutationError instanceof Error ? mutationError.message : 'Something went wrong'}
            </Alert>
          </div>
        )}

        {current && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
              Equipped: <span style={{ color: 'var(--color-text-primary)' }}>
                {itemDefs.data?.[current.itemDefId]?.name ?? current.itemDefId}
              </span> ({current.rarity})
            </p>
            <PrimaryButton onClick={handleUnequip} disabled={pending}>
              {unequip.isPending ? 'Unequipping…' : 'Unequip'}
            </PrimaryButton>
          </div>
        )}

        {inventory.isLoading && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, fontStyle: 'italic' }}>Loading inventory…</p>
        )}
        {!inventory.isLoading && eligible.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, fontStyle: 'italic' }}>
            No {baseSlot} items in your inventory.
          </p>
        )}
        {eligible.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
            {eligible.map((stack) => {
              const def = itemDefs.data?.[stack.itemDefId]
              return (
                <ItemTile
                  key={stack.id}
                  item={{
                    name: def?.name ?? stack.itemDefId,
                    rarity: stack.rarity,
                    slot: def?.slot ?? '',
                    stats: scaledItemStats(def?.statBonuses, stack.rarity),
                    value: 0,
                    quantity: stack.quantity,
                  }}
                  onClick={() => handleEquip(stack.itemDefId, stack.rarity)}
                  footer={
                    <span style={{ color: 'var(--color-gold-light)', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>
                      {equip.isPending ? 'Equipping…' : 'Equip'}
                    </span>
                  }
                />
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}
