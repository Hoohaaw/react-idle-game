import { sanity } from './sanity'
import { fetchProfile } from './profile'
import { fetchRecruitedDefIds } from './playerCharacters'

// Everything the player has UNLOCKED but not yet recruited — the /recruits screen's data source.
// Full-blind-surprise: this only ever queries characterDefs the player's own unlocked_characters
// already names. There is no query anywhere in this file for "which characters exist that I
// haven't unlocked" — that would leak locked-character existence to the client, which the spec
// (§2, §8) explicitly forbids.

export type RecruitCandidate = {
  charKey: string
  name: string
  role: string | null
  charClass: string
  rarity: string
  goldCost: number
}

const CANDIDATES_QUERY = `*[_type == "characterDef" && charKey in $keys]{
  charKey, name, role, charClass, rarity, "goldCost": acquisition.goldCost
}`

export async function fetchRecruitCandidates(): Promise<RecruitCandidate[]> {
  const [profile, ownedDefIds] = await Promise.all([fetchProfile(), fetchRecruitedDefIds()])
  const owned = new Set(ownedDefIds)
  const availableKeys = Object.keys(profile.unlockedCharacters).filter((key) => !owned.has(key))
  if (availableKeys.length === 0) return []
  const rows = await sanity.fetch<RecruitCandidate[]>(CANDIDATES_QUERY, { keys: availableKeys })
  return rows.filter((r) => typeof r.goldCost === 'number')
}
