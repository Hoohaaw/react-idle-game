import { Avatar } from '../atoms/Avatar'
import { StatusTag } from '../atoms/StatusTag'

// A character row in the roster. `activity` is derived server-side from the
// character's current assignment (on a mission / gathering / idle).
export type RosterCharacter = {
  id: string
  name: string
  charClass: string
  level: number
  activity: 'idle' | 'mission' | 'gather'
  detail?: string // mission name or resource being gathered
}

// Select-mode roster: lists EVERY owned character (busy ones included, shown
// dimmed and unselectable) so the player picks a free character to assign.
// Single-select for now (one character per mine); multi-select for mission
// parties comes later — see [[project-party-roster]].
export function PartyRoster({ characters, selectedId, onSelect }: {
  characters: RosterCharacter[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {characters.map(c => (
        <RosterRow key={c.id} char={c} selected={c.id === selectedId} onSelect={onSelect} />
      ))}
    </div>
  )
}

function RosterRow({ char, selected, onSelect }: { char: RosterCharacter; selected: boolean; onSelect: (id: string) => void }) {
  const free = char.activity === 'idle'
  const status = free ? 'Available' : char.activity === 'mission' ? 'On Mission' : 'Gathering'
  const detailIcon = char.activity === 'mission' ? '⚔' : char.activity === 'gather' ? '⛏' : ''
  const borderColor = selected ? 'var(--color-gold-light)' : free ? 'var(--color-gold-mid)' : 'var(--color-gold-dark)'

  return (
    <div
      onClick={free ? () => onSelect(char.id) : undefined}
      style={{
        borderRadius: 8, border: `2px solid ${borderColor}`,
        background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
        boxShadow: selected
          ? ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.07)', '0 0 16px rgba(240,208,96,0.45)', '0 4px 12px rgba(0,0,0,0.7)'].join(', ')
          : free
            ? ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', '0 0 12px rgba(200,140,30,0.22)', '0 4px 12px rgba(0,0,0,0.7)'].join(', ')
            : ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.05)', '0 4px 12px rgba(0,0,0,0.7)'].join(', '),
        opacity: free ? 1 : 0.6,
        padding: 11, display: 'flex', gap: 11, alignItems: 'center',
        cursor: free ? 'pointer' : 'not-allowed',
      }}
    >
      <Avatar size={54} state={free ? 'available' : 'busy'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: 'var(--color-gold-light)', fontSize: 14, fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 0 8px rgba(240,208,96,0.3)' }}>{char.name}</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 11, marginBottom: 7 }}>{char.charClass} · Lv {char.level}</p>
        <StatusTag tone={free ? 'ready' : 'busy'}>{status}</StatusTag>
        {char.detail && <p style={{ color: 'var(--color-text-muted)', fontSize: 11, fontStyle: 'italic', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{detailIcon} {char.detail}</p>}
      </div>
      {/* Selection indicator — only meaningful for free, selectable characters */}
      {free && (
        <span style={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: `2px solid ${selected ? 'var(--color-gold-light)' : 'var(--color-gold-dark)'}`,
          background: selected ? 'linear-gradient(180deg, #f0d060, #c9922a)' : 'transparent',
          color: selected ? '#1a0608' : 'transparent', fontWeight: 'bold', fontSize: 13,
          boxShadow: selected ? '0 0 10px rgba(240,208,96,0.6)' : 'none',
        }}>✓</span>
      )}
    </div>
  )
}
