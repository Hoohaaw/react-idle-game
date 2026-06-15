import { useState } from 'react'
import { IconSlot } from '@/components/atoms/IconSlot'
import { GoldDivider } from '@/components/atoms/GoldDivider'
import { PrimaryButton } from '@/components/atoms/Button'
import { SectionLabel } from '@/components/molecules/SectionLabel'
import { RarityChancePill } from '@/components/molecules/RarityChancePill'
import type { DropItem } from '@/types/loot'
import { RoleBadge } from '@/components/atoms/RoleBadge'
import { resolveRole, type CharacterRole } from '@/lib/roles'

// Mock data for the prototype — replaced by real mission + roster data later.
const DISPATCH_MISSION: { name: string; stage: number; description: string; duration: string; xpPerChar: number; loot: DropItem[] } = {
  name: 'Goblin Outpost',
  stage: 3,
  description: 'A ramshackle camp of goblin raiders harassing the eastern road. Clear them out and claim whatever they have hoarded away.',
  duration: '3:00',
  xpPerChar: 120,
  loot: [
    { name: 'Coif', slot: 'Head', chances: [{ rarity: 'Common', chance: 90 }, { rarity: 'Uncommon', chance: 15 }] },
    { name: 'Tattered Cloak', slot: 'Chest', chances: [{ rarity: 'Common', chance: 80 }, { rarity: 'Uncommon', chance: 10 }] },
    { name: 'Bent Dagger', slot: 'Weapon', chances: [{ rarity: 'Common', chance: 70 }, { rarity: 'Uncommon', chance: 6 }] },
  ],
}

type RosterChar = { id: string; name: string; class: string; level: number; statTotal: number; busy?: boolean; role?: CharacterRole }
const DISPATCH_ROSTER: RosterChar[] = [
  { id: 'r1', name: 'Lyra Swift', class: 'Rogue', level: 12, statTotal: 95 },
  // Demo of ADR-0008: a Death Knight (tank by class) authored as a Damage dealer.
  { id: 'r2', name: 'Alexandros Mograine', class: 'Death Knight', level: 24, statTotal: 180, role: 'damage' },
  { id: 'r3', name: 'Fandral Staghelm', class: 'Druid', level: 9, statTotal: 70, busy: true },
  { id: 'r4', name: 'Sally Whitemane', class: 'Priest', level: 15, statTotal: 120 },
]
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

function CharacterTile({ char, selected, disabled, onToggle }: { char: RosterChar; selected: boolean; disabled?: boolean; onToggle: () => void }) {
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
          {char.class} · Lv {char.level}{char.busy ? ' · On mission' : ` · ${char.statTotal} pts`}
        </p>
        <div style={{ marginTop: '5px' }}><RoleBadge role={resolveRole(char.class, char.role)} size="sm" /></div>
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

export function MissionDispatch() {
  const [selected, setSelected] = useState<string[]>(['r2'])
  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : (prev.length >= MAX_PARTY ? prev : [...prev, id]))

  const party = DISPATCH_ROSTER.filter(c => selected.includes(c.id))
  const combinedStat = party.reduce((sum, c) => sum + c.statTotal, 0)
  const statBonus = combinedStat * 0.1                    // % from summed stat points (0.1%/pt)
  const partyBonus = Math.max(0, party.length - 1) * 10   // % from party size (+10% per extra char)
  // Multiplicative: each bonus is its own independent multiplier.
  const totalPct = ((1 + statBonus / 100) * (1 + partyBonus / 100) - 1) * 100

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
        <p style={{ color: 'var(--color-gold-light)', fontSize: '17px', fontWeight: 'bold', letterSpacing: '0.5px', textShadow: '0 0 12px rgba(240,208,96,0.4)' }}>{DISPATCH_MISSION.name}</p>
        <span style={{
          color: 'var(--color-text-gold)', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase',
          whiteSpace: 'nowrap', border: '1px solid var(--color-gold-dark)', borderRadius: '3px', padding: '3px 7px',
        }}>Stage {DISPATCH_MISSION.stage}</span>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Description */}
        <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', lineHeight: 1.5, fontStyle: 'italic', marginBottom: '16px' }}>{DISPATCH_MISSION.description}</p>

        {/* Time + XP */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
          <InfoStat label="Duration" value={DISPATCH_MISSION.duration} />
          <InfoStat label="XP each" value={`~${DISPATCH_MISSION.xpPerChar}`} />
        </div>

        {/* Potential loot */}
        <SectionLabel>Potential Loot</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '18px' }}>
          {DISPATCH_MISSION.loot.map(item => (
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
          {DISPATCH_ROSTER.map(c => {
            const isSelected = selected.includes(c.id)
            return (
              <CharacterTile
                key={c.id}
                char={c}
                selected={isSelected}
                disabled={c.busy || (!isSelected && selected.length >= MAX_PARTY)}
                onToggle={() => toggle(c.id)}
              />
            )
          })}
        </div>

        <div style={{ margin: '0 0 14px' }}><GoldDivider /></div>

        {/* Reward breakdown (multiplicative) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', letterSpacing: '0.5px' }}>Stat bonus</span>
            <span style={{ color: 'var(--color-text-gold)', fontSize: '12px', fontWeight: 'bold' }}>+{statBonus.toFixed(1)}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', letterSpacing: '0.5px' }}>
              Party size{party.length > 0 ? ` (×${party.length})` : ''}
            </span>
            <span style={{ color: 'var(--color-text-gold)', fontSize: '12px', fontWeight: 'bold' }}>+{partyBonus.toFixed(1)}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '7px', borderTop: '1px solid var(--color-gold-dark)' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', letterSpacing: '0.5px' }}>Total rewards</span>
            <span style={{ color: 'var(--color-success)', fontSize: '16px', fontWeight: 'bold', textShadow: '0 0 8px rgba(74,140,63,0.4)' }}>+{totalPct.toFixed(1)}%</span>
          </div>
        </div>
        <PrimaryButton fullWidth disabled={selected.length === 0}>
          {selected.length === 0 ? 'Select a character' : `Send Party (${selected.length})`}
        </PrimaryButton>
      </div>
    </div>
  )
}
