import { FunctionsHttpError } from '@supabase/supabase-js'

// Normalizes a `supabase.functions.invoke()` error into a thrown Error carrying the Edge Function's JSON
// `{ error }` message (our functions return that shape), falling back to a generic message. Shared by the
// mission + gather data layers.
export async function invokeError(error: unknown, fallback: string): Promise<never> {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null)
    throw new Error(body?.error ?? fallback)
  }
  throw error
}
