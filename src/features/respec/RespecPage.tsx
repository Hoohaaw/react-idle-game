import { useState } from 'react'
import { Avatar } from '@/components/atoms/Avatar'
import { RoleBadge } from '@/components/atoms/RoleBadge'
import { Alert } from '@/components/atoms/Alert'
import { PrimaryButton } from '@/components/atoms/Button'
import { useRoster, type RosterMember } from '@/hooks/useRoster'
import { useProfile } from '@/hooks/useProfile'
import { resolveRole } from '@/lib/roles'
import { RESPEC_COST, pickedRowCount } from '@/lib/blessings'
import { useRespecBlessing } from './hooks'

// Respec page (ADR-0047) — pay gold to wipe a character's entire blessing tree back to `{}` in
// one shot. All-or-nothing: row2/3/4 structurally require the previous row picked, so a partial
// respec isn't offered. Deliberately no confirmation step — press-to-respec is the whole ask.

const BUSY_REASON: Record<NonNullable<RosterMember['busy']>, string> = {
  mission: 'Locked while on a mission.',
  gathering: 'Locked while gathering.',
  infirmary: 'Locked while in the infirmary.',
}

const muted = { color: 'var(--color-text-muted)', fontSize: '13px', fontStyle: 'italic' as const }

export default function RespecPage() {
  const { roster, isLoading, error } = useRoster()
  const { data: profile } = useProfile()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [justDone, setJustDone] = useState(false)
  const respec = useRespecBlessing()

  const selected = roster.find((m) => m.id === selectedId) ?? roster[0] ?? null
  const gold = profile?.currencies?.gold ?? 0

  function handleSelect(id: string) {
    setSelectedId(id)
    setJustDone(false)
    respec.reset()
  }

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
              <CharacterRow key={m.id} member={m} selected={m.id === selected?.id} onSelect={() => handleSelect(m.id)} />
            ))}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {selected ? (
              <DetailPanel
                member={selected}
                gold={gold}
                respec={respec}
                justDone={justDone}
                onRespec={() => respec.mutate({ characterId: selected.id }, { onSuccess: () => setJustDone(true) })}
              />
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
        Respec
      </h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginTop: '4px' }}>
        Pay gold to wipe a character&apos;s entire blessing tree, all rows at once, so you can
        re-pick from scratch.
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

function DetailPanel({
  member,
  gold,
  respec,
  justDone,
  onRespec,
}: {
  member: RosterMember
  gold: number
  respec: ReturnType<typeof useRespecBlessing>
  justDone: boolean
  onRespec: () => void
}) {
  const busyReason = member.busy ? BUSY_REASON[member.busy] : null
  const picked = pickedRowCount(member.blessings)
  const canAfford = gold >= RESPEC_COST

  const disabledReason = busyReason
    ? busyReason
    : picked === 0
      ? 'No blessings picked — nothing to respec.'
      : !canAfford
        ? `Not enough gold (needs ${RESPEC_COST}, have ${gold}).`
        : null

  return (
    <div className="atom-heavy" style={{
      borderRadius: '8px', border: '2px solid var(--color-gold-mid)', padding: '20px',
      display: 'flex', flexDirection: 'column', gap: '16px',
      background: 'linear-gradient(180deg, #1c080a 0%, #110305 100%)',
    }}>
      <div>
        <p style={{ color: 'var(--color-gold-light)', fontSize: '17px', fontWeight: 'bold' }}>{member.name}</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>Level {member.level}</p>
      </div>

      <p style={{ color: 'var(--color-text-primary)', fontSize: '13px' }}>{picked} of 4 rows picked.</p>

      {disabledReason && !justDone && <Alert variant="warning">{disabledReason}</Alert>}
      {respec.error && (
        <Alert variant="error">{respec.error instanceof Error ? respec.error.message : 'Could not respec'}</Alert>
      )}
      {justDone && !respec.error && <Alert variant="success">Blessings reset. Pick again anytime.</Alert>}

      <div>
        <PrimaryButton disabled={!!disabledReason || respec.isPending} onClick={onRespec}>
          {respec.isPending ? 'Respeccing...' : `Respec (${RESPEC_COST} Gold)`}
        </PrimaryButton>
      </div>
    </div>
  )
}
