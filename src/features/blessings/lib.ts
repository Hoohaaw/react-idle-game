import { STAT_DEFS } from '@/lib/statDefinitions'
import type { NodeEffect } from '@/lib/stats'

const STAT_LABEL: Record<string, string> = Object.fromEntries(STAT_DEFS.map((s) => [s.key, s.label]))

/** "+8 Attack" / "+5% Crit Chance" — a short human summary of a choice's effects. */
export function summarizeEffects(effects: NodeEffect[]): string {
  return effects
    .map((e) => `+${e.value}${e.kind === 'pct' ? '%' : ''} ${STAT_LABEL[e.stat] ?? e.stat}`)
    .join(', ')
}
