import { defineType, defineField } from 'sanity'
import { RESOURCE_SOURCE } from '../../../src/lib/resources'

// One reagent a recipe consumes (docs/superpowers/specs/2026-09-09-crafting-create-recipes-
// design.md §4a): either N of a raw resource (the gather-loop registry — keys are the LIVE
// profiles.resources wallet keys, capitalized) or N copies of an item from the player's inventory.
// Item reagents never pin a rarity — the player picks which owned rarity to spend at craft time.
const RESOURCE_OPTIONS = Object.keys(RESOURCE_SOURCE).map((key) => ({ title: key, value: key }))

export const reagentLine = defineType({
  name: 'reagentLine',
  title: 'Reagent',
  type: 'object',
  fields: [
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      options: { list: [{ title: 'Resource', value: 'resource' }, { title: 'Item', value: 'item' }], layout: 'radio' },
      initialValue: 'resource',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'resource',
      title: 'Resource',
      type: 'string',
      options: { list: RESOURCE_OPTIONS },
      hidden: ({ parent }) => (parent as { kind?: string } | undefined)?.kind !== 'resource',
      validation: (rule) =>
        rule.custom((value: string | undefined, context) => {
          const kind = (context.parent as { kind?: string } | undefined)?.kind
          if (kind !== 'resource') return true
          return value ? true : 'A resource reagent needs a resource.'
        }),
    }),
    defineField({
      name: 'item',
      title: 'Item',
      type: 'reference',
      to: [{ type: 'itemDef' }],
      hidden: ({ parent }) => (parent as { kind?: string } | undefined)?.kind !== 'item',
      validation: (rule) =>
        rule.custom((value, context) => {
          const kind = (context.parent as { kind?: string } | undefined)?.kind
          if (kind !== 'item') return true
          return value ? true : 'An item reagent needs an item.'
        }),
    }),
    defineField({
      name: 'quantity',
      title: 'Quantity',
      type: 'number',
      initialValue: 1,
      validation: (rule) => rule.required().integer().min(1),
    }),
  ],
  preview: {
    select: { kind: 'kind', resource: 'resource', itemName: 'item.name', quantity: 'quantity' },
    prepare({ kind, resource, itemName, quantity }) {
      return { title: `${quantity ?? '?'}× ${kind === 'item' ? (itemName ?? '(item)') : (resource ?? '(resource)')}` }
    },
  },
})
