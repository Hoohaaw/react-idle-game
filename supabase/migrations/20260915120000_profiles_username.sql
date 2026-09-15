-- profiles.username: a player-chosen display name, shown in the UI instead of the account email.
--
-- Nullable at the column level (existing rows are backfilled below, then the column is made
-- NOT NULL) but always populated going forward by handle_new_user(), which now reads the
-- username the client passed as auth signup metadata (`raw_user_meta_data->>'username'`).
-- Uniqueness is case-insensitive (a functional unique index on lower(username)) so "Alex" and
-- "alex" can't both be taken.

alter table public.profiles add column username text;

-- Backfill any pre-existing rows (created before this migration) with a placeholder derived from
-- their player_id, so the NOT NULL + format constraints below can apply unconditionally.
update public.profiles
set username = 'player_' || substr(replace(player_id::text, '-', ''), 1, 8)
where username is null;

alter table public.profiles alter column username set not null;

alter table public.profiles add constraint profiles_username_format
  check (username ~ '^[A-Za-z0-9_]{3,20}$');

create unique index profiles_username_lower_idx on public.profiles (lower(username));

comment on column public.profiles.username is
  'Player-chosen display name (3-20 chars, [A-Za-z0-9_]), unique case-insensitively. Shown in the UI instead of email. Set at signup via handle_new_user() from auth signup metadata; no rename flow yet.';

-- Re-populate new accounts' username from signup metadata (CREATE OR REPLACE keeps the function's
-- OID stable, so the existing trigger `on_auth_user_created` picks this up with no other changes).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (player_id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;

-- Pre-signup availability check, called from the (anon-callable) username-available Edge
-- Function, never directly by a client — same ADR-0003 posture as every other RPC (revoked from
-- public/anon/authenticated, service_role only), even though this one only reads. SECURITY
-- DEFINER so it can see every row regardless of the caller, matching handle_new_user() above.
-- Still just a UX nicety — the unique index above is what actually prevents a duplicate on the
-- rare submit-at-the-same-instant race.
create function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(p_username)
  );
$$;

revoke all on function public.username_available(text) from public, anon, authenticated;
grant execute on function public.username_available(text) to service_role;
