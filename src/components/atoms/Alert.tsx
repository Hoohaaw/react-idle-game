import type { ReactNode } from 'react'
import { IconSlot } from './IconSlot'

// icon: typographic mark, or null = IconSlot placeholder until real icons land (no emoji icons).
const ALERT_STYLES: Record<string, { border: string; bg: string; accent: string; glow: string; icon: string | null }> = {
  success: { border: '#4a8c3f', bg: 'rgba(74,140,63,0.18)',  accent: '#8ee59c', glow: 'rgba(74,140,63,0.3)',  icon: '✓' },
  error:   { border: '#d83232', bg: 'rgba(200,40,40,0.22)',  accent: '#ff9090', glow: 'rgba(200,40,40,0.4)',  icon: '✕' },
  warning: { border: '#c8962a', bg: 'rgba(200,150,42,0.18)', accent: '#f0d060', glow: 'rgba(200,150,42,0.3)', icon: null },
  info:    { border: '#3a86d8', bg: 'rgba(58,134,216,0.22)', accent: '#a8d2f5', glow: 'rgba(58,134,216,0.4)', icon: null },
}

export function Alert({ variant, children }: { variant: 'success' | 'error' | 'warning' | 'info'; children: ReactNode }) {
  const s = ALERT_STYLES[variant]
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderRadius: 5, maxWidth: 440,
      border: `2px solid ${s.border}`,
      background: s.bg,
      boxShadow: `0 0 0 1px #080101, inset 0 1px 0 rgba(255,255,255,0.05), 0 0 14px ${s.glow}`,
    }}>
      {s.icon
        ? <span style={{ color: s.accent, fontSize: 16, fontWeight: 'bold', textShadow: `0 0 8px ${s.glow}` }}>{s.icon}</span>
        : <IconSlot size={16} />}
      <span style={{ color: 'var(--color-text-primary)', fontSize: 13.5 }}>{children}</span>
    </div>
  )
}
