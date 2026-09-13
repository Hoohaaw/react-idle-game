// src/features/reset/components/TranscendAction.tsx
import { useState } from 'react'
import { Alert } from '@/components/atoms/Alert'
import { PrimaryButton, SecondaryButton } from '@/components/atoms/Button'
import { Modal } from '@/components/organisms/Modal'
import { useRoster } from '@/hooks/useRoster'
import { useRaidEligibility, useTranscendPlayer } from '../hooks'

export function TranscendAction({ protectedSlots }: { protectedSlots: number }) {
  const eligibility = useRaidEligibility()
  const transcend = useTranscendPlayer()
  const roster = useRoster()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [justDone, setJustDone] = useState<number | null>(null)

  const disabledReason = eligibility.isLoading
    ? 'Loading...'
    : eligibility.error
      ? 'Could not check Transcend eligibility.'
      : !eligibility.isEligible
        ? `Clear every raid first (${eligibility.missingRaids.length} remaining).`
        : null

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : prev.length < protectedSlots ? [...prev, id] : prev,
    )
  }

  return (
    <div className="atom-heavy" style={{
      marginTop: 24, borderRadius: 8, border: '2px solid var(--color-gold-mid)', padding: 20,
      display: 'flex', flexDirection: 'column', gap: 14,
      background: 'linear-gradient(180deg, #1c080a 0%, #110305 100%)',
    }}>
      <p style={{ color: 'var(--color-gold-light)', fontSize: 15, fontWeight: 'bold' }}>Transcend</p>

      {disabledReason && <Alert variant="warning">{disabledReason}</Alert>}
      {transcend.error && <Alert variant="error">{transcend.error instanceof Error ? transcend.error.message : 'Could not transcend'}</Alert>}
      {justDone !== null && !transcend.error && <Alert variant="success">{`Transcended — ${justDone} Ascendant Shards earned.`}</Alert>}

      {protectedSlots > 0 && (
        <div>
          <p style={{ color: 'var(--color-text-primary)', fontSize: 12, marginBottom: 6 }}>
            Choose up to {protectedSlots} characters to protect ({selected.length}/{protectedSlots}):
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(roster.roster ?? []).map((c) => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-text-primary)' }}>
                <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                {c.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <PrimaryButton disabled={!!disabledReason || transcend.isPending} onClick={() => setConfirmOpen(true)}>
          Transcend
        </PrimaryButton>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <div className="atom-heavy" style={{
          borderRadius: 8, border: '2px solid var(--color-gold-mid)', padding: 24, maxWidth: 420,
          background: 'linear-gradient(180deg, #1c080a 0%, #110305 100%)',
        }}>
          <p style={{ color: 'var(--color-gold-light)', fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>Confirm Transcend</p>
          <p style={{ color: 'var(--color-text-primary)', fontSize: 13, marginBottom: 10 }}>
            This wipes your gold, resources, map progress, dungeon/raid progress, infirmary level,
            Echoes, the Echo Shop, and every character — except the {selected.length} you've chosen
            to protect. It keeps your lifetime stats, Reset count, and every Ascendant Shard and
            Ascendant Shop level you've earned.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <SecondaryButton onClick={() => setConfirmOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton
              disabled={transcend.isPending}
              onClick={() => transcend.mutate(selected, {
                onSuccess: (data) => { setJustDone(data.shardsAwarded); setConfirmOpen(false) },
              })}
            >
              {transcend.isPending ? 'Transcending...' : 'Confirm Transcend'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
