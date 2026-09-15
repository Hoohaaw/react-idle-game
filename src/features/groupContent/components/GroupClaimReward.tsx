import { IconSlot } from '@/components/atoms/IconSlot'
import { RarityBadge } from '@/components/atoms/RarityBadge'
import { ResourceChip } from '@/components/atoms/ResourceChip'
import { GoldDivider } from '@/components/atoms/GoldDivider'
import { PrimaryButton } from '@/components/atoms/Button'
import { SectionLabel } from '@/components/molecules/SectionLabel'
import type { GroupClaimResponse, GroupStageView } from '@/services/groupContent'

// The dungeon/raid claim-result modal content (rendered inside the shared Modal organism by the
// page, same as missions' ClaimReward). Deliberately lean vs. ClaimReward — no HP bars, no bonus
// transparency trail, no character breakdown: GroupClaimResponse doesn't carry that data and
// group-run losses aren't scoped beyond "no rewards".
export function GroupClaimReward({ result, stageLoot, onDone }: {
  result: GroupClaimResponse
  stageLoot: GroupStageView['loot']
  onDone: () => void
}) {
  const win = result.outcome === 'win'
  const accent = win ? 'var(--color-gold-light)' : '#e0635c'
  const currencies = Object.entries(result.rewards.currencies)
  const resources = Object.entries(result.rewards.resources)

  return (
    <div style={{
      width: 420, borderRadius: 8, border: `3px solid ${win ? 'var(--color-gold-mid)' : '#8a2e29'}`,
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', 'inset 0 2px 8px rgba(0,0,0,0.6)', '0 6px 20px rgba(0,0,0,0.8)'].join(', '),
      overflow: 'hidden',
    }}>
      <div style={{
        textAlign: 'center', padding: '16px', borderBottom: `2px solid ${win ? 'var(--color-gold-dark)' : '#5c1f1c'}`,
        background: win
          ? 'linear-gradient(180deg, rgba(200,145,42,0.18) 0%, rgba(200,145,42,0.04) 100%)'
          : 'linear-gradient(180deg, rgba(160,45,40,0.20) 0%, rgba(160,45,40,0.04) 100%)',
      }}>
        <p style={{ color: accent, fontSize: 18, fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase', textShadow: `0 0 14px color-mix(in srgb, ${accent} 55%, transparent), 0 2px 4px rgba(0,0,0,0.9)` }}>
          {win ? 'Victory' : 'Defeat'}
        </p>
        <p style={{ color: 'var(--color-text-primary)', fontSize: 13, marginTop: 4 }}>Stage {result.stageIndex + 1}</p>
      </div>

      <div style={{ padding: 16 }}>
        {win ? (
          <>
            <SectionLabel>Rewards</SectionLabel>
            {currencies.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {currencies.map(([code, value]) => <ResourceChip key={code} label={code} value={value} />)}
              </div>
            )}
            {resources.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {resources.map(([code, value]) => <ResourceChip key={code} label={code} value={value} />)}
              </div>
            )}
            {result.rewards.loot.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.rewards.loot.map((entry, i) => {
                  const def = stageLoot.find((l) => l.itemKey === entry.item_def_id)
                  const name = def?.name ?? entry.item_def_id
                  return (
                    <div key={i} className="atom-heavy" style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 4,
                      border: '2px solid var(--color-gold-dark)', background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
                    }}>
                      <IconSlot size={28} />
                      <span style={{ color: 'var(--color-text-primary)', fontSize: 12, flex: 1 }}>
                        {name}{entry.quantity > 1 ? ` ×${entry.quantity}` : ''}
                      </span>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>{def?.slot ?? ''}</span>
                      <RarityBadge rarity={entry.rarity} />
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>
            No rewards this time — try again.
          </p>
        )}

        <div style={{ margin: '16px 0 12px' }}><GoldDivider /></div>
        <PrimaryButton fullWidth onClick={onDone}>{win ? 'Claim Rewards' : 'Close'}</PrimaryButton>
      </div>
    </div>
  )
}
