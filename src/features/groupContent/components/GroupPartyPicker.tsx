import { SectionLabel } from '@/components/molecules/SectionLabel'
import { CharacterTile } from '@/components/molecules/CharacterTile'
import type { RosterMember } from '@/hooks/useRoster'
import type { TraitContext } from '@/lib/traits'

// The dungeon/raid party panel — same visual language as MissionDispatch's right column, but the
// slot cap is a prop (5 for dungeons, 10 for raids, spec §4d) instead of a hardcoded 3.
export function GroupPartyPicker({ roster, cap, selected, onToggle, traitCtx }: {
  roster: RosterMember[]
  cap: number
  selected: string[]
  onToggle: (id: string) => void
  traitCtx: TraitContext
}) {
  return (
    <div className="atom-heavy" style={{
      borderRadius: 6, border: '2px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, #180709 0%, #0e0304 100%)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      maxHeight: 'min(620px, 70vh)',
    }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--color-gold-dark)', flexShrink: 0 }}>
        <SectionLabel>Select Party — {selected.length}/{cap}</SectionLabel>
      </div>
      <div className="scrollbar-fantasy" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {roster.map((c) => {
          const isSelected = selected.includes(c.id)
          const unavailable = Boolean(c.busy) || c.currentHp === 0
          return (
            <CharacterTile
              key={c.id}
              char={{ ...c, busy: c.busy, downed: c.currentHp === 0 }}
              selected={isSelected}
              disabled={unavailable || (!isSelected && selected.length >= cap)}
              onToggle={() => onToggle(c.id)}
              traitCtx={traitCtx}
            />
          )
        })}
        {roster.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 11, fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>
            No available characters — recruit or free up your party.
          </p>
        )}
      </div>
    </div>
  )
}
