import { useState } from 'react'
import { Modal } from '@/components/organisms/Modal'
import { xpToNext } from '@/lib/leveling'
import type { GameMission, MissionRun, ClaimResponse } from '@/services/missions'
import { MissionCard } from './components/MissionCard'
import { ActiveMissionCard } from './components/ActiveMissionCard'
import { MissionDispatch } from './components/MissionDispatch'
import { ClaimReward } from './components/ClaimReward'
import type { DispatchChar, DispatchMission } from './components/dispatchSamples'
import type { ClaimResultView, ClaimBonus } from './components/claimSamples'
import { useMissions, useStartMission, useClaimMission } from './hooks'
import { summarizeResistances } from './resistSummary'
import { sortedMaps, isMapUnlocked, isStageLocked, BOSS_STAGE } from './mapProgress'
import { MapSelector } from './components/MapSelector'
import { useMissionRuns, useRoster, type RosterMember } from '@/hooks/useRoster'
import { useProfile } from '@/hooks/useProfile'

const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// Total XP a character has accumulated toward the level curve — used to derive "how much did this
// mission grant?" from the pre/post level+xp (the claim response returns the NEW values, not the delta).
function cumulativeXp(level: number, xp: number): number {
  let total = xp
  for (let L = 1; L < level; L++) total += xpToNext(L)
  return total
}

function toDispatchMission(m: GameMission): DispatchMission {
  return {
    missionKey: m.missionKey,
    name: m.name,
    description: m.description,
    duration: fmtDuration(m.durationSeconds),
    baseXp: m.baseXp,
    loot: m.loot.map((l) => ({ name: l.name, slot: l.slot, chances: l.chances })),
    enemies: m.enemies,
    timeLimitSeconds: m.timeLimitSeconds,
  }
}

// Build the ClaimReward view from the lean claim response + the data the client already has
// (roster snapshot taken at claim time, and the mission's authored base rewards / loot names).
function buildClaimResult(
  resp: ClaimResponse,
  mission: GameMission | undefined,
  before: Map<string, RosterMember>,
): ClaimResultView {
  const party = resp.characters.map((ch) => {
    const m = before.get(ch.id)
    const gained = m ? Math.max(0, cumulativeXp(ch.level, ch.xp) - cumulativeXp(m.level, m.xp)) : 0
    return {
      name: m?.name ?? 'Unknown',
      class: m?.charClass ?? '',
      level: ch.level,
      role: m?.role,
      endingHp: ch.current_hp,
      maxHp: m?.maxHp ?? Math.max(1, ch.current_hp),
      xpGained: gained,
    }
  })

  // Reconstruct the reward multipliers for the transparency trail (same inputs the resolver used).
  const levelsBefore = resp.characters.map((ch) => before.get(ch.id)?.level ?? ch.level)
  const avgLevel = levelsBefore.length ? levelsBefore.reduce((a, b) => a + b, 0) / levelsBefore.length : 0
  const bonuses: ClaimBonus[] = [
    { label: 'Combat margin', detail: `${Math.round(resp.survivingHpPct * 100)}% HP kept`, pct: +(resp.survivingHpPct * 50).toFixed(1) },
    { label: 'Level bonus', detail: `avg Lv ${avgLevel.toFixed(0)}`, pct: +(avgLevel * 0.4).toFixed(1) },
  ]
  if (party.length > 1) bonuses.push({ label: 'Party size', detail: `×${party.length}`, pct: (party.length - 1) * 10 })

  const loot = resp.rewards.loot.map((l) => {
    const def = mission?.loot.find((x) => x.itemKey === l.item_def_id)
    const base = def?.name ?? l.item_def_id
    return { name: l.quantity > 1 ? `${base} ×${l.quantity}` : base, slot: def?.slot ?? '', rarity: l.rarity }
  })

  return {
    outcome: resp.outcome,
    reason: resp.reason,
    missionName: mission?.name ?? 'Mission',
    durationSeconds: resp.durationSeconds,
    survivingHpPct: resp.survivingHpPct,
    party,
    baseGold: mission?.baseGold ?? 0,
    resources: Object.entries(resp.rewards.resources).map(([code, value]) => ({ label: code, value })),
    loot,
    bonuses,
  }
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      color: 'var(--color-gold-mid)', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase',
      marginBottom: '14px', paddingBottom: '6px', borderBottom: '1px solid var(--color-gold-dark)',
    }}>{children}</h2>
  )
}

const NOTE: React.CSSProperties = { color: 'var(--color-text-muted)', fontSize: '12px', fontStyle: 'italic' }

export default function MissionsPage() {
  const missionsQ = useMissions()
  const runsQ = useMissionRuns()
  const { roster } = useRoster()
  const { data: profile } = useProfile()
  const startM = useStartMission()
  const claimM = useClaimMission()

  const [dispatchKey, setDispatchKey] = useState<string | null>(null) // missionKey of the open dispatch modal
  const [claimResult, setClaimResult] = useState<ClaimResultView | null>(null)
  const [selectedMap, setSelectedMap] = useState<string | null>(null)

  const missions = missionsQ.data ?? []
  const runs = runsQ.data ?? []
  const missionByKey = new Map(missions.map((m) => [m.missionKey, m]))
  const dispatchMission = dispatchKey ? missionByKey.get(dispatchKey) : undefined

  // World maps (ADR-0034): group missions by map, gate stages by profile progress. Missions
  // without a map (legacy drafts) stay visible at the end of the list. No maps authored at
  // all → the flat list renders unchanged.
  const mapProgress = profile?.mapProgress ?? {}
  const maps = sortedMaps(missions.map((m) => m.map))
  const activeMap = selectedMap ?? maps[0]?.mapKey ?? null
  const shownMissions = maps.length
    ? [
        ...missions.filter((m) => m.map?.mapKey === activeMap).sort((a, b) => (a.stage ?? 0) - (b.stage ?? 0)),
        ...missions.filter((m) => !m.map),
      ]
    : missions
  const activeMapUnlocked = activeMap == null || isMapUnlocked(maps, mapProgress, activeMap)
  const missionLocked = (m: GameMission) =>
    m.map != null && m.stage != null && (!activeMapUnlocked || isStageLocked(mapProgress, m.map.mapKey, m.stage))

  const dispatchRoster: DispatchChar[] = roster.map((m) => ({
    id: m.id,
    name: m.name,
    charClass: m.charClass,
    level: m.level,
    role: m.role,
    damageSchool: m.damageSchool,
    stats: m.stats,
    currentHp: m.currentHp,
    busy: m.busy === 'mission' ? 'On mission' : m.busy === 'gathering' ? 'Gathering' : m.busy === 'infirmary' ? 'In Infirmary' : undefined,
    downed: m.currentHp === 0,
  }))

  function handleDispatch(party: string[]) {
    if (!dispatchMission) return
    startM.mutate(
      { missionDefId: dispatchMission.missionKey, party },
      { onSuccess: () => setDispatchKey(null) },
    )
  }

  function handleClaim(run: MissionRun) {
    const mission = missionByKey.get(run.mission_def_id)
    const before = new Map(roster.map((m) => [m.id, m]))
    claimM.mutate(run.id, {
      onSuccess: (resp) => setClaimResult(buildClaimResult(resp, mission, before)),
    })
  }

  return (
    <div>
      {/* In-progress runs */}
      <section style={{ marginBottom: '36px' }}>
        <SectionTitle>In Progress</SectionTitle>
        {runs.length === 0 ? (
          <p style={NOTE}>No missions in progress. Send a party below.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
            {runs.map((run) => (
              <ActiveMissionCard
                key={run.id}
                name={missionByKey.get(run.mission_def_id)?.name ?? run.mission_def_id}
                partySize={run.party.length}
                startedAt={new Date(run.started_at).getTime()}
                endsAt={new Date(run.ends_at).getTime()}
                onClaim={() => handleClaim(run)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Available missions */}
      <section>
        <SectionTitle>Missions</SectionTitle>
        {missionsQ.isLoading ? (
          <p style={NOTE}>Loading missions…</p>
        ) : missionsQ.error ? (
          <p style={{ ...NOTE, color: '#e0635c' }}>Could not load missions.</p>
        ) : missions.length === 0 ? (
          <p style={NOTE}>No missions authored yet.</p>
        ) : (
          <>
            <MapSelector maps={maps} progress={mapProgress} selected={activeMap} onSelect={setSelectedMap} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
              {shownMissions.map((m) => {
                const { strong, weak } = summarizeResistances(m.enemies)
                const locked = missionLocked(m)
                return (
                  <MissionCard
                    key={m.missionKey}
                    name={m.name}
                    stage={m.stage ?? undefined}
                    boss={m.stage === BOSS_STAGE}
                    locked={locked}
                    gold={m.baseGold}
                    xp={m.baseXp}
                    duration={fmtDuration(m.durationSeconds)}
                    dropCount={m.loot.length}
                    resists={strong}
                    weakTo={weak}
                    onSend={locked ? undefined : () => setDispatchKey(m.missionKey)}
                  />
                )
              })}
            </div>
          </>
        )}
      </section>

      {/* Dispatch modal */}
      <Modal open={dispatchMission != null} onClose={() => setDispatchKey(null)}>
        {dispatchMission && (
          <MissionDispatch
            mission={toDispatchMission(dispatchMission)}
            roster={dispatchRoster}
            transcendenceCount={0}
            pending={startM.isPending}
            error={startM.error ? (startM.error as Error).message : null}
            onDispatch={handleDispatch}
          />
        )}
      </Modal>

      {/* Claim modal */}
      <Modal open={claimResult != null} onClose={() => setClaimResult(null)}>
        {claimResult && <ClaimReward result={claimResult} onDone={() => setClaimResult(null)} />}
      </Modal>
    </div>
  )
}
