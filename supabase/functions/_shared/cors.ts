// Shared CORS headers for browser-invoked Edge Functions. The app calls these from the client via
// supabase.functions.invoke, so preflight + the standard Supabase headers must be allowed.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
