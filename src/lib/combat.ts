// The combat sim — resolves a mission fight deterministically from party effective stats vs. an
// authored encounter. Pure, no I/O: the mission-claim Edge Function (the only legitimate caller)
// fetches the defs, computes effective stats (src/lib/stats.ts), and passes them in.
//
// Design references (docs/DECISIONS.md):
//   ADR-0012  combat resolves at claim; rewards gate on a win + scale with margin.
//   ADR-0013  seeded, action-timeline auto-battle → win/lose + per-character ending HP; passive stats
//             only (no active abilities yet); timeout = loss; damage persists.
//   ADR-0014  unkillable comps allowed but must still beat the clock; Utility = generic combatant for now.
//   ADR-0015  the FORMULAS + FIRST-PASS constants below. The shapes are stable; the numbers are
//             provisional and meant to be tuned by running this sim. Tune here, in COMBAT.
//
// Determinism: given the same inputs + seed the result is identical, so the server is authoritative
// and the client can replay `log` as the visual fight without being trusted for the outcome.

import type { StatMap } from './stats.ts'
import type { School } from './schools.ts'

// ---- Tuning (ADR-0015 — first-pass; refine against simulated fights) --------------------------

export const COMBAT = {
  /** Armor DR curve constant: DR = def / (def + K). */
  ARMOR_K: 100,
  /** A baseline-speed combatant acts every BASE_INTERVAL seconds. */
  BASE_INTERVAL: 3,
  /** The `speed` value that equals one baseline interval. */
  REF_SPEED: 10,
  /**
   * Diminishing returns on speed ABOVE the baseline (ADR-0030): effective speed saturates at
   * REF_SPEED + SPEED_DR_K, so action rate caps at (REF_SPEED + K)/REF_SPEED × baseline. Speed at
   * or below REF_SPEED is untouched (enemies and slow units keep exact v1 behavior). Haste folds
   * into speed BEFORE the curve so it cannot reopen the linear channel. Raw linear action rate was
   * the last stat runaway: authored +1–2 speed/level reached speed 55–110 at L50 (5.5–11× actions),
   * multiplying damage AND threat, and carried solo tanks to 100% win against every tier.
   */
  SPEED_DR_K: 30,
  /** Crit adds this on top of critDamage%: multiplier = 1 + CRIT_BASE + critDamage/100. */
  CRIT_BASE: 0.5,
  /**
   * Party dodge is capped at this % (ADR-0029). Dodge is full avoidance, so growth/gear stacking
   * runs away: authored +1/level growth alone reaches 50%+ at L50 and made solo tanks sweep every
   * tier. Enemies are NOT capped — their stats are hand-authored (an untouchable ghost stays a
   * legitimate encounter design tool).
   */
  DODGE_CAP: 25,
  /** A blocked hit loses this fraction of its damage. */
  BLOCK_FACTOR: 0.5,
  /** Tanks generate this much more threat per point of damage than everyone else. */
  TANK_THREAT_MULT: 4,
  /**
   * Tanks ALSO accrue threat passively over time: (defense + maxHp/10) × this, per combat second
   * (ADR-0027, the ADR-0013 "role weight + Defense/Health" term). Damage-only threat fails
   * structurally — a speed-growth dps generates threat per ACTION and out-paces any flat
   * multiplier on the slow tank as levels rise. Stat accrual is action-rate independent, so the
   * tank tanks at every level; extreme dps overgearing can still rip aggro (intended risk).
   */
  TANK_THREAT_STAT_RATE: 3,
  /**
   * Healers START healing when an ally falls below this fraction of max HP, then keep healing
   * until the whole party is topped up (hysteresis); above it they attack (ADR-0026). Without a
   * threshold a healer never attacked — any scratch anywhere locked it into pure (over)healing,
   * making the healer slot a measurable downgrade vs. a second damage dealer.
   */
  HEALER_HEAL_THRESHOLD: 0.7,
  /** marginBonus = survivingHP% × MARGIN_MAX (reward for a decisive win). */
  MARGIN_MAX: 0.5,
  /** levelBonus = avgPartyLevel × this (capped by the level-50 ceiling). */
  LEVEL_BONUS_PER_AVG_LEVEL: 0.004,
  /** Power routing coefficients (primaries → derived power). */
  STR_TO_POWER: 1,
  AGI_TO_POWER: 1,
  INT_TO_POWER: 1,
  /** Safety net so a degenerate no-damage stalemate can't loop forever. */
  MAX_STEPS: 100_000,
} as const

// ---- Public types -----------------------------------------------------------------------------

export type Role = 'tank' | 'damage' | 'healer' | 'utility' | 'gatherer'

/** A party member entering combat: effective stats + role + carried-in HP (persistent damage). */
export type Combatant = {
  id: string
  role: Role
  stats: StatMap
  /** Current HP carried from prior fights; defaults to full (`stats.health`) when omitted. */
  currentHp?: number
  /** School of the character's MAGIC damage (ADR-0033); 'magic' (neutral) when unauthored.
   *  Ignored when the physical routing wins — physical attacks are always school 'physical'. */
  damageSchool?: School
}

/** A lean enemy instance (maps from Sanity `enemyDef`, minus the wrappers; swarms are pre-expanded). */
export type Enemy = {
  id: string
  health: number
  attack: number
  /** School of the enemy's attacks. vs the party: 'physical' → Defense, anything else → Resistance. */
  damageType: School
  speed: number
  defense?: number
  resistance?: number
  /** Per-school resistances (ADR-0033), same DR-curve units as defense. A named-school attack
   *  checks its entry here and falls back to the generic `resistance` when absent. */
  resistances?: Partial<Record<School, number>>
  block?: number
  critChance?: number
  critDamage?: number
  armorPen?: number
  healthRegen?: number
  dodge?: number
}

export type Encounter = {
  /** Every enemy instance (a swarm of 3 = 3 entries). */
  enemies: Enemy[]
  timeLimitSeconds: number
}

export type CombatEvent = {
  t: number
  type: 'attack' | 'heal' | 'dodge' | 'defeat'
  source: string
  target: string
  amount: number
  /** Damage school of attack/dodge events (ADR-0033) — for replay tinting; absent on heal/defeat. */
  school?: School
}

export type CombatResult = {
  outcome: 'win' | 'loss'
  reason: 'enemies-defeated' | 'party-wiped' | 'timeout'
  /** Party member id → ending HP (0 = downed). Feeds persistent-damage writes. */
  endingHp: Record<string, number>
  /** Σ ending HP ÷ Σ max HP across the party — feeds marginBonus. */
  survivingHpPct: number
  durationSeconds: number
  log: CombatEvent[]
}

// ---- Seeded RNG (xmur3 hash → mulberry32) ------------------------------------------------------

export function makeRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = (h ^ (h >>> 16)) >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---- Internal combatant runtime ---------------------------------------------------------------

type Unit = {
  id: string
  side: 'party' | 'enemy'
  order: number
  maxHp: number
  hp: number
  power: number
  damageType: School
  isHealer: boolean
  healPower: number
  healingCrit: number
  defense: number
  resistance: number
  /** Per-school resistances (enemies only, ADR-0033); named-school hits check here first. */
  resists?: Partial<Record<School, number>>
  block: number
  dodge: number
  critChance: number
  critDamage: number
  armorPen: number
  healthRegen: number
  threatMult: number
  threat: number
  /** Passive threat per combat second (tanks only, ADR-0027); evaluated lazily as threat + rate × t. */
  threatStatRate: number
  interval: number
  nextAt: number
  /** Hysteresis for healer AI: healing engaged below the threshold, released when the party is full. */
  healing: boolean
}

const num = (m: StatMap, k: string) => m[k] ?? 0

function actionInterval(speed: number, haste: number): number {
  const raw = Math.max(1, speed) * (1 + haste / 100)
  const surplus = raw - COMBAT.REF_SPEED
  const eff =
    surplus <= 0
      ? raw
      : COMBAT.REF_SPEED + (surplus * COMBAT.SPEED_DR_K) / (surplus + COMBAT.SPEED_DR_K)
  return (COMBAT.BASE_INTERVAL * COMBAT.REF_SPEED) / eff
}

function partyUnit(c: Combatant, order: number): Unit {
  const s = c.stats
  const pAtk = num(s, 'attack') + num(s, 'strength') * COMBAT.STR_TO_POWER + num(s, 'agility') * COMBAT.AGI_TO_POWER
  const mAtk = num(s, 'spellPower') + num(s, 'intelligence') * COMBAT.INT_TO_POWER
  const hPow = num(s, 'healingPower') + num(s, 'intelligence') * COMBAT.INT_TO_POWER
  const usePhysical = pAtk >= mAtk
  const maxHp = Math.max(1, num(s, 'health'))
  const threatMult = c.role === 'tank' ? COMBAT.TANK_THREAT_MULT : 1
  return {
    id: c.id,
    side: 'party',
    order,
    maxHp,
    hp: Math.min(maxHp, c.currentHp ?? maxHp),
    power: Math.max(pAtk, mAtk),
    damageType: usePhysical ? 'physical' : (c.damageSchool ?? 'magic'),
    isHealer: c.role === 'healer',
    healPower: hPow,
    healingCrit: num(s, 'healingCrit'),
    defense: num(s, 'defense'),
    resistance: num(s, 'resistance'),
    block: num(s, 'block'),
    dodge: Math.min(num(s, 'dodge'), COMBAT.DODGE_CAP),
    critChance: num(s, 'critChance'),
    critDamage: num(s, 'critDamage'),
    armorPen: num(s, 'armorPen'),
    healthRegen: num(s, 'healthRegen'),
    threatMult,
    // Seed threat so ties at t=0 break toward the tank (before damage-based threat takes over).
    threat: threatMult,
    threatStatRate:
      c.role === 'tank' ? (num(s, 'defense') + maxHp / 10) * COMBAT.TANK_THREAT_STAT_RATE : 0,
    interval: actionInterval(num(s, 'speed'), num(s, 'haste')),
    nextAt: 0,
    healing: false,
  }
}

function enemyUnit(e: Enemy, order: number): Unit {
  const maxHp = Math.max(1, e.health)
  return {
    id: e.id,
    side: 'enemy',
    order,
    maxHp,
    hp: maxHp,
    power: e.attack,
    damageType: e.damageType,
    isHealer: false,
    healPower: 0,
    healingCrit: 0,
    defense: e.defense ?? 0,
    resistance: e.resistance ?? 0,
    resists: e.resistances,
    block: e.block ?? 0,
    dodge: e.dodge ?? 0,
    critChance: e.critChance ?? 0,
    critDamage: e.critDamage ?? 0,
    armorPen: e.armorPen ?? 0,
    healthRegen: e.healthRegen ?? 0,
    threatMult: 1,
    threat: 0,
    threatStatRate: 0,
    interval: actionInterval(e.speed, 0),
    nextAt: 0,
    healing: false,
  }
}

// ---- Hit resolution (ADR-0015 B: dodge → crit → armor DR → block; schools ADR-0033) -------------

function drMitigate(power: number, mitigation: number, armorPen: number): number {
  const eff = Math.max(0, mitigation - armorPen)
  return power * (1 - eff / (eff + COMBAT.ARMOR_K))
}

/** The defender's mitigation stat against a school: physical → Defense; named schools check the
 *  defender's per-school resistances (enemies) and fall back to generic Resistance (ADR-0033). */
function mitigationFor(defender: Unit, school: School): number {
  if (school === 'physical') return defender.defense
  return defender.resists?.[school] ?? defender.resistance
}

function resolveAttack(attacker: Unit, defender: Unit, rng: () => number): number {
  if (defender.dodge > 0 && rng() * 100 < defender.dodge) return 0
  let dmg = attacker.power
  if (attacker.critChance > 0 && rng() * 100 < attacker.critChance) {
    dmg *= 1 + COMBAT.CRIT_BASE + attacker.critDamage / 100
  }
  const mit = mitigationFor(defender, attacker.damageType)
  dmg = drMitigate(dmg, mit, attacker.armorPen)
  if (defender.block > 0 && rng() * 100 < defender.block) {
    dmg *= 1 - COMBAT.BLOCK_FACTOR
  }
  return dmg
}

// ---- Targeting --------------------------------------------------------------------------------

/** Party attackers focus the lowest-HP living enemy; ties → lowest order. */
function pickEnemyTarget(units: Unit[]): Unit | undefined {
  let best: Unit | undefined
  for (const u of units) {
    if (u.side !== 'enemy' || u.hp <= 0) continue
    if (!best || u.hp < best.hp || (u.hp === best.hp && u.order < best.order)) best = u
  }
  return best
}

/** Enemies hit the highest-threat living party member at time `t`; ties → lowest order.
 *  Effective threat = accumulated damage threat + the tank's passive stat accrual (ADR-0027). */
function pickThreatTarget(units: Unit[], t: number): Unit | undefined {
  let best: Unit | undefined
  let bestThreat = -Infinity
  for (const u of units) {
    if (u.side !== 'party' || u.hp <= 0) continue
    const threat = u.threat + u.threatStatRate * t
    if (!best || threat > bestThreat || (threat === bestThreat && u.order < best.order)) {
      best = u
      bestThreat = threat
    }
  }
  return best
}

/** Healers mend the most-hurt (lowest HP%) living ally below `belowPct`; undefined if none qualify. */
function pickHealTarget(units: Unit[], belowPct: number): Unit | undefined {
  let best: Unit | undefined
  let bestPct = belowPct
  for (const u of units) {
    if (u.side !== 'party' || u.hp <= 0) continue
    const pct = u.hp / u.maxHp
    if (pct < belowPct && (best === undefined || pct < bestPct || (pct === bestPct && u.order < best.order))) {
      best = u
      bestPct = pct
    }
  }
  return best
}

// ---- The sim ----------------------------------------------------------------------------------

/**
 * Resolve a fight. Deterministic given `party`, `encounter`, and `seed` (use the `mission_run` id).
 * Returns win/lose, each party member's ending HP (persistent damage), and the surviving-HP% margin.
 */
export function simulateCombat(args: {
  party: Combatant[]
  encounter: Encounter
  seed: string
}): CombatResult {
  const { party, encounter, seed } = args
  const rng = makeRng(seed)
  const timeLimit = encounter.timeLimitSeconds

  const units: Unit[] = [
    ...party.map((c, i) => partyUnit(c, i)),
    ...encounter.enemies.map((e, i) => enemyUnit(e, party.length + i)),
  ]
  const log: CombatEvent[] = []

  const alive = (side: 'party' | 'enemy') => units.some((u) => u.side === side && u.hp > 0)

  let t = 0
  let steps = 0
  while (steps++ < COMBAT.MAX_STEPS) {
    if (!alive('party') || !alive('enemy')) break

    // Next actor = the living unit with the smallest nextAt (ties → order).
    let actor: Unit | undefined
    for (const u of units) {
      if (u.hp <= 0) continue
      if (!actor || u.nextAt < actor.nextAt || (u.nextAt === actor.nextAt && u.order < actor.order)) actor = u
    }
    if (!actor || actor.nextAt > timeLimit) break // timeout

    t = actor.nextAt
    // Regen is time-normalized (ADR-0028): healthRegen = HP per BASE_INTERVAL of combat time,
    // applied on the unit's own action scaled by its interval. Per-action regen double-dipped
    // with speed (a fast unit regenerated per ACTION), making high-speed/high-regen tanks immortal.
    if (actor.healthRegen > 0) {
      const regen = actor.healthRegen * (actor.interval / COMBAT.BASE_INTERVAL)
      actor.hp = Math.min(actor.maxHp, actor.hp + regen)
    }

    if (actor.isHealer) {
      // Threshold + hysteresis (ADR-0026): start healing when an ally drops below the threshold,
      // keep healing until the party is topped up, otherwise fall through and attack.
      const trigger = actor.healing ? 1 : COMBAT.HEALER_HEAL_THRESHOLD
      const heal = pickHealTarget(units, trigger)
      actor.healing = heal !== undefined
      if (heal) {
        let amount = actor.healPower
        if (actor.healingCrit > 0 && rng() * 100 < actor.healingCrit) amount *= 2
        heal.hp = Math.min(heal.maxHp, heal.hp + amount)
        log.push({ t, type: 'heal', source: actor.id, target: heal.id, amount })
        actor.nextAt += actor.interval
        continue
      }
    }

    const target = actor.side === 'party' ? pickEnemyTarget(units) : pickThreatTarget(units, t)
    if (target) {
      const dmg = resolveAttack(actor, target, rng)
      if (dmg <= 0) {
        log.push({ t, type: 'dodge', source: actor.id, target: target.id, amount: 0, school: actor.damageType })
      } else {
        target.hp = Math.max(0, target.hp - dmg)
        if (actor.side === 'party') actor.threat += dmg * actor.threatMult
        log.push({ t, type: 'attack', source: actor.id, target: target.id, amount: dmg, school: actor.damageType })
        if (target.hp === 0) log.push({ t, type: 'defeat', source: actor.id, target: target.id, amount: 0 })
      }
    }
    actor.nextAt += actor.interval
  }

  const enemiesLeft = alive('enemy')
  const partyLeft = alive('party')
  const outcome: CombatResult['outcome'] = !enemiesLeft ? 'win' : 'loss'
  const reason: CombatResult['reason'] = !enemiesLeft
    ? 'enemies-defeated'
    : !partyLeft
      ? 'party-wiped'
      : 'timeout'

  const partyUnits = units.filter((u) => u.side === 'party')
  const endingHp: Record<string, number> = {}
  let sumHp = 0
  let sumMax = 0
  for (const u of partyUnits) {
    endingHp[u.id] = u.hp
    sumHp += u.hp
    sumMax += u.maxHp
  }

  return {
    outcome,
    reason,
    endingHp,
    survivingHpPct: sumMax > 0 ? sumHp / sumMax : 0,
    durationSeconds: reason === 'timeout' ? timeLimit : t,
    log,
  }
}

// ---- Reward helpers (ADR-0015 F) — fed into the reward pipeline (src/lib/stats.ts finalReward) --

/** Reward bonus for a decisive win: survivingHP% × MARGIN_MAX. Returned as a fraction (0.5 = +50%). */
export function marginBonus(survivingHpPct: number): number {
  return survivingHpPct * COMBAT.MARGIN_MAX
}

/** Small, level-capped power bonus: average party level × rate (ADR-0014). Fraction (0.2 = +20%). */
export function levelRewardBonus(participantLevels: number[]): number {
  if (participantLevels.length === 0) return 0
  const avg = participantLevels.reduce((a, b) => a + b, 0) / participantLevels.length
  return avg * COMBAT.LEVEL_BONUS_PER_AVG_LEVEL
}
