-- Totems (design spec §E): a durable, party-wide, ACCOUNT-level equip slot — one totem
-- active at a time, free to swap, no busy-check (not scoped to any one character, unlike
-- equip_item's character-level busy checks — see the spec's "Alternatives considered").
-- totem_def_id is a bare Sanity totemKey string, not FK'd to a table (same looseness
-- player_inventory.item_def_id already has toward itemDef) — existence is validated by the
-- calling Edge Function's own Sanity lookup (Task 8), same split every other content-
-- referencing RPC in this codebase uses.

alter table public.profiles
  add column active_totem_id text;

comment on column public.profiles.active_totem_id is
  'Sanity totemKey of the player''s currently equipped totem, or null for none. Read live at mission-claim time, not locked at dispatch.';

create or replace function public.equip_totem(
  p_player       uuid,
  p_totem_def_id text
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_totem_def_id is null or length(p_totem_def_id) = 0 then
    raise exception 'equip_totem: totem id required';
  end if;

  update public.profiles
     set active_totem_id = p_totem_def_id
   where player_id = p_player;
  if not found then
    raise exception 'equip_totem: no profile';
  end if;

  return p_totem_def_id;
end;
$$;

revoke all on function public.equip_totem(uuid, text) from public, anon, authenticated;
grant execute on function public.equip_totem(uuid, text) to service_role;

create or replace function public.unequip_totem(
  p_player uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles
     set active_totem_id = null
   where player_id = p_player;
  if not found then
    raise exception 'unequip_totem: no profile';
  end if;
end;
$$;

revoke all on function public.unequip_totem(uuid) from public, anon, authenticated;
grant execute on function public.unequip_totem(uuid) to service_role;
