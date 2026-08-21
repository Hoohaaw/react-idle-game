import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '@/components/atoms/Alert'
import { IconSlot } from '@/components/atoms/IconSlot'
import { ResourceChip } from '@/components/atoms/ResourceChip'
import { RarityBadge } from '@/components/atoms/RarityBadge'
import { GoldDivider } from '@/components/atoms/GoldDivider'
import { PrimaryButton } from '@/components/atoms/Button'
import { SectionLabel } from '@/components/molecules/SectionLabel'
import { RoleBadge } from '@/components/atoms/RoleBadge'
import { resolveRole } from '@/lib/roles'
import { SAMPLE_CLAIM_WIN, type ClaimResultView } from './claimSamples'

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const hpColor = (pct: number) => (pct <= 0 ? '#e0635c' : pct < 0.35 ? '#d89a4f' : '#5fc77e')

function HpBar({ hp, max }: { hp: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0
  const color = hpColor(pct)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#0d0304', border: '1px solid var(--color-gold-dark)', overflow: 'hidden' }}>
        <div style={{ width: `${pct * 100}%`, height: '100%', background: color, boxShadow: `0 0 6px ${color}88`, transition: 'width 0.3s' }} />
      </div>
      <span style={{ color, fontSize: '9px', fontWeight: 'bold', minWidth: 46, textAlign: 'right' }}>
        {hp <= 0 ? 'DOWNED' : `${Math.round(hp)}/${max}`}
      </span>
    </div>
  )
}

const REASON_TEXT: Record<ClaimResultView['reason'], string> = {
  'enemies-defeated': 'Enemies defeated',
  'party-wiped': 'All heroes downed',
  timeout: 'Combat clock expired',
}

// The two failure screens (win/loss comes from the server sim; reason discriminates them):
//  'party-wiped' = every hero hit 0 HP before the enemies died → red, infirmary-focused
//  'timeout'     = the combat clock ran out with enemies still standing → amber, kill-faster-focused
const LOSS_SCREENS = {
  'party-wiped': {
    title: 'Party Wiped',
    accent: '#e0635c',
    border: '#8a2e29',
    borderSoft: '#5c1f1c',
    headline: 'Your party has fallen — no rewards',
    body:
      'Every hero was struck down before the enemies were. Nothing was earned, and downed heroes ' +
      'must be stabilized at the Infirmary before they can fight again. Come back stronger — or ' +
      'come back with a different party.',
  },
  timeout: {
    title: 'Out of Time',
    accent: '#d89a4f',
    border: '#8a5e29',
    borderSoft: '#5c3f1c',
    headline: 'The clock ran out — no rewards',
    body:
      'The battle dragged on too long with enemies still standing, and that counts as a loss — ' +
      'nothing was earned. Your party survived but carries its wounds. To beat the clock, bring ' +
      'more damage or heroes the enemies cannot resist.',
  },
} as const

export function ClaimReward({ result = SAMPLE_CLAIM_WIN, onDone }: { result?: ClaimResultView; onDone?: () => void }) {
  const win = result.outcome === 'win'
  const loss = win ? null : LOSS_SCREENS[result.reason === 'party-wiped' ? 'party-wiped' : 'timeout']
  const multiplier = result.bonuses.reduce((m, b) => m * (1 + b.pct / 100), 1)
  const finalGold = Math.round(result.baseGold * multiplier)
  // Cumulative coin value after each bonus is applied (the transparency trail).
  const goldSteps = result.bonuses.map((b, i) => ({
    ...b,
    value: Math.round(result.bonuses.slice(0, i + 1).reduce((acc, x) => acc * (1 + x.pct / 100), result.baseGold)),
  }))
  const labelStyle: CSSProperties = { color: 'var(--color-text-muted)', fontSize: '11px', letterSpacing: '0.5px' }
  const accent = loss ? loss.accent : 'var(--color-gold-light)'

  return (
    <div style={{
      width: 440, borderRadius: 8, border: `3px solid ${loss ? loss.border : 'var(--color-gold-mid)'}`,
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: ['0 0 0 1px #080101', 'inset 0 1px 0 rgba(255,255,255,0.06)', 'inset 0 2px 8px rgba(0,0,0,0.6)', '0 6px 20px rgba(0,0,0,0.8)'].join(', '),
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center', padding: '16px', borderBottom: `2px solid ${loss ? loss.borderSoft : 'var(--color-gold-dark)'}`,
        background: win
          ? 'linear-gradient(180deg, rgba(200,145,42,0.18) 0%, rgba(200,145,42,0.04) 100%)'
          : `linear-gradient(180deg, color-mix(in srgb, ${accent} 20%, transparent) 0%, color-mix(in srgb, ${accent} 4%, transparent) 100%)`,
      }}>
        <p style={{ color: accent, fontSize: '18px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', textShadow: `0 0 14px color-mix(in srgb, ${win ? '#f0d060' : accent} 55%, transparent), 0 2px 4px rgba(0,0,0,0.9)` }}>
          {loss ? loss.title : 'Victory'}
        </p>
        <p style={{ color: 'var(--color-text-primary)', fontSize: '13px', marginTop: '4px' }}>
          {result.missionName}{result.stage ? ` · Stage ${result.stage}` : ''}
        </p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginTop: '3px', fontStyle: 'italic' }}>
          {REASON_TEXT[result.reason]} · {fmtTime(result.durationSeconds)} · {Math.round(result.survivingHpPct * 100)}% party HP
        </p>
      </div>

      {result.newlyUnlocked.length > 0 && (
        <div style={{ padding: '12px 16px 0' }}>
          {result.newlyUnlocked.map((r) => (
            <div key={r.charKey} style={{ marginBottom: '8px' }}>
              <Alert variant="success">
                New recruit available: <strong>{r.name}</strong>{r.role ? ` (${r.role})` : ''} — visit{' '}
                <Link to="/recruits" style={{ color: 'var(--color-gold-mid)', textDecoration: 'underline' }}>Recruits</Link> to hire them.
              </Alert>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: '16px' }}>
        {/* Party — ending HP always shown (persistent damage); XP only where earned */}
        <SectionLabel>Party</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
          {result.party.map(c => (
            <div key={c.name} className="atom-heavy" style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '4px',
              border: '2px solid var(--color-gold-dark)', background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
            }}>
              <div style={{ width: 30, height: 36, flexShrink: 0, borderRadius: '3px', border: '2px solid var(--color-gold-dark)', background: 'linear-gradient(180deg, #1a0608 0%, #0d0304 100%)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <p style={{ color: 'var(--color-text-primary)', fontSize: '12px' }}>{c.name}</p>
                  {c.xpGained > 0
                    ? <span style={{ color: 'var(--color-xp)', fontSize: '12px', fontWeight: 'bold', textShadow: '0 0 8px rgba(124,45,190,0.5)' }}>+{c.xpGained} XP</span>
                    : <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', fontStyle: 'italic' }}>{c.endingHp <= 0 ? 'no XP — downed' : win ? '' : 'no XP'}</span>}
                </div>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>{c.class} · Lv {c.level}</p>
                <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RoleBadge role={resolveRole(c.class, c.role)} size="sm" />
                </div>
                <HpBar hp={c.endingHp} max={c.maxHp} />
              </div>
            </div>
          ))}
        </div>

        {win ? (
          <>
            <div style={{ margin: '0 0 16px' }}><GoldDivider /></div>

            {/* Rewards */}
            <SectionLabel>Rewards</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <IconSlot size={18} />
              <span style={{ color: 'var(--color-text-gold)', fontSize: '18px', fontWeight: 'bold', textShadow: '0 0 8px rgba(232,192,80,0.4)' }}>+{finalGold}</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>gold</span>
            </div>
            {result.resources.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {result.resources.map(r => <ResourceChip key={r.label} label={r.label} value={r.value} />)}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {result.loot.map((item, i) => (
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
                <span style={labelStyle}>Base gold</span>
                <span style={{ color: 'var(--color-text-primary)', fontSize: '12px' }}>{result.baseGold}</span>
              </div>
              {goldSteps.map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={labelStyle}>× {s.label} ({s.detail}) <span style={{ color: 'var(--color-success)' }}>+{s.pct}%</span></span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>→ {s.value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid var(--color-gold-dark)' }}>
                <span style={labelStyle}>Total gold (×{multiplier.toFixed(2)})</span>
                <span style={{ color: 'var(--color-text-gold)', fontSize: '14px', fontWeight: 'bold' }}>{finalGold}</span>
              </div>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', fontStyle: 'italic', marginTop: '4px' }}>
                Resources & each survivor's XP use the same ×{multiplier.toFixed(2)}. Loot rolled independently per item.
              </p>
            </div>
          </>
        ) : loss && (
          /* Loss: no rewards, party carries persistent damage. Copy is reason-specific. */
          <div className="atom-heavy" style={{
            padding: '12px 14px', borderRadius: '5px', marginBottom: '4px',
            border: `2px solid ${loss.borderSoft}`,
            background: `linear-gradient(180deg, color-mix(in srgb, ${loss.accent} 12%, #160607) 0%, #160607 100%)`,
          }}>
            <p style={{ color: loss.accent, fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.5px' }}>{loss.headline}</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', lineHeight: 1.5, marginTop: '4px' }}>
              {loss.body}
            </p>
          </div>
        )}

        <div style={{ margin: '16px 0 12px' }}><GoldDivider /></div>

        <PrimaryButton fullWidth onClick={onDone}>{win ? 'Claim Rewards' : 'Return to Base'}</PrimaryButton>
      </div>
    </div>
  )
}
