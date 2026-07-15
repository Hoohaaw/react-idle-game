import { defineType, defineField } from 'sanity'
import { SCHOOL_KEYS } from '../../../src/lib/schools'
import { MINE_DEFS } from '../../../src/lib/gather'

// A reusable "when is this active" condition (ADR-0045) — extracted from traitDef so the same
// cross-field validation serves BOTH traitDef.condition (ADR-0035) and the blessing capstone's
// conditional flavor, instead of duplicating the rule in two schema files.

const ENEMY_ARCHETYPES = ['bruiser', 'caster', 'tank', 'swarm', 'boss']
const RESOURCE_KEYS = MINE_DEFS.map((m) => m.resourceKey)

const CONDITION_TYPES = [
  { title: 'Always', value: 'always' },
  { title: 'On a specific map', value: 'map' },
  { title: 'Vs enemy archetype', value: 'enemyArchetype' },
  { title: 'Vs enemy damage school', value: 'enemySchool' },
  { title: 'Gathering a resource', value: 'resource' },
]

export const conditionTrigger = defineType({
  name: 'conditionTrigger',
  title: 'Condition',
  type: 'object',
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
})
