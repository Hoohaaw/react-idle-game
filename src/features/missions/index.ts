// Public API of the Missions feature.
// Import from '@/features/missions' — never reach into the feature's internals
// (./components/*) from outside the feature.

export { default as MissionsPage } from './MissionsPage'

// Showcased on the design page; exported because the design system references them.
export { MissionCard } from './components/MissionCard'
export { ActiveMissionCard } from './components/ActiveMissionCard'
export { MissionDispatch } from './components/MissionDispatch'
export { ClaimReward } from './components/ClaimReward'
export { SAMPLE_CLAIM_WIN, SAMPLE_CLAIM_LOSS, SAMPLE_CLAIM_WIPE, type ClaimResultView } from './components/claimSamples'

// The shared roster read now lives in @/hooks/useRoster (three consumers: missions, infirmary, gather) —
// import it from there, not through this barrel.
