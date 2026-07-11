import type { DropItem } from '@/types/loot'
import type { CharacterRole } from '@/lib/roles'
import type { School } from '@/lib/schools'
import type { MissionEnemyView } from '@/services/missions'

// Prop shapes for MissionDispatch + the sample data that drives the /design showcase (replaced by
// real mission + roster data when wired). Data-only module so the component file stays HMR-clean.
export type DispatchMission = {
  missionKey?: string
  name: string
  stage?: number
  description: string
  duration: string // display label, e.g. "3:00"
  baseXp: number
  loot: DropItem[]
  enemies: MissionEnemyView[]
}

export type DispatchChar = {
  id: string
  name: string
  charClass: string
  level: number
  role?: CharacterRole
  damageSchool?: School
  busy?: string // a label (e.g. "On mission") — present means the character can't be selected
  downed?: boolean
}

export const SAMPLE_DISPATCH_MISSION: DispatchMission = {
  name: 'Goblin Outpost',
  stage: 3,
  description: 'A ramshackle camp of goblin raiders harassing the eastern road. Clear them out and claim whatever they have hoarded away.',
  duration: '3:00',
  baseXp: 120,
  loot: [
    { name: 'Coif', slot: 'Head', chances: [{ rarity: 'Common', chance: 90 }, { rarity: 'Uncommon', chance: 15 }] },
    { name: 'Tattered Cloak', slot: 'Chest', chances: [{ rarity: 'Common', chance: 80 }, { rarity: 'Uncommon', chance: 10 }] },
    { name: 'Bent Dagger', slot: 'Weapon', chances: [{ rarity: 'Common', chance: 70 }, { rarity: 'Uncommon', chance: 6 }] },
  ],
  enemies: [
    { name: 'Goblin Raider', count: 3, damageType: 'physical', resistances: [] },
    {
      name: 'Goblin Pyromancer',
      count: 1,
      damageType: 'fire',
      resistances: [
        { school: 'fire', value: 100 },
        { school: 'ice', value: 0 },
      ],
    },
  ],
}

export const SAMPLE_DISPATCH_ROSTER: DispatchChar[] = [
  { id: 'r1', name: 'Lyra Swift', charClass: 'Rogue', level: 12 },
  // ADR-0008 demo: a Death Knight (tank by class) authored as a Damage dealer.
  { id: 'r2', name: 'Alexandros Mograine', charClass: 'Death Knight', level: 24, role: 'damage' },
  { id: 'r3', name: 'Fandral Staghelm', charClass: 'Druid', level: 9, busy: 'Gathering' },
  { id: 'r4', name: 'Sally Whitemane', charClass: 'Priest', level: 15, damageSchool: 'holy' },
]
