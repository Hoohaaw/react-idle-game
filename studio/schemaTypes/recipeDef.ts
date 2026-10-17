import { defineType, defineField, defineArrayMember } from 'sanity'
import { CogIcon } from '@sanity/icons'

const PROFESSION_OPTIONS = [
  { title: 'Alchemy', value: 'alchemy' },
  { title: 'Carving', value: 'carving' },
  { title: 'Prospecting', value: 'prospecting' },
  { title: 'Tempering', value: 'tempering' },
  { title: 'Arcane Writing', value: 'arcaneWriting' },
]

// A `create` crafting recipe (docs/superpowers/specs/2026-09-09-crafting-create-recipes-
// design.md §4b): spend the reagents up front, wait durationSeconds (real-world), claim ONE copy
// of `result` at a rarity rolled from resultRarityWeights. Result and reagents are plain
// references — a new item or recipe is pure content, never a code change (ADR-0004).
// No discovery gating and no `infuse` kind in v1 — both are follow-ups.
export const recipeDef = defineType({
  name: 'recipeDef',
  title: 'Recipe',
  type: 'document',
  icon: CogIcon,
  fields: [
    defineField({ name: 'name', type: 'string', validation: (rule) => rule.required() }),
    defineField({
      name: 'recipeKey',
      title: 'Recipe key',
      description: 'Stable id (craft_runs.recipe_def_id). Lowercase letters, numbers and hyphens. NEVER change once live.',
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
      name: 'result',
      title: 'Result item',
      type: 'reference',
      to: [{ type: 'itemDef' }, { type: 'consumableDef' }, { type: 'totemDef' }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'resultRarityWeights',
      title: 'Result rarity weights',
      description: 'The crafted copy\'s rarity is a weighted roll among these lines (same roll loot uses). Leave empty to always produce Common.',
      type: 'array',
      of: [defineArrayMember({ type: 'rarityWeight' })],
    }),
    defineField({
      name: 'durationSeconds',
      title: 'Duration (real-world wait, seconds)',
      description: 'Same meaning as missionDef.durationSeconds — reagents are spent when the craft starts; the result is claimable after this wait.',
      type: 'number',
      validation: (rule) => rule.required().integer().min(1),
    }),
    defineField({
      name: 'reagents',
      title: 'Reagents (1–6)',
      description: 'The crafting circle has 6 slots — one per line.',
      type: 'array',
      of: [defineArrayMember({ type: 'reagentLine' })],
      validation: (rule) => rule.required().min(1).max(6),
    }),
    defineField({
      name: 'professionKey',
      title: 'Profession',
      description: 'Leave empty for a generic recipe with no profession gate or XP grant (e.g. the existing reference recipes).',
      type: 'string',
      options: { list: PROFESSION_OPTIONS },
    }),
    defineField({
      name: 'xpAwarded',
      title: 'Profession XP awarded',
      description: 'Granted to professionKey\'s level on each claim. Required when professionKey is set.',
      type: 'number',
      hidden: ({ parent }) => !(parent as { professionKey?: string } | undefined)?.professionKey,
      validation: (rule) =>
        rule.custom((value: number | undefined, context) => {
          const professionKey = (context.parent as { professionKey?: string } | undefined)?.professionKey
          if (!professionKey) return true
          return typeof value === 'number' && value >= 1 ? true : 'Required (min 1) when a profession is set.'
        }),
    }),
    defineField({
      name: 'requiredLevel',
      title: 'Required profession level',
      description: 'The profession level needed to buy this recipe (via profession-learn-recipe) or claim a quest that rewards it. Does not gate crafting a recipe you already know.',
      type: 'number',
      initialValue: 1,
      hidden: ({ parent }) => !(parent as { professionKey?: string } | undefined)?.professionKey,
      validation: (rule) => rule.integer().min(1).max(10),
    }),
    defineField({
      name: 'grantedAtLevel',
      title: 'Auto-granted at level',
      description: 'Optional. If set, this recipe is unlocked automatically the moment professionKey reaches this level — no purchase or quest needed.',
      type: 'number',
      hidden: ({ parent }) => !(parent as { professionKey?: string } | undefined)?.professionKey,
      validation: (rule) => rule.integer().min(1).max(10),
    }),
    defineField({
      name: 'learnCost',
      title: 'Gold cost to learn (profession expert)',
      description: 'Only meaningful when professionKey is set and the recipe is meant to be purchasable, not quest/level-only.',
      type: 'number',
      initialValue: 0,
      hidden: ({ parent }) => !(parent as { professionKey?: string } | undefined)?.professionKey,
      validation: (rule) => rule.integer().min(0),
    }),
  ],
  preview: {
    select: { title: 'name', result: 'result.name', duration: 'durationSeconds' },
    prepare({ title, result, duration }) {
      return { title, subtitle: [result, duration != null ? `${duration}s` : null].filter(Boolean).join(' · ') }
    },
  },
})
