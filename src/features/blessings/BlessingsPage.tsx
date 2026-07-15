import { useState } from 'react'
import { Avatar } from '@/components/atoms/Avatar'
import { RoleBadge } from '@/components/atoms/RoleBadge'
import { Alert } from '@/components/atoms/Alert'
import { useRoster, type RosterMember } from '@/hooks/useRoster'
import { useCharacters } from '@/hooks/useCharacters'
import { resolveRole } from '@/lib/roles'
import { BLESSING_ROWS, BLESSING_ROW_LEVELS, canPickRow, rowSequenceBlocked } from '@/lib/blessings'
import type { GameCharacter } from '@/services/characters'
import { BlessingRowTile } from './components/BlessingRowTile'
import { CapstoneCard } from './components/CapstoneCard'
import { useChooseBlessing } from './hooks'

// Blessings page (ADR-0045) — real data, real writes. 4 rows of 2 choices, permanent, level-gated
// every 10 levels; a capstone earned (not chosen) once all 4 are picked. Replaces the old 7-row
// WoW-Classic-style mock (no backend, hardcoded party + tree).

const BUSY_REASON: Record<NonNullable<RosterMember['busy']>, string> = {
  mission: 'Blessings are locked while on a mission.',
  gathering: 'Blessings are locked while gathering.',
  infirmary: 'Blessings are locked while in the infirmary.',
}

const muted = { color: 'var(--color-text-muted)', fontSize: '13px', fontStyle: 'italic' as const }

export default function BlessingsPage() {
  const { roster, isLoading, error } = useRoster()
  const { data: defs } = useCharacters()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const choose = useChooseBlessing()

  const selected = roster.find((m) => m.id === selectedId) ?? roster[0] ?? null
  const def = selected ? defs?.find((d) => d.charKey === selected.characterDefId) ?? null : null

  return (
    <div>
      <PageHeader />
      {isLoading && <p style={muted}>Loading roster...</p>}
      {error && <Alert variant="error">{error instanceof Error ? error.message : 'Could not load roster'}</Alert>}
      {!isLoading && !error && roster.length === 0 && <p style={muted}>No characters recruited yet.</p>}

      {roster.length > 0 && (
        <div style={{ display: 'flex', gap: '18px', alignItems: 'flex-start' }}>
          <div style={{ width: '236px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <RailTitle>Characters</RailTitle>
            {roster.map((m) => (
              <CharacterRow key={m.id} member={m} selected={m.id === selected?.id} onSelect={() => setSelectedId(m.id)} />
            ))}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {selected && def ? (
              <TreePanel member={selected} def={def} choose={choose} />
            ) : (
              <p style={muted}>Select a character.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PageHeader() {
  return (
    <div style={{ marginBottom: '18px' }}>
      <h1 style={{ color: 'var(--color-gold-light)', fontSize: '22px', letterSpacing: '1px', textShadow: '0 0 12px rgba(240,208,96,0.35)' }}>
        Blessings
      </h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginTop: '4px' }}>
        Four rows, two choices each — pick one per row, permanent. A row unlocks every 10 levels,
        in order. A capstone is earned once all four are chosen.
      </p>
    </div>
  )
}

function RailTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      color: 'var(--color-gold-mid)', fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase',
      marginBottom: '4px', paddingBottom: '6px', borderBottom: '1px solid var(--color-gold-dark)',
    }}>{children}</h2>
  )
}

function CharacterRow({ member, selected, onSelect }: { member: RosterMember; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: '11px', width: '100%', textAlign: 'left',
        padding: '10px 12px', borderRadius: '6px', cursor: 'pointer',
        border: `2px solid ${selected ? 'var(--color-gold-light)' : 'var(--color-gold-dark)'}`,
        background: selected ? 'linear-gradient(180deg, #2a0f12 0%, #1c0709 100%)' : 'linear-gradient(180deg, #18070a 0%, #100305 100%)',
        boxShadow: selected ? '0 0 0 1px #080101, 0 0 14px rgba(240,208,96,0.25)' : '0 0 0 1px #080101',
      }}
    >
      <Avatar size={42} level={member.level} state={member.busy ? 'busy' : 'available'} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ color: selected ? 'var(--color-gold-light)' : 'var(--color-text-primary)', fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {member.name}
        </p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', margin: '2px 0 5px' }}>{member.charClass}</p>
        <RoleBadge role={resolveRole(member.charClass, member.role)} size="sm" />
      </div>
    </button>
  )
}

function TreePanel({
  member,
  def,
  choose,
}: {
  member: RosterMember
  def: GameCharacter
  choose: ReturnType<typeof useChooseBlessing>
}) {
  const busyReason = member.busy ? BUSY_REASON[member.busy] : null
  const rowByNumber = new Map(def.blessingTree.map((r) => [r.row, r]))

  return (
    <div className="atom-heavy" style={{
      borderRadius: '8px', border: '2px solid var(--color-gold-mid)', padding: '20px',
      display: 'flex', flexDirection: 'column', gap: '20px',
      background: 'linear-gradient(180deg, #1c080a 0%, #110305 100%)',
    }}>
      <div>
        <p style={{ color: 'var(--color-gold-light)', fontSize: '17px', fontWeight: 'bold' }}>{member.name}</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>Level {member.level}</p>
      </div>

      {busyReason && <Alert variant="warning">{busyReason}</Alert>}
      {choose.error && (
        <Alert variant="error">{choose.error instanceof Error ? choose.error.message : 'Could not choose blessing'}</Alert>
      )}

      {BLESSING_ROWS.map((row) => {
        const rowDef = rowByNumber.get(row)
        if (!rowDef) {
          return (
            <p key={row} style={muted}>Row {row}: not authored yet.</p>
          )
        }
        return (
          <BlessingRowTile
            key={row}
            row={rowDef}
            picked={member.blessings[`row${row}`]}
            pickable={!busyReason && canPickRow(row, member.level, member.blessings)}
            requiredLevel={BLESSING_ROW_LEVELS[row]}
            sequenceBlocked={rowSequenceBlocked(row, member.blessings)}
            pending={choose.isPending}
            onPick={(choice) => choose.mutate({ characterId: member.id, row: `row${row}`, choice })}
          />
        )
      })}

      <CapstoneCard capstone={def.capstone} earned={member.capstoneEarned} />
    </div>
  )
}
