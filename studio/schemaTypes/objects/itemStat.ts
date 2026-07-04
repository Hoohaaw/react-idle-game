import { defineType, defineField } from 'sanity'
import { STAT_DEFS } from '../../../src/lib/statDefinitions'

const STAT_OPTIONS = STAT_DEFS.map((s) => ({ title: s.label, value: s.key }))

// A single stat bonus an item grants when equipped. Mirrors the blessing nodeEffect shape
// ({stat, kind, value}) so gear folds into the SAME stacking formula the engine already uses
// (flat adds directly; pct applies to the baseline only — see src/lib/stats.ts). These are the
// BASE (Common) values; per-rarity scaling of item stats is deferred (project_undecided).
export const itemStat = defineType({
  name: 'itemStat',
  title: 'Item stat',
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
      description: 'Base (Common) amount. Total effect stacks with the same {flat, pct} rule as blessings.',
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
