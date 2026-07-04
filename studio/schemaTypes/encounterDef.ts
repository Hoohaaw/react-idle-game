import { defineType, defineField, defineArrayMember } from 'sanity'
import { BoltIcon } from '@sanity/icons'

// A mission's fight (ADR-0013): the list of 1–N enemies the party auto-battles at claim, plus the time
// cap that turns an un-winnable fight into a LOSS (ADR-0014 — so an unkillable-but-low-DPS comp simply
// times out). A future missionDef will reference this by `encounterKey` (missions aren't authored yet).
export const encounterDef = defineType({
  name: 'encounterDef',
  title: 'Encounter',
  type: 'document',
  icon: BoltIcon,
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'encounterKey',
      title: 'Encounter key',
      description:
        'Stable id a mission references. Lowercase letters, numbers and hyphens. NEVER change once live.',
      type: 'string',
      validation: (rule) =>
        rule.required().custom((value) => {
          if (!value) return 'Required'
          if (!/^[a-z0-9-]+$/.test(value)) return 'Lowercase letters, numbers and hyphens only'
          return true
        }),
    }),
    defineField({ name: 'description', type: 'text', rows: 2 }),
    defineField({
      name: 'enemies',
      title: 'Enemies',
      description: '1–N enemies fought together. Use Count on a line for swarms of the same enemy.',
      type: 'array',
      of: [defineArrayMember({ type: 'encounterEnemy' })],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'timeLimitSeconds',
      title: 'Time limit (combat seconds)',
      description:
        'The fight cap. If the party has not won by here it is a LOSS (ADR-0013/0014). This is abstract in-fight time, NOT the mission wait timer.',
      type: 'number',
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    select: { title: 'name', enemies: 'enemies' },
    prepare({ title, enemies }) {
      const n = Array.isArray(enemies)
        ? enemies.reduce((sum: number, e: { count?: number }) => sum + (e?.count || 1), 0)
        : 0
      return { title, subtitle: `${n} enem${n === 1 ? 'y' : 'ies'}` }
    },
  },
})
