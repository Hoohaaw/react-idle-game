// src/features/reset/components/ResetAction.tsx
import { useState } from 'react'
import { Alert } from '@/components/atoms/Alert'
import { PrimaryButton, SecondaryButton } from '@/components/atoms/Button'
import { Modal } from '@/components/organisms/Modal'
import { computeEchoesAward, sumStagesCleared, isResetGateMet } from '@/lib/reset'
import { useGateMap, useResetPlayer } from '../hooks'

// The rare/irreversible action (spec §6) — visually separated from the shop above. Shows the
// live formula preview before the player commits.
export function ResetAction({ mapProgress, lifetimeGoldEarned }: { mapProgress: Record<string, number>; lifetimeGoldEarned: number }) {
  const gateMap = useGateMap()
  const reset = useResetPlayer()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [justDone, setJustDone] = useState<number | null>(null)

  const gateStageCleared = gateMap.data ? (mapProgress[gateMap.data.mapKey] ?? 0) : 0
  const gateMet = isResetGateMet(gateStageCleared)
  const totalStagesCleared = sumStagesCleared(mapProgress)
  const projectedEchoes = computeEchoesAward(totalStagesCleared, lifetimeGoldEarned)

  const disabledReason = !gateMap.data
    ? 'Loading...'
    : !gateMet
      ? `Clear ${gateMap.data.name}'s boss (stage 7) first.`
      : null

  return (
    <div className="atom-heavy" style={{
      marginTop: 24, borderRadius: 8, border: '2px solid var(--color-gold-mid)', padding: 20,
      display: 'flex', flexDirection: 'column', gap: 14,
      background: 'linear-gradient(180deg, #1c080a 0%, #110305 100%)',
    }}>
      <p style={{ color: 'var(--color-gold-light)', fontSize: 15, fontWeight: 'bold' }}>Reset</p>
      <p style={{ color: 'var(--color-text-primary)', fontSize: 13 }}>
        Stages cleared: {totalStagesCleared} · Lifetime gold earned: {Math.round(lifetimeGoldEarned).toLocaleString()}
      </p>
      <p style={{ color: 'var(--color-text-gold)', fontSize: 13 }}>Projected award: {projectedEchoes} Echoes</p>

      {disabledReason && <Alert variant="warning">{disabledReason}</Alert>}
      {reset.error && <Alert variant="error">{reset.error instanceof Error ? reset.error.message : 'Could not reset'}</Alert>}
      {justDone !== null && !reset.error && <Alert variant="success">{`Reset complete — ${justDone} Echoes earned.`}</Alert>}

      <div>
        <PrimaryButton disabled={!!disabledReason || reset.isPending} onClick={() => setConfirmOpen(true)}>
          Reset
        </PrimaryButton>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <div className="atom-heavy" style={{
          borderRadius: 8, border: '2px solid var(--color-gold-mid)', padding: 24, maxWidth: 420,
          background: 'linear-gradient(180deg, #1c080a 0%, #110305 100%)',
        }}>
          <p style={{ color: 'var(--color-gold-light)', fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>Confirm Reset</p>
          <p style={{ color: 'var(--color-text-primary)', fontSize: 13, marginBottom: 10 }}>
            This wipes your gold, resources, map progress, dungeon/raid progress, and infirmary
            level. It keeps your characters, their gear and blessings, and every Echo Shop level
            you&apos;ve bought.
          </p>
          <p style={{ color: 'var(--color-text-gold)', fontSize: 13, marginBottom: 16 }}>
            You&apos;ll earn {projectedEchoes} Echoes.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <SecondaryButton onClick={() => setConfirmOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton
              disabled={reset.isPending}
              onClick={() => reset.mutate(undefined, {
                onSuccess: (data) => { setJustDone(data.echoesAwarded); setConfirmOpen(false) },
              })}
            >
              {reset.isPending ? 'Resetting...' : 'Confirm Reset'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
