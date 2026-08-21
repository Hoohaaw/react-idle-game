import { RarityBadge } from '@/components/atoms/RarityBadge'
import { RoleBadge } from '@/components/atoms/RoleBadge'
import { GoldDivider } from '@/components/atoms/GoldDivider'
import { PrimaryButton } from '@/components/atoms/Button'
import { IconSlot } from '@/components/atoms/IconSlot'
import type { CharacterRole } from '@/lib/roles'
import { useRecruits } from '@/hooks/useRecruits'
import { useRecruit } from '@/hooks/useRecruit'
import { useProfile } from '@/hooks/useProfile'

// The /recruits screen (ADR / spec 2026-08-20 character-acquisition, task 14): lists characters the
// player has unlocked but not yet recruited, with a gold-cost Hire button per candidate.
// Full-blind-surprise: the empty state says nothing about locked characters — see
// src/services/recruits.ts for why the data source itself can't leak that either.

const NOTE: React.CSSProperties = { color: 'var(--color-text-muted)', fontSize: '12px', fontStyle: 'italic' }

export default function RecruitsPage() {
  const recruitsQ = useRecruits()
  const { data: profile } = useProfile()
  const recruit = useRecruit()

  const candidates = recruitsQ.data ?? []
  const gold = profile?.currencies?.gold ?? 0

  return (
    <div>
      <h2 style={{
        color: 'var(--color-gold-mid)', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase',
        marginBottom: '14px', paddingBottom: '6px', borderBottom: '1px solid var(--color-gold-dark)',
      }}>Recruits</h2>

      {recruitsQ.isLoading ? (
        <p style={NOTE}>Loading…</p>
      ) : candidates.length === 0 ? (
        <p style={NOTE}>Keep playing — recruits show up as you go.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {candidates.map((c) => {
            const affordable = gold >= c.goldCost
            return (
              <div key={c.charKey} className="atom-heavy" style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '5px',
                border: '2px solid var(--color-gold-dark)',
                background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
              }}>
                <div style={{ width: 36, height: 44, flexShrink: 0, borderRadius: '4px', border: '2px solid var(--color-gold-dark)', background: 'linear-gradient(180deg, #1a0608 0%, #0d0304 100%)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <p style={{ color: 'var(--color-text-primary)', fontSize: '13px', fontWeight: 'bold' }}>{c.name}</p>
                    <RarityBadge rarity={c.rarity} />
                  </div>
                  <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RoleBadge role={(c.role as CharacterRole) ?? 'damage'} size="sm" />
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>{c.charClass}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IconSlot size={16} />
                  <span style={{ color: 'var(--color-text-gold)', fontSize: '14px', fontWeight: 'bold' }}>{c.goldCost}</span>
                </div>
                {/* PrimaryButton doesn't take a `title` prop — wrap in a span so the disabled state still gets a native tooltip */}
                <span title={affordable ? undefined : `Need ${c.goldCost - gold} more gold`}>
                  <PrimaryButton
                    disabled={!affordable || recruit.isPending}
                    onClick={() => recruit.mutate(c.charKey)}
                  >
                    Hire
                  </PrimaryButton>
                </span>
              </div>
            )
          })}
        </div>
      )}

      {recruit.error && (
        <>
          <div style={{ margin: '16px 0' }}><GoldDivider /></div>
          <p style={{ color: '#e0635c', fontSize: 12 }}>{(recruit.error as Error).message}</p>
        </>
      )}
    </div>
  )
}
