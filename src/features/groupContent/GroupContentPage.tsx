import { useEffect, useState } from 'react'
import { PrimaryButton } from '@/components/atoms/Button'
import { useRoster } from '@/hooks/useRoster'
import { GROUP_PARTY_CAP, GROUP_LOCKOUT, nextResetBoundary, type GroupKind } from '@/lib/groupContent'
import { useDungeons, useRaids, useGroupRuns, useStartGroupStage, useClaimGroupStage } from './hooks'
import { GroupPartyPicker } from './components/GroupPartyPicker'
import { StageProgress } from './components/StageProgress'

// One page, two routes (/dungeons, /raids) — `kind` picks which content list and party cap apply.
// Same page-composition pattern as MissionsPage: fetch content + runtime state, compose a picker.
export function GroupContentPage({ kind }: { kind: GroupKind }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const { roster } = useRoster()
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
  const isLockedOut = run?.status === 'complete' && lockoutBoundary != null && now < lockoutBoundary.getTime()
  const stageInFlight = Boolean(run?.stage_ends_at) && new Date(run!.stage_ends_at!).getTime() > now
  const canClaim = Boolean(run?.stage_ends_at) && !stageInFlight

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
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <StageProgress run={run} stageCount={active.stageCount} lockoutBoundary={lockoutBoundary} />
            {canClaim && (
              <PrimaryButton onClick={() => claimStage.mutate({ kind, defKey })}>Claim</PrimaryButton>
            )}
            {!isLockedOut && !stageInFlight && !canClaim && (
              <PrimaryButton disabled={party.length === 0 || startStage.isPending}
                onClick={() => startStage.mutate({ kind, defKey, party })}>
                {startStage.isPending ? 'Sending…' : `Send Party (${party.length})`}
              </PrimaryButton>
            )}
          </div>
          {!isLockedOut && !stageInFlight && !canClaim && (
            <div style={{ flex: 1 }}>
              <GroupPartyPicker roster={roster} cap={cap} selected={party} onToggle={toggle} traitCtx={{ mapKey: null, enemyArchetypes: [], enemySchools: [] }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
