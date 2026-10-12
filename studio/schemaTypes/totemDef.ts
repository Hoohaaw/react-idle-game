import { defineType, defineField, defineArrayMember } from 'sanity'
import { ShieldIcon } from '@sanity/icons'

// A TOTEM definition (design spec §E): durable, party-wide, account-level equip — NOT a
// per-mission consumable. One active at a time (profiles.active_totem_id). Effects are
// restricted to combat.ts's AbilityStat allowlist (same set capstone's partyBuffOnStart
// already respects) — enforced by the `kind` options list below; the STAT allowlist itself
// is enforced in code (src/lib/totems.ts), not re-validated here, to avoid a second source
// of truth for that list.
export const totemDef = defineType({
  name: 'totemDef',
  title: 'Totem',
  type: 'document',
  icon: ShieldIcon,
  fields: [
    defineField({ name: 'name', type: 'string', validation: (rule) => rule.required() }),
    defineField({
      name: 'totemKey',
      title: 'Totem key',
      description: 'Stable id (profiles.active_totem_id). Lowercase letters, numbers and hyphens. NEVER change once live.',
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
      name: 'effects',
      title: 'Effects',
      description: 'Small, flat magnitudes (illustrative target ~+3) — applied to EVERY party member at fight start. Placeholder pending a balance pass.',
      type: 'array',
      of: [defineArrayMember({ type: 'itemStat' })],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: { select: { title: 'name' } },
})
