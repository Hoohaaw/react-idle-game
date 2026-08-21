import { defineType, defineField } from 'sanity'

// A rare "recruitment token" loot line — a character named on a mission's loot table, rolled
// independently on a win alongside item loot (docs/superpowers/specs/2026-08-20-character-
// acquisition-design.md §6). No rarity weights or quantity (a character isn't rarity-rolled or
// stackable) — mirrors lootDrop.ts's shape, simplified.
export const characterLootDrop = defineType({
  name: 'characterLootDrop',
  title: 'Character loot drop',
  type: 'object',
  fields: [
    defineField({
      name: 'character',
      title: 'Character',
      type: 'reference',
      to: [{ type: 'characterDef' }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'dropChance',
      title: 'Drop chance (%)',
      description: 'Independent probability this character unlocks on a win (rolled once, separately from item loot).',
      type: 'number',
      initialValue: 1,
      validation: (rule) => rule.required().min(0).max(100),
    }),
  ],
  preview: {
    select: { name: 'character.name', chance: 'dropChance' },
    prepare({ name, chance }) {
      return { title: name || '(no character selected)', subtitle: chance != null ? `${chance}% drop` : undefined }
    },
  },
})
