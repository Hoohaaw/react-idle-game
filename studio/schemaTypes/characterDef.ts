import { defineType, defineField, defineArrayMember } from 'sanity'
import { UserIcon } from '@sanity/icons'
import { CLASS_ROLE, ROLE_STYLES } from '../../src/lib/roles'
import {
  CHARACTER_RARITIES,
  auditCharacter,
  type CharacterRarity,
  type BudgetStatValue,
  type BudgetStatGrowth,
} from '../../src/lib/characterBudget'

// Class options come from the shared CLASS_ROLE map (single source of truth). Class sets the
// DEFAULT role; the optional `role` field below can override it per character (ADR-0008).
const CLASS_OPTIONS = Object.keys(CLASS_ROLE).map((c) => ({ title: c, value: c }))
const ROLE_OPTIONS = Object.entries(ROLE_STYLES).map(([value, s]) => ({ title: s.label, value }))
const RARITY_OPTIONS = CHARACTER_RARITIES.map((r) => ({ title: r, value: r }))

type BlessingNodeValue = { isUltimate?: boolean }

// The point-buy budget check (ADR-0031, docs/CHARACTERS.md): both stat arrays must spend their
// rarity's budget within tolerance. Skipped while rarity or the array is still unauthored.
type CharacterDoc = {
  rarity?: CharacterRarity
  baseStats?: BudgetStatValue[]
  growth?: BudgetStatGrowth[]
}

function budgetError(doc: CharacterDoc, which: 'base' | 'growth'): string | true {
  if (!doc.rarity || !doc.baseStats?.length || !doc.growth?.length) return true
  const audit = auditCharacter(doc.rarity, doc.baseStats, doc.growth)
  if (which === 'base' && !audit.baseOk) {
    return `Base spread spends ${audit.baseCost.toFixed(2)} budget points; ${doc.rarity} allows ${audit.baseBudget} (±0.5). See docs/CHARACTERS.md.`
  }
  if (which === 'growth' && !audit.growthOk) {
    return `Growth spends ${audit.growthCost.toFixed(2)} budget points/level; ${doc.rarity} allows ${audit.growthBudget} (±0.5). See docs/CHARACTERS.md.`
  }
  return true
}

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
      name: 'rarity',
      title: 'Rarity',
      description:
        'Acquisition tier AND stat budget tier (ADR-0031): sets how many budget points the base spread and per-level growth may spend. See docs/CHARACTERS.md.',
      type: 'string',
      options: { list: RARITY_OPTIONS },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'baseStats',
      title: 'Base stats (level 1)',
      type: 'array',
      of: [defineArrayMember({ type: 'statValue' })],
      validation: (rule) =>
        rule
          .required()
          .min(1)
          .custom((_value, context) => budgetError(context.document as CharacterDoc, 'base')),
    }),
    defineField({
      name: 'growth',
      title: 'Growth per level',
      type: 'array',
      of: [defineArrayMember({ type: 'statGrowth' })],
      validation: (rule) =>
        rule
          .required()
          .min(1)
          .custom((_value, context) => budgetError(context.document as CharacterDoc, 'growth')),
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
