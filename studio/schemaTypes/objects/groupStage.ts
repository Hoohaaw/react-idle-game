import { defineType, defineField, defineArrayMember } from 'sanity'

// One stage of a dungeonDef/raidDef run (docs/superpowers/specs/2026-09-08-dungeons-and-raids-
// design.md §4a) — trash packs are an easy item-grab pace, boss stages are the real check. Reuses
// the existing lootDrop/missionReward objects as-is; no new drop mechanism.
export const groupStage = defineType({
  name: 'groupStage',
  title: 'Stage',
  type: 'object',
  fields: [
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      options: { list: [{ title: 'Trash', value: 'trash' }, { title: 'Boss', value: 'boss' }], layout: 'radio' },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'encounter',
      title: 'Encounter (the fight)',
      type: 'reference',
      to: [{ type: 'encounterDef' }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'durationSeconds',
      title: 'Duration (real-world wait, seconds)',
      description: 'Same meaning as missionDef.durationSeconds — the real-world wait, not the in-fight time limit.',
      type: 'number',
      validation: (rule) => rule.required().integer().min(1),
    }),
    defineField({
      name: 'baseXp',
      title: 'Base XP',
      type: 'number',
      initialValue: 0,
      validation: (rule) => rule.required().min(0),
    }),
    defineField({
      name: 'rewards',
      title: 'Guaranteed rewards',
      type: 'array',
      of: [defineArrayMember({ type: 'missionReward' })],
    }),
    defineField({
      name: 'loot',
      title: 'Loot table',
      type: 'array',
      of: [defineArrayMember({ type: 'lootDrop' })],
    }),
  ],
  preview: {
    select: { kind: 'kind', duration: 'durationSeconds', encounter: 'encounter.name' },
    prepare({ kind, duration, encounter }) {
      return { title: kind === 'boss' ? 'BOSS' : 'Trash', subtitle: [encounter, duration != null ? `${duration}s` : null].filter(Boolean).join(' · ') }
    },
  },
})
