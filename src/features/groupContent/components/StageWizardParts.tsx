import { IconSlot } from '@/components/atoms/IconSlot'
import { RarityChancePill } from '@/components/molecules/RarityChancePill'
import type { GroupStageLootView } from '@/services/groupContent'

// Card/tile subcomponents for the real dungeon/raid stage wizard. Split out of StageWizard.tsx to
// keep that file under the ~200-line target — same split DesignDungeonWizardParts.tsx uses for the
// approved prototype this adapts (src/pages/DesignDungeonWizard.tsx), which is this component's
// visual/structural source of truth.

export function TrailDot({ kind, status }: { kind: 'trash' | 'boss'; status: 'cleared' | 'current' | 'locked' }) {
  const boss = kind === 'boss'
  return (
    <div style={{
      width: boss ? 22 : 16, height: boss ? 22 : 16, borderRadius: boss ? 5 : '50%', flexShrink: 0,
      border: `2px solid ${boss ? '#8a2e29' : 'var(--color-gold-mid)'}`,
      background: status === 'current'
        ? (boss ? '#c23c34' : 'var(--color-gold-light)')
        : status === 'cleared' ? (boss ? '#5c1f1c' : 'var(--color-gold-dark)') : 'transparent',
      boxShadow: status === 'current' ? '0 0 8px rgba(240,208,96,0.7)' : 'none',
      opacity: status === 'locked' ? 0.4 : 1,
    }} />
  )
}

export function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="atom-heavy" style={{
      flex: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10,
      padding: '12px 16px', borderRadius: 5,
      border: '2px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
    }}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ color: 'var(--color-text-gold)', fontSize: 18, fontWeight: 'bold', textShadow: '0 0 6px rgba(232,192,80,0.3)' }}>{value}</span>
    </div>
  )
}

export function LootCard({ item }: { item: GroupStageLootView }) {
  return (
    <div className="atom-heavy" style={{
      flex: '1 1 45%', minWidth: 260, display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', borderRadius: 5,
      border: '2px solid var(--color-gold-dark)', background: 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
    }}>
      <IconSlot size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7 }}>
          <span style={{ color: 'var(--color-text-primary)', fontSize: 13, flex: 1 }}>{item.name}</span>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase' }}>{item.slot}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {item.chances.map((c) => <RarityChancePill key={c.rarity} rarity={c.rarity} chance={c.chance} />)}
        </div>
      </div>
    </div>
  )
}
