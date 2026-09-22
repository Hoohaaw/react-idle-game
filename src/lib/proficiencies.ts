import type { StatBonus } from './stats.ts'

// Utility role conditional proficiency (ADR-0013 fork 6, ADR-0059,
// docs/superpowers/specs/2026-09-20-utility-proficiency-design.md): a fixed authored trait,
// decided at recruitment, that grants a flat/pct stat bonus when the current mission's
// proficiencyTags include it. Same {flat, pct} effect shape as traits/gear/blessings
// (src/lib/stats.ts) so it stacks through the ordinary bonus pipeline — the bonus modifies
// the sim's INPUTS, never a win-chance number post-hoc (see traits.ts's doc comment for why
// that rule exists). Deno-safe: imported by the client, the mission-claim Edge Function, AND
// the Sanity studio's validation (like traits.ts/characterBudget.ts).

export type ProficiencyEffect = { stat: string; kind: 'flat' | 'pct'; value: number }

export type ProficiencyDef = {
  proficiencyKey: string
  label: string
  effects: ProficiencyEffect[]
}

export const PROFICIENCY_DEFS: ProficiencyDef[] = [
  {
    proficiencyKey: 'alchemy',
    label: 'Alchemy',
    // Placeholder value pending docs/BALANCE.md's before/after sweep (design spec §6/§7).
    effects: [{ stat: 'defense', kind: 'flat', value: 5 }],
  },
]

export const PROFICIENCY_BY_KEY: Record<string, ProficiencyDef> = Object.fromEntries(
  PROFICIENCY_DEFS.map((p) => [p.proficiencyKey, p]),
)

/** Resolves a character's proficiency bonus for one mission attempt. A static per-attempt
 *  match (proficiency ∈ mission's tags), not a live combat-state condition — this does NOT
 *  reuse traits.ts's conditionTrigger engine, which exists for a different kind of thing.
 *  Utility-exclusivity is an authoring-time rule (studio validation, Task 2), not enforced
 *  here — this function only checks the key match. */
export function resolveProficiencyBonus(
  proficiency: string | null | undefined,
  missionProficiencyTags: string[] | null | undefined,
): Record<string, StatBonus> {
  const out: Record<string, StatBonus> = {}
  if (!proficiency) return out
  if (!(missionProficiencyTags ?? []).includes(proficiency)) return out
  const def = PROFICIENCY_BY_KEY[proficiency]
  if (!def) return out
  for (const effect of def.effects) {
    const bonus = (out[effect.stat] ??= { flat: 0, pct: 0 })
    if (effect.kind === 'flat') bonus.flat += effect.value
    else bonus.pct += effect.value
  }
  return out
}
