import { defineType, defineField, defineArrayMember } from 'sanity'
import { StarIcon } from '@sanity/icons'
import { auditBlessingRow } from '../../../src/lib/blessingBudget'

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
            const audit = auditBlessingRow(a.effects ?? [], b.effects ?? [])
            if (audit.costA === null || audit.costB === null) {
              // A `pct` effect is present — can't auto-price it the same way (ADR-0045); run
              // blessingBudget.ts's auditPctDrift against this character's real baseline instead
              // (docs/BLESSINGS.md #3) — the check of record for these rows.
              return true
            }
            if (!audit.ok) {
              return `Choices must cost the same (A=${audit.costA.toFixed(2)}, B=${audit.costB.toFixed(2)}) — a real fork, not a bigger number.`
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
