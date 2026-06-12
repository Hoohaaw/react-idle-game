import { defineType, defineField } from 'sanity'
import { STAT_DEFS } from '../../../src/lib/statDefinitions'

// The stat dropdown is generated from the shared registry, so adding a stat there
// (and nowhere else) makes it author-able here.
const STAT_OPTIONS = STAT_DEFS.map((s) => ({ title: s.label, value: s.key }))

export const statValue = defineType({
  name: 'statValue',
  title: 'Stat value',
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
      name: 'value',
      title: 'Base value (level 1)',
      type: 'number',
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { title: 'stat', subtitle: 'value' },
  },
})
