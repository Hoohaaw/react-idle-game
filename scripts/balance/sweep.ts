// The balance sweep — runs the real combat sim (src/lib/combat.ts) across a grid of
// party comp × level × enemy tier × encounter shape × time limit, many seeds per cell, and writes
// a CSV (full grid) + a markdown report (matrices + auto-flagged anomalies) to scripts/balance/reports/.
//
// Run:  node scripts/balance/sweep.ts [seedsPerCell] [label]     (default: 200 baseline)
// `label` names the report files (reports/<date>-<label>.{md,csv}) so tuning runs don't
// overwrite the baseline. See docs/BALANCE.md for the process this feeds.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { simulateCombat, marginBonus, levelRewardBonus, COMBAT } from '../../src/lib/combat.ts'
import { buildParty } from './roster.ts'
import { makeEncounter, type EncounterShape } from './enemies.ts'

// ---- Sweep grid ---------------------------------------------------------------------------------

/** Named comps drawn from the real roster (roster.ts). Trios are the standard party size. */
const COMPS: Record<string, string[]> = {
  'trio-core': ['brom-ironwall', 'vex-nightcut', 'tyla-windcarrier'], // tank + dps + healer
  'trio-double-dps': ['brom-ironwall', 'vex-nightcut', 'sera-fletchwind'], // no healer
  'trio-no-tank': ['vex-nightcut', 'sera-fletchwind', 'tyla-windcarrier'],
  'trio-casters': ['callum-emberveil', 'mira-ashbind', 'aldric-faithward'], // magic dmg + healer
  'trio-double-tank': ['brom-ironwall', 'mordrek-graveborn', 'tyla-windcarrier'], // turtle
  'trio-utility': ['fenn-mosswhisper', 'lyra-brightnote', 'torvin-gearlock'],
  'trio-gatherers': ['gort-deepvein', 'nira-barkholm', 'rowan-thicket'], // off-role stress test
  'duo-tank-heal': ['brom-ironwall', 'tyla-windcarrier'], // unkillable-comp probe
  'solo-tank': ['mordrek-graveborn'],
  'solo-dps': ['vex-nightcut'],
}

const LEVELS = [1, 5, 10, 20, 35, 50]
const TIERS = [1, 2, 3, 4, 5, 6, 7, 8]
const SHAPES: EncounterShape[] = ['solo', 'pack', 'boss']
// First entry = the recommended authored limit (matrices + anomaly rules read it); second = a
// longer probe that separates "can't kill it" from "can't kill it in time".
const TIME_LIMITS = [180, 300] // ADR-0025: 180s recommended (was 60); 300s probes clock sensitivity
const PRIMARY_LIMIT = TIME_LIMITS[0]
const PROBE_LIMIT = TIME_LIMITS[1]
const SEEDS_PER_CELL = Number(process.argv[2] ?? 200)
const LABEL = process.argv[3] ?? 'baseline'

// ---- Per-cell metrics ----------------------------------------------------------------------------

type CellResult = {
  comp: string
  level: number
  tier: number
  shape: EncounterShape
  limit: number
  fights: number
  winRate: number
  timeoutRate: number
  wipeRate: number
  /** Mean survivingHpPct across WINS (feeds marginBonus). NaN if no wins. */
  avgMarginWin: number
  /** Mean fight duration across WINS, seconds. NaN if no wins. */
  avgDurationWin: number
  /** Mean party members at 0 HP per fight (infirmary load). */
  avgDowned: number
  /** Mean fraction of party max HP lost per fight (all outcomes). */
  avgHpLostPct: number
  /** Share of enemy attacks aimed at a tank-role member. NaN for tankless comps. */
  tankTargetPct: number
  /** Mean (1+marginBonus)(1+levelBonus) over ALL attempts (losses count 0) — expected reward multiplier. */
  expRewardMult: number
}

function runCell(
  comp: string,
  level: number,
  tier: number,
  shape: EncounterShape,
  limit: number,
): CellResult {
  const party = buildParty(COMPS[comp], level)
  const tankIds = new Set(party.filter((c) => c.role === 'tank').map((c) => c.id))
  const partyIds = new Set(party.map((c) => c.id))
  const lvlBonus = levelRewardBonus(party.map(() => level))

  let wins = 0
  let timeouts = 0
  let wipes = 0
  let marginSum = 0
  let durationSum = 0
  let downedSum = 0
  let hpLostSum = 0
  let enemyAttacks = 0
  let enemyAttacksOnTank = 0
  let rewardSum = 0

  for (let s = 0; s < SEEDS_PER_CELL; s++) {
    const encounter = makeEncounter(tier, shape, limit)
    const result = simulateCombat({ party, encounter, seed: `${comp}|L${level}|T${tier}|${shape}|${limit}|s${s}` })

    if (result.outcome === 'win') {
      wins++
      marginSum += result.survivingHpPct
      durationSum += result.durationSeconds
      rewardSum += (1 + marginBonus(result.survivingHpPct)) * (1 + lvlBonus)
    } else if (result.reason === 'timeout') timeouts++
    else wipes++

    downedSum += Object.values(result.endingHp).filter((hp) => hp === 0).length
    hpLostSum += 1 - result.survivingHpPct

    if (tankIds.size > 0) {
      for (const ev of result.log) {
        if ((ev.type === 'attack' || ev.type === 'dodge') && !partyIds.has(ev.source)) {
          enemyAttacks++
          if (tankIds.has(ev.target)) enemyAttacksOnTank++
        }
      }
    }
  }

  const n = SEEDS_PER_CELL
  return {
    comp, level, tier, shape, limit,
    fights: n,
    winRate: wins / n,
    timeoutRate: timeouts / n,
    wipeRate: wipes / n,
    avgMarginWin: wins > 0 ? marginSum / wins : NaN,
    avgDurationWin: wins > 0 ? durationSum / wins : NaN,
    avgDowned: downedSum / n,
    avgHpLostPct: hpLostSum / n,
    tankTargetPct: tankIds.size > 0 && enemyAttacks > 0 ? enemyAttacksOnTank / enemyAttacks : NaN,
    expRewardMult: rewardSum / n,
  }
}

// ---- Report generation ----------------------------------------------------------------------------

const pct = (x: number) => (Number.isNaN(x) ? '—' : `${Math.round(x * 100)}%`)
const num = (x: number, d = 2) => (Number.isNaN(x) ? '—' : x.toFixed(d))

function csvOf(cells: CellResult[]): string {
  const header =
    'comp,level,tier,shape,limit,fights,winRate,timeoutRate,wipeRate,avgMarginWin,avgDurationWin,avgDowned,avgHpLostPct,tankTargetPct,expRewardMult'
  const rows = cells.map((c) =>
    [
      c.comp, c.level, c.tier, c.shape, c.limit, c.fights,
      num(c.winRate, 3), num(c.timeoutRate, 3), num(c.wipeRate, 3),
      num(c.avgMarginWin, 3), num(c.avgDurationWin, 1), num(c.avgDowned, 2),
      num(c.avgHpLostPct, 3), num(c.tankTargetPct, 3), num(c.expRewardMult, 3),
    ].join(','),
  )
  return [header, ...rows].join('\n')
}

/** comp × tier win-rate matrix for one (level, shape, limit) slice. */
function matrix(cells: CellResult[], level: number, shape: EncounterShape, limit: number): string {
  const lines: string[] = []
  lines.push(`| comp \\ tier | ${TIERS.join(' | ')} |`)
  lines.push(`|---${'|---'.repeat(TIERS.length)}|`)
  for (const comp of Object.keys(COMPS)) {
    const row = TIERS.map((tier) => {
      const c = cells.find(
        (x) => x.comp === comp && x.level === level && x.tier === tier && x.shape === shape && x.limit === limit,
      )
      if (!c) return '—'
      if (c.winRate === 0) return '0'
      return `${pct(c.winRate)} m${pct(c.avgMarginWin)}`
    })
    lines.push(`| ${comp} | ${row.join(' | ')} |`)
  }
  return lines.join('\n')
}

function findAnomalies(cells: CellResult[]): string[] {
  const out: string[] = []
  const at = (comp: string, level: number, tier: number, shape: EncounterShape, limit: number) =>
    cells.find((c) => c.comp === comp && c.level === level && c.tier === tier && c.shape === shape && c.limit === limit)

  // 1. Threat failure: a tank comp where the tank eats < 60% of enemy attacks.
  const threatFails = cells.filter((c) => !Number.isNaN(c.tankTargetPct) && c.tankTargetPct < 0.6 && c.winRate > 0)
  if (threatFails.length > 0) {
    const worst = threatFails.reduce((a, b) => (a.tankTargetPct < b.tankTargetPct ? a : b))
    out.push(
      `**Threat failure** in ${threatFails.length} cells: tank absorbs <60% of enemy attacks ` +
        `(worst: ${worst.comp} L${worst.level} T${worst.tier} ${worst.shape} — ${pct(worst.tankTargetPct)}).`,
    )
  }

  // 2. Timeout-heavy cells: the clock, not HP, decides the fight.
  const timeoutHeavy = cells.filter((c) => c.timeoutRate > 0.3)
  if (timeoutHeavy.length > 0) {
    const sample = timeoutHeavy.slice(0, 5).map((c) => `${c.comp} L${c.level} T${c.tier} ${c.shape}@${c.limit}s (${pct(c.timeoutRate)})`)
    out.push(`**Timeout-heavy** (${timeoutHeavy.length} cells >30% timeouts): ${sample.join(', ')}${timeoutHeavy.length > 5 ? ', …' : ''}.`)
  }

  // 3. Healer inversion: healer trio LOSES to swapping the healer for a second dps.
  for (const level of LEVELS) for (const tier of TIERS) for (const shape of SHAPES) {
    const healer = at('trio-core', level, tier, shape, PRIMARY_LIMIT)
    const noHealer = at('trio-double-dps', level, tier, shape, PRIMARY_LIMIT)
    if (healer && noHealer && noHealer.winRate - healer.winRate > 0.1) {
      out.push(
        `**Healer inversion** L${level} T${tier} ${shape}: trio-core ${pct(healer.winRate)} vs ` +
          `trio-double-dps ${pct(noHealer.winRate)} — the healer slot is a downgrade.`,
      )
    }
  }

  // 4. Difficulty cliff: win rate falls from ≥90% to ≤10% in ONE tier step (no middle band).
  for (const comp of Object.keys(COMPS)) for (const level of LEVELS) for (const shape of SHAPES) {
    for (let i = 0; i < TIERS.length - 1; i++) {
      const a = at(comp, level, TIERS[i], shape, PRIMARY_LIMIT)
      const b = at(comp, level, TIERS[i + 1], shape, PRIMARY_LIMIT)
      if (a && b && a.winRate >= 0.9 && b.winRate <= 0.1) {
        out.push(`**Cliff** ${comp} L${level} ${shape}: T${TIERS[i]} ${pct(a.winRate)} → T${TIERS[i + 1]} ${pct(b.winRate)}.`)
      }
    }
  }

  // 5. Clock sensitivity: raising the limit to the probe flips a cell from loss to win (>40pt swing).
  const clockFlips = cells.filter((c) => {
    if (c.limit !== PRIMARY_LIMIT) return false
    const longer = at(c.comp, c.level, c.tier, c.shape, PROBE_LIMIT)
    return longer !== undefined && longer.winRate - c.winRate > 0.4
  })
  if (clockFlips.length > 0) {
    const sample = clockFlips.slice(0, 5).map((c) => `${c.comp} L${c.level} T${c.tier} ${c.shape}`)
    out.push(`**Clock-bound** (${clockFlips.length} cells win ≥40pts more at ${PROBE_LIMIT}s): ${sample.join(', ')}${clockFlips.length > 5 ? ', …' : ''}.`)
  }

  return out
}

// ---- Main -----------------------------------------------------------------------------------------

function main() {
  const t0 = Date.now()
  const cells: CellResult[] = []
  for (const comp of Object.keys(COMPS))
    for (const level of LEVELS)
      for (const tier of TIERS)
        for (const shape of SHAPES)
          for (const limit of TIME_LIMITS) cells.push(runCell(comp, level, tier, shape, limit))
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

  const totalFights = cells.length * SEEDS_PER_CELL
  const date = new Date().toISOString().slice(0, 10)
  const outDir = join(dirname(fileURLToPath(import.meta.url)), 'reports')
  mkdirSync(outDir, { recursive: true })

  const md: string[] = []
  md.push(`# Balance sweep — ${date} (${LABEL})`)
  md.push('')
  md.push(
    `${totalFights.toLocaleString()} fights (${cells.length} cells × ${SEEDS_PER_CELL} seeds) in ${elapsed}s. ` +
      `Naked baselines (no gear, no blessings). Constants: ARMOR_K=${COMBAT.ARMOR_K}, ` +
      `TANK_THREAT_MULT=${COMBAT.TANK_THREAT_MULT}, MARGIN_MAX=${COMBAT.MARGIN_MAX}, ` +
      `LEVEL_BONUS=${COMBAT.LEVEL_BONUS_PER_AVG_LEVEL}, BASE_INTERVAL=${COMBAT.BASE_INTERVAL}, REF_SPEED=${COMBAT.REF_SPEED}.`,
  )
  md.push('')
  md.push(`Cell format: \`winRate m<avg surviving-HP% on wins>\`. \`0\` = no wins. Matrices are the ${PRIMARY_LIMIT}s time limit.`)

  md.push('', '## Anomalies (auto-flagged)', '')
  const anomalies = findAnomalies(cells)
  md.push(anomalies.length > 0 ? anomalies.map((a) => `- ${a}`).join('\n') : '_none flagged_')

  for (const shape of SHAPES) {
    md.push('', `## Shape: ${shape}`, '')
    for (const level of LEVELS) {
      md.push(`### Level ${level} — ${shape} (${PRIMARY_LIMIT}s)`, '')
      md.push(matrix(cells, level, shape, PRIMARY_LIMIT), '')
    }
  }

  writeFileSync(join(outDir, `${date}-${LABEL}.md`), md.join('\n') + '\n')
  writeFileSync(join(outDir, `${date}-${LABEL}.csv`), csvOf(cells) + '\n')
  console.log(`Wrote ${cells.length} cells (${totalFights.toLocaleString()} fights, ${elapsed}s) to scripts/balance/reports/${date}-${LABEL}.{md,csv}`)
}

main()
