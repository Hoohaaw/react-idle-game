import { RARITY_STYLES } from '../../lib/rarity'
import { RarityBadge } from '../atoms/RarityBadge'
import { Tooltip } from '../atoms/Tooltip'
import { GEAR_SLOT_KEYS, slotKeyLabel, type GearSlotKey } from '../../lib/equipment'

// The 14-slot equipped-gear grid (ADR-0022) — presentational half of the CharacterCard's
// Equipped tab. Callers resolve slot contents (item name/rarity/stat lines from the
// inventory + itemDefs caches) and, when the character can be re-geared, pass onSlotClick
// to open a picker. `disabledReason` (busy character) renders the grid inert with a hint.

export type GearSlotContent = { name: string; rarity: string; stats?: string[] }

export function GearSlotGrid({ slots, onSlotClick, disabledReason }: {
  slots: Partial<Record<GearSlotKey, GearSlotContent | null>>
  onSlotClick?: (slotKey: GearSlotKey) => void
  disabledReason?: string | null
}) {
  const clickable = onSlotClick != null && !disabledReason

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {GEAR_SLOT_KEYS.map((slotKey) => {
          const item = slots[slotKey] ?? null
          return (
            <Tooltip
              key={slotKey}
              content={
                item ? (
                  <div>
                    <p style={{ color: RARITY_STYLES[item.rarity]?.color ?? 'var(--color-text-primary)', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>{item.name}</p>
                    <RarityBadge rarity={item.rarity} />
                    {item.stats && item.stats.length > 0 && (
                      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {item.stats.map((line) => (
                          <p key={line} style={{ color: '#5b9bd5', fontSize: '12px' }}>{line}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                    {clickable ? 'This slot is empty — click to equip.' : 'This slot is empty.'}
                  </p>
                )
              }
            >
              <div
                className="atom-heavy"
                onClick={clickable ? () => onSlotClick(slotKey) : undefined}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  padding: '8px 10px',
                  borderRadius: '4px',
                  border: `2px solid ${item ? 'var(--color-gold-dark)' : '#2a0d10'}`,
                  background: item
                    ? 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)'
                    : 'linear-gradient(180deg, #110305 0%, #0a0203 100%)',
                  opacity: item ? 1 : 0.55,
                  cursor: clickable ? 'pointer' : 'default',
                }}
              >
                <span style={{ color: 'var(--color-text-muted)', fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{slotKeyLabel(slotKey)}</span>
                {item ? (
                  <span style={{
                    color: RARITY_STYLES[item.rarity]?.color ?? 'var(--color-text-primary)',
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textShadow: `0 0 6px ${RARITY_STYLES[item.rarity]?.glow ?? 'transparent'}`,
                  }}>{item.name}</span>
                ) : (
                  <span style={{ color: '#3a1218', fontSize: '12px', fontStyle: 'italic' }}>Empty</span>
                )}
              </div>
            </Tooltip>
          )
        })}
      </div>
      {disabledReason && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', fontStyle: 'italic', marginTop: '10px', textAlign: 'center' }}>
          {disabledReason}
        </p>
      )}
    </div>
  )
}
