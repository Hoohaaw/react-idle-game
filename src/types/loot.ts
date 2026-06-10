export type RarityChance = { rarity: string; chance: number }
export type DropItem = { name: string; slot: string; chances: RarityChance[] }
export type MissionDrops = { mission: string; stage: number; boss?: boolean; pool: DropItem[] }
