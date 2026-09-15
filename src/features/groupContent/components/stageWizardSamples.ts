import type { WizardStage } from './StageWizard'

// Sample stages driving the /design showcase — shaped like the real Emberdeep Vault dungeon
// (9 stages, (trash,trash,boss)×3) but with illustrative loot, not the real authored tables.
// Index 6 deliberately has an empty loot table, to show the same "nothing authored yet" gap the
// live reference content actually has today (see the null-loot crash fix) — the wizard must show
// that gracefully, not just in its happy path.
export const SAMPLE_WIZARD_STAGES: WizardStage[] = [
  { kind: 'trash', durationSeconds: 90, baseXp: 40, loot: [{ name: 'Charred Bone', slot: 'Material' }] },
  { kind: 'trash', durationSeconds: 90, baseXp: 40, loot: [{ name: 'Ember Dust', slot: 'Material' }] },
  { kind: 'boss', durationSeconds: 180, baseXp: 120, loot: [{ name: 'Cinderfang Rod', slot: 'Weapon' }, { name: 'Ashbound Cloak', slot: 'Back' }] },
  { kind: 'trash', durationSeconds: 90, baseXp: 40, loot: [{ name: 'Charred Bone', slot: 'Material' }] },
  { kind: 'trash', durationSeconds: 90, baseXp: 40, loot: [{ name: 'Ember Dust', slot: 'Material' }] },
  { kind: 'boss', durationSeconds: 180, baseXp: 120, loot: [{ name: 'Glacial Wand', slot: 'Weapon' }] },
  { kind: 'trash', durationSeconds: 90, baseXp: 40, loot: [] },
  { kind: 'trash', durationSeconds: 90, baseXp: 40, loot: [{ name: 'Ember Dust', slot: 'Material' }] },
  { kind: 'boss', durationSeconds: 240, baseXp: 200, loot: [{ name: "Vaultkeeper's Signet", slot: 'Ring' }] },
]
