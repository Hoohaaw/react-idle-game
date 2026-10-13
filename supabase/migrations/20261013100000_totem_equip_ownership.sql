-- Fix (final-branch review, ADR-0061): equip_totem let a player equip ANY authored totem for
-- free with no ownership check at all. Per the spec, totems work like a real crafted item — you
-- must own at least one copy (a player_inventory row) to equip it — but equipping must NOT
-- consume/decrement that stack (it stays durable: free to re-equip or swap between owned totems
-- without re-crafting, matching the existing "free to swap" design already covered by
-- 20261012110000_totem_equip.sql's pgTAP case 2). This project never edits a historical
-- migration file, so this creates a new `create or replace function` with the ownership check
-- added; every other line of the function body is preserved verbatim from
-- 20261012110000_totem_equip.sql.

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

  -- Ownership check: must own at least one copy to equip it. Not decremented/deleted — equipping
  -- a totem is durable, not a consume (same rarity convention as crafted non-rarity-rolled
  -- results — see claim_craft/rollRarity — totems are always stored at rarity 'Common').
  if not exists (
    select 1 from public.player_inventory
     where player_id = p_player and item_def_id = p_totem_def_id and rarity = 'Common' and quantity >= 1
  ) then
    raise exception 'equip_totem: totem not owned';
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
