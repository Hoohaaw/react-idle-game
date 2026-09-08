import { defineType, defineField, defineArrayMember } from 'sanity'
import { CircleIcon } from '@sanity/icons'
import { SCHOOL_DEFS } from '../../src/lib/schools'

const SCHOOL_OPTIONS = SCHOOL_DEFS.filter((s) => s.key !== 'physical').map((s) => ({
  title: `${s.label} ${s.icon}`,
  value: s.key,
}))

// A raid (spec §4c): up to 10 characters, exactly (trash, trash, trash, boss) — 4 stages. Same
// mapGate/theme pattern as dungeonDef; the boss stage carries the game's biggest Legendary weight.
export const raidDef = defineType({
  name: 'raidDef',
  title: 'Raid',
  type: 'document',
  icon: CircleIcon,
  fields: [
    defineField({ name: 'name', type: 'string', validation: (rule) => rule.required() }),
    defineField({
      name: 'raidKey',
      title: 'Raid key',
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
      type: 'string',
      options: { list: SCHOOL_OPTIONS },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'mapGate',
      title: 'Map gate',
      type: 'reference',
      to: [{ type: 'mapDef' }],
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'description', type: 'text', rows: 2 }),
    defineField({
      name: 'stages',
      title: 'Stages (exactly 4: trash, trash, trash, boss)',
      type: 'array',
      of: [defineArrayMember({ type: 'groupStage' })],
      validation: (rule) =>
        rule.required().length(4).custom((stages: { kind?: string }[] | undefined) => {
          if (!stages) return true
          const ok = stages[0]?.kind === 'trash' && stages[1]?.kind === 'trash' && stages[2]?.kind === 'trash' && stages[3]?.kind === 'boss'
          return ok || 'Must be exactly (trash, trash, trash, boss)'
        }),
    }),
  ],
  preview: {
    select: { title: 'name', theme: 'theme', key: 'raidKey' },
    prepare({ title, theme, key }) {
      return { title, subtitle: [theme, key].filter(Boolean).join(' · ') }
    },
  },
})
