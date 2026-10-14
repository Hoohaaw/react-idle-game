import type { StatBonus } from './stats.ts'

// Mission prep & consumables (docs/superpowers/specs/2026-10-12-mission-prep-consumables-
// design.md): self-only items a character brings on a mission. Two categories:
//   heal — mid-fight, HP-threshold-triggered (combat.ts owns the trigger logic).
//   buff — pre-fight, whole-encounter (folds into effectiveStats' extraBonuses, same {flat,
//          pct} shape gear/blessings/traits/proficiencies already use).
// Flat, tiered items — deliberately NOT rarity-rolled like itemDef (ADR analog: design
// spec §B "Alternatives considered").

export type ConsumableCategory = 'heal' | 'buff'
export type ConsumableEffect = { stat: string; kind: 'flat' | 'pct'; value: number }

/**
 * Per-character mission-prep slot count: 1 up to level 20, 2 from level 21 on, plus 1 more
 * if the character carries the studio-authored bonusConsumableSlot flag (Utility-role-
 * exclusive, granted by hand per character — never computed from role alone).
 */
export function slotsForCharacter(level: number, bonusSlot: boolean): number {
  return (level >= 21 ? 2 : 1) + (bonusSlot ? 1 : 0)
}

/** Totals a buff-category consumable's authored effects into the {flat, pct}-per-stat shape
 *  every other bonus source already uses — pass straight into effectiveStats' extraBonuses. */
export function resolveConsumableBuffBonus(effects: ConsumableEffect[]): Record<string, StatBonus> {
  const out: Record<string, StatBonus> = {}
  for (const effect of effects) {
    const bonus = (out[effect.stat] ??= { flat: 0, pct: 0 })
    if (effect.kind === 'flat') bonus.flat += effect.value
    else bonus.pct += effect.value
  }
  return out
}

export type LoadoutPartyMember = { characterId: string; level: number; bonusSlot: boolean }
export type LoadoutEntry = { characterId: string; consumableDefId: string; category: ConsumableCategory }

/**
 * Validates a proposed mission loadout against the party's slot budgets and the party-wide
 * healing cap. Returns an error string, or null if valid. Called by the mission-start Edge
 * Function (Task 7) AFTER it has resolved each party member's level/bonusSlot and each
 * submitted item's category from Sanity — this function is pure and knows nothing about
 * Sanity or the database, which is what makes it unit-testable without either.
 */
export function validateMissionLoadout(
  party: LoadoutPartyMember[],
  loadout: LoadoutEntry[],
): string | null {
  const byChar = new Map(party.map((p) => [p.characterId, p]))
  const countByChar = new Map<string, number>()
  let healCount = 0

  for (const entry of loadout) {
    const member = byChar.get(entry.characterId)
    if (!member) return `Character ${entry.characterId} is not in the party`
    countByChar.set(entry.characterId, (countByChar.get(entry.characterId) ?? 0) + 1)
    if (entry.category === 'heal') healCount += 1
  }

  for (const [characterId, count] of countByChar) {
    const member = byChar.get(characterId)!
    const cap = slotsForCharacter(member.level, member.bonusSlot)
    if (count > cap) {
      return `Character ${characterId} carries ${count} items but only has ${cap} slot(s)`
    }
  }

  if (healCount > 1) {
    return 'Only one healing-category consumable may be brought per party per mission'
  }

  return null
}
