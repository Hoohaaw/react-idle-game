import { useState } from 'react'
import { PrimaryButton } from '@/components/atoms/Button'
import { IconButton } from '@/components/atoms/IconButton'
import { SectionLabel } from '@/components/molecules/SectionLabel'
import { MISSION, ROSTER } from './designMissionDispatchWideSamples'
import { InfoStat, RewardRow, EnemyCard, LootCard, PartyTile } from './designMissionDispatchWideParts'

// ── Mission Dispatch — wide redesign (prototype, /design only) ─────────────────────────
// Header carries the mission name + map/stage + description + a close button together. LEFT
// column is three labeled sections — Mission (duration/XP, win-chance, reward breakdown),
// Enemies, Potential Loot — each box sized to FIT the column's actual width (flex-basis +
// minWidth, wraps rather than overflows). RIGHT is a standalone SCROLLABLE party-select panel
// with a capped height, anchored to the top of the row — independent of how tall the left
// column's content happens to be, so it always scrolls once the roster overflows it rather
// than growing to match. The send CTA is its own footer strip — nothing else shares that
// container. Sample data + card subcomponents live alongside this file
// (designMissionDispatchWideSamples.ts / designMissionDispatchWideParts.tsx) — wire into the
// real component once approved.

const MAX_PARTY = 3

export function MissionDispatchWide({ onClose }: { onClose?: () => void }) {
  const [selected, setSelected] = useState<string[]>(['r1', 'r2'])
  const toggle = (id: string) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : (prev.length >= MAX_PARTY ? prev : [...prev, id]))

  const party = ROSTER.filter((c) => selected.includes(c.id))
  const avgLevel = party.length ? party.reduce((sum, c) => sum + c.level, 0) / party.length : 0
  const levelBonus = avgLevel * 0.4
  const partyBonus = Math.max(0, party.length - 1) * 10
  const knownPct = ((1 + levelBonus / 100) * (1 + partyBonus / 100) - 1) * 100
  const winPct = Math.min(96, 38 + party.length * 18 + (party.some((c) => c.id === 'r1') ? 6 : 0))

  return (
    <div style={{
      width: 1100, maxWidth: '100%', minHeight: 'min(760px, 82vh)', borderRadius: 10, border: '3px solid var(--color-gold-mid)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', 'inset 0 2px 8px rgba(0,0,0,0.6)', '0 6px 20px rgba(0,0,0,0.8)'].join(', '),
      overflow: 'hidden', fontFamily: 'Georgia, serif',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header — mission name, map/stage + description, boss badge, close button */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexShrink: 0,
        padding: '22px 32px', borderBottom: '2px solid var(--color-gold-dark)',
        background: 'linear-gradient(180deg, rgba(200,145,42,0.15) 0%, rgba(200,145,42,0.04) 100%)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: 'var(--color-gold-light)', fontSize: 24, fontWeight: 'bold', letterSpacing: '0.5px', textShadow: '0 0 14px rgba(240,208,96,0.4)' }}>{MISSION.name}</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{MISSION.map} · Stage {MISSION.stage}</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 13, lineHeight: 1.5, fontStyle: 'italic' }}>{MISSION.description}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          {MISSION.boss && (
            <span style={{
              color: '#e0938a', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', whiteSpace: 'nowrap',
              border: '1px solid #8a2e29', borderRadius: 4, padding: '6px 12px',
              background: 'linear-gradient(180deg, rgba(140,32,32,0.18) 0%, rgba(140,32,32,0.04) 100%)',
            }}>Boss Stage</span>
          )}
          <IconButton label="Close" onClick={onClose}>✕</IconButton>
        </div>
      </div>

      {/* Body — mission context (left, never scrolls — every card previews in full) /
          scrollable party panel (right), stretched to fill the space between header and footer */}
      <div style={{ display: 'flex', flex: 1, gap: 32, padding: '28px 32px 24px' }}>
        {/* LEFT — three labeled sections: Mission, Enemies, Potential Loot */}
        <div style={{ flex: '1.15 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <SectionLabel>Mission</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Duration, Base XP, Estimated success — one line, each fits the column's width
                  (flex-basis + minWidth, wraps to a second line rather than overflowing) */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                <InfoStat label="Duration" value={MISSION.duration} />
                <InfoStat label="Base XP" value={`${MISSION.baseXp}`} />
                <div className="atom-heavy" style={{
                  flex: '1 1 220px', minWidth: 220, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10,
                  padding: '12px 16px', borderRadius: 5,
                  border: `2px solid ${winPct >= 70 ? '#2d6b45' : winPct >= 40 ? '#8c6020' : '#8a2e29'}`,
                  background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
                }}>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                    Estimated success
                    <span style={{ display: 'block', fontSize: 9, letterSpacing: '0.5px', textTransform: 'none', fontStyle: 'italic', marginTop: 2 }}>Traits included</span>
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 'bold', color: winPct >= 70 ? '#5fc77e' : winPct >= 40 ? '#d89a4f' : '#e0635c' }}>
                    {party.length ? `${winPct}%` : '—'}
                  </span>
                </div>
              </div>

              <div className="atom-heavy" style={{
                display: 'flex', flexDirection: 'column', gap: 8,
                padding: '12px 16px', borderRadius: 6,
                border: '2px solid var(--color-gold-dark)',
                background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
              }}>
                <RewardRow label={`Level bonus (avg Lv ${avgLevel ? avgLevel.toFixed(0) : '—'})`} pct={levelBonus} />
                <RewardRow label={`Party size${party.length > 0 ? ` (×${party.length})` : ''}`} pct={partyBonus} />
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--color-gold-dark)' }}>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 12, letterSpacing: '0.5px' }}>Guaranteed multipliers</span>
                  <span style={{ color: 'var(--color-text-gold)', fontSize: 14, fontWeight: 'bold' }}>+{knownPct.toFixed(1)}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 12, letterSpacing: '0.5px' }}>
                    Combat margin <span style={{ fontStyle: 'italic', opacity: 0.75 }}>(win-dependent)</span>
                  </span>
                  <span style={{ color: 'var(--color-success)', fontSize: 15, fontWeight: 'bold', textShadow: '0 0 8px rgba(74,140,63,0.4)' }}>+0 – 50%</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <SectionLabel>Enemies</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {MISSION.enemies.map((e) => <EnemyCard key={e.name} enemy={e} />)}
            </div>
          </div>

          <div>
            <SectionLabel>Potential Loot</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {MISSION.loot.map((item) => <LootCard key={item.name} item={item} />)}
            </div>
          </div>
        </div>

        {/* RIGHT — party panel: capped height (independent of however tall the left column's
            content grows), anchored to the top of the row, internally scrollable so the roster
            can grow to dozens of characters without the modal growing */}
        <div className="atom-heavy" style={{
          flex: '0.85 1 0%', minWidth: 0, alignSelf: 'flex-start', maxHeight: 'min(620px, 70vh)',
          borderRadius: 6, border: '2px solid var(--color-gold-dark)',
          background: 'linear-gradient(180deg, #180709 0%, #0e0304 100%)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--color-gold-dark)', flexShrink: 0 }}>
            <SectionLabel>Select Party — {selected.length}/{MAX_PARTY}</SectionLabel>
          </div>
          <div className="scrollbar-fantasy" style={{
            padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
            flex: 1, minHeight: 0, overflowY: 'auto',
          }}>
            {ROSTER.map((c) => {
              const isSelected = selected.includes(c.id)
              const unavailable = Boolean(c.busy) || Boolean(c.downed)
              return (
                <PartyTile
                  key={c.id}
                  char={c}
                  selected={isSelected}
                  disabled={unavailable || (!isSelected && selected.length >= MAX_PARTY)}
                  onToggle={() => toggle(c.id)}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* Footer — isolated CTA container. Only the Send button lives here, centered. */}
      <div style={{
        borderTop: '2px solid var(--color-gold-mid)', padding: '18px 32px', flexShrink: 0,
        display: 'flex', justifyContent: 'center',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.3) 100%)',
      }}>
        <PrimaryButton disabled={selected.length === 0}>
          {selected.length === 0 ? 'Select a character' : `Send Party (${selected.length})`}
        </PrimaryButton>
      </div>
    </div>
  )
}
