-- equip_item bumps achievement_counters.legendaryItemsEquipped whenever the equipped item's
-- rarity is 'Legendary' (spec 2026-09-13 §4e "Legendary Collector" — counts equip EVENTS, not
-- distinct legendary item defs, a deliberate simplification). The actual achievement claim
-- happens later, next time check_achievements runs from any of its callers — equip_item never
-- calls it directly, since equipping never touches lifetime_stats/reset_count/transcend_count/
-- shards/days_played, so there is nothing else for check_achievements to re-evaluate here. Every
-- other line preserved VERBATIM from 20260908140000_group_runs.sql's equip_item. Same signature.

create or replace function public.equip_item(
  p_player          uuid,
  p_char            uuid,
  p_slot_key        text,
  p_item_def_id     text,
  p_rarity          text,
  p_required_level  integer default 0
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
  v_level        integer;
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

  -- 3. Lock the character row and capture equipped + level; fail if not owned.
  select equipped, level into v_equipped, v_level
    from public.player_characters
   where id = p_char and player_id = p_player
   for update;
  if not found then
    raise exception 'equip_item: character not found or not owned';
  end if;

  -- 3b. Level-requirement gate (ADR-0043).
  if v_level < p_required_level then
    raise exception 'equip_item: character level too low (needs %, has %)', p_required_level, v_level;
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
  if exists (
    select 1 from public.group_runs
     where player_id = p_player and party && array[p_char]
  ) then
    raise exception 'equip_item: character is in a dungeon or raid';
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

  -- 10. "Legendary Collector" counter (spec §4e) — an equip event, not a distinct-items set.
  if p_rarity = 'Legendary' then
    update public.profiles
       set achievement_counters = jsonb_set(
             coalesce(achievement_counters, '{}'::jsonb),
             array['legendaryItemsEquipped'],
             to_jsonb(coalesce((achievement_counters->>'legendaryItemsEquipped')::int, 0) + 1)
           )
     where player_id = p_player;
  end if;

  return jsonb_build_object(
    'equipped', v_new_equipped,
    'returned', coalesce(v_prev, 'null'::jsonb)
  );
end;
$$;

revoke all on function public.equip_item(uuid, uuid, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.equip_item(uuid, uuid, text, text, text, integer) to service_role;
