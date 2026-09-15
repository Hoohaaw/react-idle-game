import { useEffect, useState } from 'react'
import { Modal } from '@/components/organisms/Modal'
import { useRoster } from '@/hooks/useRoster'
import { useProfile } from '@/hooks/useProfile'
import { formatRemaining } from '@/lib/time'
import { GROUP_PARTY_CAP, GROUP_LOCKOUT, nextResetBoundary, isLockedOut as computeIsLockedOut, type GroupKind } from '@/lib/groupContent'
import { useDungeons, useRaids, useGroupRuns, useStartGroupStage, useClaimGroupStage } from './hooks'
import { StageWizard } from './components/StageWizard'
import { GroupClaimReward } from './components/GroupClaimReward'

// One page, two routes (/dungeons, /raids) — `kind` picks which content list and party cap apply.
// Same page-composition pattern as MissionsPage: fetch content + runtime state, compose a picker.
// The dispatch/trail/party-picker/claim UI all lives inside StageWizard now — this page only owns
// content selection, run/lockout state, and wiring StageWizard's callbacks to the mutations.
export function GroupContentPage({ kind }: { kind: GroupKind }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const { roster } = useRoster()
  const { data: profile } = useProfile()
  const dungeons = useDungeons()
  const raids = useRaids()
  const content = kind === 'dungeon' ? dungeons.data : raids.data
  const runs = useGroupRuns()
  const startStage = useStartGroupStage()
  const claimStage = useClaimGroupStage()
  const [selectedDefKey, setSelectedDefKey] = useState<string | null>(null)
  const [party, setParty] = useState<string[]>([])

  const cap = GROUP_PARTY_CAP[kind]
  const toggle = (id: string) =>
    setParty((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= cap ? prev : [...prev, id]))

  const active = content?.find((c) => (kind === 'dungeon' ? c.dungeonKey : c.raidKey) === selectedDefKey)
  const defKey = kind === 'dungeon' ? active?.dungeonKey : active?.raidKey
  const run = runs.data?.find((r) => r.kind === kind && r.def_key === defKey)
  const lockoutBoundary = run?.last_cleared_at ? nextResetBoundary(run.last_cleared_at, GROUP_LOCKOUT[kind]) : null
  const isLockedOut = computeIsLockedOut(run?.last_cleared_at ?? null, GROUP_LOCKOUT[kind], new Date(now))
  const gateCleared = (profile?.mapProgress?.[active?.mapGate ?? ''] ?? 0) >= 7

  // claimStage.data is only meaningful for the wizard's fail screen on a loss — a win keeps using
  // the existing GroupClaimReward popup modal, unchanged.
  const claimIsLoss = claimStage.data?.outcome === 'loss'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 24 }}>
      <h1 style={{ color: 'var(--color-text-gold)', fontSize: 22 }}>{kind === 'dungeon' ? 'Dungeons' : 'Raids'}</h1>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {(content ?? []).map((c) => {
          const key = kind === 'dungeon' ? c.dungeonKey! : c.raidKey!
          return (
            <button key={key} type="button" onClick={() => setSelectedDefKey(key)}
              style={{ padding: '10px 16px', border: '2px solid var(--color-gold-dark)', borderRadius: 6, background: selectedDefKey === key ? 'var(--color-gold-mid)' : 'transparent', cursor: 'pointer' }}>
              {c.name}
            </button>
          )
        })}
      </div>

      {active && defKey && (
        !gateCleared ? (
          <p style={{ color: 'var(--color-text-muted)' }}>Locked — clear {active.mapGate ?? 'the gated map'} first.</p>
        ) : isLockedOut && lockoutBoundary ? (
          // Post-clear cooldown — never part of the approved wizard design, so it stays a plain
          // page-level message shown INSTEAD of the wizard, not a wizard variant.
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
            Cleared — available again in {formatRemaining(lockoutBoundary.getTime() - now)}.
          </p>
        ) : (
          <StageWizard
            dungeonName={active.name}
            description={active.description}
            stages={active.stages}
            currentStageIndex={run?.current_stage_index ?? 0}
            stageEndsAt={run?.stage_ends_at}
            roster={roster}
            cap={cap}
            selected={party}
            onToggle={toggle}
            traitCtx={{ mapKey: null, enemyArchetypes: [], enemySchools: [] }}
            onSend={() => startStage.mutate({ kind, defKey, party }, { onSuccess: () => setParty([]) })}
            sending={startStage.isPending}
            sendError={startStage.error ? (startStage.error as Error).message : null}
            onClaim={() => claimStage.mutate({ kind, defKey })}
            claiming={claimStage.isPending}
            claimError={claimStage.error ? (claimStage.error as Error).message : null}
            claimOutcome={claimIsLoss ? 'loss' : null}
            claimReason={claimIsLoss ? claimStage.data?.reason : null}
            onRetry={() => claimStage.reset()}
          />
        )
      )}

      <Modal open={claimStage.data?.outcome === 'win'} onClose={() => claimStage.reset()}>
        {claimStage.data?.outcome === 'win' && (
          <GroupClaimReward
            result={claimStage.data}
            stageLoot={active?.stages[claimStage.data.stageIndex]?.loot ?? []}
            onDone={() => claimStage.reset()}
          />
        )}
      </Modal>
    </div>
  )
}
