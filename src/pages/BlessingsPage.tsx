import { useState, useRef, useCallback } from 'react'
import type { ReactNode, MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Avatar } from '../components/atoms/Avatar'
import { RoleBadge } from '../components/atoms/RoleBadge'
import { SecondaryButton } from '../components/atoms/Button'
import { resolveRole, type CharacterRole } from '../lib/roles'

// Blessings page — interactive mock (no backend yet, like Team / Crafting / Mines).
// Left: every owned character, selectable. Middle: that character's 7-row blessing
// tree. Rows hold a VARIABLE number of nodes (2–5). Row 7 is a single ULTIMATE node.
// WoW-Classic rules: 5 points in the tree above unlock the next tier; per-node
// prerequisite arrows; 1 point per level → level = total points. Respec clears all.
// The tree data is one shared mock for now — per-character trees arrive with the
// backend; identity (name / role / level / point pool) is already per-character.

type Member = { id: string; name: string; charClass: string; level: number; role?: CharacterRole }

const PARTY: Member[] = [
  { id: 'c1', name: 'Lyra Swift',          charClass: 'Rogue',        level: 12 },
  { id: 'c2', name: 'Tyra Oakheart',       charClass: 'Forester',     level: 9 },
  // Demo of ADR-0008: a Death Knight (tank by class) authored as a Damage dealer.
  { id: 'c3', name: 'Alexandros Mograine', charClass: 'Death Knight', level: 24, role: 'damage' },
  { id: 'c4', name: 'Sally Whitemane',     charClass: 'Priest',       level: 15 },
  { id: 'c5', name: 'Fandral Staghelm',    charClass: 'Druid',        level: 9 },
  { id: 'c6', name: 'Bron Stormhammer',    charClass: 'Miner',        level: 18 },
]

// ── Tree definition (shared mock) ──────────────────────────────────────────
type TreeNode = { id: string; row: number; col: number; name: string; max: number; desc: string; ultimate?: boolean }

const NODES: TreeNode[] = [
  // Row 1 (3 across)
  { id: 'r1c2', row: 1, col: 2, name: 'Toughened Hide', max: 5, desc: 'Increases maximum health.' },
  { id: 'r1c3', row: 1, col: 3, name: 'Keen Edge',      max: 5, desc: 'Increases attack power.' },
  { id: 'r1c4', row: 1, col: 4, name: 'Swift Step',     max: 3, desc: 'Increases agility.' },
  // Row 2 (5 across)
  { id: 'r2c1', row: 2, col: 1, name: 'Bulwark',        max: 5, desc: 'Increases armor.' },
  { id: 'r2c2', row: 2, col: 2, name: 'Bloodlust',      max: 5, desc: 'Increases strength.' },
  { id: 'r2c3', row: 2, col: 3, name: 'Focus',          max: 3, desc: 'Increases critical chance.' },
  { id: 'r2c4', row: 2, col: 4, name: 'Riposte',        max: 5, desc: 'Chance to counter on block.' },
  { id: 'r2c5', row: 2, col: 5, name: 'Vigor',          max: 5, desc: 'Increases health regeneration.' },
  // Row 3 (2 across)
  { id: 'r3c2', row: 3, col: 2, name: 'Iron Will',      max: 3, desc: 'Reduces damage taken.' },
  { id: 'r3c4', row: 3, col: 4, name: 'Battle Trance',  max: 3, desc: 'Increases damage dealt below 30% health.' },
  // Row 4 (4 across)
  { id: 'r4c1', row: 4, col: 1, name: 'Stoneskin',      max: 5, desc: 'Increases all resistances.' },
  { id: 'r4c2', row: 4, col: 2, name: 'Rampage',        max: 3, desc: 'Each kill increases attack speed.' },
  { id: 'r4c4', row: 4, col: 4, name: 'Counterstrike',  max: 3, desc: 'Reflects a portion of melee damage.' },
  { id: 'r4c5', row: 4, col: 5, name: 'Second Wind',    max: 5, desc: 'Heal when struck below 50% health.' },
  // Row 5 (3 across)
  { id: 'r5c2', row: 5, col: 2, name: 'Unbreakable',       max: 3, desc: 'Greatly increases armor for 10s.' },
  { id: 'r5c3', row: 5, col: 3, name: "Warlord's Command", max: 2, desc: 'Buffs the whole party on mission start.' },
  { id: 'r5c4', row: 5, col: 4, name: 'Adrenaline',        max: 3, desc: 'Increases all damage at low health.' },
  // Row 6 (2 across)
  { id: 'r6c2', row: 6, col: 2, name: 'Last Stand',     max: 3, desc: 'Survive a fatal blow once per mission.' },
  { id: 'r6c4', row: 6, col: 4, name: 'Executioner',    max: 3, desc: 'Massive bonus damage to low-health foes.' },
  // Row 7 (1 — ultimate)
  { id: 'ult', row: 7, col: 3, name: 'Avatar of War', max: 1, ultimate: true, desc: 'Become an unstoppable avatar — immune to control and greatly empowered for the fight.' },
]

const NODE_BY_ID: Record<string, TreeNode> = Object.fromEntries(NODES.map(n => [n.id, n]))

// parent → child prerequisite links
const EDGES: ReadonlyArray<readonly [string, string]> = [
  ['r1c2', 'r2c1'], ['r1c2', 'r2c2'], ['r1c3', 'r2c3'], ['r1c4', 'r2c4'], ['r1c4', 'r2c5'],
  ['r2c2', 'r3c2'], ['r2c3', 'r3c2'], ['r2c3', 'r3c4'], ['r2c4', 'r3c4'],
  ['r3c2', 'r4c1'], ['r3c2', 'r4c2'], ['r3c4', 'r4c4'], ['r3c4', 'r4c5'],
  ['r4c2', 'r5c2'], ['r4c2', 'r5c3'], ['r4c4', 'r5c3'], ['r4c4', 'r5c4'],
  ['r5c2', 'r6c2'], ['r5c3', 'r6c2'], ['r5c3', 'r6c4'], ['r5c4', 'r6c4'],
  ['r6c2', 'ult'], ['r6c4', 'ult'],
]

const ROWS = 7
const COL_W = 128
const COL_GAP = 18
const NODE_H = 58
const ROW_GAP = 50
const GUTTER = 42 // left room for tier numerals + unlock progress
const ULT_W = 210
const ROW_PITCH = NODE_H + ROW_GAP
const INNER_W = 5 * COL_W + 4 * COL_GAP
const BOARD_W = GUTTER + INNER_W
const BOARD_H = ROWS * NODE_H + (ROWS - 1) * ROW_GAP

const centerX = (col: number) => GUTTER + (col - 1) * (COL_W + COL_GAP) + COL_W / 2
const topY = (row: number) => (row - 1) * ROW_PITCH

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

export default function BlessingsPage() {
  const [selectedId, setSelectedId] = useState<string>('c3')
  // points allocation, per character: { charId: { nodeId: rank } }
  const [alloc, setAlloc] = useState<Record<string, Record<string, number>>>({})

  const selected = PARTY.find(m => m.id === selectedId) ?? PARTY[0]
  const points = alloc[selected.id] ?? {}

  const pts = (id: string) => points[id] ?? 0
  const totalSpent = NODES.reduce((sum, n) => sum + pts(n.id), 0)
  const available = Math.max(0, selected.level - totalSpent)
  const spentAboveRow = (row: number) =>
    NODES.filter(n => n.row < row).reduce((sum, n) => sum + pts(n.id), 0)
  const rowUnlocked = (row: number) => row === 1 || spentAboveRow(row) >= 5 * (row - 1)
  const parentsOf = (id: string) => EDGES.filter(e => e[1] === id).map(e => e[0])
  const prereqMet = (n: TreeNode) => {
    if (!rowUnlocked(n.row)) return false
    const parents = parentsOf(n.id)
    return parents.length === 0 || parents.every(p => pts(p) > 0)
  }
  const canSpend = (n: TreeNode) => prereqMet(n) && pts(n.id) < n.max && available > 0

  const spend = (n: TreeNode) => {
    if (!canSpend(n)) return
    setAlloc(prev => {
      const cur = prev[selected.id] ?? {}
      return { ...prev, [selected.id]: { ...cur, [n.id]: (cur[n.id] ?? 0) + 1 } }
    })
  }
  const respec = () => setAlloc(prev => ({ ...prev, [selected.id]: {} }))

  return (
    <div>
      <PageHeader />
      <div style={{ display: 'flex', gap: '18px', alignItems: 'flex-start' }}>
        {/* ── Left: character rail ── */}
        <div style={{ width: '236px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <RailTitle>Characters</RailTitle>
          {PARTY.map(m => (
            <CharacterRow key={m.id} member={m} selected={m.id === selectedId} onSelect={() => setSelectedId(m.id)} />
          ))}
        </div>

        {/* ── Middle: tree ── */}
        <div style={{
          flex: 1,
          minWidth: 0,
          borderRadius: '8px',
          border: '2px solid var(--color-gold-mid)',
          background: 'linear-gradient(180deg, #1c080a 0%, #110305 100%)',
          boxShadow: [
            '0 0 0 1px #080101',
            'inset 0 1px 0 rgba(255,255,255,0.05)',
            'inset 0 2px 10px rgba(0,0,0,0.55)',
            '0 6px 18px rgba(0,0,0,0.7)',
          ].join(', '),
        }}>
          <TreeHeader selected={selected} available={available} spent={totalSpent} onRespec={respec} />
          <div style={{ padding: '24px 20px 30px', overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: BOARD_W, height: BOARD_H, flexShrink: 0 }}>
              {/* connector layer */}
              <svg width={BOARD_W} height={BOARD_H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
                <defs>
                  <marker id="arw-on" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-gold-mid)" />
                  </marker>
                  <marker id="arw-off" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="#3a1a1f" />
                  </marker>
                </defs>
                {EDGES.map(([from, to]) => {
                  const p = NODE_BY_ID[from], c = NODE_BY_ID[to]
                  const on = pts(from) > 0
                  return (
                    <line
                      key={`${from}-${to}`}
                      x1={centerX(p.col)} y1={topY(p.row) + NODE_H}
                      x2={centerX(c.col)} y2={topY(c.row)}
                      stroke={on ? 'var(--color-gold-mid)' : '#3a1a1f'}
                      strokeWidth={2}
                      markerEnd={`url(#${on ? 'arw-on' : 'arw-off'})`}
                      style={on ? { filter: 'drop-shadow(0 0 3px rgba(200,140,30,0.5))' } : undefined}
                    />
                  )
                })}
              </svg>

              {/* tier numerals + unlock progress (total points spent above / points needed) */}
              {Array.from({ length: ROWS }).map((_, i) => {
                const row = i + 1
                const unlocked = rowUnlocked(row)
                const need = 5 * (row - 1)
                const have = spentAboveRow(row)
                return (
                  <div key={row} style={{
                    position: 'absolute', left: 0, top: topY(row), width: GUTTER - 8, height: NODE_H,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
                    color: unlocked ? 'var(--color-gold-mid)' : 'var(--color-text-muted)',
                  }}>
                    <span style={{ fontSize: '13px', letterSpacing: '0.5px', opacity: unlocked ? 0.9 : 0.5, textShadow: unlocked ? '0 0 6px rgba(200,140,30,0.4)' : 'none' }}>{ROMAN[i]}</span>
                    {!unlocked && (
                      <>
                        <span style={{ fontSize: '9px', whiteSpace: 'nowrap' }}>{have}/{need}</span>
                      </>
                    )}
                  </div>
                )
              })}

              {/* nodes */}
              {NODES.map(n => {
                const w = n.ultimate ? ULT_W : COL_W
                return (
                  <div key={n.id} style={{ position: 'absolute', left: centerX(n.col) - w / 2, top: topY(n.row), width: w, height: NODE_H }}>
                    <NodeTile
                      node={n}
                      rank={pts(n.id)}
                      rowUnlocked={rowUnlocked(n.row)}
                      spendable={canSpend(n)}
                      tierHave={spentAboveRow(n.row)}
                      tierNeed={5 * (n.row - 1)}
                      onSpend={() => spend(n)}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page + rail chrome ─────────────────────────────────────────────────────
function PageHeader() {
  return (
    <div style={{ marginBottom: '18px' }}>
      <h1 style={{ color: 'var(--color-gold-light)', fontSize: '22px', letterSpacing: '1px', textShadow: '0 0 12px rgba(240,208,96,0.35)' }}>Blessings</h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginTop: '4px' }}>
        Spend a blessing point each level. A tier unlocks on the <em>total</em> points spent above it (5 per tier) — overflow counts, so you never have to fill a tier to move on. Arrows show node prerequisites.
      </p>
    </div>
  )
}

function RailTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      color: 'var(--color-gold-mid)', fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase',
      marginBottom: '4px', paddingBottom: '6px', borderBottom: '1px solid var(--color-gold-dark)',
    }}>{children}</h2>
  )
}

function CharacterRow({ member, selected, onSelect }: { member: Member; selected: boolean; onSelect: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '11px', width: '100%', textAlign: 'left',
        padding: '10px 12px', borderRadius: '6px', cursor: 'pointer',
        border: `2px solid ${selected ? 'var(--color-gold-light)' : hover ? 'var(--color-gold-mid)' : 'var(--color-gold-dark)'}`,
        background: selected ? 'linear-gradient(180deg, #2a0f12 0%, #1c0709 100%)' : 'linear-gradient(180deg, #18070a 0%, #100305 100%)',
        boxShadow: selected ? '0 0 0 1px #080101, 0 0 14px rgba(240,208,96,0.25), inset 0 1px 0 rgba(255,255,255,0.06)' : '0 0 0 1px #080101, inset 0 1px 0 rgba(255,255,255,0.04)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      <Avatar size={42} level={member.level} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ color: selected ? 'var(--color-gold-light)' : 'var(--color-text-primary)', fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.name}</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', margin: '2px 0 5px' }}>{member.charClass}</p>
        <RoleBadge role={resolveRole(member.charClass, member.role)} size="sm" />
      </div>
    </button>
  )
}

function TreeHeader({ selected, available, spent, onRespec }: { selected: Member; available: number; spent: number; onRespec: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
      padding: '14px 20px', borderBottom: '2px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, #20090c 0%, #160508 100%)', borderRadius: '7px 7px 0 0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ color: 'var(--color-gold-light)', fontSize: '17px', fontWeight: 'bold', textShadow: '0 0 8px rgba(240,208,96,0.35)' }}>{selected.name}</span>
        <RoleBadge role={resolveRole(selected.charClass, selected.role)} size="sm" />
        <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>Level {selected.level}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Points</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ color: 'var(--color-gold-light)', fontSize: '22px', fontWeight: 'bold', textShadow: '0 0 10px rgba(240,208,96,0.45)' }}>{available}</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>available · {spent} spent</span>
          </div>
        </div>
        <SecondaryButton onClick={onRespec}>Respec</SecondaryButton>
      </div>
    </div>
  )
}

// ── Node tile ──────────────────────────────────────────────────────────────
function NodeTile({ node, rank, rowUnlocked, spendable, tierHave, tierNeed, onSpend }: {
  node: TreeNode; rank: number; rowUnlocked: boolean; spendable: boolean; tierHave: number; tierNeed: number; onSpend: () => void
}) {
  const maxed = rank === node.max
  const hasPoints = rank > 0
  const locked = !rowUnlocked

  const borderColor = locked ? '#2a0d10'
    : maxed ? 'var(--color-gold-light)'
    : hasPoints ? 'var(--color-gold-mid)'
    : spendable ? 'var(--color-gold-mid)'
    : 'var(--color-gold-dark)'

  const cursor = spendable ? 'pointer' : locked ? 'not-allowed' : 'default'

  const tipState = locked ? `Locked — needs ${tierNeed} total points spent in the tiers above (${tierHave}/${tierNeed})`
    : maxed ? 'Maxed'
    : !spendable ? 'Locked — requires the linked blessing above'
    : 'Click to learn'

  return (
    <NodeTooltip
      content={
        <div>
          <p style={{ color: node.ultimate ? '#f0d060' : 'var(--color-gold-light)', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>
            {node.ultimate && '★ '}{node.name}
          </p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginBottom: '8px' }}>Rank {rank} / {node.max} — {tipState}</p>
          <p style={{ color: 'var(--color-text-primary)', fontSize: '12px', lineHeight: 1.5 }}>{node.desc}</p>
        </div>
      }
    >
      <div
        onClick={onSpend}
        className="atom-heavy"
        style={{
          height: NODE_H, boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '5px',
          padding: '6px 10px', borderRadius: '5px',
          border: `2px solid ${borderColor}`,
          background: node.ultimate
            ? 'linear-gradient(180deg, #3a2708 0%, #1d1304 100%)'
            : 'linear-gradient(180deg, #1c0a0c 0%, #110305 100%)',
          opacity: locked ? 0.4 : !spendable && !hasPoints && !maxed ? 0.72 : 1,
          cursor,
          boxShadow: (maxed || (node.ultimate && hasPoints))
            ? '0 0 0 1px #080101, inset 0 1px 0 rgba(255,255,255,0.08), 0 0 14px rgba(240,208,96,0.4)'
            : undefined,
          transition: 'border-color 0.12s, box-shadow 0.12s, opacity 0.12s',
        }}
      >
        <p style={{
          color: node.ultimate ? '#f5e080' : maxed ? 'var(--color-gold-light)' : 'var(--color-text-primary)',
          fontSize: node.ultimate ? '13px' : '11px', fontWeight: node.ultimate ? 'bold' : 'normal',
          letterSpacing: '0.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          textAlign: node.ultimate ? 'center' : 'left',
          textShadow: node.ultimate ? '0 0 8px rgba(240,208,96,0.5)' : 'none',
        }}>
          {node.ultimate && '★ '}{node.name}
        </p>
        <PipRow rank={rank} max={node.max} center={node.ultimate} />
      </div>
    </NodeTooltip>
  )
}

// Portal-based hover tooltip — rendered to document.body so the tree's scroll
// container (overflow:auto) can never clip it. Cursor-following + pointer-events:none,
// matching the ItemTooltip pattern. (The plain CSS Tooltip atom is fine in non-scrolling
// contexts like the character sheet, but gets clipped inside scroll containers.)
function NodeTooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const move = useCallback((e: MouseEvent) => {
    const pad = 16
    const w = ref.current?.offsetWidth ?? 220
    const h = ref.current?.offsetHeight ?? 120
    let x = e.clientX + pad
    let y = e.clientY + pad
    if (x + w > window.innerWidth) x = e.clientX - w - pad
    if (y + h > window.innerHeight) y = Math.max(pad, window.innerHeight - h - pad)
    setPos({ x, y })
  }, [])

  return (
    <div onMouseEnter={move} onMouseMove={move} onMouseLeave={() => setPos(null)} style={{ display: 'contents' }}>
      {children}
      {pos && createPortal(
        <div ref={ref} style={{
          position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999, pointerEvents: 'none',
          width: 220, padding: '12px 14px', borderRadius: '5px', fontFamily: 'Georgia, serif',
          border: '2px solid var(--color-gold-mid)',
          background: 'linear-gradient(180deg, #2a0f12 0%, #120407 100%)',
          boxShadow: [
            '0 0 0 1px #080101',
            'inset 0 1px 0 rgba(255,255,255,0.07)',
            '0 0 20px rgba(200,140,30,0.2)',
            '0 8px 24px rgba(0,0,0,0.8)',
          ].join(', '),
        }}>
          {content}
        </div>,
        document.body,
      )}
    </div>
  )
}

function PipRow({ rank, max, center }: { rank: number; max: number; center?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: center ? 'center' : 'flex-start' }}>
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} style={{
          width: '9px', height: '9px', borderRadius: '50%', border: '1px solid var(--color-gold-dark)',
          background: i < rank ? 'radial-gradient(circle at 40% 35%, #f0d060, #7a4f10)' : 'linear-gradient(180deg, #1a0608, #0d0304)',
          boxShadow: i < rank ? '0 0 4px rgba(200,140,30,0.6)' : 'none',
        }} />
      ))}
      <span style={{ color: 'var(--color-text-muted)', fontSize: '9px', marginLeft: '3px' }}>{rank}/{max}</span>
    </div>
  )
}
