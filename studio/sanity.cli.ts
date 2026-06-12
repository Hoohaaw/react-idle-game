import { defineCliConfig } from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: 'q6f4y8es',
    dataset: 'production',
  },
  // Typegen path/output is configured in sanity-typegen.json (read by `sanity typegen generate`).
  // Generated types land in the game app (src/sanity.types.ts) so it + the Edge Functions import them locally.
  autoUpdates: true,
})
