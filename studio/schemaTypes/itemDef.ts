import { defineType, defineField, defineArrayMember } from 'sanity'
import { PackageIcon } from '@sanity/icons'
import { auditItem, type BudgetItemStat, type ItemSlot } from '../../src/lib/itemBudget'

// An equippable item DEFINITION — the first item schema. A player owns INSTANCES of these in
// player_inventory (item_def_id = itemKey) at a rolled RARITY; equipped gear is referenced from
// player_characters.equipped as { slot: { itemDefId, rarity } }. The def holds only the base
// (Common) stat bonuses; rarity scaling of those is deferred (project_undecided). Slots are the
// item TYPE (a "ring" item fills any of the ring slots); the 14 equip slots (8 gear + 4 ring +
// 2 trinket) are a UI concern, not authored here.
//
// `minLevel` (ADR-0043) is the level required to equip this item at Common rarity; a rarer roll
// adds LEVEL_REQ_STEP_BY_RARITY on top (src/lib/equipment.ts) — enforced server-side in the
// equip_item RPC, not just the client picker.
const SLOT_OPTIONS = [
  { title: 'Head', value: 'head' },
  { title: 'Shoulders', value: 'shoulders' },
  { title: 'Chest', value: 'chest' },
  { title: 'Hands', value: 'hands' },
  { title: 'Legs', value: 'legs' },
  { title: 'Feet', value: 'feet' },
  { title: 'Weapon', value: 'weapon' },
  { title: 'Off-hand', value: 'offhand' },
  { title: 'Ring', value: 'ring' },
  { title: 'Trinket', value: 'trinket' },
]

// The item power-budget check (src/lib/itemBudget.ts): statBonuses' total cost-per-level must
// land in the item's slot's rate band. Skipped while slot/minLevel isn't authored yet.
type ItemDoc = { slot?: ItemSlot; minLevel?: number; statBonuses?: BudgetItemStat[] }

function itemBudgetError(doc: ItemDoc): string | true {
  if (!doc.slot || !doc.statBonuses?.length) return true
  const audit = auditItem(doc.slot, doc.minLevel, doc.statBonuses)
  if (!audit.ok) {
    return `Stat bonuses cost ${audit.cost.toFixed(2)} budget points (${audit.rate.toFixed(2)}/level) — ${doc.slot} allows ${audit.minRate.toFixed(2)}–${audit.maxRate.toFixed(2)}/level at minLevel ${doc.minLevel ?? 1}. See docs/ITEMS.md.`
  }
  return true
}

export const itemDef = defineType({
  name: 'itemDef',
  title: 'Item',
  type: 'document',
  icon: PackageIcon,
  fieldsets: [{ name: 'identity', title: 'Identity', options: { columns: 2 } }],
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      fieldset: 'identity',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'itemKey',
      title: 'Item key',
      description:
        'Stable id inventory/loot references (= player_inventory.item_def_id). Lowercase letters, numbers and hyphens. NEVER change once live.',
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
      name: 'slot',
      title: 'Equip slot',
      description: 'Which slot type this item fills. First-pass slot list.',
      type: 'string',
      options: { list: SLOT_OPTIONS },
      fieldset: 'identity',
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'sprite', title: 'Sprite (WebP)', type: 'image', fieldset: 'identity' }),
    defineField({ name: 'description', type: 'text', rows: 2 }),
    defineField({
      name: 'minLevel',
      title: 'Min level (Common)',
      description:
        'Level required to equip this item at Common rarity. A rarer roll adds a per-rarity step on top (ADR-0043). Leave blank for no restriction.',
      type: 'number',
      validation: (rule) => rule.min(1).integer(),
    }),
    defineField({
      name: 'statBonuses',
      title: 'Stat bonuses',
      description: 'Base (Common) bonuses granted when equipped. Stack via the same {flat, pct} rule as blessings.',
      type: 'array',
      of: [defineArrayMember({ type: 'itemStat' })],
      validation: (rule) =>
        rule.custom((_value, context) => itemBudgetError(context.document as ItemDoc)),
    }),
  ],
  preview: {
    select: { title: 'name', slot: 'slot', media: 'sprite' },
    prepare({ title, slot, media }) {
      return { title, subtitle: slot, media }
    },
  },
})
