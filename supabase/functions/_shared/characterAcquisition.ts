import { sanityQuery } from './sanity.ts'

// Fetches characterDefs that have a real unlock CONDITION (not gold-only — those need no
// evaluation) and are not already unlocked, for mission-claim/gather-collect to evaluate against
// the player's just-updated state. Mirrors _shared/itemDefs.ts's style.

export type AcquisitionCandidate = {
  charKey: string
  name: string
  role: string | null
  condition: {
    type: string
    level?: number
    stat?: string
    threshold?: number
    resource?: string
    map?: string
    stage?: number
  }
}

const CANDIDATES_GROQ = `*[_type == "characterDef" && defined(acquisition.condition) && !(charKey in $unlocked)]{
  charKey, name, role,
  "condition": acquisition.condition{ type, level, stat, threshold, resource, map, stage }
}`

/** Characters with an unlock condition, not yet in `unlockedKeys`. Throws on Sanity failure. */
export async function fetchAcquisitionCandidates(unlockedKeys: string[]): Promise<AcquisitionCandidate[]> {
  return await sanityQuery<AcquisitionCandidate[]>(CANDIDATES_GROQ, { unlocked: unlockedKeys })
}
