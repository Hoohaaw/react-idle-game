import { defineType, defineField } from 'sanity'
import { STAT_DEFS } from '../../../src/lib/statDefinitions'
import { RESOURCE_SOURCE } from '../../../src/lib/resources'

// The precondition gating a character's eligibility to recruit (docs/superpowers/specs/
// 2026-08-20-character-acquisition-design.md §5a). Every character ALWAYS carries a goldCost
// (acquisition.ts) — this object is the OPTIONAL extra condition on top; absent = gold-only.
// elementalMastery/comebackMoment are deliberately NOT here — wave 2, needs combat-sim signal
// capture (spec §3/§12).

const STAT_OPTIONS = STAT_DEFS.map((s) => ({ title: s.label, value: s.key }))
const RESOURCE_OPTIONS = Object.keys(RESOURCE_SOURCE).map((r) => ({ title: r, value: r }))

const CONDITION_TYPES = [
  { title: 'Character reaches a level', value: 'characterLevel' },
  { title: 'Character reaches a stat threshold', value: 'statThreshold' },
  { title: 'Lifetime resource gathered', value: 'resourceTotal' },
  { title: 'Lifetime gold earned', value: 'goldTotal' },
  { title: 'Lifetime mission time', value: 'missionTimeTotal' },
  { title: 'Map/boss completion', value: 'mapCompletion' },
]

export const acquisitionCondition = defineType({
  name: 'acquisitionCondition',
  title: 'Unlock condition',
  type: 'object',
  fields: [
    defineField({
      name: 'type',
      title: 'Type',
      type: 'string',
      options: { list: CONDITION_TYPES },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'level',
      title: 'Level required',
      description: 'characterLevel only — any owned character must reach this level.',
      type: 'number',
      validation: (rule) =>
        rule.custom((value, context) => {
          const type = (context.parent as { type?: string } | undefined)?.type
          if (type === 'characterLevel') return typeof value === 'number' ? true : 'Required for this type'
          return value == null ? true : 'Only used by the characterLevel type'
        }),
    }),
    defineField({
      name: 'stat',
      title: 'Stat',
      description: 'statThreshold only — which stat must reach the threshold.',
      type: 'string',
      options: { list: STAT_OPTIONS },
      validation: (rule) =>
        rule.custom((value, context) => {
          const type = (context.parent as { type?: string } | undefined)?.type
          if (type === 'statThreshold') return value ? true : 'Required for this type'
          return value == null ? true : 'Only used by the statThreshold type'
        }),
    }),
    defineField({
      name: 'threshold',
      title: 'Threshold',
      description: 'statThreshold / resourceTotal / goldTotal / missionTimeTotal — the number to reach.',
      type: 'number',
      validation: (rule) =>
        rule.custom((value, context) => {
          const type = (context.parent as { type?: string } | undefined)?.type
          const needsThreshold = type === 'statThreshold' || type === 'resourceTotal' || type === 'goldTotal' || type === 'missionTimeTotal'
          if (needsThreshold) return typeof value === 'number' ? true : 'Required for this type'
          return value == null ? true : 'Only used by statThreshold/resourceTotal/goldTotal/missionTimeTotal'
        }),
    }),
    defineField({
      name: 'resource',
      title: 'Resource',
      description: 'resourceTotal only — which resource must be gathered in total.',
      type: 'string',
      options: { list: RESOURCE_OPTIONS },
      validation: (rule) =>
        rule.custom((value, context) => {
          const type = (context.parent as { type?: string } | undefined)?.type
          if (type === 'resourceTotal') return value ? true : 'Required for this type'
          return value == null ? true : 'Only used by the resourceTotal type'
        }),
    }),
    defineField({
      name: 'map',
      title: 'Map key',
      description: 'mapCompletion only — the mapKey that must be cleared.',
      type: 'string',
      validation: (rule) =>
        rule.custom((value, context) => {
          const type = (context.parent as { type?: string } | undefined)?.type
          if (type === 'mapCompletion') return value ? true : 'Required for this type'
          return value == null ? true : 'Only used by the mapCompletion type'
        }),
    }),
    defineField({
      name: 'stage',
      title: 'Stage required cleared',
      description: 'mapCompletion only — leave blank for 7 (boss/full map clear).',
      type: 'number',
      validation: (rule) =>
        rule.custom((value, context) => {
          const type = (context.parent as { type?: string } | undefined)?.type
          if (type !== 'mapCompletion' && value != null) return 'Only used by the mapCompletion type'
          if (value != null && (value < 1 || value > 7)) return 'Stage must be 1–7'
          return true
        }),
    }),
  ],
  preview: {
    select: { type: 'type', level: 'level', stat: 'stat', threshold: 'threshold', resource: 'resource', map: 'map' },
    prepare({ type, level, stat, threshold, resource, map }) {
      const detail =
        type === 'characterLevel' ? `Lv ${level}`
        : type === 'statThreshold' ? `${stat} ≥ ${threshold}`
        : type === 'resourceTotal' ? `${resource} ≥ ${threshold}`
        : type === 'goldTotal' ? `gold ≥ ${threshold}`
        : type === 'missionTimeTotal' ? `mission time ≥ ${threshold}s`
        : type === 'mapCompletion' ? `clear ${map}`
        : undefined
      return { title: type ?? '(no type)', subtitle: detail }
    },
  },
})
