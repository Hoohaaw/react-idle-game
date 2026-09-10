import { defineType, defineField } from 'sanity'

// One line of a weighted rarity roll — shared by lootDrop (mission loot) and recipeDef (crafted
// result). Promoted out of lootDrop's inline array member so both can reference one definition.
// The five rarities match the player_inventory CHECK constraint exactly (Common…Legendary).
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] as const

export const rarityWeight = defineType({
  name: 'rarityWeight',
  title: 'Rarity weight',
  type: 'object',
  fields: [
    defineField({
      name: 'rarity',
      title: 'Rarity',
      type: 'string',
      options: { list: RARITIES.map((r) => ({ title: r, value: r })) },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'weight',
      title: 'Weight',
      type: 'number',
      validation: (rule) => rule.required().min(0),
    }),
  ],
  preview: {
    select: { rarity: 'rarity', weight: 'weight' },
    prepare: ({ rarity, weight }) => ({ title: `${rarity ?? '?'} · w${weight ?? 0}` }),
  },
})
