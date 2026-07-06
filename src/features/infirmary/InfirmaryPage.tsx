import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRoster, type RosterMember } from '@/features/missions'
import { healCharacter } from '@/services/heal'
import { RoleBadge } from '@/components/atoms/RoleBadge'
import { PrimaryButton } from '@/components/atoms/Button'

// The Infirmary: heal wounded characters. First-pass — fully restores HP instantly and for free
// (heal rate / resource cost / capacity are future tuning). Damage persists between missions
// (ADR-0013), and a downed character (0 HP) can't be dispatched until healed here.

const hpColor = (pct: number) => (pct <= 0 ? '#e0635c' : pct < 0.35 ? '#d89a4f' : '#5fc77e')

function HpBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0
  const color = hpColor(pct)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#0d0304', border: '1px solid var(--color-gold-dark)', overflow: 'hidden' }}>
        <div style={{ width: `${pct * 100}%`, height: '100%', background: color, boxShadow: `0 0 6px ${color}88`, transition: 'width 0.3s' }} />
      </div>
      <span style={{ color, fontSize: 11, fontWeight: 'bold', minWidth: 56, textAlign: 'right' }}>
        {current <= 0 ? 'DOWNED' : `${Math.round(current)}/${max}`}
      </span>
    </div>
  )
}

function InfirmaryCard({ member, onHeal, healing }: { member: RosterMember; onHeal: () => void; healing: boolean }) {
  const current = member.currentHp ?? member.maxHp // null = full
  const hurt = member.currentHp !== null && member.currentHp < member.maxHp
  return (
    <div className="atom-heavy" style={{
      width: 320, padding: 14, borderRadius: 8,
      border: `3px solid ${member.currentHp === 0 ? '#8a2e29' : 'var(--color-gold-dark)'}`,
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
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
      <div style={{ marginTop: 12 }}>
        <PrimaryButton fullWidth disabled={!hurt || healing} onClick={onHeal}>
          {healing ? 'Healing…' : hurt ? 'Heal to full' : 'Full HP'}
        </PrimaryButton>
      </div>
    </div>
  )
}

const NOTE: React.CSSProperties = { color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic' }

export default function InfirmaryPage() {
  const { roster, isLoading, error } = useRoster()
  const qc = useQueryClient()
  const heal = useMutation({
    mutationFn: (characterId: string) => healCharacter(characterId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ownedCharacters'] }),
  })

  return (
    <div>
      <h2 style={{
        color: 'var(--color-gold-mid)', fontSize: 12, letterSpacing: 3, textTransform: 'uppercase',
        marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--color-gold-dark)',
      }}>Infirmary</h2>
      <p style={{ ...NOTE, marginBottom: 20 }}>
        Rest your wounded here to fully restore their HP. A downed character must be healed before it can be sent again.
      </p>

      {isLoading ? (
        <p style={NOTE}>Loading roster…</p>
      ) : error ? (
        <p style={{ ...NOTE, color: '#e0635c' }}>Could not load your roster.</p>
      ) : roster.length === 0 ? (
        <p style={NOTE}>No characters yet — recruit one on the Team page.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          {roster.map((m) => (
            <InfirmaryCard
              key={m.id}
              member={m}
              healing={heal.isPending && heal.variables === m.id}
              onHeal={() => heal.mutate(m.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
