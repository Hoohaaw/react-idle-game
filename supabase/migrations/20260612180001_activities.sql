-- Active player activities: missions (one-shot timers) and gather assignments (continuous ticks).
--
-- A character may be in at most ONE activity at a time. That rule spans both tables, so it is
-- enforced in Edge Functions (a single DB constraint cannot span tables). Within gathering, a
-- per-table UNIQUE still guards "a character gathers at most one node".

-- mission_runs: a discrete, one-shot mission timer. On claim, an Edge Function validates
-- now >= ends_at, grants rewards, and DELETES the row (freeing the party). Offline-safe: a
-- mission that finished while the player was away is simply "ready to claim" on return.
create table public.mission_runs (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references auth.users (id) on delete cascade,
  mission_def_id text not null,                       -- = Sanity mission content key
  party          uuid[] not null,                     -- player_character ids on this mission
  started_at     timestamptz not null default now(),
  ends_at        timestamptz not null,

  check (cardinality(party) between 1 and 3)           -- party size 1..3
);

comment on table public.mission_runs is
  'Active one-shot missions. party = player_character ids (1..3). Claimed via Edge Function: validate now>=ends_at, grant rewards, delete row. Character-busy uniqueness enforced in Edge Functions.';

-- gather_assignments: a character continuously gathering a resource. Yield accrues every tick;
-- the tick interval + yield_per_tick come from the resource def. An Edge Function credits
-- floor((now - last_collected_at)/interval) * yield_per_tick on read/collect/unassign and
-- advances last_collected_at by the consumed ticks (keeping the partial-tick remainder).
create table public.gather_assignments (
  id                  uuid primary key default gen_random_uuid(),
  player_id           uuid not null references auth.users (id) on delete cascade,
  player_character_id uuid not null references public.player_characters (id) on delete cascade,
  resource_id         text not null,                  -- = Sanity/config resource key
  started_at          timestamptz not null default now(),
  last_collected_at   timestamptz not null default now(),

  unique (player_character_id)                         -- a character gathers at most one node
);

comment on table public.gather_assignments is
  'A character continuously gathering a resource. Accrual computed server-side from elapsed ticks (interval + yield_per_tick from the resource def). Character-busy uniqueness across missions enforced in Edge Functions.';

-- Row Level Security + grants (owner reads; Edge Functions write).
alter table public.mission_runs enable row level security;
alter table public.gather_assignments enable row level security;

create policy "mission_runs_select_own"
  on public.mission_runs for select to authenticated
  using (player_id = (select auth.uid()));

create policy "gather_assignments_select_own"
  on public.gather_assignments for select to authenticated
  using (player_id = (select auth.uid()));

grant select on public.mission_runs to authenticated;
grant select, insert, update, delete on public.mission_runs to service_role;

grant select on public.gather_assignments to authenticated;
grant select, insert, update, delete on public.gather_assignments to service_role;
