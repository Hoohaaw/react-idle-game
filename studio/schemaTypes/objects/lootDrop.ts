import { defineType, defineField, defineArrayMember } from 'sanity'

// One line of a mission's loot table — an INDEPENDENT per-item roll (decided 2026-07-05):
// on a win the claim resolver rolls EACH drop separately against its own dropChance, and for
// every item that drops it rolls a rarity from that drop's own weights. So a mission can hand out
// several items in one clear, each at its own odds. The five rarities match the player_inventory
// CHECK constraint exactly (Common…Legendary).
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] as const

export const lootDrop = defineType({
  name: 'lootDrop',
  title: 'Loot drop',
  type: 'object',
  fields: [
    defineField({
      name: 'item',
      title: 'Item',
      type: 'reference',
      to: [{ type: 'itemDef' }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'dropChance',
      title: 'Drop chance (%)',
      description: 'Independent probability THIS item drops on a win (rolled separately from every other line).',
      type: 'number',
      initialValue: 100,
      validation: (rule) => rule.required().min(0).max(100),
    }),
    defineField({
      name: 'rarityWeights',
      title: 'Rarity weights',
      description:
        'When this item drops, its rarity is a weighted roll among these lines. Omit a rarity to make it impossible; leave the whole list empty to always drop Common.',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'rarityWeight',
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
        }),
      ],
    }),
    defineField({
      name: 'quantityMin',
      title: 'Quantity (min)',
      type: 'number',
      initialValue: 1,
      validation: (rule) => rule.required().integer().min(1),
    }),
    defineField({
      name: 'quantityMax',
      title: 'Quantity (max)',
      description: 'Rolled uniformly in [min, max] when the item drops.',
      type: 'number',
      initialValue: 1,
      validation: (rule) =>
        rule.required().integer().min(1).custom((max, ctx) => {
          const min = (ctx.parent as { quantityMin?: number })?.quantityMin
          if (typeof min === 'number' && typeof max === 'number' && max < min)
            return 'Max must be ≥ min'
          return true
        }),
    }),
  ],
  preview: {
    select: { name: 'item.name', chance: 'dropChance' },
    prepare({ name, chance }) {
      return { title: name || '(no item selected)', subtitle: chance != null ? `${chance}% drop` : undefined }
    },
  },
})
