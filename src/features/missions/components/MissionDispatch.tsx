import { useState } from 'react'
import { IconSlot } from '@/components/atoms/IconSlot'
import { GoldDivider } from '@/components/atoms/GoldDivider'
import { PrimaryButton } from '@/components/atoms/Button'
import { SectionLabel } from '@/components/molecules/SectionLabel'
import { RarityChancePill } from '@/components/molecules/RarityChancePill'
import { RoleBadge } from '@/components/atoms/RoleBadge'
import { SchoolBadge } from '@/components/atoms/SchoolBadge'
import { resolveRole } from '@/lib/roles'
import { MissionEnemies } from './MissionEnemies'
import { WinChanceEstimate } from './WinChanceEstimate'
import {
  SAMPLE_DISPATCH_MISSION,
  SAMPLE_DISPATCH_ROSTER,
  type DispatchMission,
  type DispatchChar,
} from './dispatchSamples'

const MAX_PARTY = 3

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="atom-heavy" style={{
      flex: 1, padding: '8px 12px', borderRadius: '4px',
      border: '2px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
    }}>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{label}</p>
      <p style={{ color: 'var(--color-text-gold)', fontSize: '15px', fontWeight: 'bold', textShadow: '0 0 6px rgba(232,192,80,0.3)' }}>{value}</p>
    </div>
  )
}

function RewardRow({ label, pct }: { label: string; pct: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', letterSpacing: '0.5px' }}>{label}</span>
      <span style={{ color: 'var(--color-text-gold)', fontSize: '12px', fontWeight: 'bold' }}>+{pct.toFixed(1)}%</span>
    </div>
  )
}

function CharacterTile({ char, selected, disabled, onToggle }: { char: DispatchChar; selected: boolean; disabled?: boolean; onToggle: () => void }) {
  const note = char.busy ?? (char.downed ? 'Downed' : null)
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', width: '100%',
        padding: '8px 10px', borderRadius: '5px', cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'Georgia, serif',
        border: `2px solid ${selected ? 'var(--color-gold-mid)' : 'var(--color-gold-dark)'}`,
        background: selected ? 'linear-gradient(180deg, #34161a 0%, #1e0a0c 100%)' : 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
        opacity: disabled ? 0.45 : 1,
        boxShadow: selected
          ? '0 0 0 1px #080101, 0 0 12px rgba(200,140,30,0.35), inset 0 1px 0 rgba(255,255,255,0.07)'
          : '0 0 0 1px #080101, inset 0 1px 0 rgba(255,255,255,0.05)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      <div style={{
        width: 38, height: 46, flexShrink: 0, borderRadius: '3px',
        border: '2px solid var(--color-gold-dark)',
        background: 'linear-gradient(180deg, #1a0608 0%, #0d0304 100%)',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: 'var(--color-text-primary)', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{char.name}</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '0.5px' }}>
          {char.charClass} · Lv {char.level}{note ? ` · ${note}` : ''}
        </p>
        <div style={{ marginTop: '5px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <RoleBadge role={resolveRole(char.charClass, char.role)} size="sm" />
          {char.damageSchool && <SchoolBadge school={char.damageSchool} size="sm" />}
        </div>
      </div>
      <span style={{
        width: 18, height: 18, flexShrink: 0, borderRadius: '50%',
        border: `2px solid ${selected ? 'var(--color-gold-mid)' : 'var(--color-gold-dark)'}`,
        background: selected ? 'radial-gradient(circle at 40% 35%, #f0d060, #7a4f10)' : 'transparent',
        boxShadow: selected ? '0 0 6px rgba(200,140,30,0.6)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#1a0608', fontSize: '11px', fontWeight: 'bold',
      }}>{selected ? '✓' : ''}</span>
    </button>
  )
}

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
      width: 420, borderRadius: 8, border: '3px solid var(--color-gold-mid)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', 'inset 0 2px 8px rgba(0,0,0,0.6)', '0 6px 20px rgba(0,0,0,0.8)'].join(', '),
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
        padding: '12px 16px', borderBottom: '2px solid var(--color-gold-dark)',
        background: 'linear-gradient(180deg, rgba(200,145,42,0.15) 0%, rgba(200,145,42,0.04) 100%)',
      }}>
        <p style={{ color: 'var(--color-gold-light)', fontSize: '17px', fontWeight: 'bold', letterSpacing: '0.5px', textShadow: '0 0 12px rgba(240,208,96,0.4)' }}>{mission.name}</p>
        {mission.stage != null && (
          <span style={{
            color: 'var(--color-text-gold)', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase',
            whiteSpace: 'nowrap', border: '1px solid var(--color-gold-dark)', borderRadius: '3px', padding: '3px 7px',
          }}>Stage {mission.stage}</span>
        )}
      </div>

      <div style={{ padding: '16px' }}>
        {/* Description */}
        <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', lineHeight: 1.5, fontStyle: 'italic', marginBottom: '16px' }}>{mission.description}</p>

        {/* Enemies — what the party will fight and what schools it resists / is weak to (ADR-0033) */}
        <MissionEnemies enemies={mission.enemies} />

        {/* Time + XP */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
          <InfoStat label="Duration" value={mission.duration} />
          <InfoStat label="Base XP" value={`${mission.baseXp}`} />
        </div>

        {/* Potential loot */}
        <SectionLabel>Potential Loot</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '18px' }}>
          {mission.loot.map(item => (
            <div key={item.name} className="atom-heavy" style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '4px',
              border: '2px solid var(--color-gold-dark)', background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
            }}>
              <IconSlot size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--color-text-primary)', fontSize: '12px', flex: 1 }}>{item.name}</span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>{item.slot}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {item.chances.map(c => <RarityChancePill key={c.rarity} rarity={c.rarity} chance={c.chance} />)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Party selection */}
        <SectionLabel>Select Party — {selected.length}/{MAX_PARTY}</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
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
              />
            )
          })}
          {roster.length === 0 && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>
              No available characters — recruit or free up your party.
            </p>
          )}
        </div>

        {/* Win-chance estimate — updates live as the party changes */}
        <WinChanceEstimate party={party} enemies={mission.enemies} timeLimitSeconds={mission.timeLimitSeconds ?? null} />

        <div style={{ margin: '0 0 14px' }}><GoldDivider /></div>

        {/* Reward breakdown — win-gated pipeline (ADR-0012/0017): known multipliers + a margin range */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
          <RewardRow label={`Level bonus (avg Lv ${avgLevel ? avgLevel.toFixed(0) : '—'})`} pct={levelBonus} />
          <RewardRow label={`Party size${party.length > 0 ? ` (×${party.length})` : ''}`} pct={partyBonus} />
          {transcendenceBonus > 0 && <RewardRow label={`Transcendence (×${transcendenceCount})`} pct={transcendenceBonus} />}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '7px', borderTop: '1px solid var(--color-gold-dark)' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', letterSpacing: '0.5px' }}>Guaranteed multipliers</span>
            <span style={{ color: 'var(--color-text-gold)', fontSize: '13px', fontWeight: 'bold' }}>+{knownPct.toFixed(1)}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', letterSpacing: '0.5px' }}>
              Combat margin <span style={{ fontStyle: 'italic', opacity: 0.75 }}>(win-dependent)</span>
            </span>
            <span style={{ color: 'var(--color-success)', fontSize: '14px', fontWeight: 'bold', textShadow: '0 0 8px rgba(74,140,63,0.4)' }}>+0 – {MARGIN_MAX}%</span>
          </div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', fontStyle: 'italic', marginTop: '2px', lineHeight: 1.4 }}>
            Rewards are granted only on a win. The combat margin scales with how much HP the party keeps.
          </p>
        </div>
        {error && (
          <p style={{ color: '#e0635c', fontSize: '11px', textAlign: 'center', marginBottom: '8px' }}>{error}</p>
        )}
        <PrimaryButton fullWidth disabled={selected.length === 0 || pending} onClick={() => onDispatch?.(selected)}>
          {pending ? 'Sending…' : selected.length === 0 ? 'Select a character' : `Send Party (${selected.length})`}
        </PrimaryButton>
      </div>
    </div>
  )
}
