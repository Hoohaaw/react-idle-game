import { defineType, defineField, defineArrayMember } from 'sanity'
import { SparklesIcon } from '@sanity/icons'
import { SCHOOL_KEYS } from '../../src/lib/schools'
import { MINE_DEFS } from '../../src/lib/gather'

// A TRAIT definition (ADR-0035, docs/TRAITS.md): an innate, authored, CONDITIONAL stat modifier.
// Registry-style (ADR-0004): ~15–20 of these exist; characters reference them (characterDef.traits,
// count fixed by rarity). Effects target the ordinary stat registry and stack through the same
// {flat, pct} rule as gear/blessings — the engine layer is src/lib/traits.ts.
//
// Authoring law (docs/TRAITS.md §4): max ONE always-on combat trait per character — enforced by
// review, not schema (validating across references is async-heavy; revisit if it's ever violated).

const ENEMY_ARCHETYPES = ['bruiser', 'caster', 'tank', 'swarm', 'boss']
const RESOURCE_KEYS = MINE_DEFS.map((m) => m.resourceKey)

const CONDITION_TYPES = [
  { title: 'Always', value: 'always' },
  { title: 'On a specific map', value: 'map' },
  { title: 'Vs enemy archetype', value: 'enemyArchetype' },
  { title: 'Vs enemy damage school', value: 'enemySchool' },
  { title: 'Gathering a resource', value: 'resource' },
]

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
      type: 'object',
      validation: (rule) => rule.required(),
      fields: [
        defineField({
          name: 'type',
          type: 'string',
          options: { list: CONDITION_TYPES, layout: 'radio' },
          initialValue: 'always',
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: 'value',
          type: 'string',
          description:
            'The map key / enemy archetype / school / resource this matches. Leave empty for Always.',
          validation: (rule) =>
            rule.custom((value, context) => {
              const type = (context.parent as { type?: string } | undefined)?.type
              if (!type || type === 'always') {
                return value ? 'Always-conditions take no value' : true
              }
              if (!value) return 'This condition type needs a value'
              if (type === 'enemyArchetype' && !ENEMY_ARCHETYPES.includes(value)) {
                return `Unknown archetype — one of: ${ENEMY_ARCHETYPES.join(', ')}`
              }
              if (type === 'enemySchool' && !SCHOOL_KEYS.includes(value as (typeof SCHOOL_KEYS)[number])) {
                return `Unknown school — one of: ${SCHOOL_KEYS.join(', ')}`
              }
              if (type === 'resource' && !RESOURCE_KEYS.includes(value)) {
                return `Unknown resource — one of: ${RESOURCE_KEYS.join(', ')}`
              }
              return true // map keys live in content — not validated here
            }),
        }),
      ],
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
