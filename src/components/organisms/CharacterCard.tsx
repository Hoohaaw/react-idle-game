import { useState, type ComponentProps } from 'react'
import { LevelBadge } from '../atoms/LevelBadge'
import { ProgressBar } from '../atoms/ProgressBar'
import { StatPill } from '../atoms/StatPill'
import { GoldDivider } from '../atoms/GoldDivider'
import { Tooltip } from '../atoms/Tooltip'
import { RoleBadge } from '../atoms/RoleBadge'
import { ClassBadge } from '../atoms/ClassBadge'
import { GearSlotGrid } from './GearSlotGrid'
import { resolveRole, type CharacterRole } from '../../lib/roles'
import { computeBaselines, type StatValue, type StatGrowth } from '../../lib/stats'
import { STAT_DEFS } from '../../lib/statDefinitions'

// The full character sheet: portrait + identity + XP on the left, and Equipped /
// Talents / Stats tabs on the right. Identity + XP + gear are per-character (props;
// the Equipped tab renders real gear when a recruited instance supplies `gear` —
// ADR-0022); Talents are still shared mock data until blessings are wired. Extracted
// from the /design prototype when the Team page was built. See [[project-party-roster]].

type CharTab = 'equipped' | 'talents' | 'stats'

const MOCK_BLESSINGS = [
  { row: 1, unlocked: true,  slots: [{ name: 'Blade Mastery', pts: 3, max: 5 }, { name: 'Iron Skin', pts: 5, max: 5 }, { name: 'Battle Cry', pts: 0, max: 3 }] },
  { row: 2, unlocked: true,  slots: [{ name: 'Death Grip',    pts: 2, max: 5 }, { name: 'Dark Pact', pts: 1, max: 5 }, { name: 'Soul Drain', pts: 0, max: 3 }] },
  { row: 3, unlocked: false, slots: [{ name: 'Unholy Ground', pts: 0, max: 5 }, { name: 'Blood Boil', pts: 0, max: 5 }, { name: 'Bone Shield', pts: 0, max: 3 }] },
  { row: 4, unlocked: false, slots: [{ name: 'Army of Dead',  pts: 0, max: 3 }, { name: 'Lich Form',  pts: 0, max: 3 }, { name: 'Soul Storm',  pts: 0, max: 3 }] },
  { row: 5, unlocked: false, slots: [{ name: 'Death March',   pts: 0, max: 5 }, { name: 'Plague Aura', pts: 0, max: 5 }, { name: 'Death Pact', pts: 0, max: 5 }] },
  { row: 6, unlocked: false, slots: [{ name: 'Apocalypse',    pts: 0, max: 1 }, { name: 'Soul Reaper', pts: 0, max: 1 }, { name: 'Oblivion',   pts: 0, max: 1 }] },
]

type StatBreakdown = { label: string; base: number; items: number; blessings: number; upgrades: number }

export function CharacterCard({ name, charClass, level, xpCurrent, xpNeeded, role: roleProp, baseStats = [], growth = [], gear }: {
  name: string
  charClass: string
  level: number
  xpCurrent?: number
  xpNeeded?: number
  role?: CharacterRole // overrides the class-default role when authored (ADR-0008)
  baseStats?: StatValue[]
  growth?: StatGrowth[]
  gear?: ComponentProps<typeof GearSlotGrid> // recruited instance's gear; omitted = empty preview grid
}) {
  const [tab, setTab] = useState<CharTab>('equipped')
  const role = resolveRole(charClass, roleProp)
  const xpPct = xpCurrent != null && xpNeeded != null ? Math.round((xpCurrent / xpNeeded) * 100) : 0

  return (
    <div style={{
      display: 'flex',
      maxWidth: '760px',
      borderRadius: '8px',
      border: '3px solid var(--color-gold-mid)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
      boxShadow: [
        '0 0 0 1px #080101',
        'inset 0 1px 0 rgba(255,255,255,0.06)',
        'inset 0 2px 8px rgba(0,0,0,0.6)',
        '0 0 24px rgba(200,140,30,0.12)',
        '0 6px 20px rgba(0,0,0,0.8)',
      ].join(', '),
    }}>
      {/* ── Left: Portrait column ── */}
      <div style={{
        width: '180px',
        flexShrink: 0,
        borderRight: '2px solid var(--color-gold-dark)',
        background: 'linear-gradient(180deg, #150608 0%, #0f0305 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px 12px 16px',
        gap: '12px',
        boxShadow: 'inset -4px 0 12px rgba(0,0,0,0.5)',
      }}>
        {/* Portrait frame */}
        <div className="atom-heavy" style={{
          width: '156px',
          height: '220px',
          border: '3px solid var(--color-gold-mid)',
          borderRadius: '4px',
          background: 'linear-gradient(180deg, #1a0608 0%, #0d0304 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>Portrait</span>
        </div>

        {/* Name */}
        <div style={{ textAlign: 'center' }}>
          <p style={{
            color: 'var(--color-gold-light)',
            fontSize: '13px',
            fontWeight: 'bold',
            letterSpacing: '0.5px',
            textShadow: '0 0 8px rgba(240,208,96,0.4)',
            lineHeight: 1.3,
          }}>{name}</p>
        </div>

        {/* Identity line: class (who they are) + role (what they do) */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          <ClassBadge charClass={charClass} size="sm" />
          <RoleBadge role={role} size="sm" />
        </div>

        <LevelBadge level={level} />

        {/* XP bar — only when a player instance supplies xp (no instance yet = preview mode) */}
        {xpCurrent != null && xpNeeded != null && (
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>Experience</span>
              <span style={{ color: 'var(--color-text-primary)', fontSize: '10px', fontWeight: 'bold' }}>{xpCurrent} / {xpNeeded}</span>
            </div>
            <ProgressBar value={xpPct} label="" color="#7c2dbe" />
          </div>
        )}
      </div>

      {/* ── Right: Tabs column ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Tab nav */}
        <div style={{
          display: 'flex',
          borderBottom: '2px solid var(--color-gold-dark)',
          background: 'linear-gradient(180deg, #180608 0%, #110405 100%)',
        }}>
          {(['equipped', 'talents', 'stats'] as CharTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '11px 8px',
                fontFamily: 'Georgia, serif',
                fontSize: '11px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                border: 'none',
                borderBottom: tab === t ? '2px solid var(--color-gold-mid)' : '2px solid transparent',
                marginBottom: '-2px',
                background: tab === t
                  ? 'linear-gradient(180deg, #2a0f12 0%, #1e0a0c 100%)'
                  : 'transparent',
                color: tab === t ? 'var(--color-gold-light)' : 'var(--color-text-muted)',
                transition: 'color 0.15s, background 0.15s',
                textShadow: tab === t ? '0 0 8px rgba(240,208,96,0.4)' : 'none',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, padding: '16px' }}>
          {tab === 'equipped' && <GearSlotGrid {...(gear ?? { slots: {} })} />}
          {tab === 'talents'  && <TalentsTab />}
          {tab === 'stats'    && <StatsTab baseStats={baseStats} growth={growth} level={level} />}
        </div>
      </div>
    </div>
  )
}

function TalentsTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {MOCK_BLESSINGS.map(row => (
        <div key={row.row} style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '6px',
          opacity: row.unlocked ? 1 : 0.35,
        }}>
          {row.slots.map(slot => (
            <Tooltip
              key={slot.name}
              content={
                <div>
                  <p style={{ color: 'var(--color-gold-light)', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>{slot.name}</p>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginBottom: '8px' }}>
                    {row.unlocked ? `Rank ${slot.pts} / ${slot.max}` : 'Locked — spend 5 points in previous row'}
                  </p>
                  <p style={{ color: 'var(--color-text-primary)', fontSize: '12px', lineHeight: 1.5 }}>
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Virtus et gloria per arma crescit.
                  </p>
                </div>
              }
            >
              <div className="atom-heavy" style={{
                padding: '8px 10px',
                borderRadius: '4px',
                border: `2px solid ${row.unlocked ? 'var(--color-gold-dark)' : '#2a0d10'}`,
                background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
                cursor: row.unlocked ? 'pointer' : 'not-allowed',
              }}>
                <p style={{ color: 'var(--color-text-primary)', fontSize: '11px', marginBottom: '6px', letterSpacing: '0.3px' }}>{slot.name}</p>
                <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                  {Array.from({ length: slot.max }).map((_, i) => (
                    <div key={i} style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      border: '1px solid var(--color-gold-dark)',
                      background: i < slot.pts
                        ? 'radial-gradient(circle at 40% 35%, #f0d060, #7a4f10)'
                        : 'linear-gradient(180deg, #1a0608, #0d0304)',
                      boxShadow: i < slot.pts ? '0 0 4px rgba(200,140,30,0.6)' : 'none',
                    }} />
                  ))}
                  {slot.pts > 0 && (
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '9px', marginLeft: '3px' }}>{slot.pts}/{slot.max}</span>
                  )}
                </div>
              </div>
            </Tooltip>
          ))}
        </div>
      ))}
      {!MOCK_BLESSINGS[0].unlocked && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', textAlign: 'center', marginTop: '8px' }}>Spend 5 points in the previous row to unlock</p>
      )}
    </div>
  )
}

function StatBreakdownTooltip({ stat }: { stat: StatBreakdown }) {
  const total = stat.base + stat.items + stat.blessings + stat.upgrades
  const sources = [
    { label: 'Base',      value: stat.base,      color: 'var(--color-text-primary)' },
    { label: 'Items',     value: stat.items,      color: '#5b9bd5' },
    { label: 'Blessings', value: stat.blessings,  color: '#b06fd4' },
    { label: 'Upgrades',  value: stat.upgrades,   color: '#4caf6e' },
  ].filter(s => s.value > 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>{stat.label}</span>
        <span style={{ color: 'var(--color-gold-light)', fontSize: '22px', fontWeight: 'bold', textShadow: '0 0 10px rgba(240,208,96,0.5)' }}>{total}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {sources.map(s => (
          <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', letterSpacing: '0.5px' }}>{s.label}</span>
            <span style={{ color: s.color, fontSize: '13px', fontWeight: 'bold' }}>
              {s.label === 'Base' ? s.value : `+${s.value}`}
            </span>
          </div>
        ))}
      </div>
      {/* Divider + total row */}
      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--color-gold-dark)', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', letterSpacing: '0.5px' }}>Total</span>
        <span style={{ color: 'var(--color-text-gold)', fontSize: '13px', fontWeight: 'bold' }}>{total}</span>
      </div>
    </div>
  )
}

const STAT_CATEGORIES = ['offensive', 'defensive', 'support', 'misc'] as const

function StatsTab({ baseStats, growth, level }: { baseStats: StatValue[]; growth: StatGrowth[]; level: number }) {
  // Compute-on-read baselines from the authored def (src/lib/stats.ts). Items/Blessings/Upgrades are
  // 0 until gear + the player's blessing allocation exist (those arrive with the Supabase/instance step).
  const baselines = computeBaselines(level, baseStats, growth)
  const groups = STAT_CATEGORIES
    .map(category => ({
      category,
      stats: STAT_DEFS.filter(d => d.category === category && baselines[d.key] !== undefined),
    }))
    .filter(g => g.stats.length > 0)

  if (groups.length === 0) {
    return (
      <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
        No stats authored for this character.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {groups.map(({ category, stats }) => (
        <div key={category}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{category}</span>
            <GoldDivider />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {stats.map(d => {
              const value = baselines[d.key] ?? 0
              const breakdown: StatBreakdown = { label: d.label, base: value, items: 0, blessings: 0, upgrades: 0 }
              return (
                <Tooltip key={d.key} content={<StatBreakdownTooltip stat={breakdown} />}>
                  <StatPill label={d.label} value={value} />
                </Tooltip>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
