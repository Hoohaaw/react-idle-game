import { defineType, defineField } from 'sanity'
import { STAT_DEFS } from '../../../src/lib/statDefinitions'

const STAT_OPTIONS = STAT_DEFS.map((s) => ({ title: s.label, value: s.key }))

// What a single blessing node grants, per rank. The engine multiplies perRank by the
// ranks the player has spent and folds it into the stat-stacking formula
// (flat adds directly; pct applies to the baseline only).
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
      name: 'perRank',
      title: 'Per rank',
      description: 'Amount granted per rank (total = perRank × ranks spent).',
      type: 'number',
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { stat: 'stat', kind: 'kind', perRank: 'perRank' },
    prepare: ({ stat, kind, perRank }) => ({
      title: `${stat ?? '?'} ${kind === 'pct' ? `+${perRank}%` : `+${perRank}`} / rank`,
    }),
  },
})
