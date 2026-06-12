import { defineType, defineField, defineArrayMember } from 'sanity'
import { STAT_DEFS } from '../../../src/lib/statDefinitions'

const STAT_OPTIONS = STAT_DEFS.map((s) => ({ title: s.label, value: s.key }))

// Growth model: a flat per-level gain, plus optional milestone bonuses that ADD on top
// at specific levels. baseline(L) = base + perLevel*(L-1) + sum(milestone.bonus for level <= L).
export const statGrowth = defineType({
  name: 'statGrowth',
  title: 'Stat growth',
  type: 'object',
  fields: [
    defineField({
      name: 'stat',
      title: 'Stat',
      type: 'string',
      options: { list: STAT_OPTIONS },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'perLevel',
      title: 'Per level',
      description: 'Flat amount gained every level.',
      type: 'number',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'milestones',
      title: 'Milestone bonuses',
      description: 'Extra amount ADDED on top of the per-level gain at a specific level.',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'milestone',
          fields: [
            defineField({
              name: 'level',
              type: 'number',
              validation: (rule) => rule.required().min(2).max(50),
            }),
            defineField({
              name: 'bonus',
              type: 'number',
              validation: (rule) => rule.required(),
            }),
          ],
          preview: { select: { title: 'level', subtitle: 'bonus' } },
        }),
      ],
    }),
  ],
  preview: {
    select: { title: 'stat', subtitle: 'perLevel' },
  },
})
