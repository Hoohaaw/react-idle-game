import { defineType, defineField, defineArrayMember } from 'sanity'
import { RocketIcon } from '@sanity/icons'

// A MISSION definition — what mission_runs.mission_def_id points at. The claim resolver (the
// server-authoritative mission-claim Edge Function, ADR-0003) loads this to run the fight and pay
// out: it runs the referenced encounter's auto-battle sim (ADR-0013), and on a WIN grants baseXp +
// the guaranteed rewards + an independent roll over the loot table, each scaled by the reward
// multipliers (marginBonus × levelBonus × party × transcendence — ADR-0012/0014).
//
// `durationSeconds` is the real-world WAIT timer (started_at → ends_at); the encounter's own
// timeLimitSeconds is abstract IN-FIGHT time. Party entry requirements (role/class per slot,
// composition) are a later addition — not authored here yet.
export const missionDef = defineType({
  name: 'missionDef',
  title: 'Mission',
  type: 'document',
  icon: RocketIcon,
  fieldsets: [
    { name: 'identity', title: 'Identity' },
    { name: 'rewards', title: 'Rewards (paid on a win, before multipliers)' },
  ],
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      fieldset: 'identity',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'missionKey',
      title: 'Mission key',
      description:
        'Stable id the DB references (= mission_runs.mission_def_id). Lowercase letters, numbers and hyphens. NEVER change once live.',
      type: 'string',
      fieldset: 'identity',
      validation: (rule) =>
        rule.required().custom((value) => {
          if (!value) return 'Required'
          if (!/^[a-z0-9-]+$/.test(value)) return 'Lowercase letters, numbers and hyphens only'
          return true
        }),
    }),
    defineField({ name: 'description', type: 'text', rows: 2, fieldset: 'identity' }),
    defineField({
      name: 'encounter',
      title: 'Encounter (the fight)',
      description: 'The auto-battle resolved at claim.',
      type: 'reference',
      to: [{ type: 'encounterDef' }],
      fieldset: 'identity',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'durationSeconds',
      title: 'Duration (real-world wait, seconds)',
      description: 'The mission timer: ends_at = started_at + this. NOT the in-fight time limit.',
      type: 'number',
      fieldset: 'identity',
      validation: (rule) => rule.required().integer().min(1),
    }),

    // --- Rewards ---
    defineField({
      name: 'baseXp',
      title: 'Base XP',
      description: 'XP granted to each surviving participant on a win, before the reward multipliers.',
      type: 'number',
      fieldset: 'rewards',
      initialValue: 0,
      validation: (rule) => rule.required().min(0),
    }),
    defineField({
      name: 'rewards',
      title: 'Guaranteed rewards',
      description: 'Currencies/resources always paid on a win.',
      type: 'array',
      of: [defineArrayMember({ type: 'missionReward' })],
      fieldset: 'rewards',
    }),
    defineField({
      name: 'loot',
      title: 'Loot table',
      description: 'Each line is rolled independently on a win (per-item drop chance + its own rarity roll).',
      type: 'array',
      of: [defineArrayMember({ type: 'lootDrop' })],
      fieldset: 'rewards',
    }),
  ],
  preview: {
    select: { title: 'name', encounter: 'encounter.name', duration: 'durationSeconds' },
    prepare({ title, encounter, duration }) {
      const subtitle = [encounter, duration != null ? `${duration}s` : null].filter(Boolean).join(' · ')
      return { title, subtitle }
    },
  },
})
