import type { Recipe } from '../types/recipe'

// Mock recipe set for the prototype (replaced by real recipe-config/service data later).
// A small fixed set spanning both kinds (infuse + create); most start undiscovered so the
// recipe book demonstrates hiding locked recipes until they're found in-game.
export const RECIPES: Recipe[] = [
  { id: 'str', name: 'Strength Infusion', kind: 'infuse', result: '+5 Strength to an item', resources: [{ resource: 'Iron', qty: 3 }, { resource: 'Bronze', qty: 2 }], discovered: true },
  { id: 'helm', name: 'Ironforged Helm', kind: 'create', result: 'Ironforged Helm (Head)', resources: [{ resource: 'Iron', qty: 5 }, { resource: 'Coal', qty: 2 }], discovered: true },
  { id: 'agi', name: 'Agility Etching', kind: 'infuse', result: '+5 Agility to an item', resources: [{ resource: 'Silver', qty: 2 }, { resource: 'Wood', qty: 4 }], discovered: false },
  { id: 'vigor', name: 'Vigor Tempering', kind: 'infuse', result: '+30 Health to an item', resources: [{ resource: 'Stone', qty: 5 }, { resource: 'Coal', qty: 3 }], discovered: false },
  { id: 'ring', name: 'Silvered Band', kind: 'create', result: 'Silvered Band (Ring)', resources: [{ resource: 'Silver', qty: 4 }, { resource: 'Gold', qty: 1 }], discovered: false },
  { id: 'blade', name: 'Platinum Greatblade', kind: 'create', result: 'Platinum Greatblade (Weapon)', resources: [{ resource: 'Platinum', qty: 3 }, { resource: 'Iron', qty: 6 }, { resource: 'Coal', qty: 4 }], discovered: false },
]
