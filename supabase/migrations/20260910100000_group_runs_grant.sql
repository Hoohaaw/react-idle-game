-- group_runs was created (20260908140000_group_runs.sql) with RLS enabled and an owner-read
-- policy but no table GRANT. New Supabase projects don't auto-expose tables, so RLS without a
-- grant yields "permission denied" for authenticated reads — every client read of group_runs
-- (src/services/groupContent.ts: fetchGroupRuns, fetchGroupBusyCharacterIds) was failing, which
-- broke the dungeons/raids UI and the roster busy-state. Every other gameplay table carries this
-- same pair of grants (e.g. 20260612180000_player_inventory.sql); this brings group_runs in line.
-- Found by the 2026-09-09 project audit (docs/reports/2026-09-09-project-audit.md).

grant select on public.group_runs to authenticated;
grant select, insert, update, delete on public.group_runs to service_role;
