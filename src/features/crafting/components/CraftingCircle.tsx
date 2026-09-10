import { useState } from 'react'
import { IconSlot } from '@/components/atoms/IconSlot'
import { PrimaryButton, SecondaryButton } from '@/components/atoms/Button'
import { RarityBadge } from '@/components/atoms/RarityBadge'
import { RARITY_STYLES } from '@/lib/rarity'
import { RESOURCE_COLOR } from '@/lib/resources'
import { formatRemaining } from '@/lib/time'
import type { ResolvedReagent, ItemRarityChoice } from '@/lib/crafting'
import { RarityPicker } from './RarityPicker'

// Six reagent slots on a ring around the result slot. Recipe-driven: the page resolves the
// selected recipe's lines against the wallet/inventory and hands them in; this component only
// renders state and raises intents (pick a rarity, craft, claim, clear).
const SLOT_COUNT = 6

export function CraftingCircle({ reagents, resultName, rarityChoices, onPickRarity, inProgress, remainingMs, canCraft, pending, error, onCraft, onClaim, onClear, claimed }: {
  reagents: ResolvedReagent[]
  resultName: string | null
  rarityChoices: ItemRarityChoice[]
  onPickRarity: (reagentIndex: number, rarity: string) => void
  inProgress: boolean
  remainingMs: number
  canCraft: boolean
  pending: boolean
  error: string | null
  onCraft: () => void
  onClaim: () => void
  onClear: () => void
  claimed: { name: string; rarity: string } | null
}) {
  const [openPicker, setOpenPicker] = useState<number | null>(null)
  const SIZE = 300, RADIUS = 110, SLOT = 58, CENTER = 88
  const slots: (ResolvedReagent | null)[] = Array.from({ length: SLOT_COUNT }, (_, i) => reagents[i] ?? null)
  const ready = inProgress && remainingMs <= 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: 340, flexShrink: 0 }}>
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        <Ring d={RADIUS * 2} />
        <Ring d={CENTER + 30} faint />
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 150, height: 150, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,208,96,0.10) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {slots.map((r, i) => {
          const a = (-90 + i * 60) * Math.PI / 180
          const x = SIZE / 2 + RADIUS * Math.cos(a)
          const y = SIZE / 2 + RADIUS * Math.sin(a)
          const pickable = !inProgress && r?.kind === 'item' && r.owned.length > 1
          return (
            <div key={i} style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%,-50%)' }}>
              <ReagentSlot reagent={r} size={SLOT} onClick={pickable ? () => setOpenPicker(openPicker === i ? null : i) : undefined} />
              {openPicker === i && r?.kind === 'item' && (
                <div style={{ position: 'absolute', top: SLOT + 6, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                  <RarityPicker
                    options={r.owned}
                    selected={rarityChoices.find((c) => c.reagentIndex === r.index)?.rarity ?? null}
                    onPick={(rarity) => { onPickRarity(r.index, rarity); setOpenPicker(null) }}
                  />
                </div>
              )}
            </div>
          )
        })}

        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}>
          <CenterSlot size={CENTER} label={inProgress ? (ready ? 'Ready' : formatRemaining(remainingMs)) : (!resultName && claimed ? 'Crafted' : (resultName ?? 'Result'))} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
        <SecondaryButton onClick={onClear} disabled={inProgress || pending}>Clear</SecondaryButton>
        {inProgress
          ? <PrimaryButton disabled={!ready || pending} onClick={onClaim}>{pending ? 'Claiming…' : ready ? 'Claim' : 'Crafting…'}</PrimaryButton>
          : <PrimaryButton disabled={!canCraft || pending} onClick={onCraft}>{pending ? 'Starting…' : 'Craft'}</PrimaryButton>}
      </div>
      {!inProgress && claimed && !resultName && (
        <p style={{ fontSize: 12, textAlign: 'center', color: 'var(--color-text-primary)' }}>
          <RarityBadge rarity={claimed.rarity} size="sm" /> {claimed.name}
        </p>
      )}
      {error && <p style={{ color: '#e0635c', fontSize: 11, textAlign: 'center' }}>{error}</p>}
    </div>
  )
}

function Ring({ d, faint = false }: { d: number; faint?: boolean }) {
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%', width: d, height: d, transform: 'translate(-50%,-50%)',
      borderRadius: '50%', pointerEvents: 'none',
      border: `1px solid rgba(200,145,42,${faint ? 0.18 : 0.4})`,
      boxShadow: faint ? 'none' : '0 0 14px rgba(200,145,42,0.12), inset 0 0 14px rgba(200,145,42,0.08)',
    }} />
  )
}

// A filled reagent slot shows have/need; red border when short. Item slots use the chosen
// rarity's color; resource slots the resource's accent color.
function ReagentSlot({ reagent, size, onClick }: { reagent: ResolvedReagent | null; size: number; onClick?: () => void }) {
  const border = !reagent
    ? 'var(--color-gold-dark)'
    : !reagent.ok
      ? '#e0635c'
      : reagent.kind === 'item'
        ? (RARITY_STYLES[reagent.rarity ?? 'Common'] ?? RARITY_STYLES.Common).border
        : `rgb(${RESOURCE_COLOR[reagent.code] ?? '200,145,42'})`
  const title = !reagent
    ? undefined
    : reagent.kind === 'resource'
      ? `${reagent.code} — have ${reagent.have}, need ${reagent.quantity}`
      : `${reagent.itemKey} (${reagent.rarity ?? 'pick a rarity'}) — have ${reagent.have}, need ${reagent.quantity}${onClick ? ' · click to choose' : ''}`
  return (
    <div onClick={onClick} title={title} style={{
      width: size, height: size, borderRadius: 8, position: 'relative',
      border: `2px solid ${border}`,
      background: reagent ? 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)' : 'radial-gradient(circle at 50% 40%, #1a0608 0%, #0c0203 100%)',
      boxShadow: '0 0 0 1px #080101, inset 0 1px 0 rgba(255,255,255,0.05), 0 3px 8px rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      {reagent
        ? <>
            <IconSlot size={Math.round(size * 0.52)} />
            <span style={{ position: 'absolute', right: -6, bottom: -6, padding: '1px 5px', borderRadius: 4, fontSize: 10, fontWeight: 'bold',
              color: reagent.ok ? 'var(--color-gold-light)' : '#e0635c', border: '1.5px solid var(--color-gold-mid)',
              background: 'linear-gradient(180deg, #2a1a08 0%, #120a02 100%)' }}>{reagent.have}/{reagent.quantity}</span>
          </>
        : <span style={{ color: 'var(--color-text-muted)', fontSize: 22 }}>+</span>}
    </div>
  )
}

function CenterSlot({ size, label }: { size: number; label: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 8, padding: 6, textAlign: 'center',
      border: '3px solid var(--color-gold-mid)',
      background: 'radial-gradient(circle at 50% 40%, #1a0608 0%, #0c0203 100%)',
      boxShadow: '0 0 0 1px #080101, 0 0 18px rgba(240,208,96,0.35), 0 3px 8px rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ color: 'var(--color-gold-mid)', fontSize: 11, letterSpacing: 1, fontWeight: 'bold', textTransform: 'uppercase', lineHeight: 1.3 }}>{label}</span>
    </div>
  )
}
