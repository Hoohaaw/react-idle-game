import type { CharacterRole } from '@/lib/roles'

// The result a claim renders — mirrors the mission-claim Edge Function response (outcome/reason/
// survivingHpPct/rewards/per-character ending HP + XP), enriched with the display fields the UI joins
// in (names/classes/item labels). Rewards follow the win-gated pipeline (ADR-0012/0017):
//   final = base × (1+margin) × (1+level) × (1+party) × (1+transcendence)   — granted only on a win.
// Kept in a data-only module (not the component file) so Fast Refresh stays happy.
export type ClaimMember = {
  name: string
  class: string
  level: number
  role?: CharacterRole
  endingHp: number
  maxHp: number
  xpGained: number // 0 = no XP (downed, or a loss). Survivors on a win get > 0.
}
export type ClaimBonus = { label: string; detail: string; pct: number }
export type NewRecruitReveal = { charKey: string; name: string; role: string | null }
export type ClaimResultView = {
  outcome: 'win' | 'loss'
  reason: 'enemies-defeated' | 'party-wiped' | 'timeout'
  missionName: string
  stage?: number
  durationSeconds: number
  survivingHpPct: number
  party: ClaimMember[]
  // Win-only payout (ignored on a loss):
  baseGold: number
  resources: { label: string; value: number }[]
  loot: { name: string; slot: string; rarity: string }[]
  bonuses: ClaimBonus[] // margin, level, party, transcendence
  newlyUnlocked: NewRecruitReveal[]
}

// --- Sample results: drive the /design showcase; replaced by the real claim payload when wired. -----
export const SAMPLE_CLAIM_WIN: ClaimResultView = {
  outcome: 'win',
  reason: 'enemies-defeated',
  missionName: 'Goblin Outpost',
  stage: 3,
  durationSeconds: 84,
  survivingHpPct: 0.62,
  party: [
    { name: 'Lyra Swift', class: 'Rogue', level: 12, endingHp: 88, maxHp: 140, xpGained: 152 },
    // Death Knight authored as Damage = per-character role override (ADR-0008).
    { name: 'Alexandros Mograine', class: 'Death Knight', level: 24, role: 'damage', endingHp: 0, maxHp: 260, xpGained: 0 },
  ],
  baseGold: 100,
  resources: [{ label: 'Cu', value: 20 }, { label: 'Wd', value: 13 }, { label: 'St', value: 8 }],
  loot: [
    { name: 'Coif', slot: 'Head', rarity: 'Uncommon' },
    { name: 'Bent Dagger', slot: 'Weapon', rarity: 'Common' },
  ],
  bonuses: [
    { label: 'Combat margin', detail: '62% HP kept', pct: 31 },
    { label: 'Level bonus', detail: 'avg Lv 18', pct: 7.2 },
    { label: 'Party size', detail: '×2', pct: 10 },
    { label: 'Transcendence', detail: '×1', pct: 10 },
  ],
  newlyUnlocked: [],
}

// Timeout loss: the clock expired with enemies alive — survivors keep their (reduced) HP.
export const SAMPLE_CLAIM_LOSS: ClaimResultView = {
  outcome: 'loss',
  reason: 'timeout',
  missionName: 'Frozen Pass',
  stage: 5,
  durationSeconds: 120,
  survivingHpPct: 0.18,
  party: [
    { name: 'Lyra Swift', class: 'Rogue', level: 12, endingHp: 22, maxHp: 140, xpGained: 0 },
    { name: 'Sally Whitemane', class: 'Priest', level: 15, endingHp: 0, maxHp: 180, xpGained: 0 },
  ],
  baseGold: 0,
  resources: [],
  loot: [],
  bonuses: [],
  newlyUnlocked: [],
}

// Wipe loss: every hero at 0 HP before the enemies died.
export const SAMPLE_CLAIM_WIPE: ClaimResultView = {
  outcome: 'loss',
  reason: 'party-wiped',
  missionName: 'Frozen Pass',
  stage: 5,
  durationSeconds: 74,
  survivingHpPct: 0,
  party: [
    { name: 'Lyra Swift', class: 'Rogue', level: 12, endingHp: 0, maxHp: 140, xpGained: 0 },
    { name: 'Sally Whitemane', class: 'Priest', level: 15, endingHp: 0, maxHp: 180, xpGained: 0 },
  ],
  baseGold: 0,
  resources: [],
  loot: [],
  bonuses: [],
  newlyUnlocked: [],
}
