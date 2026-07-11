import { defineType, defineField, defineArrayMember } from 'sanity'
import { WarningOutlineIcon } from '@sanity/icons'
import { SCHOOL_DEFS, RESISTIBLE_SCHOOLS, SCHOOL_LABELS } from '../../src/lib/schools'

// A single enemy — the SIMPLIFIED opponent block for the combat sim (ADR-0013). Unlike a characterDef,
// an enemy does NOT use the 23-stat registry and does NOT derive Attack from primaries (STR/AGI/INT):
// it authors final combat numbers directly. Damage is one value + a type (physical|magic); mitigation is
// defense (armor) + resistance + block; the "depth" fields default to 0 (= no effect) and are only filled
// for special enemies. `tier` seeds a (code-side, deferred) stat template that suggests the numbers below;
// editing a field overrides the template.

const ARCHETYPE_OPTIONS = [
  { title: 'Bruiser (melee attacker)', value: 'bruiser' },
  { title: 'Caster (magic attacker)', value: 'caster' },
  { title: 'Tank (soaks, high mitigation)', value: 'tank' },
  { title: 'Swarm (weak, many)', value: 'swarm' },
  { title: 'Boss', value: 'boss' },
]

// Damage schools (ADR-0033): physical is mitigated by target Defense; every other school by
// target Resistance (party side). Against enemies, named schools check per-school resistances.
const DAMAGE_TYPE_OPTIONS = SCHOOL_DEFS.map((s) => ({
  title: s.key === 'physical' ? 'Physical (mitigated by target Defense)' : `${s.label} ${s.icon}`,
  value: s.key,
}))

const RESIST_SCHOOL_OPTIONS = RESISTIBLE_SCHOOLS.map((k) => ({ title: SCHOOL_LABELS[k], value: k }))

export const enemyDef = defineType({
  name: 'enemyDef',
  title: 'Enemy',
  type: 'document',
  icon: WarningOutlineIcon,
  fieldsets: [
    { name: 'identity', title: 'Identity', options: { columns: 2 } },
    { name: 'offense', title: 'Offense' },
    { name: 'defense', title: 'Defense & mitigation' },
    {
      name: 'depth',
      title: 'Combat depth (optional — leave at 0 for a plain enemy)',
      options: { collapsible: true, collapsed: true },
    },
  ],
  fields: [
    // --- Identity ---
    defineField({
      name: 'name',
      type: 'string',
      fieldset: 'identity',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'enemyKey',
      title: 'Enemy key',
      description:
        'Stable id the encounter/DB references. Lowercase letters, numbers and hyphens. NEVER change once live.',
      type: 'string',
      fieldset: 'identity',
      validation: (rule) =>
        rule.required().custom((value) => {
          if (!value) return 'Required'
          if (!/^[a-z0-9-]+$/.test(value)) return 'Lowercase letters, numbers and hyphens only'
          return true
        }),
    }),
    defineField({
      name: 'archetype',
      title: 'Archetype',
      description:
        'Authoring tag + the seed for the tier template. Combat behavior (threat/targeting, auras) is wired later (ADR-0014 fork 6).',
      type: 'string',
      options: { list: ARCHETYPE_OPTIONS },
      fieldset: 'identity',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'tier',
      title: 'Tier',
      description:
        'Difficulty band. Drives the (code-side, deferred) stat template that suggests the numbers below; edit a field to override.',
      type: 'number',
      fieldset: 'identity',
      validation: (rule) => rule.required().integer().min(1),
    }),
    defineField({ name: 'sprite', title: 'Sprite (WebP)', type: 'image', fieldset: 'identity' }),

    // --- Offense ---
    defineField({
      name: 'health',
      title: 'Health (HP pool)',
      description: 'What the party must burn down before the time limit.',
      type: 'number',
      fieldset: 'offense',
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'attack',
      title: 'Attack (damage per hit)',
      description: 'Final authored value — NOT derived from primaries.',
      type: 'number',
      fieldset: 'offense',
      validation: (rule) => rule.required().min(0),
    }),
    defineField({
      name: 'damageType',
      title: 'Damage school',
      description:
        'School of this enemy’s attacks (ADR-0033). Physical is mitigated by the party’s Defense; every other school by their Resistance.',
      type: 'string',
      options: { list: DAMAGE_TYPE_OPTIONS },
      fieldset: 'offense',
      initialValue: 'physical',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'speed',
      title: 'Speed (action cadence)',
      description: 'How often it acts on the timeline — next action fires at interval / speed (ADR-0013).',
      type: 'number',
      fieldset: 'offense',
      validation: (rule) => rule.required().min(1),
    }),

    // --- Defense & mitigation ---
    defineField({
      name: 'defense',
      title: 'Defense / Armor (mitigates physical)',
      description: 'Feeds the DR curve def/(def+K) against the party’s physical damage.',
      type: 'number',
      fieldset: 'defense',
      initialValue: 0,
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: 'resistance',
      title: 'Resistance (mitigates magic — the fallback for schools not listed below)',
      type: 'number',
      fieldset: 'defense',
      initialValue: 0,
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: 'resistances',
      title: 'Per-school resistances (ADR-0033)',
      description:
        'Same DR-curve units as Defense. A named-school hit checks its entry here and falls back to the generic Resistance when absent. Guideline: strong resist 100–150, weakness 0 (omit + generic 0), immunity ≥1000 for gimmicks.',
      type: 'array',
      fieldset: 'defense',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'schoolResistance',
          fields: [
            defineField({
              name: 'school',
              type: 'string',
              options: { list: RESIST_SCHOOL_OPTIONS },
              validation: (rule) => rule.required(),
            }),
            defineField({ name: 'value', type: 'number', validation: (rule) => rule.required().min(0) }),
          ],
          preview: { select: { title: 'school', subtitle: 'value' } },
        }),
      ],
    }),
    defineField({
      name: 'block',
      title: 'Block (blunts part of an incoming hit)',
      type: 'number',
      fieldset: 'defense',
      initialValue: 0,
      validation: (rule) => rule.min(0),
    }),

    // --- Combat depth (default 0 = no effect) ---
    defineField({
      name: 'critChance',
      title: 'Crit chance (%)',
      type: 'number',
      fieldset: 'depth',
      initialValue: 0,
      validation: (rule) => rule.min(0).max(100),
    }),
    defineField({
      name: 'critDamage',
      title: 'Crit damage (% bonus)',
      description: 'Only matters when Crit chance > 0.',
      type: 'number',
      fieldset: 'depth',
      initialValue: 0,
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: 'armorPen',
      title: 'Armor penetration',
      description: 'Reduces the party member’s effective Defense when this enemy hits (an "armor-shredder").',
      type: 'number',
      fieldset: 'depth',
      initialValue: 0,
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: 'dodge',
      title: 'Dodge (%)',
      description: 'Chance to fully avoid an incoming party hit.',
      type: 'number',
      fieldset: 'depth',
      initialValue: 0,
      validation: (rule) => rule.min(0).max(100),
    }),
    defineField({
      name: 'healthRegen',
      title: 'Health regen (per action)',
      description: 'HP it heals each time it acts — the party must out-damage the regen.',
      type: 'number',
      fieldset: 'depth',
      initialValue: 0,
      validation: (rule) => rule.min(0),
    }),
  ],
  preview: {
    select: { title: 'name', archetype: 'archetype', tier: 'tier', media: 'sprite' },
    prepare({ title, archetype, tier, media }) {
      const subtitle = [archetype, tier != null ? `T${tier}` : null].filter(Boolean).join(' · ')
      return { title, subtitle, media }
    },
  },
})
