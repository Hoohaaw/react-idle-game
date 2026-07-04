import { defineType, defineField } from 'sanity'

// A guaranteed (non-loot) reward a mission pays on a WIN, before the reward multipliers
// (marginBonus × levelBonus × party × transcendence — ADR-0012/0014) are applied by the claim
// resolver. Currencies and resources are code-side registries stored as JSONB on `profiles`
// (ADR-0004), so we author the registry CODE as a string here — adding a new currency/resource
// needs no schema change.
export const missionReward = defineType({
  name: 'missionReward',
  title: 'Reward',
  type: 'object',
  fields: [
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      options: {
        list: [
          { title: 'Currency', value: 'currency' },
          { title: 'Resource', value: 'resource' },
        ],
        layout: 'radio',
      },
      initialValue: 'currency',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'code',
      title: 'Registry code',
      description: 'The currency/resource key from the code-side registry (e.g. "gold", "wood"). Lowercase.',
      type: 'string',
      validation: (rule) =>
        rule.required().custom((value) => {
          if (!value) return 'Required'
          if (!/^[a-z0-9-]+$/.test(value)) return 'Lowercase letters, numbers and hyphens only'
          return true
        }),
    }),
    defineField({
      name: 'amount',
      title: 'Base amount',
      description: 'Amount before reward multipliers.',
      type: 'number',
      validation: (rule) => rule.required().min(0),
    }),
  ],
  preview: {
    select: { kind: 'kind', code: 'code', amount: 'amount' },
    prepare: ({ kind, code, amount }) => ({
      title: `${amount ?? 0} ${code ?? '?'}`,
      subtitle: kind,
    }),
  },
})
