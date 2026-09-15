import type { RarityChance } from '@/types/loot'
import type { CharacterRole } from '@/lib/roles'

// Sample data for the dungeon/raid stage-wizard redesign prototype (/design only).
// Self-contained per the design-page workflow — not wired to real dungeon/roster data.
// Shaped like the real Emberdeep Vault dungeon (9 stages, (trash,trash,boss)×3), but loot
// names/chances are illustrative. `chances` mirrors lootDrop's real dropChance/rarityWeights
// fields (same ones Missions already renders via RarityChancePill) — the live groupStage schema
// already carries this, it's just not in the client query yet (STAGE_PROJECTION trims it today).

export type WizardLoot = { name: string; slot: string; chances: RarityChance[] }
export type WizardStage = {
  kind: 'trash' | 'boss'
  durationSeconds: number
  baseXp: number
  loot: WizardLoot[]
}

export const LOSS_SCREENS = {
  'party-wiped': {
    title: 'Party Wiped', accent: '#e0635c', border: '#8a2e29', borderSoft: '#5c1f1c',
    headline: 'Your party has fallen — no rewards',
    body: 'Every hero was struck down before the enemies were. Nothing was earned, and downed heroes must be stabilized at the Infirmary before they can fight again. The stage stays where it is — try again with a stronger or different party.',
  },
  timeout: {
    title: 'Out of Time', accent: '#d89a4f', border: '#8a5e29', borderSoft: '#5c3f1c',
    headline: 'The clock ran out — no rewards',
    body: 'The stage dragged on too long with enemies still standing, and that counts as a loss — nothing was earned. Your party survived but carries its wounds. Bring more damage, or heroes this stage cannot resist.',
  },
} as const

export const DUNGEON = {
  name: 'Emberdeep Vault',
  description: 'A sunken forge where the old smiths still hammer, long after the fire went out beneath them.',
}

export const SAMPLE_WIZARD_STAGES: WizardStage[] = [
  { kind: 'trash', durationSeconds: 90, baseXp: 40, loot: [{ name: 'Charred Bone', slot: 'Material', chances: [{ rarity: 'Common', chance: 60 }] }] },
  { kind: 'trash', durationSeconds: 90, baseXp: 40, loot: [{ name: 'Ember Dust', slot: 'Material', chances: [{ rarity: 'Common', chance: 55 }] }] },
  { kind: 'boss', durationSeconds: 180, baseXp: 120, loot: [
    { name: 'Cinderfang Rod', slot: 'Weapon', chances: [{ rarity: 'Rare', chance: 22 }, { rarity: 'Epic', chance: 4 }] },
    { name: 'Ashbound Cloak', slot: 'Back', chances: [{ rarity: 'Uncommon', chance: 30 }, { rarity: 'Rare', chance: 8 }] },
  ] },
  { kind: 'trash', durationSeconds: 90, baseXp: 40, loot: [{ name: 'Charred Bone', slot: 'Material', chances: [{ rarity: 'Common', chance: 60 }] }] },
  { kind: 'trash', durationSeconds: 90, baseXp: 40, loot: [{ name: 'Ember Dust', slot: 'Material', chances: [{ rarity: 'Common', chance: 55 }] }] },
  { kind: 'boss', durationSeconds: 180, baseXp: 120, loot: [{ name: 'Glacial Wand', slot: 'Weapon', chances: [{ rarity: 'Rare', chance: 18 }, { rarity: 'Epic', chance: 3 }] }] },
  { kind: 'trash', durationSeconds: 90, baseXp: 40, loot: [] },
  { kind: 'trash', durationSeconds: 90, baseXp: 40, loot: [{ name: 'Ember Dust', slot: 'Material', chances: [{ rarity: 'Common', chance: 55 }] }] },
  { kind: 'boss', durationSeconds: 240, baseXp: 200, loot: [{ name: "Vaultkeeper's Signet", slot: 'Ring', chances: [{ rarity: 'Epic', chance: 12 }, { rarity: 'Legendary', chance: 2 }] }] },
]

export type WizardChar = {
  id: string
  name: string
  charClass: string
  level: number
  role?: CharacterRole
  busy?: string
  downed?: boolean
}

export const SAMPLE_WIZARD_ROSTER: WizardChar[] = [
  { id: 'r1', name: 'Mordrek Graveborn', charClass: 'Death Knight', level: 34, role: 'tank' },
  { id: 'r2', name: 'Lyra Swift', charClass: 'Rogue', level: 22, role: 'damage' },
  { id: 'r3', name: 'Sally Whitemane', charClass: 'Priest', level: 19, role: 'healer' },
  { id: 'r4', name: 'Alexandros Mograine', charClass: 'Death Knight', level: 24, role: 'damage' },
  { id: 'r5', name: 'Fandral Staghelm', charClass: 'Druid', level: 9, role: 'utility', busy: 'Gathering' },
  { id: 'r6', name: 'Tyra Oakheart', charClass: 'Hunter', level: 15, role: 'damage', downed: true },
]
