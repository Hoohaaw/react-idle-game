import { defineType, defineField, defineArrayMember } from 'sanity'
import { SparklesIcon } from '@sanity/icons'
import { STAT_DEFS } from '../../../src/lib/statDefinitions'

// The stats a scripted 'partyBuffOnStart' ability may target — mirrors src/lib/combat.ts's
// AbilityStat allowlist exactly (attack/spellPower/healingPower are pre-routed into a single
// power/healPower field by the sim and aren't separately addressable, ADR-0045 Phase B).
const ABILITY_STAT_KEYS = ['defense', 'resistance', 'critChance', 'critDamage', 'dodge', 'block', 'healthRegen']
const ABILITY_STAT_OPTIONS = STAT_DEFS.filter((s) => ABILITY_STAT_KEYS.includes(s.key)).map((s) => ({
  title: s.label,
  value: s.key,
}))

// A character's single capstone blessing (ADR-0045) — earned, not chosen: granted once level
// >= 50 AND all 4 rows are picked (computed on read, src/lib/blessings.ts — never written to the
// player row). Three effect flavors: stat/conditional resolve through the ordinary stat pipeline,
// same as a blessing choice; 'ability' resolves in the combat sim instead (src/lib/combat.ts,
// ADR-0045 Phase B) via the fixed abilityKind/abilityParams vocabulary below.
export const capstoneBlessing = defineType({
  name: 'capstoneBlessing',
  title: 'Capstone blessing',
  type: 'object',
  icon: SparklesIcon,
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      type: 'text',
      rows: 2,
    }),
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      options: {
        list: [
          { title: 'Flat stat bonus', value: 'stat' },
          { title: 'Conditional stat bonus', value: 'conditional' },
          { title: 'Scripted ability', value: 'ability' },
        ],
        layout: 'radio',
      },
      initialValue: 'stat',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'effects',
      title: 'Effects',
      description:
        'Stat modifiers granted once earned — same shape as a blessing choice. Used by Kind = Flat/Conditional; leave empty for Ability.',
      type: 'array',
      of: [defineArrayMember({ type: 'nodeEffect' })],
      validation: (rule) =>
        rule.custom((value: unknown[] | undefined, context) => {
          const kind = (context.parent as { kind?: string } | undefined)?.kind
          if (kind === 'ability') return true
          return value && value.length > 0 ? true : 'A stat/conditional capstone needs at least one effect.'
        }),
    }),
    defineField({
      name: 'condition',
      title: 'Condition',
      description:
        'When the bonus applies (reuses the trait condition engine). Only used by Kind = Conditional.',
      type: 'conditionTrigger',
      validation: (rule) =>
        rule.custom((value, context) => {
          const kind = (context.parent as { kind?: string } | undefined)?.kind
          if (kind !== 'conditional') return true
          return value ? true : 'A conditional capstone needs a condition.'
        }),
    }),
    defineField({
      name: 'abilityKind',
      title: 'Ability',
      description: 'Which scripted behavior this capstone grants. Only used by Kind = Ability.',
      type: 'string',
      options: {
        list: [
          { title: 'Survive a fatal blow (once per fight)', value: 'surviveFatal' },
          { title: 'Buff the party at fight start', value: 'partyBuffOnStart' },
        ],
        layout: 'radio',
      },
      hidden: ({ parent }) => (parent as { kind?: string } | undefined)?.kind !== 'ability',
      validation: (rule) =>
        rule.custom((value: string | undefined, context) => {
          const kind = (context.parent as { kind?: string } | undefined)?.kind
          if (kind !== 'ability') return true
          return value ? true : 'An ability capstone needs an ability kind.'
        }),
    }),
    defineField({
      name: 'abilityParams',
      title: 'Ability parameters',
      description: 'Stat/kind/value the buff grants. Only used by Ability = Buff the party at fight start.',
      type: 'object',
      fields: [
        defineField({
          name: 'stat',
          title: 'Stat',
          type: 'string',
          options: { list: ABILITY_STAT_OPTIONS },
        }),
        defineField({
          name: 'kind',
          title: 'Kind',
          type: 'string',
          options: {
            list: [
              { title: 'Flat', value: 'flat' },
              { title: 'Percent', value: 'pct' },
            ],
            layout: 'radio',
          },
          initialValue: 'flat',
        }),
        defineField({
          name: 'value',
          title: 'Value',
          type: 'number',
        }),
      ],
      hidden: ({ parent }) => (parent as { abilityKind?: string } | undefined)?.abilityKind !== 'partyBuffOnStart',
      validation: (rule) =>
        rule.custom((value: { stat?: string; kind?: string; value?: number } | undefined, context) => {
          const abilityKind = (context.parent as { abilityKind?: string } | undefined)?.abilityKind
          if (abilityKind !== 'partyBuffOnStart') return true
          return value?.stat && value?.kind && value?.value != null
            ? true
            : 'A party-buff ability needs stat, kind, and value.'
        }),
    }),
  ],
  preview: {
    select: { title: 'title', kind: 'kind' },
    prepare: ({ title, kind }) => ({ title, subtitle: kind }),
  },
})
