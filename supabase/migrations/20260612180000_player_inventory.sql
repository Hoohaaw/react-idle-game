-- player_inventory: a player's bagged (unequipped) item stacks.
--
-- Items are DEFINED in Sanity (item_def_id = the item's content key). This table records which
-- items a player holds, at what rarity, and how many. Stacks by (item + rarity) so the
-- duplicate-upgrade system (5 same item+rarity -> 1 of the next rarity) operates on a quantity.
--
-- EQUIPPED gear is NOT stored here — it lives on player_characters.equipped as
-- { "<slot>": { itemDefId, rarity } }. Items of the same (def, rarity) are fungible, so equip
-- decrements a stack here and unequip increments it (both via Edge Functions); no per-instance
-- row identity is needed.

create table public.player_inventory (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references auth.users (id) on delete cascade,
  item_def_id  text not null,                        -- = Sanity item content key
  rarity       text not null check (rarity in ('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary')),
  quantity     integer not null default 1 check (quantity > 0),
  acquired_at  timestamptz not null default now(),

  unique (player_id, item_def_id, rarity)            -- one stack per (item, rarity)
);

comment on table public.player_inventory is
  'A player''s bagged item stacks (item_def_id = Sanity item key), stacked by (item, rarity). Equipped gear lives on player_characters.equipped, not here.';

-- Row Level Security + grants (new Supabase default does not auto-expose tables).
alter table public.player_inventory enable row level security;

create policy "player_inventory_select_own"
  on public.player_inventory
  for select
  to authenticated
  using (player_id = (select auth.uid()));

-- Writes go through Edge Functions (service_role) only.
grant select on public.player_inventory to authenticated;
grant select, insert, update, delete on public.player_inventory to service_role;
