import type { AbilityStat } from './combat'

// Totems (design spec §E): a durable, party-wide, ACCOUNT-level equip (profiles.
// active_totem_id) — not a per-mission consumable. Applied in combat.ts the exact same way
// a capstone's partyBuffOnStart ability already is: a flat/pct buff to every party member,
// once, at fight start. Restricted to the same AbilityStat allowlist for the same reason
// (attack/spellPower/healingPower are pre-routed into power/healPower by partyUnit() and
// aren't separately addressable after construction).

export type TotemEffect = { stat: string; kind: 'flat' | 'pct'; value: number }
export type TotemDef = { totemKey: string; effects: TotemEffect[] }

export const TOTEM_ALLOWED_STATS: ReadonlySet<AbilityStat> = new Set<AbilityStat>([
  'defense', 'resistance', 'critChance', 'critDamage', 'dodge', 'block', 'healthRegen',
])

/**
 * Resolves the equipped totem's effects into the exact array shape simulateCombat's new
 * `partyBuffs` param expects. Null-safe by design: a missing totem (none equipped) or a
 * stale reference (the totemDef was deleted/unpublished in Sanity since being equipped —
 * see Review Focus) both degrade to "no bonus," never a throw. Effects targeting a stat
 * outside the allowlist are silently dropped rather than corrupting the sim's internal
 * (non-addressable) power/healPower fields.
 */
export function resolveTotemPartyBuffs(
  totem: TotemDef | null | undefined,
): { stat: AbilityStat; kind: 'flat' | 'pct'; value: number }[] {
  if (!totem) return []
  return totem.effects
    .filter((e): e is TotemEffect & { stat: AbilityStat } => TOTEM_ALLOWED_STATS.has(e.stat))
    .map((e) => ({ stat: e.stat, kind: e.kind, value: e.value }))
}
