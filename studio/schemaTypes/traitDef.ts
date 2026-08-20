import { defineType, defineField, defineArrayMember } from 'sanity'
import { SparklesIcon } from '@sanity/icons'

// A TRAIT definition (ADR-0035, docs/TRAITS.md): an innate, authored, CONDITIONAL stat modifier.
// Registry-style (ADR-0004): ~15–20 of these exist; characters reference them (characterDef.traits,
// count fixed by rarity). Effects target the ordinary stat registry and stack through the same
// {flat, pct} rule as gear/blessings — the engine layer is src/lib/traits.ts.
//
// Authoring law (docs/TRAITS.md §4): max ONE always-on combat trait per character — enforced by
// review, not schema (validating across references is async-heavy; revisit if it's ever violated).

export const traitDef = defineType({
  name: 'traitDef',
  title: 'Trait',
  type: 'document',
  icon: SparklesIcon,
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      description: 'Player-facing name ("Gravehand", "Giantslayer", "Lumberjack"…).',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'traitKey',
      title: 'Trait key',
      description: 'Stable id. Lowercase letters, numbers and hyphens. NEVER change once live.',
      type: 'string',
      validation: (rule) =>
        rule.required().custom((value) => {
          if (!value) return 'Required'
          if (!/^[a-z0-9-]+$/.test(value)) return 'Lowercase letters, numbers and hyphens only'
          return true
        }),
    }),
    defineField({
      name: 'description',
      type: 'text',
      rows: 2,
      description: 'Plain-language tooltip ("Deals more damage in Gravemarch.").',
    }),
    defineField({
      name: 'condition',
      title: 'Condition',
      description: 'When the trait is active. Effects apply only while this holds (src/lib/traits.ts).',
      type: 'conditionTrigger',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'effects',
      title: 'Effects',
      description:
        'Stat modifiers while active — same shape and stacking rule as gear bonuses. Magnitude bands per docs/TRAITS.md §3.',
      type: 'array',
      of: [defineArrayMember({ type: 'itemStat' })],
      validation: (rule) => rule.required().min(1).max(2),
    }),
  ],
  preview: {
    select: { title: 'name', ctype: 'condition.type', cvalue: 'condition.value' },
    prepare({ title, ctype, cvalue }) {
      return { title, subtitle: ctype === 'always' ? 'always' : `${ctype}: ${cvalue ?? '?'}` }
    },
  },
})
