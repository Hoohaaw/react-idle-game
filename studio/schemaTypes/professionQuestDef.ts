import { defineType, defineField, defineArrayMember } from 'sanity'
import { ClipboardIcon } from '@sanity/icons'

// A profession-expert quest (docs/superpowers/specs/2026-10-16-profession-system-design.md
// Decision 4 channel 2): turn in `cost` (reagentLine's resource/item/currency mix) once, get
// rewardRecipe unlocked permanently. Level-10-exclusive quests are NOT a separate mechanism —
// they're just entries authored with requiredLevel: 10.
const PROFESSION_OPTIONS = [
  { title: 'Alchemy', value: 'alchemy' },
  { title: 'Carving', value: 'carving' },
  { title: 'Prospecting', value: 'prospecting' },
  { title: 'Tempering', value: 'tempering' },
  { title: 'Arcane Writing', value: 'arcaneWriting' },
]

export const professionQuestDef = defineType({
  name: 'professionQuestDef',
  title: 'Profession Quest',
  type: 'document',
  icon: ClipboardIcon,
  fields: [
    defineField({ name: 'name', type: 'string', validation: (rule) => rule.required() }),
    defineField({
      name: 'questKey',
      title: 'Quest key',
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
      name: 'professionKey',
      title: 'Profession',
      type: 'string',
      options: { list: PROFESSION_OPTIONS },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'requiredLevel',
      title: 'Required profession level',
      type: 'number',
      initialValue: 1,
      validation: (rule) => rule.required().integer().min(1).max(10),
    }),
    defineField({
      name: 'description',
      type: 'text',
      rows: 2,
    }),
    defineField({
      name: 'cost',
      title: 'Turn-in cost (1-6)',
      type: 'array',
      of: [defineArrayMember({ type: 'reagentLine' })],
      validation: (rule) => rule.required().min(1).max(6),
    }),
    defineField({
      name: 'rewardRecipe',
      title: 'Reward recipe',
      type: 'reference',
      to: [{ type: 'recipeDef' }],
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { title: 'name', profession: 'professionKey', level: 'requiredLevel' },
    prepare({ title, profession, level }) {
      return { title, subtitle: `${profession} · requires level ${level}` }
    },
  },
})
