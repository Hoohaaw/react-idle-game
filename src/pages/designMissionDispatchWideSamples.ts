import type { CharacterRole } from '@/lib/roles'
import type { TraitDef, TraitContext } from '@/lib/traits'
import type { School } from '@/lib/schools'
import type { RarityChance } from '@/types/loot'

// Sample data for the wide Mission Dispatch redesign prototype (/design only).
// Self-contained per the design-page workflow — not wired to real mission/roster data.

export type WideEnemy = { name: string; count: number; damageType: School; archetype?: string; health: number }
export type WideLoot = { name: string; slot: string; chances: RarityChance[] }
export type WideChar = {
  id: string
  name: string
  charClass: string
  level: number
  role?: CharacterRole
  damageSchool?: School
  rarity: string
  traits: TraitDef[]
  busy?: string
  downed?: boolean
}

export const MISSION = {
  name: 'Sundered Vault',
  map: 'Gravemarch',
  stage: 7,
  boss: true,
  description:
    'The Gravemarch\'s final vault, sealed for a thousand years — until the wardstones cracked. ' +
    'Whatever answered still guards its hoard, and it has had a very long time to grow patient.',
  duration: '6:30',
  baseXp: 480,
  enemies: [
    { name: 'Gravemarch Colossus', count: 1, damageType: 'shadow', archetype: 'boss', health: 4200 },
    { name: 'Wailing Shade', count: 4, damageType: 'shadow', archetype: 'swarm', health: 380 },
    { name: 'Vault Warden', count: 2, damageType: 'holy', archetype: 'bruiser', health: 1400 },
  ] as WideEnemy[],
  loot: [
    { name: 'Gravemarch Signet', slot: 'Ring', chances: [{ rarity: 'Epic', chance: 12 }, { rarity: 'Legendary', chance: 2 }] },
    { name: 'Colossus-forged Plate', slot: 'Chest', chances: [{ rarity: 'Rare', chance: 30 }, { rarity: 'Epic', chance: 8 }] },
    { name: 'Warden\'s Bulwark', slot: 'Shield', chances: [{ rarity: 'Rare', chance: 25 }, { rarity: 'Epic', chance: 6 }] },
    { name: 'Shroud of Sighs', slot: 'Trinket', chances: [{ rarity: 'Epic', chance: 10 }] },
  ] as WideLoot[],
}

const TRAIT_GRAVEHAND: TraitDef = { traitKey: 'gravehand', name: 'Gravehand', description: 'Hits harder in the Gravemarch.', condition: { type: 'map', value: 'gravemarch' }, effects: [{ stat: 'attack', kind: 'pct', value: 12 }] }
const TRAIT_SHADOWWARD: TraitDef = { traitKey: 'shadowward', name: 'Shadowward', description: 'Resists shadow damage.', condition: { type: 'enemySchool', value: 'shadow' }, effects: [{ stat: 'resistance', kind: 'flat', value: 20 }] }
const TRAIT_GIANTSLAYER: TraitDef = { traitKey: 'giantslayer', name: 'Giantslayer', description: 'Punishes boss-tier enemies.', condition: { type: 'enemyArchetype', value: 'boss' }, effects: [{ stat: 'critChance', kind: 'flat', value: 10 }] }
const TRAIT_SPELLBREAKER: TraitDef = { traitKey: 'spellbreaker', name: 'Spellbreaker', description: 'Always alert for casters.', condition: { type: 'always' }, effects: [{ stat: 'armorPen', kind: 'flat', value: 5 }] }
const TRAIT_PATHFINDER: TraitDef = { traitKey: 'pathfinder', name: 'Pathfinder', description: 'Brings missions home sooner.', condition: { type: 'always' }, effects: [{ stat: 'missionSpeedDecrease', kind: 'flat', value: 8 }] }
const TRAIT_QUICKHAND: TraitDef = { traitKey: 'quickhand', name: 'Quickhand', description: 'A touch faster in a fight.', condition: { type: 'always' }, effects: [{ stat: 'speed', kind: 'flat', value: 2 }] }
const TRAIT_IRONBLOOD: TraitDef = { traitKey: 'ironblood', name: 'Ironblood', description: 'Recovers a little quicker.', condition: { type: 'always' }, effects: [{ stat: 'recoverySpeed', kind: 'flat', value: 10 }] }
const TRAIT_FORTUNATE: TraitDef = { traitKey: 'fortunate', name: 'Fortunate', description: 'A little luckier with drops.', condition: { type: 'always' }, effects: [{ stat: 'luck', kind: 'flat', value: 5 }] }
const TRAIT_SCHOLAR: TraitDef = { traitKey: 'scholar', name: 'Scholar', description: 'Learns a little faster, for themself.', condition: { type: 'always' }, effects: [{ stat: 'xpGain', kind: 'flat', value: 10 }] }
const TRAIT_LUMBERJACK: TraitDef = { traitKey: 'lumberjack', name: 'Lumberjack', description: 'Hauls more Wood per trip.', condition: { type: 'resource', value: 'Wood' }, effects: [{ stat: 'gatherYield', kind: 'pct', value: 25 }] }

export const ROSTER: WideChar[] = [
  { id: 'r1', name: 'Mordrek Graveborn', charClass: 'Death Knight', level: 34, role: 'tank', rarity: 'Epic', traits: [TRAIT_GRAVEHAND, TRAIT_SHADOWWARD, TRAIT_GIANTSLAYER, TRAIT_SPELLBREAKER] },
  { id: 'r2', name: 'Lyra Swift', charClass: 'Rogue', level: 22, role: 'damage', rarity: 'Uncommon', traits: [TRAIT_PATHFINDER, TRAIT_QUICKHAND] },
  { id: 'r3', name: 'Sally Whitemane', charClass: 'Priest', level: 19, role: 'healer', damageSchool: 'holy', rarity: 'Rare', traits: [TRAIT_IRONBLOOD, TRAIT_FORTUNATE, TRAIT_SCHOLAR] },
  { id: 'r4', name: 'Alexandros Mograine', charClass: 'Death Knight', level: 24, role: 'damage', rarity: 'Uncommon', traits: [TRAIT_QUICKHAND, TRAIT_IRONBLOOD] },
  { id: 'r5', name: 'Fandral Staghelm', charClass: 'Druid', level: 9, role: 'utility', rarity: 'Common', traits: [TRAIT_LUMBERJACK], busy: 'Gathering' },
  { id: 'r6', name: 'Tyra Oakheart', charClass: 'Hunter', level: 15, role: 'damage', rarity: 'Common', traits: [TRAIT_FORTUNATE], downed: true },
  { id: 'r7', name: 'Brennan Ashfall', charClass: 'Warrior', level: 28, role: 'tank', rarity: 'Rare', traits: [TRAIT_SHADOWWARD, TRAIT_IRONBLOOD, TRAIT_QUICKHAND] },
  { id: 'r8', name: 'Isolde Vane', charClass: 'Mage', level: 17, role: 'damage', damageSchool: 'fire', rarity: 'Uncommon', traits: [TRAIT_SCHOLAR, TRAIT_FORTUNATE] },
  { id: 'r9', name: 'Grommash Ironhide', charClass: 'Warrior', level: 31, role: 'tank', rarity: 'Common', traits: [TRAIT_GIANTSLAYER] },
  { id: 'r10', name: 'Elowen Nightsong', charClass: 'Druid', level: 12, role: 'healer', rarity: 'Uncommon', traits: [TRAIT_PATHFINDER, TRAIT_LUMBERJACK] },
  { id: 'r11', name: 'Corwin Blackthorn', charClass: 'Rogue', level: 26, role: 'damage', rarity: 'Rare', traits: [TRAIT_QUICKHAND, TRAIT_GRAVEHAND, TRAIT_SCHOLAR] },
  { id: 'r12', name: 'Thalric Stormbrew', charClass: 'Shaman', level: 8, role: 'healer', rarity: 'Common', traits: [TRAIT_IRONBLOOD], busy: 'On mission' },
]

export const TRAIT_CTX: TraitContext = { mapKey: 'gravemarch', enemyArchetypes: ['boss', 'swarm', 'bruiser'], enemySchools: ['shadow', 'holy'] }
