-- Activity Log (docs/superpowers/specs/2026-09-18-activity-log-design.md) — a per-player event
-- ledger the game never had. Every mutation in this codebase already goes through a SECURITY
-- DEFINER RPC (never a raw insert from an Edge Function's admin client); log_event follows the
-- same shape so retention (the 200-row-per-player cap) is enforced in exactly one place regardless
-- of which of the ~21 call sites triggered the insert.
create table public.player_events (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references auth.users (id) on delete cascade,
  type       text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index player_events_player_created_idx
  on public.player_events (player_id, created_at desc);

alter table public.player_events enable row level security;

grant select on public.player_events to authenticated;

create policy "player_events_select_own"
  on public.player_events for select to authenticated
  using (player_id = (select auth.uid()));
-- Intentionally NO client insert/update/delete policy (ADR-0003) — same shape as
-- infirmary_admissions (supabase/migrations/20260707150000_infirmary.sql).

create or replace function public.log_event(
  p_player  uuid,
  p_type    text,
  p_payload jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.player_events (player_id, type, payload)
  values (p_player, p_type, p_payload);

  -- Cap at 200 most recent per player — enforced here, once, regardless of which of the ~21
  -- call sites triggered the insert.
  delete from public.player_events
   where id in (
     select id from public.player_events
      where player_id = p_player
      order by created_at desc
      offset 200
   );
end;
$$;

revoke all on function public.log_event(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.log_event(uuid, text, jsonb) to service_role;
