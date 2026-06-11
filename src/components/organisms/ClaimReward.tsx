import type { CSSProperties } from 'react'
import { IconSlot } from '../atoms/IconSlot'
import { ResourceChip } from '../atoms/ResourceChip'
import { RarityBadge } from '../atoms/RarityBadge'
import { GoldDivider } from '../atoms/GoldDivider'
import { PrimaryButton } from '../atoms/Button'
import { SectionLabel } from '../molecules/SectionLabel'
import { RoleBadge } from '../atoms/RoleBadge'
import { roleForClass } from '../../lib/roles'

// Mock data for the prototype — replaced by the real claim payload later.
const CLAIM = {
  stageName: 'Goblin Outpost',
  stage: 3,
  elapsed: '3:00',
  baseCoins: 100,
  baseXp: 120,
  party: [
    { name: 'Lyra Swift', class: 'Rogue', level: 12 },
    { name: 'Alexandros Mograine', class: 'Death Knight', level: 24 },
  ],
  resources: [{ label: 'Cu', value: 20 }, { label: 'Wd', value: 13 }, { label: 'St', value: 8 }],
  items: [
    { name: 'Coif', slot: 'Head', rarity: 'Uncommon' },
    { name: 'Coif', slot: 'Head', rarity: 'Common' },
    { name: 'Bent Dagger', slot: 'Weapon', rarity: 'Common' },
  ],
  bonuses: [
    { label: 'Stat bonus', detail: '275 pts', pct: 27.5 },
    { label: 'Party size', detail: '×2', pct: 10 },
    { label: 'Transcendence', detail: '×2', pct: 20 },
  ],
}

export function ClaimReward() {
  // Multiplicative chain — running value after each bonus is applied
  let running = CLAIM.baseCoins
  const coinSteps = CLAIM.bonuses.map(b => { running = running * (1 + b.pct / 100); return { ...b, value: Math.round(running) } })
  const multiplier = CLAIM.bonuses.reduce((m, b) => m * (1 + b.pct / 100), 1)
  const finalCoins = Math.round(CLAIM.baseCoins * multiplier)
  const xpEach = Math.round(CLAIM.baseXp * multiplier)

  const labelStyle: CSSProperties = { color: 'var(--color-text-muted)', fontSize: '11px', letterSpacing: '0.5px' }

  return (
    <div style={{
      width: 440, borderRadius: 8, border: '3px solid var(--color-gold-mid)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', 'inset 0 2px 8px rgba(0,0,0,0.6)', '0 6px 20px rgba(0,0,0,0.8)'].join(', '),
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center', padding: '16px', borderBottom: '2px solid var(--color-gold-dark)',
        background: 'linear-gradient(180deg, rgba(200,145,42,0.18) 0%, rgba(200,145,42,0.04) 100%)',
      }}>
        <p style={{ color: 'var(--color-gold-light)', fontSize: '18px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', textShadow: '0 0 14px rgba(240,208,96,0.55), 0 2px 4px rgba(0,0,0,0.9)' }}>Mission Complete</p>
        <p style={{ color: 'var(--color-text-primary)', fontSize: '13px', marginTop: '4px' }}>{CLAIM.stageName} · Stage {CLAIM.stage}</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginTop: '3px', fontStyle: 'italic' }}>Completed in {CLAIM.elapsed}</p>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Party */}
        <SectionLabel>Party</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
          {CLAIM.party.map(c => (
            <div key={c.name} className="atom-heavy" style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '4px',
              border: '2px solid var(--color-gold-dark)', background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
            }}>
              <div style={{ width: 30, height: 36, flexShrink: 0, borderRadius: '3px', border: '2px solid var(--color-gold-dark)', background: 'linear-gradient(180deg, #1a0608 0%, #0d0304 100%)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: 'var(--color-text-primary)', fontSize: '12px' }}>{c.name}</p>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>{c.class} · Lv {c.level}</p>
                <div style={{ marginTop: '4px' }}><RoleBadge role={roleForClass(c.class)} size="sm" /></div>
              </div>
              <span style={{ color: 'var(--color-xp)', fontSize: '12px', fontWeight: 'bold', textShadow: '0 0 8px rgba(124,45,190,0.5)' }}>+{xpEach} XP</span>
            </div>
          ))}
        </div>

        <div style={{ margin: '0 0 16px' }}><GoldDivider /></div>

        {/* Rewards */}
        <SectionLabel>Rewards</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <IconSlot size={18} />
          <span style={{ color: 'var(--color-text-gold)', fontSize: '18px', fontWeight: 'bold', textShadow: '0 0 8px rgba(232,192,80,0.4)' }}>+{finalCoins}</span>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>coins</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
          {CLAIM.resources.map(r => <ResourceChip key={r.label} label={r.label} value={r.value} />)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {CLAIM.items.map((item, i) => (
            <div key={i} className="atom-heavy" style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '4px',
              border: '2px solid var(--color-gold-dark)', background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
            }}>
              <IconSlot size={34} />
              <span style={{ color: 'var(--color-text-primary)', fontSize: '12px', flex: 1 }}>{item.name}</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>{item.slot}</span>
              <RarityBadge rarity={item.rarity} />
            </div>
          ))}
        </div>

        <div style={{ margin: '16px 0' }}><GoldDivider /></div>

        {/* Transparency: how it was calculated */}
        <SectionLabel>How it was calculated</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={labelStyle}>Base coins</span>
            <span style={{ color: 'var(--color-text-primary)', fontSize: '12px' }}>{CLAIM.baseCoins}</span>
          </div>
          {coinSteps.map(s => (
            <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={labelStyle}>× {s.label} ({s.detail}) <span style={{ color: 'var(--color-success)' }}>+{s.pct}%</span></span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>→ {s.value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid var(--color-gold-dark)' }}>
            <span style={labelStyle}>Total coins (×{multiplier.toFixed(2)})</span>
            <span style={{ color: 'var(--color-text-gold)', fontSize: '14px', fontWeight: 'bold' }}>{finalCoins}</span>
          </div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', fontStyle: 'italic', marginTop: '4px' }}>
            Resources and XP use the same ×{multiplier.toFixed(2)} multiplier. Loot rolled once per character.
          </p>
        </div>

        <div style={{ margin: '16px 0 12px' }}><GoldDivider /></div>

        <PrimaryButton fullWidth>Claim Rewards</PrimaryButton>
      </div>
    </div>
  )
}
