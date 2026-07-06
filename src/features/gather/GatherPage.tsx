import { useState } from 'react'
import { MineCard } from '@/components/molecules/MineCard'
import { ActiveGatherCard } from '@/components/molecules/ActiveGatherCard'
import { Modal } from '@/components/organisms/Modal'
import { PartyRoster, type RosterCharacter } from '@/components/organisms/PartyRoster'
import { PrimaryButton, SecondaryButton } from '@/components/atoms/Button'
import { resourceHeaderStyle } from '@/lib/resources'
import { MINE_DEFS, MINE_BY_RESOURCE } from '@/lib/gather'
import { useRoster } from '@/hooks/useRoster'
import type { GatherAssignment } from '@/services/gather'
import { useGatherAssignments, useStartGather, useCollectGather } from './hooks'

const secSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      color: 'var(--color-gold-mid)', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase',
      marginBottom: '14px', paddingBottom: '6px', borderBottom: '1px solid var(--color-gold-dark)',
    }}>{children}</h2>
  )
}

const NOTE: React.CSSProperties = { color: 'var(--color-text-muted)', fontSize: '12px', fontStyle: 'italic' }

export default function GatherPage() {
  const assignmentsQ = useGatherAssignments()
  const { roster } = useRoster()
  const startG = useStartGather()
  const collectG = useCollectGather()

  const [assigningResource, setAssigningResource] = useState<string | null>(null)
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null)

  const assignments = assignmentsQ.data ?? []
  const byResource = new Map<string, GatherAssignment>(assignments.map((a) => [a.resource_id, a]))
  const nameOf = (charId: string) => roster.find((m) => m.id === charId)?.name ?? 'Gatherer'

  // Active gathers (a resource with an assignment), for the collector feed.
  const active = assignments
    .map((a) => ({ assignment: a, mine: MINE_BY_RESOURCE[a.resource_id] }))
    .filter((x) => x.mine)

  const closeAssign = () => { setAssigningResource(null); setSelectedCharId(null); startG.reset() }

  const confirmAssign = () => {
    if (!selectedCharId || !assigningResource) return
    startG.mutate(
      { characterId: selectedCharId, resourceId: assigningResource },
      { onSuccess: closeAssign },
    )
  }

  // Every character + what they're doing (busy ones show in the picker but aren't selectable).
  const rosterChars: RosterCharacter[] = roster.map((m) => ({
    id: m.id,
    name: m.name,
    charClass: m.charClass,
    level: m.level,
    role: m.role,
    activity: m.busy === 'gathering' ? 'gather' : m.busy === 'mission' ? 'mission' : 'idle',
    detail: m.busy === 'gathering'
      ? assignments.find((a) => a.player_character_id === m.id)?.resource_id
      : undefined,
  }))

  return (
    <div>
      {/* Active gathering collector */}
      {active.length > 0 && (
        <section style={{ marginBottom: '36px' }}>
          <SectionTitle>Active Gathering</SectionTitle>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
            {active.map(({ assignment, mine }) => (
              <ActiveGatherCard
                key={assignment.id}
                resource={mine.resourceKey}
                gatherer={nameOf(assignment.player_character_id)}
                intervalSec={mine.intervalSec}
                yieldPerTick={mine.yieldPerTick}
                assignedSecAgo={secSince(assignment.last_collected_at)}
              />
            ))}
          </div>
        </section>
      )}

      {/* All mines */}
      <section>
        <SectionTitle>Mines</SectionTitle>
        {assignmentsQ.isLoading ? (
          <p style={NOTE}>Loading mines…</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
            {MINE_DEFS.map((mine) => {
              const a = byResource.get(mine.resourceKey)
              return (
                <MineCard
                  // key includes last_collected_at so the card remounts on assign/collect/stop,
                  // resetting its banked-since-collect clock to start "now".
                  key={`${mine.resourceKey}-${a?.last_collected_at ?? 'idle'}`}
                  resource={mine.resourceKey}
                  tier={mine.tier}
                  intervalSec={mine.intervalSec}
                  yieldPerTick={mine.yieldPerTick}
                  gatherer={a ? nameOf(a.player_character_id) : undefined}
                  assignedSecAgo={a ? secSince(a.last_collected_at) : undefined}
                  onAssign={() => setAssigningResource(mine.resourceKey)}
                  onCollect={a ? () => collectG.mutate({ assignmentId: a.id }) : undefined}
                  onStop={a ? () => collectG.mutate({ assignmentId: a.id, stop: true }) : undefined}
                />
              )
            })}
          </div>
        )}
      </section>

      {/* Assign-character flow */}
      <Modal open={assigningResource !== null} onClose={closeAssign}>
        <div style={{
          width: 360, maxWidth: '90vw', borderRadius: 8, overflow: 'hidden',
          border: '3px solid var(--color-gold-mid)',
          background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
          boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', 'inset 0 2px 8px rgba(0,0,0,0.6)', '0 10px 30px rgba(0,0,0,0.85)'].join(', '),
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '2px solid var(--color-gold-dark)', ...resourceHeaderStyle(assigningResource ?? '') }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>Assign Gatherer</p>
            <p style={{ color: 'var(--color-gold-light)', fontSize: 16, fontWeight: 'bold', textShadow: '0 0 10px rgba(240,208,96,0.4)' }}>⛏ {assigningResource}</p>
          </div>

          <div style={{ padding: 16, maxHeight: '52vh', overflowY: 'auto' }}>
            <PartyRoster characters={rosterChars} selectedId={selectedCharId} onSelect={setSelectedCharId} />
          </div>

          {startG.error && (
            <p style={{ color: '#e0635c', fontSize: 12, padding: '0 16px 4px' }}>{(startG.error as Error).message}</p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--color-gold-dark)' }}>
            <SecondaryButton onClick={closeAssign}>Cancel</SecondaryButton>
            <PrimaryButton disabled={!selectedCharId || startG.isPending} onClick={confirmAssign}>Send to Gather</PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
