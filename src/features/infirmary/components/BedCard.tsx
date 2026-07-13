import { useNow } from '@/hooks/useNow'
import { healState, regenPerSec } from '@/lib/infirmary'
import { formatRemaining } from '@/lib/time'
import type { RosterMember } from '@/hooks/useRoster'
import type { InfirmaryAdmission } from '@/services/infirmary'
import { PrimaryButton } from '@/components/atoms/Button'
import { HpBar } from './HpBar'

// An occupied infirmary bed. HP is DERIVED live from admitted_at + hp_at_admission with the
// shared engine (compute-on-read, ADR-0002/0021) — the same math the discharge Edge Function
// settles with, so what the player watches is what they get.

export function BedCard({ member, admission, infirmaryLevel, onDischarge, discharging }: {
  member: RosterMember
  admission: InfirmaryAdmission
  infirmaryLevel: number
  onDischarge: () => void
  discharging: boolean
}) {
  const now = useNow()
  const recoverySpeedPct = member.stats.recoverySpeed ?? 0
  const state = healState({
    hpAtAdmission: admission.hp_at_admission,
    admittedAtMs: new Date(admission.admitted_at).getTime(),
    nowMs: now,
    charLevel: member.level,
    infirmaryLevel,
    maxHp: member.maxHp,
    recoverySpeedPct,
  })

  const effRate = Math.round(regenPerSec(infirmaryLevel) * (1 + Math.max(0, recoverySpeedPct) / 100))
  const phaseLine =
    state.phase === 'stabilizing'
      ? `Stabilizing — ${formatRemaining(state.stabilizeRemainingSec * 1000)} · full in ${formatRemaining(state.secondsToFull * 1000)}`
      : state.phase === 'healing'
        ? `Healing +${effRate} HP/s · full in ${formatRemaining(state.secondsToFull * 1000)}`
        : 'Fully healed'

  return (
    <div className="atom-heavy" style={{
      width: 320, padding: 14, borderRadius: 8,
      border: `3px solid ${state.phase === 'full' ? '#5fc77e' : 'var(--color-gold-dark)'}`,
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 48, flexShrink: 0, borderRadius: 3, border: '2px solid var(--color-gold-dark)', background: 'linear-gradient(180deg, #1a0608 0%, #0d0304 100%)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: 'var(--color-text-primary)', fontSize: 13 }}>{member.name}</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>{member.charClass} · Lv {member.level}</p>
        </div>
      </div>
      <HpBar current={state.currentHp} max={member.maxHp} />
      <p style={{
        color: state.phase === 'full' ? '#5fc77e' : 'var(--color-text-muted)',
        fontSize: 11, marginTop: 8, fontVariantNumeric: 'tabular-nums',
      }}>{phaseLine}</p>
      <div style={{ marginTop: 12 }}>
        <PrimaryButton fullWidth disabled={discharging} onClick={onDischarge}>
          {discharging ? 'Discharging…' : state.phase === 'full' ? 'Discharge (full HP)' : 'Discharge early'}
        </PrimaryButton>
      </div>
    </div>
  )
}

/** An unoccupied bed slot — shows the player their remaining capacity at a glance. */
export function EmptyBed() {
  return (
    <div style={{
      width: 320, minHeight: 120, borderRadius: 8, border: '2px dashed var(--color-gold-dark)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5,
    }}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic' }}>Empty bed</span>
    </div>
  )
}
