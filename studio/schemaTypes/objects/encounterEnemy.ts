import { defineType, defineField } from 'sanity'

// One line of an encounter: which enemy, and how many of it (for swarms). Kept as a tiny object so a
// "3× Goblin" reads cleanly rather than repeating the reference three times.
export const encounterEnemy = defineType({
  name: 'encounterEnemy',
  title: 'Encounter enemy',
  type: 'object',
  fields: [
    defineField({
      name: 'enemy',
      title: 'Enemy',
      type: 'reference',
      to: [{ type: 'enemyDef' }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'count',
      title: 'Count',
      type: 'number',
      initialValue: 1,
      validation: (rule) => rule.required().integer().min(1),
    }),
  ],
  preview: {
    select: { name: 'enemy.name', count: 'count' },
    prepare({ name, count }) {
      return { title: name || '(no enemy selected)', subtitle: count ? `×${count}` : undefined }
    },
  },
})
