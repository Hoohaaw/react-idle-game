import { defineType, defineField } from 'sanity'

// A character's acquisition price + optional unlock precondition (spec §5a). Referenced directly
// on characterDef, mirroring how `capstone` is a single `capstoneBlessing` object field (not an
// array) on the same document.
export const acquisition = defineType({
  name: 'acquisition',
  title: 'Acquisition',
  type: 'object',
  fields: [
    defineField({
      name: 'goldCost',
      title: 'Gold cost',
      description: 'Always required — every character has a price, even one gated by a condition.',
      type: 'number',
      validation: (rule) => rule.required().min(0),
    }),
    defineField({
      name: 'condition',
      title: 'Unlock condition',
      description: 'Leave blank for gold-only (no precondition, just costs gold once unlocked by default).',
      type: 'acquisitionCondition',
    }),
  ],
  preview: {
    select: { goldCost: 'goldCost', type: 'condition.type' },
    prepare({ goldCost, type }) {
      return { title: `${goldCost ?? '?'} gold`, subtitle: type ? `+ ${type}` : 'gold only' }
    },
  },
})
