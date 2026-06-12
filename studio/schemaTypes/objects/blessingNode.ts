import { defineType, defineField, defineArrayMember } from 'sanity'
import { StarIcon } from '@sanity/icons'

// One tile in a character's bespoke blessing tree. Approach (a): nodes live as a nested
// array on the characterDef document, and prerequisite arrows are expressed inline via
// `requires` (nodeIds in the same tree) — no separate node documents.
export const blessingNode = defineType({
  name: 'blessingNode',
  title: 'Blessing node',
  type: 'object',
  icon: StarIcon,
  fields: [
    defineField({
      name: 'nodeId',
      title: 'Node ID',
      description:
        'Stable within-tree id, e.g. "r3c2" or "ult". Referenced by prerequisites and by player allocations.',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      type: 'text',
      rows: 2,
    }),
    defineField({
      name: 'row',
      title: 'Row (1–7)',
      type: 'number',
      validation: (rule) => rule.required().min(1).max(7),
    }),
    defineField({
      name: 'col',
      title: 'Column (1–5)',
      type: 'number',
      validation: (rule) => rule.required().min(1).max(5),
    }),
    defineField({
      name: 'maxRank',
      title: 'Max rank',
      type: 'number',
      initialValue: 1,
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'isUltimate',
      title: 'Is ultimate (row 7 capstone)',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'effects',
      type: 'array',
      of: [defineArrayMember({ type: 'nodeEffect' })],
    }),
    defineField({
      name: 'requires',
      title: 'Requires (prerequisite node IDs)',
      description: 'nodeIds that must have ≥1 rank before this node unlocks (the prereq arrows).',
      type: 'array',
      of: [defineArrayMember({ type: 'string' })],
    }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'nodeId' },
  },
})
