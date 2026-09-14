-- claim_group_stage gains the achievements check (spec 2026-09-13 §4b) plus the same level-cap/
-- capstone-earned one-off detection claim_mission (Task 2) has. Every other line preserved
-- VERBATIM from 20260912100300_claim_group_stage_lifetime_stats.sql. Same 10-arg signature.

create or replace function public.claim_group_stage(
  p_player         uuid,
  p_kind           text,
  p_def_key        text,
  p_won            boolean,
  p_char_updates   jsonb,
  p_loot           jsonb,
  p_currencies     jsonb,
  p_resources      jsonb,
  p_is_last_stage  boolean,
  p_lifetime_stats jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run   public.group_runs;
  v_char  jsonb;
  v_loot  jsonb;
  v_key   text;
  v_val   numeric;
  v_lifetime_stats jsonb;
  v_transcend_count integer;
  v_ascendant_milestones jsonb;
  v_milestones jsonb;
  v_new_level      integer;
  v_char_blessings jsonb;
  v_reached_cap      boolean := false;
  v_reached_capstone boolean := false;
  v_reset_count integer;
  v_shards_earned_total integer;
  v_days_played integer;
  v_achievement_counters jsonb;
  v_achievements jsonb;
  v_unlocked_characters jsonb;
  v_achievement_result jsonb;
begin
  select * into v_run from public.group_runs
   where player_id = p_player and kind = p_kind and def_key = p_def_key
     and now() >= stage_ends_at
   for update;
  if not found then
    raise exception 'claim_group_stage: not claimable (no run, not finished, or already claimed)';
  end if;

  for v_char in select * from jsonb_array_elements(coalesce(p_char_updates, '[]'::jsonb))
  loop
    update public.player_characters
       set level = (v_char->>'level')::int,
           xp = (v_char->>'xp')::int,
           current_hp = (v_char->>'current_hp')::int
     where id = (v_char->>'id')::uuid and player_id = p_player
    returning level, blessings into v_new_level, v_char_blessings;

    if v_new_level >= 50 then
      v_reached_cap := true;
      if coalesce(v_char_blessings, '{}'::jsonb) ? 'row4' then
        v_reached_capstone := true;
      end if;
    end if;
  end loop;

  if p_won then
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
  end if;

  if p_won and p_is_last_stage then
    update public.group_runs
       set status = 'complete', party = '{}', stage_started_at = null, stage_ends_at = null,
           last_cleared_at = now()
     where player_id = p_player and kind = p_kind and def_key = p_def_key;
  elsif p_won then
    update public.group_runs
       set current_stage_index = current_stage_index + 1, party = '{}',
           stage_started_at = null, stage_ends_at = null
     where player_id = p_player and kind = p_kind and def_key = p_def_key;
  else
    update public.group_runs
       set party = '{}', stage_started_at = null, stage_ends_at = null
     where player_id = p_player and kind = p_kind and def_key = p_def_key;
  end if;

  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_lifetime_stats, '{}'::jsonb))
  loop
    update public.profiles
       set lifetime_stats = jsonb_set(lifetime_stats, array[v_key],
             to_jsonb(coalesce((lifetime_stats->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;

  select lifetime_stats, transcend_count, ascendant_milestones, reset_count,
         ascendant_shards_earned_total, days_played, achievement_counters, achievements,
         unlocked_characters
    into v_lifetime_stats, v_transcend_count, v_ascendant_milestones, v_reset_count,
         v_shards_earned_total, v_days_played, v_achievement_counters, v_achievements,
         v_unlocked_characters
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

  update public.profiles
     set ascendant_shards = ascendant_shards + (v_milestones->>'shards')::int,
         ascendant_shards_earned_total = ascendant_shards_earned_total + (v_milestones->>'shards')::int,
         ascendant_milestones = ascendant_milestones || (v_milestones->'newKeys'),
         achievement_counters = v_achievement_counters,
         achievements = achievements || (v_achievement_result -> 'newKeys')
   where player_id = p_player;

  return jsonb_build_object('won', p_won, 'party', v_run.party);
end;
$$;

revoke all on function public.claim_group_stage(uuid, text, text, boolean, jsonb, jsonb, jsonb, jsonb, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.claim_group_stage(uuid, text, text, boolean, jsonb, jsonb, jsonb, jsonb, boolean, jsonb) to service_role;
