import { StatusTag } from '@/components/atoms/StatusTag'
import { IconSlot } from '@/components/atoms/IconSlot'
import { PrimaryButton } from '@/components/atoms/Button'
import { useNow } from '@/hooks/useNow'
import { formatRemaining } from '@/lib/time'

// DESIGN PROTOTYPE (docs/superpowers — dungeon/raid UI follow-up to StagePath). Not yet wired into
// GroupContentPage; shown here on /design for review. Since a dungeon/raid clears strictly linearly,
// there's no reason to show all 9/4 stages' full detail at once — a slim trail gives orientation
// ("where am I"), and one big card gives full "what happens if I go forward" detail for the stage
// that's actually next, matching how a wizard/stepper presents one step at a time.

export type WizardStageStatus = 'cleared' | 'current' | 'locked'
export type WizardStage = {
  kind: 'trash' | 'boss'
  durationSeconds: number
  baseXp: number
  loot: { name: string; slot: string }[]
}

// A compact trail dot — bosses read as small red squares, trash as gold circles. No numbers, no
// per-node loot icon: the trail's only job is "where am I", the big card below carries the detail.
function TrailDot({ kind, status }: { kind: 'trash' | 'boss'; status: WizardStageStatus }) {
  const boss = kind === 'boss'
  return (
    <div style={{
      width: boss ? 12 : 9, height: boss ? 12 : 9, borderRadius: boss ? 3 : '50%', flexShrink: 0,
      border: `2px solid ${boss ? '#8a2e29' : 'var(--color-gold-mid)'}`,
      background: status === 'current'
        ? (boss ? '#c23c34' : 'var(--color-gold-light)')
        : status === 'cleared' ? (boss ? '#5c1f1c' : 'var(--color-gold-dark)') : 'transparent',
      boxShadow: status === 'current' ? '0 0 8px rgba(240,208,96,0.7)' : 'none',
      opacity: status === 'locked' ? 0.4 : 1,
    }} />
  )
}

const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export function StageWizard({ stages, currentStageIndex, stageEndsAt, onSend, onClaim, sending }: {
  stages: WizardStage[]
  currentStageIndex: number
  stageEndsAt?: string | null // ISO — set once the current stage is in flight
  onSend?: () => void
  onClaim?: () => void
  sending?: boolean
}) {
  const now = useNow()
  const stage = stages[currentStageIndex]
  const boss = stage.kind === 'boss'
  const endsAtMs = stageEndsAt ? new Date(stageEndsAt).getTime() : null
  const inFlight = endsAtMs != null && endsAtMs > now
  const readyToClaim = endsAtMs != null && !inFlight

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {stages.map((s, i) => (
          <TrailDot key={i} kind={s.kind} status={i < currentStageIndex ? 'cleared' : i === currentStageIndex ? 'current' : 'locked'} />
        ))}
        <span style={{ color: 'var(--color-text-muted)', fontSize: 11, marginLeft: 6 }}>Stage {currentStageIndex + 1} / {stages.length}</span>
      </div>

      <div style={{
        width: 320, borderRadius: 8,
        border: `3px solid ${boss ? '#8a2e29' : 'var(--color-gold-mid)'}`,
        background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
        boxShadow: [
          '0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', 'inset 0 2px 8px rgba(0,0,0,0.6)',
          boss ? '0 0 14px rgba(160,45,40,0.35)' : null, '0 6px 18px rgba(0,0,0,0.75)',
        ].filter(Boolean).join(', '),
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          padding: '10px 12px', borderBottom: `2px solid ${boss ? '#5c1f1c' : 'var(--color-gold-dark)'}`,
          background: boss
            ? 'linear-gradient(180deg, rgba(160,45,40,0.20) 0%, rgba(160,45,40,0.04) 100%)'
            : 'linear-gradient(180deg, rgba(200,145,42,0.15) 0%, rgba(200,145,42,0.04) 100%)',
        }}>
          <span style={{ color: 'var(--color-gold-light)', fontSize: 14, fontWeight: 'bold' }}>Stage {currentStageIndex + 1}</span>
          {boss ? <StatusTag tone="danger">Boss</StatusTag> : <StatusTag tone="neutral">Trash</StatusTag>}
        </div>

        <div style={{ padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
            <span style={{ color: 'var(--color-xp)', fontSize: 12, fontWeight: 'bold' }}>{stage.baseXp} XP</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--color-text-muted)', fontSize: 12 }}>
              <IconSlot size={12} />{fmtDuration(stage.durationSeconds)}
            </span>
          </div>

          <p style={{ color: 'var(--color-text-muted)', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
            Possible loot
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
            {stage.loot.length > 0 ? stage.loot.map((l, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconSlot size={20} />
                <span style={{ color: 'var(--color-text-primary)', fontSize: 12, flex: 1 }}>{l.name}</span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>{l.slot}</span>
              </div>
            )) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 11, fontStyle: 'italic' }}>No loot table authored for this stage yet.</p>
            )}
          </div>

          {inFlight && endsAtMs != null ? (
            <p style={{ color: 'var(--color-text-gold)', fontSize: 13, fontWeight: 'bold', textAlign: 'center' }}>
              {formatRemaining(endsAtMs - now)}
            </p>
          ) : readyToClaim ? (
            <PrimaryButton fullWidth onClick={onClaim}>Claim</PrimaryButton>
          ) : (
            <PrimaryButton fullWidth disabled={sending} onClick={onSend}>{sending ? 'Sending…' : 'Send Party'}</PrimaryButton>
          )}
        </div>
      </div>
    </div>
  )
}
