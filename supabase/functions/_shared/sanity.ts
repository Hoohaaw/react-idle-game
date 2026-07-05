// Server-side Sanity read used to validate/resolve authored content before a write. Mirrors the
// browser client (src/services/sanity.ts): same project/dataset and the `drafts` perspective, so
// unpublished definitions still resolve during the drafts-only authoring phase. The read token is a
// function SECRET (set via `supabase secrets set`), never bundled into the client here.

/** Run a GROQ query against Sanity (drafts perspective) and return its `result`. */
export async function sanityQuery<T>(query: string, params: Record<string, unknown> = {}): Promise<T> {
  const projectId = Deno.env.get('SANITY_PROJECT_ID')!
  const dataset = Deno.env.get('SANITY_DATASET')!
  const apiVersion = Deno.env.get('SANITY_API_VERSION')!
  const token = Deno.env.get('SANITY_READ_TOKEN')!

  const url = new URL(`https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}`)
  url.searchParams.set('query', query)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(`$${k}`, JSON.stringify(v))
  url.searchParams.set('perspective', 'drafts')

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Sanity query failed: ${res.status} ${await res.text()}`)
  const { result } = await res.json()
  return result as T
}

// Returns true if a characterDef with the given charKey exists in Sanity.
export async function characterDefExists(charKey: string): Promise<boolean> {
  const result = await sanityQuery<number>('count(*[_type == "characterDef" && charKey == $id])', {
    id: charKey,
  })
  return typeof result === 'number' && result > 0
}
