import { useState } from 'react'
import { StatusTag } from '@/components/atoms/StatusTag'
import { PrimaryButton } from '@/components/atoms/Button'
import { SectionLabel } from '@/components/molecules/SectionLabel'
import { useNow } from '@/hooks/useNow'
import { formatRemaining } from '@/lib/time'
import { InfoStat, LootCard, PartyTile } from './DesignDungeonWizardParts'
import { DUNGEON, SAMPLE_WIZARD_STAGES, SAMPLE_WIZARD_ROSTER, type WizardStage } from './DesignDungeonWizardSamples'

// ── Dungeon/Raid Stage Wizard (prototype, /design only) ────────────────────────────────
// Adapts MissionDispatch's wide two-column layout (header / left content columns / right party
// panel / footer CTA) instead of the earlier small MissionCard-shaped step card: since a dungeon
// clears strictly linearly, there's exactly one meaningful "next step" at a time, same as a fresh
// mission dispatch — so it gets the same visual weight and structure. A slim, bigger stage-trail
// (dots, bosses marked) sits under the header for orientation. The party panel only appears while
// choosing a party (matches live GroupContentPage: party resets to empty after every claim, so a
// party gets picked before EVERY stage, not just the first) — mid-flight/ready-to-claim states
// collapse to a single centered column, since there's nothing left to pick at that point.
const MAX_PARTY = 5
const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function TrailDot({ kind, status }: { kind: 'trash' | 'boss'; status: 'cleared' | 'current' | 'locked' }) {
  const boss = kind === 'boss'
  return (
    <div style={{
      width: boss ? 22 : 16, height: boss ? 22 : 16, borderRadius: boss ? 5 : '50%', flexShrink: 0,
      border: `2px solid ${boss ? '#8a2e29' : 'var(--color-gold-mid)'}`,
      background: status === 'current'
        ? (boss ? '#c23c34' : 'var(--color-gold-light)')
        : status === 'cleared' ? (boss ? '#5c1f1c' : 'var(--color-gold-dark)') : 'transparent',
      boxShadow: status === 'current' ? '0 0 8px rgba(240,208,96,0.7)' : 'none',
      opacity: status === 'locked' ? 0.4 : 1,
    }} />
  )
}

export function DesignDungeonWizard({ stages = SAMPLE_WIZARD_STAGES, currentStageIndex, stageEndsAt }: {
  stages?: WizardStage[]
  currentStageIndex: number
  stageEndsAt?: string | null // ISO — set once the current stage is in flight
}) {
  const [selected, setSelected] = useState<string[]>([])
  const toggle = (id: string) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : (prev.length >= MAX_PARTY ? prev : [...prev, id]))

  const now = useNow()
  const stage = stages[currentStageIndex]
  const boss = stage.kind === 'boss'
  const endsAtMs = stageEndsAt ? new Date(stageEndsAt).getTime() : null
  const inFlight = endsAtMs != null && endsAtMs > now
  const readyToClaim = endsAtMs != null && !inFlight
  const dispatching = !inFlight && !readyToClaim

  return (
    <div style={{
      width: 1100, maxWidth: '100%', borderRadius: 10, border: `3px solid ${boss ? '#8a2e29' : 'var(--color-gold-mid)'}`,
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', 'inset 0 2px 8px rgba(0,0,0,0.6)', boss ? '0 0 14px rgba(160,45,40,0.35)' : null, '0 6px 20px rgba(0,0,0,0.8)'].filter(Boolean).join(', '),
      overflow: 'hidden', fontFamily: 'Georgia, serif', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header — dungeon name + description, boss badge */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexShrink: 0,
        padding: '22px 32px', borderBottom: '2px solid var(--color-gold-dark)',
        background: boss
          ? 'linear-gradient(180deg, rgba(160,45,40,0.20) 0%, rgba(160,45,40,0.04) 100%)'
          : 'linear-gradient(180deg, rgba(200,145,42,0.15) 0%, rgba(200,145,42,0.04) 100%)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: 'var(--color-gold-light)', fontSize: 24, fontWeight: 'bold', letterSpacing: '0.5px', textShadow: '0 0 14px rgba(240,208,96,0.4)' }}>{DUNGEON.name}</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Stage {currentStageIndex + 1} of {stages.length}</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 13, lineHeight: 1.5, fontStyle: 'italic' }}>{DUNGEON.description}</span>
          </div>
        </div>
        {boss ? <StatusTag tone="danger">Boss</StatusTag> : <StatusTag tone="neutral">Trash</StatusTag>}
      </div>

      {/* Stage trail — orientation only, bigger dots per feedback, sits inside the card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 32px', borderBottom: '1px solid var(--color-gold-dark)', flexShrink: 0 }}>
        {stages.map((s, i) => (
          <TrailDot key={i} kind={s.kind} status={i < currentStageIndex ? 'cleared' : i === currentStageIndex ? 'current' : 'locked'} />
        ))}
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, gap: 32, padding: '28px 32px 24px' }}>
        <div style={{ flex: dispatching ? '1.15 1 0%' : '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <SectionLabel>Stage {currentStageIndex + 1}</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              <InfoStat label="Duration" value={fmtDuration(stage.durationSeconds)} />
              <InfoStat label="Base XP" value={`${stage.baseXp}`} />
            </div>
          </div>

          <div>
            <SectionLabel>Potential Loot</SectionLabel>
            {stage.loot.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {stage.loot.map((item) => <LootCard key={item.name} item={item} />)}
              </div>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic' }}>No loot table authored for this stage yet.</p>
            )}
          </div>
        </div>

        {dispatching && (
          <div className="atom-heavy" style={{
            flex: '0.85 1 0%', minWidth: 0, alignSelf: 'flex-start', maxHeight: 'min(620px, 70vh)',
            borderRadius: 6, border: '2px solid var(--color-gold-dark)',
            background: 'linear-gradient(180deg, #180709 0%, #0e0304 100%)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--color-gold-dark)', flexShrink: 0 }}>
              <SectionLabel>Select Party — {selected.length}/{MAX_PARTY}</SectionLabel>
            </div>
            <div className="scrollbar-fantasy" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {SAMPLE_WIZARD_ROSTER.map((c) => {
                const isSelected = selected.includes(c.id)
                const unavailable = Boolean(c.busy) || Boolean(c.downed)
                return (
                  <PartyTile key={c.id} char={c} selected={isSelected} disabled={unavailable || (!isSelected && selected.length >= MAX_PARTY)} onToggle={() => toggle(c.id)} />
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer — isolated CTA container */}
      <div style={{
        borderTop: '2px solid var(--color-gold-mid)', padding: '18px 32px', flexShrink: 0,
        display: 'flex', justifyContent: 'center',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.3) 100%)',
      }}>
        {inFlight && endsAtMs != null ? (
          <p style={{ color: 'var(--color-text-gold)', fontSize: 16, fontWeight: 'bold' }}>{formatRemaining(endsAtMs - now)}</p>
        ) : readyToClaim ? (
          <PrimaryButton>Claim</PrimaryButton>
        ) : (
          <PrimaryButton disabled={selected.length === 0}>
            {selected.length === 0 ? 'Select a character' : `Send Party (${selected.length})`}
          </PrimaryButton>
        )}
      </div>
    </div>
  )
}
