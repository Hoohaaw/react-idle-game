import { supabase } from '@/lib/supabase'
import { invokeError } from './_invoke'

// Player support/feedback mailbox (TODO.md D9) — same Edge-Function-invoke pattern as every
// other server-authoritative write (ADR-0003). submit_feedback enforces a 5-minute per-player
// cooldown server-side; a rejected submission surfaces that message via invokeError.
export async function submitFeedback(message: string): Promise<void> {
  const { error } = await supabase.functions.invoke('submit-feedback', {
    body: { message },
  })
  if (error) await invokeError(error, 'Could not submit feedback')
}
