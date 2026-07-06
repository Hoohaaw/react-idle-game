// Public API of the Missions feature.
// Import from '@/features/missions' — never reach into the feature's internals
// (./components/*) from outside the feature.

export { default as MissionsPage } from './MissionsPage'

// Showcased on the design page; exported because the design system references them.
export { MissionCard } from './components/MissionCard'
export { ActiveMissionCard } from './components/ActiveMissionCard'
export { MissionDispatch } from './components/MissionDispatch'
export { ClaimReward } from './components/ClaimReward'
export { SAMPLE_CLAIM_WIN, SAMPLE_CLAIM_LOSS, type ClaimResultView } from './components/claimSamples'

// Shared roster read (owned characters ⨯ defs ⨯ items → name/role/level + effective maxHp + busy).
// Used by the infirmary too; promote to @/hooks if a third consumer appears.
export { useRoster, type RosterMember } from './hooks'
