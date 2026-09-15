import { StatusTag } from '@/components/atoms/StatusTag'
import { PrimaryButton } from '@/components/atoms/Button'
import { SectionLabel } from '@/components/molecules/SectionLabel'
import { useNow } from '@/hooks/useNow'
import { formatRemaining } from '@/lib/time'
import type { RosterMember } from '@/hooks/useRoster'
import type { TraitContext } from '@/lib/traits'
import type { GroupStageView, GroupClaimResponse } from '@/services/groupContent'
import { GroupPartyPicker } from './GroupPartyPicker'
import { InfoStat, LootCard, TrailDot } from './StageWizardParts'

// Real dungeon/raid stage wizard — wires the approved prototype (src/pages/DesignDungeonWizard.tsx,
// left in place as a permanent /design reference) to live data. Adapts MissionDispatch's wide
// two-column layout: header / left content column (stage info + loot) / right party panel (shown
// only while dispatching, since a party gets picked fresh before EVERY stage — GroupContentPage
// resets `party` to empty after every claim) / footer CTA. A slim stage-trail sits under the header
// for orientation.
//
// Deliberately NOT included (scope decisions made in chat, see the task brief): a win-chance
// estimate box (needs the full combat-stat pipeline — deferred follow-up) and the "locked out"
// post-clear-cooldown state (GroupContentPage keeps handling that at the page level, unchanged —
// it was never part of the approved design; this component is simply not rendered in that state).
const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

const LOSS_SCREENS = {
  'party-wiped': {
    title: 'Party Wiped', accent: '#e0635c', border: '#8a2e29', borderSoft: '#5c1f1c',
    headline: 'Your party has fallen — no rewards',
    body: 'Every hero was struck down before the enemies were. Nothing was earned, and downed heroes must be stabilized at the Infirmary before they can fight again. The stage stays where it is — try again with a stronger or different party.',
  },
  timeout: {
    title: 'Out of Time', accent: '#d89a4f', border: '#8a5e29', borderSoft: '#5c3f1c',
    headline: 'The clock ran out — no rewards',
    body: 'The stage dragged on too long with enemies still standing, and that counts as a loss — nothing was earned. Your party survived but carries its wounds. Bring more damage, or heroes this stage cannot resist.',
  },
} as const

export type StageWizardProps = {
  dungeonName: string
  description?: string
  stages: GroupStageView[]
  currentStageIndex: number
  stageEndsAt?: string | null // ISO — set once the current stage is in flight
  roster: RosterMember[]
  cap: number
  selected: string[]
  onToggle: (id: string) => void
  traitCtx: TraitContext
  onSend: () => void
  sending?: boolean
  sendError?: string | null
  onClaim: () => void
  claiming?: boolean
  claimError?: string | null
  /** A claim just came back a loss — shows the fail screen in place of the trail+body. */
  claimOutcome?: 'loss' | null
  claimReason?: GroupClaimResponse['reason'] | null
  onRetry: () => void
}

export function StageWizard({
  dungeonName, description, stages, currentStageIndex, stageEndsAt,
  roster, cap, selected, onToggle, traitCtx,
  onSend, sending, sendError, onClaim, claiming, claimError,
  claimOutcome, claimReason, onRetry,
}: StageWizardProps) {
  const now = useNow()
  const stage = stages[currentStageIndex]
  const boss = stage?.kind === 'boss'
  const endsAtMs = stageEndsAt ? new Date(stageEndsAt).getTime() : null
  const inFlight = endsAtMs != null && endsAtMs > now
  const readyToClaim = endsAtMs != null && !inFlight
  const lost = claimOutcome === 'loss'
  const dispatching = !inFlight && !readyToClaim && !lost
  // Same fallback-to-timeout-bucket pattern ClaimReward.tsx uses for its own loss screens.
  const loss = lost ? LOSS_SCREENS[claimReason === 'party-wiped' ? 'party-wiped' : 'timeout'] : null

  return (
    <div style={{
      width: 1100, maxWidth: '100%', borderRadius: 10, border: `3px solid ${loss ? loss.border : boss ? '#8a2e29' : 'var(--color-gold-mid)'}`,
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', 'inset 0 2px 8px rgba(0,0,0,0.6)', boss && !loss ? '0 0 14px rgba(160,45,40,0.35)' : null, '0 6px 20px rgba(0,0,0,0.8)'].filter(Boolean).join(', '),
      overflow: 'hidden', fontFamily: 'Georgia, serif', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header — dungeon name + description, boss badge (or the fail screen's title, on a loss) */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexShrink: 0,
        padding: '22px 32px', borderBottom: `2px solid ${loss ? loss.borderSoft : 'var(--color-gold-dark)'}`,
        background: loss
          ? `linear-gradient(180deg, color-mix(in srgb, ${loss.accent} 20%, transparent) 0%, color-mix(in srgb, ${loss.accent} 4%, transparent) 100%)`
          : boss
            ? 'linear-gradient(180deg, rgba(160,45,40,0.20) 0%, rgba(160,45,40,0.04) 100%)'
            : 'linear-gradient(180deg, rgba(200,145,42,0.15) 0%, rgba(200,145,42,0.04) 100%)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            color: loss ? loss.accent : 'var(--color-gold-light)', fontSize: 24, fontWeight: 'bold', letterSpacing: '0.5px',
            textShadow: loss ? 'none' : '0 0 14px rgba(240,208,96,0.4)',
          }}>{loss ? loss.title : dungeonName}</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Stage {currentStageIndex + 1} of {stages.length}</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 13, lineHeight: 1.5, fontStyle: 'italic' }}>{loss ? dungeonName : description}</span>
          </div>
        </div>
        {!loss && (boss ? <StatusTag tone="danger">Boss</StatusTag> : <StatusTag tone="neutral">Trash</StatusTag>)}
      </div>

      {loss ? (
        /* Fail screen — adapts ClaimReward's Party Wiped / Out of Time treatment */
        <div style={{ padding: '28px 32px' }}>
          <div className="atom-heavy" style={{
            padding: '16px 18px', borderRadius: 6,
            border: `2px solid ${loss.borderSoft}`,
            background: `linear-gradient(180deg, color-mix(in srgb, ${loss.accent} 12%, #160607) 0%, #160607 100%)`,
          }}>
            <p style={{ color: loss.accent, fontSize: 13, fontWeight: 'bold', letterSpacing: '0.5px' }}>{loss.headline}</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 12, lineHeight: 1.6, marginTop: 6 }}>{loss.body}</p>
          </div>
        </div>
      ) : (
        <>
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
                  <InfoStat label="Duration" value={fmtDuration(stage?.durationSeconds ?? 0)} />
                  <InfoStat label="Base XP" value={`${stage?.baseXp ?? 0}`} />
                </div>
              </div>

              <div>
                <SectionLabel>Potential Loot</SectionLabel>
                {/* Defensive guard (carried over from StagePath.tsx's StageNode): never assume
                    stage.loot is a real array — GROQ's loot[]{...} returns null, not [], for a
                    stage with no loot authored, even though the query's coalesce(..., []) now
                    guards against that server-side too (defense in depth, not either/or). */}
                {(stage?.loot?.length ?? 0) > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {stage!.loot.map((item) => <LootCard key={item.itemKey} item={item} />)}
                  </div>
                ) : (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic' }}>No loot table authored for this stage yet.</p>
                )}
              </div>
            </div>

            {dispatching && (
              <div style={{ flex: '0.85 1 0%', minWidth: 0, alignSelf: 'flex-start' }}>
                <GroupPartyPicker roster={roster} cap={cap} selected={selected} onToggle={onToggle} traitCtx={traitCtx} />
              </div>
            )}
          </div>
        </>
      )}

      {/* Footer — isolated CTA container */}
      <div style={{
        borderTop: `2px solid ${loss ? loss.borderSoft : 'var(--color-gold-mid)'}`, padding: '18px 32px', flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.3) 100%)',
      }}>
        {loss ? (
          <PrimaryButton onClick={onRetry}>Retry</PrimaryButton>
        ) : inFlight && endsAtMs != null ? (
          <p style={{ color: 'var(--color-text-gold)', fontSize: 16, fontWeight: 'bold' }}>{formatRemaining(endsAtMs - now)}</p>
        ) : readyToClaim ? (
          <>
            <PrimaryButton disabled={claiming} onClick={onClaim}>{claiming ? 'Claiming…' : 'Claim'}</PrimaryButton>
            {claimError && <p style={{ color: '#e0635c', fontSize: 11 }}>{claimError}</p>}
          </>
        ) : (
          <>
            <PrimaryButton disabled={selected.length === 0 || sending} onClick={onSend}>
              {sending ? 'Sending…' : selected.length === 0 ? 'Select a character' : `Send Party (${selected.length})`}
            </PrimaryButton>
            {sendError && <p style={{ color: '#e0635c', fontSize: 11 }}>{sendError}</p>}
          </>
        )}
      </div>
    </div>
  )
}
