import type { CapstoneDef } from '@/lib/blessings'
import { CAPSTONE_LEVEL } from '@/lib/blessings'
import { summarizeEffects } from '../lib'

const KIND_LABEL: Record<CapstoneDef['kind'], string> = {
  stat: 'Flat bonus',
  conditional: 'Conditional bonus',
  ability: 'Ability',
}

// The character's single capstone (ADR-0045) — earned, not chosen: granted once level 50 is
// reached and all 4 rows are picked. No pick UI here, only state display.
export function CapstoneCard({ capstone, earned }: { capstone?: CapstoneDef; earned: boolean }) {
  if (!capstone) {
    return (
      <div style={{ padding: '14px', borderRadius: '6px', border: '2px dashed var(--color-gold-dark)', opacity: 0.6 }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', fontStyle: 'italic' }}>
          No capstone authored yet for this character.
        </p>
      </div>
    )
  }

  return (
    <div
      className="atom-heavy"
      style={{
        padding: '14px 16px',
        borderRadius: '6px',
        border: `2px solid ${earned ? 'var(--color-gold-light)' : 'var(--color-gold-dark)'}`,
        background: earned
          ? 'linear-gradient(180deg, #3a2708 0%, #1d1304 100%)'
          : 'linear-gradient(180deg, #1c0a0c 0%, #110305 100%)',
        opacity: earned ? 1 : 0.6,
        boxShadow: earned
          ? '0 0 0 1px #080101, inset 0 1px 0 rgba(255,255,255,0.08), 0 0 14px rgba(240,208,96,0.4)'
          : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <p style={{ color: earned ? '#f5e080' : 'var(--color-text-primary)', fontSize: '14px', fontWeight: 'bold' }}>
          ★ {capstone.title}
        </p>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>
          {KIND_LABEL[capstone.kind]}
        </span>
      </div>
      {!earned && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginTop: '4px', fontStyle: 'italic' }}>
          Earned at level {CAPSTONE_LEVEL} once all 4 blessings are chosen.
        </p>
      )}
      {(capstone.effects?.length ?? 0) > 0 && (
        <p style={{ color: 'var(--color-gold-mid)', fontSize: '11px', marginTop: '6px' }}>
          {summarizeEffects(capstone.effects!)}
        </p>
      )}
      {capstone.description && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginTop: '6px', lineHeight: 1.4 }}>
          {capstone.description}
        </p>
      )}
    </div>
  )
}
