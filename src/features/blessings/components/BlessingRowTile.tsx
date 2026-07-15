import type { CharacterBlessingRow } from '@/services/characters'
import { summarizeEffects } from '../lib'

// One row of a character's bespoke blessing tree (ADR-0045) — two choices, pick one, permanent.
// Three states per row: locked (level/sequence not met — no card detail shown), pickable (both
// choices selectable), chosen (the picked choice is highlighted, the other dimmed, no more clicks).

export function BlessingRowTile({
  row,
  picked,
  pickable,
  requiredLevel,
  sequenceBlocked,
  pending,
  onPick,
}: {
  row: CharacterBlessingRow
  picked?: 'a' | 'b'
  pickable: boolean
  requiredLevel: number
  sequenceBlocked: boolean
  pending: boolean
  onPick: (choiceId: 'a' | 'b') => void
}) {
  const locked = picked == null && !pickable

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span style={{ color: 'var(--color-gold-mid)', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>
          Row {row.row}
        </span>
        {locked && (
          <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', fontStyle: 'italic' }}>
            {sequenceBlocked ? 'Choose the row above first' : `Unlocks at level ${requiredLevel}`}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        {row.choices.map((choice) => (
          <ChoiceCard
            key={choice.choiceId}
            title={choice.title}
            description={choice.description}
            effects={choice.effects}
            state={
              picked === choice.choiceId ? 'chosen' : picked != null ? 'passed-over' : locked ? 'locked' : 'pickable'
            }
            disabled={locked || picked != null || pending}
            onClick={() => onPick(choice.choiceId)}
          />
        ))}
      </div>
    </div>
  )
}

type ChoiceState = 'chosen' | 'passed-over' | 'locked' | 'pickable'

function ChoiceCard({
  title,
  description,
  effects,
  state,
  disabled,
  onClick,
}: {
  title: string
  description?: string
  effects: { stat: string; kind: 'flat' | 'pct'; value: number }[]
  state: ChoiceState
  disabled: boolean
  onClick: () => void
}) {
  const borderColor =
    state === 'chosen' ? 'var(--color-gold-light)' : state === 'pickable' ? 'var(--color-gold-mid)' : 'var(--color-gold-dark)'
  const opacity = state === 'passed-over' || state === 'locked' ? 0.45 : 1

  return (
    <button
      className="atom-heavy"
      disabled={disabled}
      onClick={onClick}
      style={{
        flex: 1,
        textAlign: 'left',
        padding: '12px 14px',
        borderRadius: '6px',
        border: `2px solid ${borderColor}`,
        background: 'linear-gradient(180deg, #1c0a0c 0%, #110305 100%)',
        cursor: state === 'pickable' ? 'pointer' : 'default',
        opacity,
        boxShadow:
          state === 'chosen'
            ? '0 0 0 1px #080101, inset 0 1px 0 rgba(255,255,255,0.08), 0 0 14px rgba(240,208,96,0.4)'
            : '0 0 0 1px #080101, inset 0 1px 0 rgba(255,255,255,0.05)',
        transition: 'border-color 0.12s, opacity 0.12s',
      }}
    >
      <p style={{ color: state === 'chosen' ? 'var(--color-gold-light)' : 'var(--color-text-primary)', fontSize: '13px', fontWeight: 'bold' }}>
        {title}{state === 'chosen' && ' ✓'}
      </p>
      {effects.length > 0 && (
        <p style={{ color: 'var(--color-gold-mid)', fontSize: '11px', marginTop: '4px' }}>{summarizeEffects(effects)}</p>
      )}
      {description && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginTop: '6px', lineHeight: 1.4 }}>{description}</p>
      )}
    </button>
  )
}
