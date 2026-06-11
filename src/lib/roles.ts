// Character role / archetype — what a character is good at. Role is FIXED BY CLASS
// (the CLASS_ROLE map below is the source of truth); blessing points later deepen
// the role rather than change it. Surfaced as a <RoleBadge> on the character card,
// mission dispatch, claim reward, and party roster.
export type CharacterRole = 'tank' | 'damage' | 'healer' | 'utility' | 'gatherer'

export type RoleStyle = { label: string; icon: string; color: string; border: string; glow: string }

// Per-role label + icon + colour. Colours read distinctly against the dark-red/gold
// theme without clashing with the rarity or resource palettes.
export const ROLE_STYLES: Record<CharacterRole, RoleStyle> = {
  tank:     { label: 'Tank',     icon: '🛡', color: '#7ba6d0', border: '#3a5e82', glow: 'rgba(123,166,208,0.35)' },
  damage:   { label: 'Damage',   icon: '⚔', color: '#e0635c', border: '#8a2e29', glow: 'rgba(224,99,92,0.40)' },
  healer:   { label: 'Healer',   icon: '✚', color: '#5fc77e', border: '#2d6b45', glow: 'rgba(95,199,126,0.35)' },
  utility:  { label: 'Utility',  icon: '✨', color: '#52c2b6', border: '#2a6a63', glow: 'rgba(82,194,182,0.35)' },
  gatherer: { label: 'Gatherer', icon: '⛏', color: '#cf9a4f', border: '#7a4f10', glow: 'rgba(207,154,79,0.35)' },
}

// Class → role. Fixed mapping. Classes not listed fall back to 'damage'.
export const CLASS_ROLE: Record<string, CharacterRole> = {
  // Tank
  Warrior: 'tank',
  'Death Knight': 'tank',
  // Damage
  Rogue: 'damage',
  Hunter: 'damage',
  Warlock: 'damage',
  Mage: 'damage',
  Fighter: 'damage',
  // Healer
  Priest: 'healer',
  Shaman: 'healer',
  // Utility
  Druid: 'utility',
  Bard: 'utility',
  Engineer: 'utility',
  Brewmaster: 'utility',
  Painter: 'utility',
  // Gatherer
  Miner: 'gatherer',
  Forester: 'gatherer',
}

export function roleForClass(charClass: string): CharacterRole {
  return CLASS_ROLE[charClass] ?? 'damage'
}
