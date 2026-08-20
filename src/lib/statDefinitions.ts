// The stat registry — the single source of truth for every stat the game knows about.
// Adding a stat = one entry here. No DB migration, no Sanity schema edit: the Sanity
// content schema and the game both read their stat list from STAT_DEFS.
//
// `category` groups a stat (offensive / defensive / support / misc — for UI + intent); the separate
// `reward` flag decides whether it feeds the 0.1%/point reward multiplier. These are DECOUPLED
// (ADR-0007) so we can add combat depth (crit, dodge, …) without inflating the economy:
//   reward: true   → a core "power" stat that counts toward the reward multiplier
//   reward: false  → has a gameplay effect but does NOT inflate rewards
//
// Per-stat combat `effect`/`formula` definitions still arrive with the combat model (deferred).

export type StatCategory = 'offensive' | 'defensive' | 'support' | 'misc'

export type StatDef = {
  key: string
  label: string
  category: StatCategory
  /** Whether this stat feeds the 0.1%/pt reward multiplier (ADR-0007 — decoupled from category). */
  reward: boolean
}

export const STAT_DEFS: StatDef[] = [
  // Core power stats — the curated set that drives the reward multiplier (reward:true). Under
  // WoW-style routing (ADR-0009), primaries feed derived scalars by role: Strength/Agility → Attack
  // (physical), Intelligence → Spell Power (damage) or Healing Power (healer); Health = the HP pool.
  { key: 'attack', label: 'Attack', category: 'offensive', reward: true },
  { key: 'strength', label: 'Strength', category: 'offensive', reward: true },
  { key: 'agility', label: 'Agility', category: 'offensive', reward: true },
  { key: 'speed', label: 'Speed', category: 'offensive', reward: true },
  { key: 'intelligence', label: 'Intelligence', category: 'offensive', reward: true },
  { key: 'spellPower', label: 'Spell Power', category: 'offensive', reward: true },
  { key: 'haste', label: 'Haste', category: 'offensive', reward: true },
  { key: 'health', label: 'Health', category: 'defensive', reward: true },
  { key: 'defense', label: 'Defense', category: 'defensive', reward: true },

  // Combat depth — texture for builds. Effects await the combat model; reward:false keeps them from
  // inflating loot (a crit stat shouldn't double-dip). Defensive model is mitigate-not-avoid (ADR-0009):
  // Defense/Resistance reduce physical/magic damage, Dodge fully avoids a hit, Block partly blunts one.
  { key: 'critChance', label: 'Crit Chance', category: 'offensive', reward: false },
  { key: 'critDamage', label: 'Crit Damage', category: 'offensive', reward: false },
  { key: 'armorPen', label: 'Armor Penetration', category: 'offensive', reward: false },
  { key: 'dodge', label: 'Dodge', category: 'defensive', reward: false },
  { key: 'block', label: 'Block', category: 'defensive', reward: false },
  { key: 'resistance', label: 'Resistance', category: 'defensive', reward: false },
  { key: 'healthRegen', label: 'Health Regen', category: 'defensive', reward: false },

  // Support — a healer's output. Effects await the combat model.
  { key: 'healingPower', label: 'Healing Power', category: 'support', reward: false },
  { key: 'healingCrit', label: 'Healing Crit', category: 'support', reward: false },

  // Economy / utility — a real effect, but never the reward multiplier. Magic Find = the RATE of
  // finding items; Luck = the AMOUNT found (ADR-0009).
  { key: 'missionSpeedDecrease', label: 'Mission Speed Decrease', category: 'misc', reward: false },
  { key: 'gatherSpeed', label: 'Gather Speed', category: 'misc', reward: false },
  { key: 'gatherYield', label: 'Gather Yield', category: 'misc', reward: false },
  { key: 'magicFind', label: 'Magic Find', category: 'misc', reward: false },
  { key: 'luck', label: 'Luck', category: 'misc', reward: false },

  // Trait-era economy/recovery stats (ADR-0035). Percent-point values consumed at their sites:
  // goldFind scales mission gold (party average), xpGain scales a survivor's OWN mission XP,
  // recoverySpeed scales that character's infirmary healing rate.
  { key: 'goldFind', label: 'Gold Find', category: 'misc', reward: false },
  { key: 'xpGain', label: 'XP Gain', category: 'misc', reward: false },
  { key: 'recoverySpeed', label: 'Recovery Speed', category: 'misc', reward: false },
]

export const STAT_KEYS: string[] = STAT_DEFS.map((s) => s.key)

export const STAT_LABELS: Record<string, string> = Object.fromEntries(
  STAT_DEFS.map((s) => [s.key, s.label]),
)
