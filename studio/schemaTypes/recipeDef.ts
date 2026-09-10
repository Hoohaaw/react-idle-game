import { defineType, defineField, defineArrayMember } from 'sanity'
import { CogIcon } from '@sanity/icons'

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
      to: [{ type: 'itemDef' }],
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
  ],
  preview: {
    select: { title: 'name', result: 'result.name', duration: 'durationSeconds' },
    prepare({ title, result, duration }) {
      return { title, subtitle: [result, duration != null ? `${duration}s` : null].filter(Boolean).join(' · ') }
    },
  },
})
