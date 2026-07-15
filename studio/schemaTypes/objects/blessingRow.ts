import { defineType, defineField, defineArrayMember } from 'sanity'
import { StarIcon } from '@sanity/icons'
import { flatEffectsCost, BUDGET_TOLERANCE } from '../../../src/lib/characterBudget'

type ChoicePreview = {
  choiceId?: string
  effects?: { stat: string; kind: 'flat' | 'pct'; value: number }[]
}

// One row of a character's bespoke blessing tree (ADR-0045) — exactly 2 choices, pick one,
// permanent. Row N unlocks at character level N×10 (src/lib/blessings.ts).
export const blessingRow = defineType({
  name: 'blessingRow',
  title: 'Blessing row',
  type: 'object',
  icon: StarIcon,
  fields: [
    defineField({
      name: 'row',
      title: 'Row (1-4)',
      type: 'number',
      validation: (rule) => rule.required().min(1).max(4),
    }),
    defineField({
      name: 'choices',
      type: 'array',
      of: [defineArrayMember({ type: 'blessingChoice' })],
      validation: (rule) =>
        rule
          .required()
          .length(2)
          .custom((choices?: ChoicePreview[]) => {
            if (!choices || choices.length !== 2) return true // length() already reports this
            const ids = choices.map((c) => c.choiceId).filter(Boolean)
            if (new Set(ids).size !== ids.length) {
              return 'Both choices must have a different Choice (A/B).'
            }
            const [a, b] = choices
            const costA = flatEffectsCost(a.effects ?? [])
            const costB = flatEffectsCost(b.effects ?? [])
            if (costA === null || costB === null) {
              // A `pct` effect is present — can't auto-price it the same way (ADR-0045); the
              // Phase C calc-script verification is the check of record for these rows.
              return true
            }
            if (Math.abs(costA - costB) > BUDGET_TOLERANCE) {
              return `Choices must cost the same (A=${costA.toFixed(2)}, B=${costB.toFixed(2)}) — a real fork, not a bigger number.`
            }
            return true
          }),
    }),
  ],
  preview: {
    select: { row: 'row', a: 'choices.0.title', b: 'choices.1.title' },
    prepare: ({ row, a, b }) => ({
      title: `Row ${row ?? '?'}`,
      subtitle: [a, b].filter(Boolean).join(' vs '),
    }),
  },
})
