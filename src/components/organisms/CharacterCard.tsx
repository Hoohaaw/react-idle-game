import { useState, type ComponentProps } from 'react'
import { LevelBadge } from '../atoms/LevelBadge'
import { ProgressBar } from '../atoms/ProgressBar'
import { RoleBadge } from '../atoms/RoleBadge'
import { ClassBadge } from '../atoms/ClassBadge'
import { GearSlotGrid } from './GearSlotGrid'
import { CharacterStats } from './CharacterStats'
import { TalentsTab } from './TalentsTab'
import { SchoolBadge } from '../atoms/SchoolBadge'
import { TraitChips } from '../molecules/TraitChips'
import { resolveRole, type CharacterRole } from '../../lib/roles'
import type { School } from '../../lib/schools'
import type { TraitDef } from '../../lib/traits'
import type { StatValue, StatGrowth, StatSourceBreakdown } from '../../lib/stats'
import type { BlessingPicks, CapstoneDef } from '../../lib/blessings'
import type { CharacterBlessingRow } from '../../services/characters'

// The full character sheet: portrait + identity + XP on the left, and Equipped /
// Talents / Stats tabs on the right. Identity + XP + gear + stats are per-character
// (props; the Equipped tab renders real gear and the Stats tab a real per-source
// breakdown when a recruited instance supplies them — ADR-0022). Talents shows a
// read-only summary of the character's blessing picks (ADR-0045) — the actual pick
// UI lives on the dedicated /blessings page, not duplicated here. Extracted from the
// /design prototype when the Team page was built. See [[project-party-roster]].

type CharTab = 'equipped' | 'talents' | 'stats'

export function CharacterCard({
  name, charClass, level, xpCurrent, xpNeeded, role: roleProp, damageSchool,
  traits = [], baseStats = [], growth = [], gear, statBreakdown,
  blessingTree = [], blessings = {}, capstone, capstoneEarned = false,
}: {
  name: string
  charClass: string
  level: number
  xpCurrent?: number
  xpNeeded?: number
  role?: CharacterRole // overrides the class-default role when authored (ADR-0008)
  damageSchool?: School // the caster's magic school, when authored (ADR-0033)
  traits?: TraitDef[] // innate identity traits (ADR-0035)
  baseStats?: StatValue[]
  growth?: StatGrowth[]
  gear?: ComponentProps<typeof GearSlotGrid> // recruited instance's gear; omitted = empty preview grid
  statBreakdown?: Record<string, StatSourceBreakdown> // recruited instance's effective stats by source; omitted = def baselines (preview)
  blessingTree?: CharacterBlessingRow[] // authored rows (ADR-0045); omitted = preview (nothing authored yet)
  blessings?: BlessingPicks // recruited instance's picks; omitted = nothing picked yet
  capstone?: CapstoneDef
  capstoneEarned?: boolean
}) {
  const [tab, setTab] = useState<CharTab>('equipped')
  const role = resolveRole(charClass, roleProp)
  const xpPct = xpCurrent != null && xpNeeded != null ? Math.round((xpCurrent / xpNeeded) * 100) : 0

  return (
    <div style={{
      display: 'flex',
      width: '760px',
      maxWidth: '100%',
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

        {/* Identity line: class (who they are) + role (what they do) + school (how they hit) */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          <ClassBadge charClass={charClass} size="sm" />
          <RoleBadge role={role} size="sm" />
          {damageSchool && <SchoolBadge school={damageSchool} size="sm" />}
        </div>

        {/* Innate traits (ADR-0035) — hover for what each does */}
        {traits.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <TraitChips traits={traits} />
          </div>
        )}

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

        {/* Tab content — fixed height so switching tabs never resizes the card; taller
            content (e.g. many authored stats) scrolls instead. Tooltips portal to <body>,
            so the scroll container can't clip them. */}
        <div style={{ padding: '16px', height: '460px', overflowY: 'auto' }}>
          {tab === 'equipped' && <GearSlotGrid {...(gear ?? { slots: {} })} />}
          {tab === 'talents'  && (
            <TalentsTab
              level={level}
              blessingTree={blessingTree}
              blessings={blessings}
              capstone={capstone}
              capstoneEarned={capstoneEarned}
            />
          )}
          {tab === 'stats'    && <CharacterStats baseStats={baseStats} growth={growth} level={level} breakdown={statBreakdown} />}
        </div>
      </div>
    </div>
  )
}

