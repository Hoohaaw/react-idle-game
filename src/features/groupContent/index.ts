// Public API of the groupContent feature (dungeons + raids). Import from '@/features/groupContent'
// — never reach into ./components/* from outside the feature.
export { GroupContentPage } from './GroupContentPage'

// Showcased on the design page; exported because the design system references them.
export { StageWizard, type WizardStage } from './components/StageWizard'
export { SAMPLE_WIZARD_STAGES } from './components/stageWizardSamples'
