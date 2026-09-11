// src/features/reset/PrestigePage.tsx
import { SegmentedControl } from '@/components/atoms/SegmentedControl'
import { ResetTab } from './components/ResetTab'

// The prestige hub: one shell, one tab per tier (ADR-0053). Today only "Reset" exists — the
// future Transcendence tier adds a second tab here, revealed once unlocked, rather than a new
// page (docs/superpowers/specs/2026-09-11-reset-echoes-design.md §6/§9).
const TABS = ['Reset']

export default function PrestigePage() {
  return (
    <div>
      <h1 style={{ color: 'var(--color-gold-light)', fontSize: '22px', letterSpacing: '1px', textShadow: '0 0 12px rgba(240,208,96,0.35)', marginBottom: 14 }}>
        Prestige
      </h1>
      <SegmentedControl options={TABS} />
      <div style={{ marginTop: 20 }}>
        <ResetTab />
      </div>
    </div>
  )
}
