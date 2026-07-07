import { useNow } from '@/hooks/useNow'
import { healState } from '@/lib/infirmary'
import { formatRemaining } from '@/lib/time'
import type { RosterMember } from '@/hooks/useRoster'
import { RoleBadge } from '@/components/atoms/RoleBadge'
import { PrimaryButton } from '@/components/atoms/Button'
import { HpBar } from './HpBar'

// A roster entry in the ward list: current HP + what admitting RIGHT NOW would look like
// ("full in 14m" / "stabilize 8m, then heal 22m" — ADR-0021's projection contract). The
// projection reuses healState with admittedAt = now, so it always matches the server's math.

export function WardCard({ member, infirmaryLevel, bedFree, onAdmit, admitting }: {
  member: RosterMember
  infirmaryLevel: number
  bedFree: boolean
  onAdmit: () => void
  admitting: boolean
}) {
  const now = useNow()
  const current = member.currentHp ?? member.maxHp // null = full
  const damaged = member.currentHp !== null && member.currentHp < member.maxHp
  const admitted = member.busy === 'infirmary'
  const busyElsewhere = member.busy === 'mission' || member.busy === 'gathering'

  let projection: string | null = null
  if (damaged && !admitted) {
    const state = healState({
      hpAtAdmission: current,
      admittedAtMs: now,
      nowMs: now,
      charLevel: member.level,
      infirmaryLevel,
      maxHp: member.maxHp,
    })
    projection =
      state.phase === 'stabilizing'
        ? `Stabilize ${formatRemaining(state.stabilizeRemainingSec * 1000)}, then heal ${formatRemaining((state.secondsToFull - state.stabilizeRemainingSec) * 1000)}`
        : `Full in ${formatRemaining(state.secondsToFull * 1000)}`
  }

  const buttonLabel = admitting
    ? 'Admitting…'
    : admitted
      ? 'In Infirmary'
      : busyElsewhere
        ? member.busy === 'mission' ? 'On Mission' : 'Gathering'
        : !damaged
          ? 'Full HP'
          : bedFree
            ? 'Admit'
            : 'No free beds'

  return (
    <div className="atom-heavy" style={{
      width: 320, padding: 14, borderRadius: 8,
      border: `3px solid ${member.currentHp === 0 ? '#8a2e29' : 'var(--color-gold-dark)'}`,
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      opacity: admitted ? 0.75 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 48, flexShrink: 0, borderRadius: 3, border: '2px solid var(--color-gold-dark)', background: 'linear-gradient(180deg, #1a0608 0%, #0d0304 100%)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: 'var(--color-text-primary)', fontSize: 13 }}>{member.name}</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>{member.charClass} · Lv {member.level}</p>
          <div style={{ marginTop: 4 }}><RoleBadge role={member.role} size="sm" /></div>
        </div>
      </div>
      <HpBar current={current} max={member.maxHp} />
      {projection && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 11, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>
          {projection}
        </p>
      )}
      <div style={{ marginTop: 12 }}>
        <PrimaryButton
          fullWidth
          disabled={admitting || admitted || busyElsewhere || !damaged || !bedFree}
          onClick={onAdmit}
        >
          {buttonLabel}
        </PrimaryButton>
      </div>
    </div>
  )
}
