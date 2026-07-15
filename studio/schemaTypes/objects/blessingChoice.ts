import { defineType, defineField, defineArrayMember } from 'sanity'
import { StarIcon } from '@sanity/icons'

// One of the two options in a blessing row (ADR-0045) — a real playstyle fork, not a numeric
// upgrade: both choices in a row are priced equally (enforced by blessingRow's validator).
export const blessingChoice = defineType({
  name: 'blessingChoice',
  title: 'Choice',
  type: 'object',
  icon: StarIcon,
  fields: [
    defineField({
      name: 'choiceId',
      title: 'Choice',
      type: 'string',
      options: {
        list: [
          { title: 'A', value: 'a' },
          { title: 'B', value: 'b' },
        ],
        layout: 'radio',
      },
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
      description: 'Player-facing flavor text — bespoke per character (docs/BLESSINGS.md).',
    }),
    defineField({
      name: 'effects',
      type: 'array',
      of: [defineArrayMember({ type: 'nodeEffect' })],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    select: { title: 'title', choiceId: 'choiceId' },
    prepare: ({ title, choiceId }) => ({
      title,
      subtitle: choiceId ? `Choice ${String(choiceId).toUpperCase()}` : undefined,
    }),
  },
})
