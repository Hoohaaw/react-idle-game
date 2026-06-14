import { defineType, defineField, defineArrayMember } from 'sanity'
import { UserIcon } from '@sanity/icons'
import { CLASS_ROLE, ROLE_STYLES } from '../../src/lib/roles'

// Class options come from the shared CLASS_ROLE map (single source of truth). Class sets the
// DEFAULT role; the optional `role` field below can override it per character (ADR-0008).
const CLASS_OPTIONS = Object.keys(CLASS_ROLE).map((c) => ({ title: c, value: c }))
const ROLE_OPTIONS = Object.entries(ROLE_STYLES).map(([value, s]) => ({ title: s.label, value }))

type BlessingNodeValue = { isUltimate?: boolean }

export const characterDef = defineType({
  name: 'characterDef',
  title: 'Character',
  type: 'document',
  icon: UserIcon,
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'charKey',
      title: 'Character key',
      description: 'Stable id the game DB references. Lowercase letters, numbers and hyphens. NEVER change once live.',
      type: 'string',
      validation: (rule) =>
        rule.required().custom((value) => {
          if (!value) return 'Required'
          if (!/^[a-z0-9-]+$/.test(value)) return 'Lowercase letters, numbers and hyphens only'
          return true
        }),
    }),
    defineField({
      name: 'charClass',
      title: 'Class',
      description: 'Sets the default role (see Role below, which can override it).',
      type: 'string',
      options: { list: CLASS_OPTIONS },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'role',
      title: 'Role',
      description:
        'Leave blank to use the class default. Set it to OVERRIDE — e.g. a Mage authored as a Healer (ADR-0008).',
      type: 'string',
      options: { list: ROLE_OPTIONS },
    }),
    defineField({
      name: 'baseStats',
      title: 'Base stats (level 1)',
      type: 'array',
      of: [defineArrayMember({ type: 'statValue' })],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'growth',
      title: 'Growth per level',
      type: 'array',
      of: [defineArrayMember({ type: 'statGrowth' })],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'blessingTree',
      title: 'Blessing tree',
      type: 'array',
      of: [defineArrayMember({ type: 'blessingNode' })],
      validation: (rule) =>
        rule.custom((nodes?: BlessingNodeValue[]) => {
          if (!nodes || nodes.length === 0) return true // allow incremental authoring
          const ultimates = nodes.filter((n) => n.isUltimate).length
          if (ultimates > 1) return 'Only one node can be the ultimate (row 7).'
          return true
        }),
    }),
  ],
  preview: {
    select: { title: 'name', subtitle: 'charClass' },
  },
})
