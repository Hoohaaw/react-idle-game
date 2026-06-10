import type { CSSProperties } from 'react'

// Muted per-resource accent colors (RGB triples) — keyed off the material so each
// gathering card carries a subtle identity. Applied only as a header color wash +
// accent line (body stays neutral) so it never overpowers the dark-red/gold theme.
export const RESOURCE_COLOR: Record<string, string> = {
  Wood: '74,140,63',       // earthy green
  Copper: '184,115,51',    // copper
  Stone: '154,140,120',    // tan-grey
  Coal: '120,120,128',     // smoky grey
  Iron: '124,150,170',     // steel blue
  Silver: '176,184,196',   // pale grey
  Bronze: '176,125,70',    // bronze
  Gold: '232,192,80',      // warm gold
  Platinum: '198,222,236', // ice blue
}

// Faint per-resource header wash + accent line for gathering cards.
export function resourceHeaderStyle(resource: string): CSSProperties {
  const c = RESOURCE_COLOR[resource] ?? '200,145,42'
  return {
    background: `linear-gradient(180deg, rgba(${c},0.40) 0%, rgba(${c},0.08) 100%)`,
    borderBottom: `2px solid rgba(${c},0.95)`,
  }
}

// "30s" / "1m 30s" / "15m" — human-readable gather cycle interval.
export function mineRate(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60), s = sec % 60
  return s ? `${m}m ${s}s` : `${m}m`
}
