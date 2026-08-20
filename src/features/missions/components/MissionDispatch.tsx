import { useState } from 'react'
import { IconSlot } from '@/components/atoms/IconSlot'
import { PrimaryButton } from '@/components/atoms/Button'
import { SectionLabel } from '@/components/molecules/SectionLabel'
import { RarityChancePill } from '@/components/molecules/RarityChancePill'
import { MissionEnemies } from './MissionEnemies'
import { WinChanceEstimate } from './WinChanceEstimate'
import { missionTraitContext } from '../winChance'
import { InfoStat, RewardRow, CharacterTile } from './dispatchParts'
import {
  SAMPLE_DISPATCH_MISSION,
  SAMPLE_DISPATCH_ROSTER,
  type DispatchMission,
  type DispatchChar,
} from './dispatchSamples'

// Wide two-column redesign (prototyped on /design as DesignMissionDispatchWide): LEFT column
// never scrolls — every card (Mission/Enemies/Potential Loot) previews in full. RIGHT is a
// standalone party-select panel with a capped, independently-scrollable height so a growing
// roster never grows the modal. No in-header close button: Modal.tsx already floats its own.
const MAX_PARTY = 3

export function MissionDispatch({
  mission = SAMPLE_DISPATCH_MISSION,
  roster = SAMPLE_DISPATCH_ROSTER,
  transcendenceCount = 1,
  pending = false,
  error = null,
  onDispatch,
}: {
  mission?: DispatchMission
  roster?: DispatchChar[]
  transcendenceCount?: number
  pending?: boolean
  error?: string | null
  onDispatch?: (party: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : (prev.length >= MAX_PARTY ? prev : [...prev, id]))

  const party = roster.filter(c => selected.includes(c.id))
  // What this mission "is" for trait matching (ADR-0035) — same construction mission-claim uses.
  const traitCtx = missionTraitContext(mission.enemies, mission.mapKey)
  // Reward pipeline (ADR-0012/0017), win-gated. Only the multipliers KNOWN before the fight are shown
  // here; the combat margin (up to +50%) depends on how much HP the party keeps, so it's a range.
  const avgLevel = party.length ? party.reduce((sum, c) => sum + c.level, 0) / party.length : 0
  const levelBonus = avgLevel * 0.4                        // % — levelBonus = avgPartyLevel × 0.004
  const partyBonus = Math.max(0, party.length - 1) * 10    // % — (partySize − 1) × 10%
  const transcendenceBonus = transcendenceCount * 10       // % — transcendence_count × 10%
  const knownPct = ((1 + levelBonus / 100) * (1 + partyBonus / 100) * (1 + transcendenceBonus / 100) - 1) * 100
  const MARGIN_MAX = 50                                    // combat margin caps at +50% (a flawless win)

  return (
    <div style={{
      width: 1100, maxWidth: '100%', minHeight: 'min(760px, 82vh)', borderRadius: 10, border: '3px solid var(--color-gold-mid)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', 'inset 0 2px 8px rgba(0,0,0,0.6)', '0 6px 20px rgba(0,0,0,0.8)'].join(', '),
      overflow: 'hidden', fontFamily: 'Georgia, serif',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header — mission name, map/stage + description, boss badge */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexShrink: 0,
        padding: '22px 32px', borderBottom: '2px solid var(--color-gold-dark)',
        background: 'linear-gradient(180deg, rgba(200,145,42,0.15) 0%, rgba(200,145,42,0.04) 100%)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: 'var(--color-gold-light)', fontSize: 24, fontWeight: 'bold', letterSpacing: '0.5px', textShadow: '0 0 14px rgba(240,208,96,0.4)' }}>{mission.name}</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
            {mission.stage != null && (
              <span style={{ color: 'var(--color-text-muted)', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Stage {mission.stage}</span>
            )}
            <span style={{ color: 'var(--color-text-muted)', fontSize: 13, lineHeight: 1.5, fontStyle: 'italic' }}>{mission.description}</span>
          </div>
        </div>
      </div>

      {/* Body — mission context (left, never scrolls — every card previews in full) /
          scrollable party panel (right), capped independent of the left column's height */}
      <div style={{ display: 'flex', flex: 1, gap: 32, padding: '28px 32px 24px' }}>
        {/* LEFT — three labeled sections: Mission, Enemies, Potential Loot */}
        <div style={{ flex: '1.15 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <SectionLabel>Mission</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Duration, Base XP, Estimated success — one line, wraps rather than overflows */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                <InfoStat label="Duration" value={mission.duration} />
                <InfoStat label="Base XP" value={`${mission.baseXp}`} />
                <WinChanceEstimate party={party} enemies={mission.enemies} timeLimitSeconds={mission.timeLimitSeconds ?? null} mapKey={mission.mapKey} />
              </div>

              <div className="atom-heavy" style={{
                display: 'flex', flexDirection: 'column', gap: 8,
                padding: '12px 16px', borderRadius: 6,
                border: '2px solid var(--color-gold-dark)',
                background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
              }}>
                <RewardRow label={`Level bonus (avg Lv ${avgLevel ? avgLevel.toFixed(0) : '—'})`} pct={levelBonus} />
                <RewardRow label={`Party size${party.length > 0 ? ` (×${party.length})` : ''}`} pct={partyBonus} />
                {transcendenceBonus > 0 && <RewardRow label={`Transcendence (×${transcendenceCount})`} pct={transcendenceBonus} />}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--color-gold-dark)' }}>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 12, letterSpacing: '0.5px' }}>Guaranteed multipliers</span>
                  <span style={{ color: 'var(--color-text-gold)', fontSize: 14, fontWeight: 'bold' }}>+{knownPct.toFixed(1)}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 12, letterSpacing: '0.5px' }}>
                    Combat margin <span style={{ fontStyle: 'italic', opacity: 0.75 }}>(win-dependent)</span>
                  </span>
                  <span style={{ color: 'var(--color-success)', fontSize: 15, fontWeight: 'bold', textShadow: '0 0 8px rgba(74,140,63,0.4)' }}>+0 – {MARGIN_MAX}%</span>
                </div>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 10, fontStyle: 'italic', marginTop: 2, lineHeight: 1.4 }}>
                  Rewards are granted only on a win. The combat margin scales with how much HP the party keeps.
                </p>
              </div>
            </div>
          </div>

          {/* Enemies — what the party will fight and what schools it resists / is weak to (ADR-0033) */}
          <MissionEnemies enemies={mission.enemies} />

          <div>
            <SectionLabel>Potential Loot</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {mission.loot.map(item => (
                <div key={item.name} className="atom-heavy" style={{
                  flex: '1 1 45%', minWidth: 260, display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 5,
                  border: '2px solid var(--color-gold-dark)', background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
                }}>
                  <IconSlot size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7 }}>
                      <span style={{ color: 'var(--color-text-primary)', fontSize: 13, flex: 1 }}>{item.name}</span>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase' }}>{item.slot}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {item.chances.map(c => <RarityChancePill key={c.rarity} rarity={c.rarity} chance={c.chance} />)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — party panel: capped height (independent of however tall the left column's
            content grows), anchored to the top of the row, internally scrollable */}
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
            {roster.map(c => {
              const isSelected = selected.includes(c.id)
              const unavailable = Boolean(c.busy) || Boolean(c.downed)
              return (
                <CharacterTile
                  key={c.id}
                  char={c}
                  selected={isSelected}
                  disabled={unavailable || (!isSelected && selected.length >= MAX_PARTY)}
                  onToggle={() => toggle(c.id)}
                  traitCtx={traitCtx}
                />
              )
            })}
            {roster.length === 0 && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 11, fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>
                No available characters — recruit or free up your party.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer — isolated CTA container */}
      <div style={{
        borderTop: '2px solid var(--color-gold-mid)', padding: '18px 32px', flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.3) 100%)',
      }}>
        {error && <p style={{ color: '#e0635c', fontSize: 11, textAlign: 'center' }}>{error}</p>}
        <PrimaryButton disabled={selected.length === 0 || pending} onClick={() => onDispatch?.(selected)}>
          {pending ? 'Sending…' : selected.length === 0 ? 'Select a character' : `Send Party (${selected.length})`}
        </PrimaryButton>
      </div>
    </div>
  )
}
