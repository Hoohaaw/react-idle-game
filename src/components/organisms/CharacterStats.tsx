import { StatPill } from '../atoms/StatPill'
import { GoldDivider } from '../atoms/GoldDivider'
import { Tooltip } from '../atoms/Tooltip'
import { computeBaselines, type StatValue, type StatGrowth, type StatSourceBreakdown } from '../../lib/stats'
import { STAT_DEFS } from '../../lib/statDefinitions'
import { SPAN_STATS, powerSpan } from '../../lib/powerSpan'

// The character sheet's Stats tab (extracted from CharacterCard). Two modes:
//  - recruited instance: `breakdown` = effectiveStatBreakdown() → real totals with the per-source
//    (Base / Items / Blessings) trail in the tooltip — the same engine numbers the sim uses.
//  - preview (no instance): def baselines only, sources beyond Base show 0.
// Upgrades stay 0 until that system exists.

type StatRow = { label: string; base: number; items: number; blessings: number; upgrades: number; span?: string }

// Whole numbers render bare; anything fractional (pct bonuses) keeps one decimal.
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

function StatBreakdownTooltip({ stat }: { stat: StatRow }) {
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
        <span style={{ color: 'var(--color-gold-light)', fontSize: '22px', fontWeight: 'bold', textShadow: '0 0 10px rgba(240,208,96,0.5)' }}>{fmt(total)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {sources.map(s => (
          <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', letterSpacing: '0.5px' }}>{s.label}</span>
            <span style={{ color: s.color, fontSize: '13px', fontWeight: 'bold' }}>
              {s.label === 'Base' ? fmt(s.value) : `+${fmt(s.value)}`}
            </span>
          </div>
        ))}
      </div>
      {/* Divider + total row */}
      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--color-gold-dark)', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', letterSpacing: '0.5px' }}>Total</span>
        <span style={{ color: 'var(--color-text-gold)', fontSize: '13px', fontWeight: 'bold' }}>{fmt(total)}</span>
      </div>
      {stat.span && (
        <div style={{ marginTop: '6px', color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '0.5px' }}>
          Rolls {stat.span} each fight
        </div>
      )}
    </div>
  )
}

const STAT_CATEGORIES = ['offensive', 'defensive', 'support', 'misc'] as const

export function CharacterStats({ baseStats, growth, level, breakdown }: {
  baseStats: StatValue[]
  growth: StatGrowth[]
  level: number
  breakdown?: Record<string, StatSourceBreakdown>
}) {
  // Preview fallback: def baselines with no bonus sources (ADR-0002 compute-on-read either way).
  const rows: Record<string, StatSourceBreakdown> =
    breakdown ??
    Object.fromEntries(
      Object.entries(computeBaselines(level, baseStats, growth)).map(([k, v]) => [
        k, { base: v, items: 0, blessings: 0, total: v },
      ]),
    )

  const groups = STAT_CATEGORIES
    .map(category => ({
      category,
      stats: STAT_DEFS.filter(d => d.category === category && rows[d.key] !== undefined),
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
              const r = rows[d.key]
              // Attack-type stats are a per-fight SPAN (ADR-0038) — pill shows the range.
              const span = SPAN_STATS.has(d.key) ? powerSpan(r.total) : undefined
              const row: StatRow = { label: d.label, base: r.base, items: r.items, blessings: r.blessings, upgrades: 0, span }
              return (
                <Tooltip key={d.key} content={<StatBreakdownTooltip stat={row} />}>
                  <StatPill label={d.label} value={span ?? Math.round(r.total)} />
                </Tooltip>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
