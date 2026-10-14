-- Totem durability: every totem has 3 uses (one per mission claim, win OR loss both consume a
-- charge). Charges are tracked per (player, totemKey) on profiles.totem_charges and persist
-- across equip/unequip of the SAME totem — this is what prevents a "spam unequip/re-equip for
-- free charges" exploit. At 0 charges the totem breaks: its charges entry is cleared, one copy is
-- removed from player_inventory, and the player is left with no totem equipped (manual re-equip
-- required even if they own more copies — a deliberate design choice, not a bug).
--
-- claim_mission's signature does NOT change — the RPC re-derives the currently-equipped totem
-- from the same profiles row it already locks (`for update`), consistent with this project's
-- "totems read live at claim time" rule, and avoids adding a parameter at all. This is a pure
-- `create or replace` with the identical signature, so no `drop function` is needed first. Every
-- other line of the function body is preserved VERBATIM from
-- 20260914100100_claim_mission_collect_gather_achievements.sql — only the new declares/block/
-- update/return additions below are new.

alter table public.profiles
  add column totem_charges jsonb not null default '{}'::jsonb;

comment on column public.profiles.totem_charges is
  'Map of {totemKey: usesRemaining}. A missing entry means that totemKey has not been tracked yet (a fresh totem, or one equipped before this feature shipped) and is treated as full (3 uses).';

create or replace function public.claim_mission(
  p_player          uuid,
  p_run_id          uuid,
  p_char_updates    jsonb,
  p_loot            jsonb,
  p_currencies      jsonb,
  p_resources       jsonb,
  p_map_key         text    default null,
  p_stage           int     default null,
  p_won             boolean default false,
  p_lifetime_stats  jsonb   default '{}'::jsonb,
  p_newly_unlocked  text[]  default '{}'
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_party uuid[];
  v_char  jsonb;
  v_loot  jsonb;
  v_key   text;
  v_val   numeric;
  v_actually_unlocked text[] := '{}';
  v_lifetime_stats jsonb;
  v_transcend_count integer;
  v_ascendant_milestones jsonb;
  v_milestones jsonb;
  v_new_level    integer;
  v_new_blessings jsonb;
  v_reached_cap      boolean := false;
  v_reached_capstone boolean := false;
  v_reset_count integer;
  v_shards_earned_total integer;
  v_days_played integer;
  v_achievement_counters jsonb;
  v_achievements jsonb;
  v_unlocked_characters jsonb;
  v_achievement_result jsonb;
  v_active_totem_key text;
  v_totem_charges jsonb;
  v_totem_remaining int;
  v_totem_broke boolean := false;
  v_totem_qty int;
begin
  delete from public.mission_runs
   where id = p_run_id and player_id = p_player and now() >= ends_at
   returning party into v_party;
  if not found then
    raise exception 'claim_mission: not claimable (already claimed, not owned, or not finished)';
  end if;

  for v_char in select * from jsonb_array_elements(coalesce(p_char_updates, '[]'::jsonb))
  loop
    update public.player_characters
       set level      = (v_char->>'level')::int,
           xp         = (v_char->>'xp')::int,
           current_hp = (v_char->>'current_hp')::int
     where id = (v_char->>'id')::uuid and player_id = p_player
    returning level, blessings into v_new_level, v_new_blessings;

    if v_new_level >= 50 then
      v_reached_cap := true;
      if coalesce(v_new_blessings, '{}'::jsonb) ? 'row4' then
        v_reached_capstone := true;
      end if;
    end if;
  end loop;

  for v_loot in select * from jsonb_array_elements(coalesce(p_loot, '[]'::jsonb))
  loop
    insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
    values (p_player, v_loot->>'item_def_id', v_loot->>'rarity', (v_loot->>'quantity')::int)
    on conflict (player_id, item_def_id, rarity)
      do update set quantity = public.player_inventory.quantity + excluded.quantity;
  end loop;

  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_currencies, '{}'::jsonb))
  loop
    update public.profiles
       set currencies = jsonb_set(currencies, array[v_key],
             to_jsonb(coalesce((currencies->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;
  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_resources, '{}'::jsonb))
  loop
    update public.profiles
       set resources = jsonb_set(resources, array[v_key],
             to_jsonb(coalesce((resources->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;

  if p_won and p_map_key is not null and p_stage is not null then
    update public.profiles
       set map_progress = jsonb_set(
             map_progress,
             array[p_map_key],
             to_jsonb(greatest(coalesce((map_progress ->> p_map_key)::int, 0), p_stage))
           )
     where player_id = p_player;
  end if;

  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_lifetime_stats, '{}'::jsonb))
  loop
    update public.profiles
       set lifetime_stats = jsonb_set(lifetime_stats, array[v_key],
             to_jsonb(coalesce((lifetime_stats->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;

  foreach v_key in array coalesce(p_newly_unlocked, '{}')
  loop
    update public.profiles
       set unlocked_characters = jsonb_set(unlocked_characters, array[v_key], to_jsonb(now()))
     where player_id = p_player and not (unlocked_characters ? v_key);
    if found then
      v_actually_unlocked := array_append(v_actually_unlocked, v_key);
    end if;
  end loop;

  select lifetime_stats, transcend_count, ascendant_milestones, reset_count,
         ascendant_shards_earned_total, days_played, achievement_counters, achievements,
         unlocked_characters, totem_charges, active_totem_id
    into v_lifetime_stats, v_transcend_count, v_ascendant_milestones, v_reset_count,
         v_shards_earned_total, v_days_played, v_achievement_counters, v_achievements,
         v_unlocked_characters, v_totem_charges, v_active_totem_key
    from public.profiles where player_id = p_player
    for update;
  v_milestones := check_ascendant_milestones(v_lifetime_stats, v_transcend_count, v_ascendant_milestones);

  if v_reached_cap then
    v_achievement_counters := jsonb_set(v_achievement_counters, array['charactersReachedLevelCap'],
      to_jsonb(coalesce((v_achievement_counters->>'charactersReachedLevelCap')::int, 0) + 1));
  end if;
  if v_reached_capstone then
    v_achievement_counters := jsonb_set(v_achievement_counters, array['capstonesEarned'],
      to_jsonb(coalesce((v_achievement_counters->>'capstonesEarned')::int, 0) + 1));
  end if;

  v_achievement_result := check_achievements(
    v_lifetime_stats,
    (select count(*) from jsonb_object_keys(v_unlocked_characters))::int,
    v_reset_count, v_transcend_count, v_shards_earned_total, v_days_played,
    v_achievement_counters, v_achievements
  );

  -- Mission-prep totem durability: every totem has 3 uses (one per mission claim, win or
  -- loss); a missing totem_charges entry defaults to 3 (first-ever use of this totemKey, OR
  -- a totem equipped before this feature shipped — no backfill migration needed). At 0 uses
  -- the totem breaks: its charges entry is cleared, one copy is removed from inventory, and
  -- the player is left with no totem equipped — re-equipping even from remaining stock is
  -- manual (deliberate design choice, not a bug).
  if v_active_totem_key is not null then
    v_totem_remaining := coalesce((v_totem_charges->>v_active_totem_key)::int, 3) - 1;
    if v_totem_remaining <= 0 then
      v_totem_broke := true;
      v_totem_charges := v_totem_charges - v_active_totem_key;
      -- player_inventory.quantity has a `check (quantity > 0)` constraint, so an
      -- unconditional `quantity = quantity - 1` would violate it when only one copy remains —
      -- same delete-if-last-else-decrement branch every other inventory-consuming RPC in this
      -- codebase uses (equip_item, upgrade_items, claim_craft, mission_consumables, ...).
      select quantity into v_totem_qty
        from public.player_inventory
       where player_id = p_player and item_def_id = v_active_totem_key and rarity = 'Common'
       for update;
      if v_totem_qty is not null then
        if v_totem_qty <= 1 then
          delete from public.player_inventory
           where player_id = p_player and item_def_id = v_active_totem_key and rarity = 'Common';
        else
          update public.player_inventory
             set quantity = quantity - 1
           where player_id = p_player and item_def_id = v_active_totem_key and rarity = 'Common';
        end if;
      end if;
    else
      v_totem_charges := jsonb_set(v_totem_charges, array[v_active_totem_key], to_jsonb(v_totem_remaining));
    end if;
  end if;

  update public.profiles
     set ascendant_shards = ascendant_shards + (v_milestones->>'shards')::int,
         ascendant_shards_earned_total = ascendant_shards_earned_total + (v_milestones->>'shards')::int,
         ascendant_milestones = ascendant_milestones || (v_milestones->'newKeys'),
         achievement_counters = v_achievement_counters,
         achievements = achievements || (v_achievement_result -> 'newKeys'),
         totem_charges = v_totem_charges,
         active_totem_id = case when v_totem_broke then null else active_totem_id end
   where player_id = p_player;

  return jsonb_build_object(
    'claimed', true, 'party', v_party, 'actually_unlocked', v_actually_unlocked,
    'totem_broke', v_totem_broke,
    'broken_totem_key', case when v_totem_broke then v_active_totem_key else null end
  );
end;
$$;

revoke all on function public.claim_mission(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, int, boolean, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.claim_mission(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, int, boolean, jsonb, text[]) to service_role;
