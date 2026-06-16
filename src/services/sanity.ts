import { createClient } from '@sanity/client'

// Read-only Sanity client for the game app — fetches authored CONTENT/definitions (characters and
// their stats, growth, blessing trees). projectId + dataset are public (same values as
// studio/sanity.config.ts). We read the `drafts` perspective so unpublished content shows during
// the drafts-only authoring phase; that requires a Viewer token (the public `production` dataset is
// token-free only for PUBLISHED content).
//
// SECURITY: a VITE_ token is bundled into the client — acceptable for non-sensitive game content
// while authoring. At launch, publish content and read token-free (drop the token + perspective).
// Per-player runtime state does NOT come from here — that's Supabase (src/lib/supabase.ts).

const token = import.meta.env.VITE_SANITY_READ_TOKEN

if (import.meta.env.DEV && !token) {
  console.warn(
    '[sanity] VITE_SANITY_READ_TOKEN is not set — draft content (e.g. unpublished characters) will not load.',
  )
}

export const sanity = createClient({
  projectId: 'q6f4y8es',
  dataset: 'production',
  apiVersion: '2025-01-01',
  useCdn: false, // drafts + token need the live API, not the CDN
  token,
  perspective: 'drafts',
})
