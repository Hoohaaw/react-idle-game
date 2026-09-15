// The skill registry + reused accrual/leveling math for indefinite skill assignments (docs/
// superpowers/specs/2026-09-14-skill-assignments-design.md). Like gather.ts and combat.ts, this
// module MUST stay Deno-safe: pure data + pure functions, no browser/node deps — imported by both
// the client (Skills page) and the skill Edge Functions (server-authoritative accrual).
//
// No new accrual function: skill-collect calls gather.ts's existing accrue() directly with
// speedPct/yieldPct = 0 (no character-stat modifiers in this pass — see spec §3, deferred). No new
// leveling curve: skill levels reuse leveling.ts's applyXp/xpToNext/LEVEL_CAP verbatim — the
// identical capped-at-50 curve character levels use, so a skill and a character level up
// identically and there is only one curve to ever tune.

export type SkillDef = {
  skillKey: string
  label: string
  destination: string
  intervalSec: number
  xpPerTick: number
}

export const SKILL_DEFS: SkillDef[] = [
  { skillKey: 'religion', label: 'Religion', destination: 'Church', intervalSec: 30, xpPerTick: 15 },
  { skillKey: 'athletics', label: 'Athletics', destination: 'Training Grounds', intervalSec: 30, xpPerTick: 15 },
  { skillKey: 'farming', label: 'Farming', destination: 'Farm', intervalSec: 30, xpPerTick: 15 },
  { skillKey: 'mining', label: 'Mining', destination: 'Quarry', intervalSec: 30, xpPerTick: 15 },
]

export const SKILL_BY_KEY: Record<string, SkillDef> = Object.fromEntries(
  SKILL_DEFS.map((s) => [s.skillKey, s]),
)
