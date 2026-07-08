-- Gear equip/unequip RPCs for the gear-equip feature (ADR-0022).
--
-- Items are fungible stacks in player_inventory keyed by (player_id, item_def_id, rarity).
-- Equipping an item decrements (or deletes) that stack and writes the slot on
-- player_characters.equipped. Unequipping does the reverse. Both operations are atomic
-- inside a transaction: the FOR UPDATE locks on character + inventory rows prevent races.
--
-- Semantic item-slot compatibility (e.g. a ring item into ring3 but not into chest) is
-- enforced by the calling Edge Functions via Sanity def lookups. The RPCs only enforce
-- structural validity (slot key in the 14-key list, rarity in the known set, ownership,
-- busy-status, inventory presence) as a defence-in-depth layer (ADR-0003).
--
-- Clients never call these functions directly; they are service_role-only (ADR-0003).
-- The gear-equip and gear-unequip Edge Functions are the only callers.

-- ---------------------------------------------------------------------------
-- RPC: equip_item
-- ---------------------------------------------------------------------------
-- Equips one item stack onto a character slot, returning the item previously
-- in that slot (if any) to inventory. Steps in order:
--   1. Validate p_slot_key and p_rarity.
--   2. Lock + verify character ownership.
--   3. Busy checks: mission / gather / infirmary.
--   4. Lock + verify inventory stack.
--   5. Capture the previously equipped item in the target slot.
--   6. Consume the incoming stack (delete if qty=1, else decrement).
--   7. Return the displaced item to inventory (upsert +1) if a previous item existed.
--   8. Write the new item into the equipped slot.
--   9. Return { equipped: <new equipped jsonb>, returned: <displaced item jsonb or null> }.
create or replace function public.equip_item(
  p_player      uuid,
  p_char        uuid,
  p_slot_key    text,
  p_item_def_id text,
  p_rarity      text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_equipped     jsonb;
  v_new_equipped jsonb;
  v_prev         jsonb;
  v_qty          integer;
begin
  -- 1. Validate slot key.
  if p_slot_key not in (
    'head', 'shoulders', 'chest', 'hands', 'legs', 'feet',
    'weapon', 'offhand',
    'ring1', 'ring2', 'ring3', 'ring4',
    'trinket1', 'trinket2'
  ) then
    raise exception 'equip_item: invalid slot key';
  end if;

  -- 2. Validate rarity.
  if p_rarity not in ('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary') then
    raise exception 'equip_item: invalid rarity';
  end if;

  -- 3. Lock the character row and capture equipped; fail if not owned.
  select equipped into v_equipped
    from public.player_characters
   where id = p_char and player_id = p_player
   for update;
  if not found then
    raise exception 'equip_item: character not found or not owned';
  end if;

  -- 4. Busy checks.
  if exists (
    select 1 from public.mission_runs
     where player_id = p_player and party && array[p_char]
  ) then
    raise exception 'equip_item: character is on a mission';
  end if;
  if exists (
    select 1 from public.gather_assignments
     where player_character_id = p_char
  ) then
    raise exception 'equip_item: character is gathering';
  end if;
  if exists (
    select 1 from public.infirmary_admissions
     where player_character_id = p_char
  ) then
    raise exception 'equip_item: character is in the infirmary';
  end if;

  -- 5. Lock the incoming inventory stack; fail if not present.
  select quantity into v_qty
    from public.player_inventory
   where player_id = p_player
     and item_def_id = p_item_def_id
     and rarity = p_rarity
   for update;
  if not found then
    raise exception 'equip_item: item not in inventory';
  end if;

  -- 6. Capture the item currently in the target slot (may be null / SQL NULL).
  v_prev := v_equipped -> p_slot_key;

  -- 7. Consume the incoming stack.
  if v_qty = 1 then
    delete from public.player_inventory
     where player_id = p_player
       and item_def_id = p_item_def_id
       and rarity = p_rarity;
  else
    update public.player_inventory
       set quantity = quantity - 1
     where player_id = p_player
       and item_def_id = p_item_def_id
       and rarity = p_rarity;
  end if;

  -- 8. Return displaced item to inventory (if there was one).
  --    Equipping the same item+rarity that is already in the slot is a harmless net-zero:
  --    step 7 decremented the stack, this upsert brings it back to the same count.
  if v_prev is not null then
    insert into public.player_inventory (player_id, item_def_id, rarity)
    values (p_player, v_prev->>'itemDefId', v_prev->>'rarity')
    on conflict (player_id, item_def_id, rarity)
    do update set quantity = player_inventory.quantity + 1;
  end if;

  -- 9. Write the new item into the slot, capturing the resulting equipped map.
  update public.player_characters
     set equipped = jsonb_set(
           coalesce(equipped, '{}'::jsonb),
           array[p_slot_key],
           jsonb_build_object('itemDefId', p_item_def_id, 'rarity', p_rarity)
         )
   where id = p_char and player_id = p_player
  returning equipped into v_new_equipped;

  return jsonb_build_object(
    'equipped', v_new_equipped,
    'returned', coalesce(v_prev, 'null'::jsonb)
  );
end;
$$;

revoke all on function public.equip_item(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.equip_item(uuid, uuid, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- RPC: unequip_item
-- ---------------------------------------------------------------------------
-- Removes the item in a character slot and returns it to inventory. Steps:
--   1. Validate p_slot_key.
--   2. Lock + verify character ownership, capture equipped.
--   3. Busy checks: mission / gather / infirmary.
--   4. Verify the slot is occupied.
--   5. Upsert the item back into inventory (+1 or insert).
--   6. Remove the key from the equipped map.
--   7. Return { equipped: <new equipped jsonb>, returned: <item jsonb> }.
create or replace function public.unequip_item(
  p_player   uuid,
  p_char     uuid,
  p_slot_key text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_equipped     jsonb;
  v_new_equipped jsonb;
  v_item         jsonb;
begin
  -- 1. Validate slot key.
  if p_slot_key not in (
    'head', 'shoulders', 'chest', 'hands', 'legs', 'feet',
    'weapon', 'offhand',
    'ring1', 'ring2', 'ring3', 'ring4',
    'trinket1', 'trinket2'
  ) then
    raise exception 'unequip_item: invalid slot key';
  end if;

  -- 2. Lock the character row and capture equipped; fail if not owned.
  select equipped into v_equipped
    from public.player_characters
   where id = p_char and player_id = p_player
   for update;
  if not found then
    raise exception 'unequip_item: character not found or not owned';
  end if;

  -- 3. Busy checks.
  if exists (
    select 1 from public.mission_runs
     where player_id = p_player and party && array[p_char]
  ) then
    raise exception 'unequip_item: character is on a mission';
  end if;
  if exists (
    select 1 from public.gather_assignments
     where player_character_id = p_char
  ) then
    raise exception 'unequip_item: character is gathering';
  end if;
  if exists (
    select 1 from public.infirmary_admissions
     where player_character_id = p_char
  ) then
    raise exception 'unequip_item: character is in the infirmary';
  end if;

  -- 4. Verify the slot is occupied.
  v_item := v_equipped -> p_slot_key;
  if v_item is null then
    raise exception 'unequip_item: slot is empty';
  end if;

  -- 5. Return the item to inventory.
  insert into public.player_inventory (player_id, item_def_id, rarity)
  values (p_player, v_item->>'itemDefId', v_item->>'rarity')
  on conflict (player_id, item_def_id, rarity)
  do update set quantity = player_inventory.quantity + 1;

  -- 6. Remove the slot key from the equipped map.
  update public.player_characters
     set equipped = equipped - p_slot_key
   where id = p_char and player_id = p_player
  returning equipped into v_new_equipped;

  return jsonb_build_object(
    'equipped', v_new_equipped,
    'returned', v_item
  );
end;
$$;

revoke all on function public.unequip_item(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.unequip_item(uuid, uuid, text) to service_role;

-- Clients never call equip_item or unequip_item directly (ADR-0003).
-- The gear-equip and gear-unequip Edge Functions (service role) are the sole callers.
