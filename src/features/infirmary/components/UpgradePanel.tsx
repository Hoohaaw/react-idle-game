import { INFIRMARY, UPGRADE_COSTS, bedsForLevel, regenPerSec } from '@/lib/infirmary'
import type { PlayerProfile } from '@/services/profile'
import { PrimaryButton } from '@/components/atoms/Button'

// Current → next level comparison + the upgrade cost with per-entry affordability.
// Costs are the PROVISIONAL table in src/lib/infirmary.ts (retuned with the gather economy).

function CostLine({ label, need, have }: { label: string; need: number; have: number }) {
  const ok = have >= need
  return (
    <span style={{ color: ok ? '#5fc77e' : '#e0635c', fontSize: 12, marginRight: 14, fontVariantNumeric: 'tabular-nums' }}>
      {need.toLocaleString()} {label}
      <span style={{ opacity: 0.7 }}> (have {Math.floor(have).toLocaleString()})</span>
    </span>
  )
}

export function UpgradePanel({ level, profile, onUpgrade, upgrading }: {
  level: number
  profile: PlayerProfile | undefined
  onUpgrade: () => void
  upgrading: boolean
}) {
  if (level >= INFIRMARY.MAX_LEVEL) {
    return (
      <p style={{ color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic' }}>
        The infirmary is at max level ({INFIRMARY.MAX_LEVEL}).
      </p>
    )
  }

  const next = level + 1
  const cost = UPGRADE_COSTS[next]
  const currencies = profile?.currencies ?? {}
  const resources = profile?.resources ?? {}
  const affordable =
    Object.entries(cost.currencies).every(([k, v]) => (currencies[k] ?? 0) >= v) &&
    Object.entries(cost.resources).every(([k, v]) => (resources[k] ?? 0) >= v)

  return (
    <div className="atom-heavy" style={{
      maxWidth: 520, padding: 16, borderRadius: 8, border: '3px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, #1e0a0c 0%, #130406 100%)',
    }}>
      <p style={{ color: 'var(--color-gold-light)', fontSize: 13, fontWeight: 'bold' }}>
        Upgrade to level {next}
      </p>
      <p style={{ color: 'var(--color-text-primary)', fontSize: 12, marginTop: 8 }}>
        Beds {bedsForLevel(level)} → <b>{bedsForLevel(next)}</b>
        {' · '}Regen {regenPerSec(level)} → <b>{regenPerSec(next)}</b> HP/s per bed
        {' · '}Stabilize time ÷{next} <span style={{ color: 'var(--color-text-muted)' }}>(was ÷{level})</span>
      </p>
      <div style={{ marginTop: 10 }}>
        {Object.entries(cost.currencies).map(([k, v]) => (
          <CostLine key={k} label={k === 'gold' ? 'Gold' : k} need={v} have={currencies[k] ?? 0} />
        ))}
        {Object.entries(cost.resources).map(([k, v]) => (
          <CostLine key={k} label={k} need={v} have={resources[k] ?? 0} />
        ))}
      </div>
      <div style={{ marginTop: 12, maxWidth: 240 }}>
        <PrimaryButton fullWidth disabled={!affordable || upgrading} onClick={onUpgrade}>
          {upgrading ? 'Upgrading…' : affordable ? `Upgrade to level ${next}` : 'Not enough resources'}
        </PrimaryButton>
      </div>
    </div>
  )
}
