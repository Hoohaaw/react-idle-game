import * as Sentry from 'npm:@sentry/deno@^8'
import { corsHeaders } from './cors.ts'

// Shared Sentry wiring for every Edge Function (TODO.md "Error / uptime monitoring"). Each
// function is its own Deno isolate, so this module (and Sentry.init) runs once per cold start —
// standard for this runtime, not a bug. defaultIntegrations: false because this SDK doesn't
// instrument Deno.serve (known limitation); withSentry below is the capture point instead.
Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  defaultIntegrations: false,
  tracesSampleRate: 1.0,
})

/**
 * Wraps a Deno.serve handler so an uncaught error is reported to Sentry before the function
 * returns a generic 500, instead of crashing the isolate with no visibility. Surgical — doesn't
 * change any function's existing logic or its own try/catch blocks, just adds a backstop.
 */
export function withSentry(
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      return await handler(req)
    } catch (err) {
      Sentry.captureException(err)
      await Sentry.flush(2000)
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }
}
