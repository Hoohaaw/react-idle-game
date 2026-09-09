import { defineType, defineField, defineArrayMember } from 'sanity'
import { CircleIcon } from '@sanity/icons'
import { SCHOOL_DEFS } from '../../src/lib/schools'

const SCHOOL_OPTIONS = SCHOOL_DEFS.filter((s) => s.key !== 'physical').map((s) => ({
  title: `${s.label} ${s.icon}`,
  value: s.key,
}))

// A dungeon (docs/superpowers/specs/2026-09-08-dungeons-and-raids-design.md §4b): up to 5
// characters, exactly 3x (trash, trash, boss) — 9 stages total, boss difficulty escalating via
// encounter composition (spec §7), not tier. Gated by clearing `mapGate`'s stage 7.
export const dungeonDef = defineType({
  name: 'dungeonDef',
  title: 'Dungeon',
  type: 'document',
  icon: CircleIcon,
  fields: [
    defineField({ name: 'name', type: 'string', validation: (rule) => rule.required() }),
    defineField({
      name: 'dungeonKey',
      title: 'Dungeon key',
      description: 'Stable id (group_runs.def_key). Lowercase letters, numbers and hyphens. NEVER change once live.',
      type: 'string',
      validation: (rule) =>
        rule.required().custom((value) => {
          if (!value) return 'Required'
          if (!/^[a-z0-9-]+$/.test(value)) return 'Lowercase letters, numbers and hyphens only'
          return true
        }),
    }),
    defineField({
      name: 'theme',
      title: 'Theme (damage school)',
      description: 'Governs both flavor (item naming) and mechanics (this dungeon\'s enemyDefs should be authored with this damageType).',
      type: 'string',
      options: { list: SCHOOL_OPTIONS },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'mapGate',
      title: 'Map gate',
      description: 'Clearing this map\'s stage 7 unlocks the dungeon. Difficulty stays in this map\'s tier band (spec §7).',
      type: 'reference',
      to: [{ type: 'mapDef' }],
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'description', type: 'text', rows: 2 }),
    defineField({
      name: 'stages',
      title: 'Stages (exactly 9: trash, trash, boss ×3)',
      type: 'array',
      of: [defineArrayMember({ type: 'groupStage' })],
      validation: (rule) =>
        rule.required().length(9).custom((stages: { kind?: string }[] | undefined) => {
          if (!stages) return true
          const pattern = [0, 3, 6].every((i) => stages[i]?.kind === 'trash' && stages[i + 1]?.kind === 'trash' && stages[i + 2]?.kind === 'boss')
          return pattern || 'Must be exactly 3x (trash, trash, boss)'
        }),
    }),
  ],
  preview: {
    select: { title: 'name', theme: 'theme', key: 'dungeonKey' },
    prepare({ title, theme, key }) {
      return { title, subtitle: [theme, key].filter(Boolean).join(' · ') }
    },
  },
})
