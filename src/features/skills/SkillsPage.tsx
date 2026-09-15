import { useState } from 'react'
import { Modal } from '@/components/organisms/Modal'
import { PartyRoster, type RosterCharacter } from '@/components/organisms/PartyRoster'
import { PrimaryButton, SecondaryButton } from '@/components/atoms/Button'
import { SkillTrainingCard } from '@/components/molecules/SkillTrainingCard'
import { SKILL_DEFS } from '@/lib/skills'
import { useRoster } from '@/hooks/useRoster'
import { useSkillAssignments, useStartSkill, useCollectSkill } from './hooks'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      color: 'var(--color-gold-mid)', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase',
      marginBottom: '14px', paddingBottom: '6px', borderBottom: '1px solid var(--color-gold-dark)',
    }}>{children}</h2>
  )
}

const NOTE: React.CSSProperties = { color: 'var(--color-text-muted)', fontSize: '12px', fontStyle: 'italic' }

export default function SkillsPage() {
  const assignmentsQ = useSkillAssignments()
  const { roster } = useRoster()
  const startS = useStartSkill()
  const collectS = useCollectSkill()

  const [assigningSkill, setAssigningSkill] = useState<string | null>(null)
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null)

  const assignments = assignmentsQ.data ?? []

  const closeAssign = () => { setAssigningSkill(null); setSelectedCharId(null); startS.reset() }

  const confirmAssign = () => {
    if (!selectedCharId || !assigningSkill) return
    startS.mutate(
      { characterId: selectedCharId, skillKey: assigningSkill },
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
    damageSchool: m.damageSchool,
    activity: m.currentHp === 0
      ? 'downed'
      : m.busy === 'skillTraining' ? 'skill'
      : m.busy === 'gathering' ? 'gather'
      : m.busy === 'mission' ? 'mission'
      : m.busy === 'infirmary' ? 'infirmary'
      : m.busy === 'group' ? 'group'
      : 'idle',
  }))

  return (
    <div>
      {assignmentsQ.isLoading ? (
        <p style={NOTE}>Loading skills…</p>
      ) : (
        SKILL_DEFS.map((skill) => {
          const trainees = assignments.filter((a) => a.skill_key === skill.skillKey)
          return (
            <section key={skill.skillKey} style={{ marginBottom: '36px' }}>
              <SectionTitle>{skill.destination} — {skill.label}</SectionTitle>

              {trainees.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginBottom: '14px' }}>
                  {trainees.map((a) => {
                    const char = roster.find((m) => m.id === a.player_character_id)
                    const progress = char?.skills[skill.skillKey] ?? { level: 1, xp: 0 }
                    return (
                      <SkillTrainingCard
                        key={`${a.id}-${a.last_collected_at}`}
                        trainee={char?.name ?? 'Trainee'}
                        level={progress.level}
                        xp={progress.xp}
                        intervalSec={skill.intervalSec}
                        xpPerTick={skill.xpPerTick}
                        lastCollectedAt={a.last_collected_at}
                        onCollect={() => collectS.mutate({ assignmentId: a.id })}
                        onStop={() => collectS.mutate({ assignmentId: a.id, stop: true })}
                      />
                    )
                  })}
                </div>
              ) : (
                <p style={NOTE}>No one is currently training here.</p>
              )}

              <PrimaryButton onClick={() => setAssigningSkill(skill.skillKey)}>Assign a Character</PrimaryButton>
            </section>
          )
        })
      )}

      <Modal open={assigningSkill !== null} onClose={closeAssign}>
        <div style={{
          width: 360, maxWidth: '90vw', borderRadius: 8, overflow: 'hidden',
          border: '3px solid var(--color-gold-mid)',
          background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '2px solid var(--color-gold-dark)' }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>Assign Trainee</p>
            <p style={{ color: 'var(--color-gold-light)', fontSize: 16, fontWeight: 'bold' }}>
              {SKILL_DEFS.find((s) => s.skillKey === assigningSkill)?.destination}
            </p>
          </div>

          <div style={{ padding: 16, maxHeight: '52vh', overflowY: 'auto' }}>
            <PartyRoster characters={rosterChars} selectedId={selectedCharId} onSelect={setSelectedCharId} />
          </div>

          {startS.error && (
            <p style={{ color: '#e0635c', fontSize: 12, padding: '0 16px 4px' }}>{(startS.error as Error).message}</p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--color-gold-dark)' }}>
            <SecondaryButton onClick={closeAssign}>Cancel</SecondaryButton>
            <PrimaryButton disabled={!selectedCharId || startS.isPending} onClick={confirmAssign}>Send to Train</PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
