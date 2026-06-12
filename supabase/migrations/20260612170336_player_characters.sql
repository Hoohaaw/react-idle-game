-- player_characters: a per-player instance of a roster character.
--
-- The character DEFINITION (base stats, growth, the bespoke blessing tree) lives in Sanity,
-- keyed by characterDef.charKey. This table stores only player INTENT: level/xp plus the
-- blessing-allocation and equip maps. Baselines and effective stats are computed on read
-- (server-side) from `level` + the Sanity def, so there is no stored stat for a tampered
-- row to inflate. See memory: project_data_architecture.

create table public.player_characters (
  id                uuid primary key default gen_random_uuid(),
  player_id         uuid not null references auth.users (id) on delete cascade,
  character_def_id  text not null,                          -- = Sanity characterDef.charKey
  level             integer not null default 1 check (level between 1 and 50),
  xp                integer not null default 0 check (xp >= 0),
  blessings         jsonb not null default '{}'::jsonb,     -- { "<nodeId>": ranks }
  equipped          jsonb not null default '{}'::jsonb,     -- { "<slot>": "<inventoryItemId>" }
  acquired_at       timestamptz not null default now(),

  -- One of each character per player, ever (no duplicates).
  unique (player_id, character_def_id)
);

comment on table public.player_characters is
  'Per-player owned character instance. Definition lives in Sanity (character_def_id = charKey); only level/xp + blessing/equip intent stored here. Baselines + effective stats are computed on read.';

-- The UNIQUE (player_id, character_def_id) constraint already provides an index whose
-- leftmost prefix (player_id) serves "list this player''s roster" lookups, so no extra
-- index is needed.

-- Row Level Security ---------------------------------------------------------------------
alter table public.player_characters enable row level security;

-- Owners may READ their own characters.
create policy "player_characters_select_own"
  on public.player_characters
  for select
  to authenticated
  using (player_id = (select auth.uid()));

-- Intentionally NO insert/update/delete policy for clients: every mutation goes through an
-- Edge Function (service role, which bypasses RLS) that validates against the Sanity def
-- first. This is what keeps level / xp / blessings untamperable from the client.

-- Table privileges. The new Supabase default does NOT auto-expose public tables to the Data
-- API roles, so RLS by itself yields "permission denied" — the role also needs GRANTs.
--   authenticated -> SELECT only (the RLS policy above scopes it to the player's own rows)
--   service_role  -> full DML (Edge Functions perform every mutation, bypassing RLS)
--   anon          -> intentionally NO grant (unauthenticated users have no characters)
grant select on public.player_characters to authenticated;
grant select, insert, update, delete on public.player_characters to service_role;
