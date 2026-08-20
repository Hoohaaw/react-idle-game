import { defineType, defineField } from 'sanity'
import { EarthGlobeIcon } from '@sanity/icons'

// A WORLD MAP — a themed group of missions (ADR-0034). Each map holds 7 missions
// (stages 1–6 + a stage-7 boss). `order` drives both the Missions-page toggle order
// and the unlock chain: a map is playable once the PREVIOUS map's boss (stage 7) is
// cleared; stages within a map unlock sequentially. Per-player progress lives in
// profiles.map_progress JSONB keyed by mapKey (registry-JSONB, ADR-0004).
//
// Authoring identity: each map has a DOMINANT damage school (majority of its stages
// resist it) plus off-school and resist-free stages for diversity — see docs/MAPS.md.
export const mapDef = defineType({
  name: 'mapDef',
  title: 'Map',
  type: 'document',
  icon: EarthGlobeIcon,
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'mapKey',
      title: 'Map key',
      description:
        'Stable id the DB references (profiles.map_progress key). Lowercase letters, numbers and hyphens. NEVER change once live.',
      type: 'string',
      validation: (rule) =>
        rule.required().custom((value) => {
          if (!value) return 'Required'
          if (!/^[a-z0-9-]+$/.test(value)) return 'Lowercase letters, numbers and hyphens only'
          return true
        }),
    }),
    defineField({
      name: 'order',
      title: 'Order',
      description:
        'Position in the world sequence (1 = starter map). Drives the map toggle order AND the unlock chain (map N unlocks when map N−1’s boss is cleared). Unique across maps.',
      type: 'number',
      validation: (rule) => rule.required().integer().min(1),
    }),
    defineField({ name: 'description', type: 'text', rows: 2 }),
  ],
  preview: {
    select: { title: 'name', order: 'order', key: 'mapKey' },
    prepare({ title, order, key }) {
      return { title, subtitle: [order != null ? `#${order}` : null, key].filter(Boolean).join(' · ') }
    },
  },
})
