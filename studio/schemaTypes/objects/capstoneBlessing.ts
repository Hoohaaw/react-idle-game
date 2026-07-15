import { defineType, defineField, defineArrayMember } from 'sanity'
import { SparklesIcon } from '@sanity/icons'

// A character's single capstone blessing (ADR-0045) — earned, not chosen: granted once level
// >= 50 AND all 4 rows are picked (computed on read, src/lib/blessings.ts — never written to the
// player row). Three effect flavors; 'ability' is engine-supported from Phase B onward
// (src/lib/combat.ts) — until then a stat/conditional capstone resolves entirely through the
// ordinary stat pipeline, same as a blessing choice.
export const capstoneBlessing = defineType({
  name: 'capstoneBlessing',
  title: 'Capstone blessing',
  type: 'object',
  icon: SparklesIcon,
  fields: [
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
      name: 'kind',
      title: 'Kind',
      type: 'string',
      options: {
        list: [
          { title: 'Flat stat bonus', value: 'stat' },
          { title: 'Conditional stat bonus', value: 'conditional' },
          { title: 'Scripted ability', value: 'ability' },
        ],
        layout: 'radio',
      },
      initialValue: 'stat',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'effects',
      title: 'Effects',
      description:
        'Stat modifiers granted once earned — same shape as a blessing choice. Used by Kind = Flat/Conditional; leave empty for Ability.',
      type: 'array',
      of: [defineArrayMember({ type: 'nodeEffect' })],
      validation: (rule) =>
        rule.custom((value: unknown[] | undefined, context) => {
          const kind = (context.parent as { kind?: string } | undefined)?.kind
          if (kind === 'ability') return true
          return value && value.length > 0 ? true : 'A stat/conditional capstone needs at least one effect.'
        }),
    }),
    defineField({
      name: 'condition',
      title: 'Condition',
      description:
        'When the bonus applies (reuses the trait condition engine). Only used by Kind = Conditional.',
      type: 'conditionTrigger',
      validation: (rule) =>
        rule.custom((value, context) => {
          const kind = (context.parent as { kind?: string } | undefined)?.kind
          if (kind !== 'conditional') return true
          return value ? true : 'A conditional capstone needs a condition.'
        }),
    }),
  ],
  preview: {
    select: { title: 'title', kind: 'kind' },
    prepare: ({ title, kind }) => ({ title, subtitle: kind }),
  },
})
