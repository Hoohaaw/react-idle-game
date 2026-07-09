import { useRoster } from '@/hooks/useRoster'
import { useProfile } from '@/hooks/useProfile'
import { bedsForLevel, regenPerSec } from '@/lib/infirmary'
import { useAdmissions, useAdmit, useDischarge, useUpgradeInfirmary } from './hooks'
import { BedCard, EmptyBed } from './components/BedCard'
import { WardCard } from './components/WardCard'
import { UpgradePanel } from './components/UpgradePanel'

// The Infirmary (ADR-0021): a leveled building that heals admitted characters over real time.
// Beds = level; each bed regens a flat HP/s; downed characters stabilize first. All state
// changes go through Edge Functions (ADR-0003) — this page only derives and displays.

const NOTE: React.CSSProperties = { color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic' }

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      color: 'var(--color-gold-mid)', fontSize: 12, letterSpacing: 3, textTransform: 'uppercase',
      marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--color-gold-dark)',
    }}>{children}</h2>
  )
}

export default function InfirmaryPage() {
  const { roster, isLoading, error } = useRoster()
  const profile = useProfile()
  const admissions = useAdmissions()
  const admit = useAdmit()
  const discharge = useDischarge()
  const upgrade = useUpgradeInfirmary()

  const level = profile.data?.infirmaryLevel ?? 1
  const beds = bedsForLevel(level)
  const admissionByChar = new Map((admissions.data ?? []).map((a) => [a.player_character_id, a]))
  const occupied = roster.filter((m) => admissionByChar.has(m.id))
  const bedFree = occupied.length < beds
  const actionError = admit.error ?? discharge.error ?? upgrade.error

  return (
    <div>
      <SectionHeading>Infirmary</SectionHeading>
      <p style={{ ...NOTE, marginBottom: 4 }}>
        Admit wounded characters to a bed to recover HP over time. Downed characters must
        stabilize before they begin healing.
      </p>
      <p style={{ color: 'var(--color-gold-light)', fontSize: 12, marginBottom: 20 }}>
        Level {level} · {beds} {beds === 1 ? 'bed' : 'beds'} · {regenPerSec(level)} HP/s per bed
      </p>

      {actionError && (
        <p style={{ ...NOTE, color: '#e0635c', marginBottom: 14 }}>{(actionError as Error).message}</p>
      )}

      <section style={{ marginBottom: 36 }}>
        <SectionHeading>Upgrade</SectionHeading>
        <UpgradePanel
          level={level}
          profile={profile.data}
          upgrading={upgrade.isPending}
          onUpgrade={() => upgrade.mutate()}
        />
      </section>

      {isLoading || admissions.isLoading ? (
        <p style={NOTE}>Loading roster…</p>
      ) : error ? (
        <p style={{ ...NOTE, color: '#e0635c' }}>Could not load your roster.</p>
      ) : roster.length === 0 ? (
        <p style={NOTE}>No characters yet — recruit one on the Team page.</p>
      ) : (
        <>
          <section style={{ marginBottom: 36 }}>
            <SectionHeading>Beds</SectionHeading>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              {occupied.map((m) => (
                <BedCard
                  key={m.id}
                  member={m}
                  admission={admissionByChar.get(m.id)!}
                  infirmaryLevel={level}
                  discharging={discharge.isPending && discharge.variables === m.id}
                  onDischarge={() => discharge.mutate(m.id)}
                />
              ))}
              {Array.from({ length: Math.max(0, beds - occupied.length) }, (_, i) => (
                <EmptyBed key={`empty-${i}`} />
              ))}
            </div>
          </section>

          <section style={{ marginBottom: 36 }}>
            <SectionHeading>Ward</SectionHeading>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              {roster.map((m) => (
                <WardCard
                  key={m.id}
                  member={m}
                  infirmaryLevel={level}
                  bedFree={bedFree}
                  admitting={admit.isPending && admit.variables === m.id}
                  onAdmit={() => admit.mutate(m.id)}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
