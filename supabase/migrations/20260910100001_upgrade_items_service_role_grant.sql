-- upgrade_items (20260709000000_upgrade_items_rpc.sql) was revoked from public/anon/authenticated
-- but never explicitly execute-granted to service_role — the only RPC missing the pair every
-- other SECURITY DEFINER function carries. It kept working only because Supabase's default
-- privileges grant EXECUTE on new public functions to service_role; nothing in our migrations
-- guaranteed it. Found by src/test/migration-policy.test.ts (the ADR-0003 grant-policy lint added
-- alongside the group_runs grant fix). Making the grant explicit, matching the convention.

grant execute on function public.upgrade_items(uuid, jsonb) to service_role;
