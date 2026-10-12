import { defineType, defineField, defineArrayMember } from 'sanity'
import { FilterIcon } from '@sanity/icons'

// A CONSUMABLE definition (docs/superpowers/specs/2026-10-12-mission-prep-consumables-
// design.md §B): a flat, tiered mission-prep item — NOT rarity-rolled like itemDef. Two
// categories with different timing models (src/lib/consumables.ts owns the engine):
//   heal — mid-fight, HP-threshold-triggered, self-only (combat.ts).
//   buff — pre-fight, whole-encounter, self-only (folds into effectiveStats' extraBonuses).
export const consumableDef = defineType({
  name: 'consumableDef',
  title: 'Consumable',
  type: 'document',
  icon: FilterIcon,
  fields: [
    defineField({ name: 'name', type: 'string', validation: (rule) => rule.required() }),
    defineField({
      name: 'consumableKey',
      title: 'Consumable key',
      description: 'Stable id (player_inventory.item_def_id). Lowercase letters, numbers and hyphens. NEVER change once live.',
      type: 'string',
      validation: (rule) =>
        rule.required().custom((value) => {
          if (!value) return 'Required'
          if (!/^[a-z0-9-]+$/.test(value)) return 'Lowercase letters, numbers and hyphens only'
          return true
        }),
    }),
    defineField({ name: 'description', type: 'text', rows: 2 }),
    defineField({
      name: 'category',
      title: 'Category',
      description: 'heal = mid-fight HP-threshold trigger. buff = pre-fight, whole-encounter.',
      type: 'string',
      options: { list: [{ title: 'Heal', value: 'heal' }, { title: 'Buff', value: 'buff' }], layout: 'radio' },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'healAmount',
      title: 'Heal amount (heal category only)',
      description: 'Flat HP restored, clamped to max HP. Placeholder pending a balance pass.',
      type: 'number',
      hidden: ({ document }) => document?.category !== 'heal',
      validation: (rule) =>
        rule.custom((value, context) => {
          const doc = context.document as { category?: string } | undefined
          if (doc?.category === 'heal' && (value == null || value <= 0)) return 'Required for heal-category items'
          return true
        }),
    }),
    defineField({
      name: 'triggerHpPct',
      title: 'Trigger HP % (heal category only)',
      description: 'Fires when the holder\'s own HP fraction drops to or below this (0–1). Fixed per item, not player-configurable.',
      type: 'number',
      hidden: ({ document }) => document?.category !== 'heal',
      validation: (rule) =>
        rule.custom((value, context) => {
          const doc = context.document as { category?: string } | undefined
          if (doc?.category === 'heal' && (value == null || value <= 0 || value > 1)) {
            return 'Required for heal-category items, between 0 (exclusive) and 1'
          }
          return true
        }),
    }),
    defineField({
      name: 'effects',
      title: 'Effects (buff category only)',
      description: 'Same {stat, kind, value} shape as gear/blessings/traits — applied pre-fight, whole-encounter, self-only.',
      type: 'array',
      of: [defineArrayMember({ type: 'itemStat' })],
      hidden: ({ document }) => document?.category !== 'buff',
      validation: (rule) =>
        rule.custom((value, context) => {
          const doc = context.document as { category?: string } | undefined
          if (doc?.category === 'buff' && (!value || (value as unknown[]).length === 0)) {
            return 'Required for buff-category items'
          }
          return true
        }),
    }),
  ],
  preview: {
    select: { title: 'name', category: 'category', heal: 'healAmount' },
    prepare({ title, category, heal }) {
      return { title, subtitle: category === 'heal' ? `heal +${heal ?? '?'}` : 'buff' }
    },
  },
})
