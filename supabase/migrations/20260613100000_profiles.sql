-- profiles: per-player account-level state (1:1 with auth.users).
--
-- Holds the player's wallet — spendable CURRENCIES (coins, …) and gathered RESOURCES
-- (Wood, Copper, …) — plus account scalars like the transcendence count. Both balances are
-- JSONB maps keyed by a code-side registry (currencies -> src/lib/currencies.ts; resources ->
-- src/lib/resources.ts), so adding a new currency or resource is a one-line code change with
-- NO migration. A key that is absent means a zero balance. This is a work in progress: the set
-- of currencies/resources is expected to grow. See memory: project_data_architecture.

create table public.profiles (
  player_id           uuid primary key references auth.users (id) on delete cascade,
  currencies          jsonb not null default '{}'::jsonb,   -- { "<currencyKey>": amount }  e.g. { "coins": 0 }
  resources           jsonb not null default '{}'::jsonb,   -- { "<resourceKey>": amount }  e.g. { "Wood": 0 }
  transcendence_count integer not null default 0 check (transcendence_count >= 0),
  created_at          timestamptz not null default now()
);

comment on table public.profiles is
  'Per-player account state (1:1 with auth.users). currencies/resources are JSONB maps keyed by the code-side registries; a missing key = 0. Adding a currency/resource needs no migration. All balance changes go through Edge Functions (anti-tamper).';

-- Row Level Security ---------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Owners may READ their own profile.
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (player_id = (select auth.uid()));

-- Intentionally NO client insert/update/delete policy: balances are server-authoritative.
-- Every currency/resource change goes through an Edge Function (service role, bypasses RLS).
-- New rows are created by the on-signup trigger below (security definer), never by clients —
-- this is what stops a browser from writing its own coin balance.

-- Table privileges. As with the other tables, the new Supabase default does not auto-expose
-- public tables to the Data API roles, so RLS alone yields "permission denied" without GRANTs.
--   authenticated -> SELECT only (RLS scopes it to the player's own row)
--   service_role  -> full DML (Edge Functions perform every mutation, bypassing RLS)
--   anon          -> intentionally NO grant
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;

-- Auto-create a profile when a new auth user signs up -------------------------------------
-- SECURITY DEFINER so the insert succeeds despite there being no client INSERT policy;
-- search_path is pinned empty and objects are schema-qualified (Supabase security guidance).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (player_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
