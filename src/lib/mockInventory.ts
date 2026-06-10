import type { Item } from '../types/item'

// Shared mock inventory for the prototype (replaced by real inventory/service data
// later). Each entry is a stack of one (item + rarity); `quantity` is how many copies
// the player owns. Used by the Inventory and Crafting pages.
export const MOCK_INVENTORY: Item[] = [
  { name: 'Emberforged Greataxe', slot: 'Weapon', rarity: 'Rare', value: 1850, stats: [{ key: 'ATK', value: '+24' }, { key: 'STR', value: '+9' }], quantity: 2 },
  { name: 'Dagger of Whispers', slot: 'Weapon', rarity: 'Epic', value: 4200, stats: [{ key: 'ATK', value: '+18' }, { key: 'AGI', value: '+14' }], flavor: 'It hums faintly, as if remembering every throat it has met.' },
  { name: 'Warden Plate', slot: 'Chest', rarity: 'Uncommon', value: 980, stats: [{ key: 'DEF', value: '+16' }, { key: 'HP', value: '+40' }], quantity: 3 },
  { name: 'Helm of the Vigil', slot: 'Head', rarity: 'Rare', value: 1450, stats: [{ key: 'DEF', value: '+11' }, { key: 'INT', value: '+8' }] },
  { name: 'Coif', slot: 'Head', rarity: 'Common', value: 45, stats: [{ key: 'DEF', value: '+3' }], quantity: 12 },
  { name: 'Band of Embers', slot: 'Ring', rarity: 'Legendary', value: 9800, stats: [{ key: 'ATK', value: '+30' }, { key: 'STR', value: '+22' }, { key: 'AGI', value: '+18' }], flavor: 'Forged in the heart of a dying star. The wearer never feels the cold again.' },
  { name: 'Tattered Cloak', slot: 'Chest', rarity: 'Common', value: 30, stats: [{ key: 'DEF', value: '+2' }], quantity: 5 },
  { name: 'Boots of the Swift', slot: 'Boots', rarity: 'Uncommon', value: 720, stats: [{ key: 'AGI', value: '+10' }, { key: 'SPD', value: '+6' }] },
  { name: 'Sigil of the Vigil', slot: 'Trinket', rarity: 'Epic', value: 3600, stats: [{ key: 'INT', value: '+20' }], flavor: 'A token of an order long since scattered to the winds.' },
  { name: 'Bent Dagger', slot: 'Weapon', rarity: 'Common', value: 25, stats: [{ key: 'ATK', value: '+4' }], quantity: 8 },
  { name: 'Frostweave Gloves', slot: 'Hands', rarity: 'Rare', value: 1320, stats: [{ key: 'INT', value: '+12' }, { key: 'DEF', value: '+7' }] },
  { name: 'Girdle of Might', slot: 'Belt', rarity: 'Uncommon', value: 640, stats: [{ key: 'STR', value: '+11' }, { key: 'HP', value: '+25' }], quantity: 2 },
  { name: 'Pauldrons of Dusk', slot: 'Shoulder', rarity: 'Rare', value: 1280, stats: [{ key: 'DEF', value: '+13' }, { key: 'AGI', value: '+6' }] },
  { name: 'Signet of Ash', slot: 'Ring', rarity: 'Common', value: 60, stats: [{ key: 'STR', value: '+3' }], quantity: 24 },
]
