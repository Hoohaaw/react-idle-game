import { defineType, defineField } from 'sanity'
import { STAT_DEFS } from '../../../src/lib/statDefinitions'

const STAT_OPTIONS = STAT_DEFS.map((s) => ({ title: s.label, value: s.key }))

// What a single blessing choice or capstone grants (ADR-0045). No ranks — a blessing pick is
// always on/off, never stacked — so this is a flat stat grant (flat adds directly to the
// baseline; pct applies to the baseline only), the same shape as an item or trait effect.
export const nodeEffect = defineType({
  name: 'nodeEffect',
  title: 'Effect',
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
      name: 'kind',
      title: 'Kind',
      type: 'string',
      options: {
        list: [
          { title: 'Flat', value: 'flat' },
          { title: 'Percent', value: 'pct' },
        ],
        layout: 'radio',
      },
      initialValue: 'flat',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'value',
      title: 'Value',
      description: 'Amount granted once this blessing is picked.',
      type: 'number',
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { stat: 'stat', kind: 'kind', value: 'value' },
    prepare: ({ stat, kind, value }) => ({
      title: `${stat ?? '?'} ${kind === 'pct' ? `+${value}%` : `+${value}`}`,
    }),
  },
})
