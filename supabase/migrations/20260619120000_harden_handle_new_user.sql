-- Harden public.handle_new_user(): it is a SECURITY DEFINER trigger function and must only ever
-- run from the on_auth_user_created trigger — never be invokable as a PostgREST RPC. Postgres
-- grants EXECUTE on new functions to PUBLIC by default, which let anon/authenticated reach it via
-- /rest/v1/rpc/handle_new_user (flagged by the Supabase security advisor, lints 0028/0029).
-- The trigger runs as the function owner regardless of these grants, so revoking EXECUTE does not
-- affect signup; it only removes the unintended RPC surface.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
