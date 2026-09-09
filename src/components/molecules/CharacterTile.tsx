import { RoleBadge } from '@/components/atoms/RoleBadge'
import { SchoolBadge } from '@/components/atoms/SchoolBadge'
import { TraitChips } from '@/components/molecules/TraitChips'
import { resolveRole, type CharacterRole } from '@/lib/roles'
import { traitActive, type TraitContext, type TraitDef } from '@/lib/traits'
import type { School } from '@/lib/schools'

// A selectable roster row for any party-picker (mission dispatch, dungeon/raid). Promoted from
// src/features/missions/components/dispatchParts.tsx once a second consumer (groupContent)
// appeared — CLAUDE.md's "needed by a second feature -> promote to the shared layer" rule.
export type CharacterTileChar = {
  id: string
  name: string
  charClass: string
  level: number
  role?: CharacterRole | null
  damageSchool?: School
  traits?: TraitDef[]
  busy?: string | null
  downed?: boolean
}

export function CharacterTile({ char, selected, disabled, onToggle, traitCtx }: {
  char: CharacterTileChar
  selected: boolean
  disabled?: boolean
  onToggle: () => void
  traitCtx: TraitContext
}) {
  const note = char.busy ?? (char.downed ? 'Downed' : null)
  const traits = char.traits ?? []
  const activeKeys = new Set(traits.filter((t) => traitActive(t, traitCtx)).map((t) => t.traitKey))
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'left', width: '100%',
        padding: '14px 16px', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'Georgia, serif',
        border: `2px solid ${selected ? 'var(--color-gold-mid)' : 'var(--color-gold-dark)'}`,
        background: selected ? 'linear-gradient(180deg, #34161a 0%, #1e0a0c 100%)' : 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
        opacity: disabled ? 0.45 : 1,
        boxShadow: selected
          ? '0 0 0 1px #080101, 0 0 14px rgba(200,140,30,0.35), inset 0 1px 0 rgba(255,255,255,0.07)'
          : '0 0 0 1px #080101, inset 0 1px 0 rgba(255,255,255,0.05)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      <div style={{
        width: 52, height: 64, flexShrink: 0, borderRadius: '4px',
        border: '2px solid var(--color-gold-dark)',
        background: 'linear-gradient(180deg, #1a0608 0%, #0d0304 100%)',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <p style={{ color: 'var(--color-text-primary)', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{char.name}</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
            {char.charClass} · Lv {char.level}{note ? ` · ${note}` : ''}
          </p>
        </div>
        <div style={{ marginTop: '7px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <RoleBadge role={resolveRole(char.charClass, char.role)} size="sm" />
          {char.damageSchool && <SchoolBadge school={char.damageSchool} size="sm" />}
        </div>
        {traits.length > 0 && (
          <div style={{ marginTop: '7px' }}>
            <TraitChips traits={traits} activeKeys={activeKeys} />
          </div>
        )}
      </div>
      <span style={{
        width: 20, height: 20, flexShrink: 0, borderRadius: '50%',
        border: `2px solid ${selected ? 'var(--color-gold-mid)' : 'var(--color-gold-dark)'}`,
        background: selected ? 'radial-gradient(circle at 40% 35%, #f0d060, #7a4f10)' : 'transparent',
        boxShadow: selected ? '0 0 6px rgba(200,140,30,0.6)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#1a0608', fontSize: '12px', fontWeight: 'bold',
      }}>{selected ? '✓' : ''}</span>
    </button>
  )
}
