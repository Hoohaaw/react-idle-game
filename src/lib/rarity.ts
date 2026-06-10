export type RarityStyle = { color: string; border: string; glow: string }

// Rarity palette — colours + glow per tier. Used by RarityBadge, RarityChancePill,
// item displays, and the claim/loot UIs.
export const RARITY_STYLES: Record<string, RarityStyle> = {
  Common:    { color: '#a0a0a0', border: '#555',    glow: 'transparent' },
  Uncommon:  { color: '#4caf6e', border: '#2d6b45', glow: 'rgba(76,175,110,0.3)' },
  Rare:      { color: '#5b9bd5', border: '#2a5a8a', glow: 'rgba(91,155,213,0.35)' },
  Epic:      { color: '#b06fd4', border: '#6a3580', glow: 'rgba(176,111,212,0.4)' },
  Legendary: { color: '#f0a030', border: '#8a5010', glow: 'rgba(240,160,48,0.5)' },
}

// Rarity ladder, low → high. Used by the duplicate-upgrade path (5 of one rarity →
// 1 of the next) and, later, loot rarity scaling.
export const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] as const

// The next rarity up, or null when already at the top (Legendary can't be upgraded).
export function nextRarity(rarity: string): string | null {
  const i = RARITY_ORDER.indexOf(rarity as (typeof RARITY_ORDER)[number])
  return i >= 0 && i < RARITY_ORDER.length - 1 ? RARITY_ORDER[i + 1] : null
}
