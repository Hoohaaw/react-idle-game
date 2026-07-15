import { Link } from 'react-router-dom'
import { BLESSING_ROWS, BLESSING_ROW_LEVELS, CAPSTONE_LEVEL, type BlessingPicks, type CapstoneDef } from '../../lib/blessings'
import type { CharacterBlessingRow } from '../../services/characters'

// Read-only summary of a character's blessing picks (ADR-0045) — the character sheet shows WHAT
// was chosen, not the picker itself. The actual choice UI (pick one of two, permanent) lives on
// the dedicated /blessings page, so it isn't duplicated here.
export function TalentsTab({
  level,
  blessingTree,
  blessings,
  capstone,
  capstoneEarned,
}: {
  level: number
  blessingTree: CharacterBlessingRow[]
  blessings: BlessingPicks
  capstone?: CapstoneDef
  capstoneEarned: boolean
}) {
  const rowByNumber = new Map(blessingTree.map((r) => [r.row, r]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {BLESSING_ROWS.map((row) => {
        const rowDef = rowByNumber.get(row)
        const pickedId = blessings[`row${row}`]
        const picked = rowDef?.choices.find((c) => c.choiceId === pickedId)
        const locked = level < BLESSING_ROW_LEVELS[row]
        return (
          <div key={row} className="atom-heavy" style={{
            padding: '8px 12px',
            borderRadius: '4px',
            border: `2px solid ${picked ? 'var(--color-gold-mid)' : 'var(--color-gold-dark)'}`,
            background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
            opacity: locked ? 0.4 : 1,
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px',
          }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Row {row}
            </span>
            <span style={{ color: picked ? 'var(--color-gold-light)' : 'var(--color-text-muted)', fontSize: '12px', fontStyle: picked ? 'normal' : 'italic' }}>
              {picked ? picked.title : locked ? `Unlocks at level ${BLESSING_ROW_LEVELS[row]}` : 'Not chosen yet'}
            </span>
          </div>
        )
      })}

      <div className="atom-heavy" style={{
        padding: '8px 12px',
        borderRadius: '4px',
        border: `2px solid ${capstoneEarned ? 'var(--color-gold-light)' : 'var(--color-gold-dark)'}`,
        background: capstoneEarned ? 'linear-gradient(180deg, #3a2708 0%, #1d1304 100%)' : 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
        opacity: capstoneEarned ? 1 : 0.4,
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px',
      }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>Capstone</span>
        <span style={{ color: capstoneEarned ? '#f5e080' : 'var(--color-text-muted)', fontSize: '12px', fontStyle: capstoneEarned ? 'normal' : 'italic' }}>
          {capstoneEarned && capstone ? `★ ${capstone.title}` : `Earned at level ${CAPSTONE_LEVEL}`}
        </span>
      </div>

      <Link to="/blessings" style={{
        marginTop: '4px', textAlign: 'center', color: 'var(--color-gold-mid)', fontSize: '11px',
        letterSpacing: '0.5px', textDecoration: 'underline',
      }}>
        Manage blessings →
      </Link>
    </div>
  )
}
