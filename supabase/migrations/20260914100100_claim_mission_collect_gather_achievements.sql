-- claim_mission and collect_gather gain the achievements check (spec 2026-09-13 §4b), same
-- calling shape as their existing check_ascendant_milestones call, computed from each RPC's own
-- already-locked state. claim_mission additionally detects two one-off "moment" achievements
-- (level cap reached, blessing capstone newly earned) inside its existing per-character update
-- loop — collect_gather never changes level, so it has no equivalent. Every other line of both
-- functions is preserved VERBATIM from 20260912100200_claim_mission_collect_gather_milestones.sql
-- — only the new blocks are added. Same signatures as today.

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

  -- Ascendant Milestones (ADR-0023): computed from the row's own state, AFTER every delta above
  -- has already been applied to it, so this sees the true post-claim lifetime_stats. `for update`
  -- is required here (not just incidentally covered by an earlier UPDATE in this function) so two
  -- concurrent claims for the same player always serialize on this row before computing/awarding
  -- shards — otherwise both could read the same pre-award state and double-award ascendant_shards.
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

  return jsonb_build_object('claimed', true, 'party', v_party, 'actually_unlocked', v_actually_unlocked);
end;
$$;

revoke all on function public.claim_mission(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, int, boolean, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.claim_mission(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, int, boolean, jsonb, text[]) to service_role;

create or replace function public.collect_gather(
  p_player                uuid,
  p_assignment_id         uuid,
  p_resource              text,
  p_gained                int,
  p_new_last_collected_at timestamptz,
  p_stop                  boolean,
  p_lifetime_stats        jsonb  default '{}'::jsonb,
  p_newly_unlocked        text[] default '{}'
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owned int;
  v_key   text;
  v_val   numeric;
  v_actually_unlocked text[] := '{}';
  v_lifetime_stats jsonb;
  v_transcend_count integer;
  v_ascendant_milestones jsonb;
  v_milestones jsonb;
  v_reset_count integer;
  v_shards_earned_total integer;
  v_days_played integer;
  v_achievement_counters jsonb;
  v_achievements jsonb;
  v_unlocked_characters jsonb;
  v_achievement_result jsonb;
begin
  select count(*) into v_owned
    from public.gather_assignments
   where id = p_assignment_id and player_id = p_player;
  if v_owned <> 1 then
    raise exception 'collect_gather: assignment not found or not owned';
  end if;

  if p_gained > 0 then
    update public.profiles
       set resources = jsonb_set(resources, array[p_resource],
             to_jsonb(coalesce((resources->>p_resource)::numeric, 0) + p_gained))
     where player_id = p_player;
  end if;

  if p_stop then
    delete from public.gather_assignments where id = p_assignment_id and player_id = p_player;
  else
    update public.gather_assignments
       set last_collected_at = p_new_last_collected_at
     where id = p_assignment_id and player_id = p_player;
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

  -- `for update` is required here: gather-collect's caller can call this with p_gained = 0 (a
  -- routine zero-gain collect), in which case NO earlier statement in this function has touched
  -- the profiles row yet — without an explicit lock here, two concurrent zero-gain calls would
  -- both read the same pre-award state and double-award ascendant_shards.
  select lifetime_stats, transcend_count, ascendant_milestones, reset_count,
         ascendant_shards_earned_total, days_played, achievement_counters, achievements,
         unlocked_characters
    into v_lifetime_stats, v_transcend_count, v_ascendant_milestones, v_reset_count,
         v_shards_earned_total, v_days_played, v_achievement_counters, v_achievements,
         v_unlocked_characters
    from public.profiles where player_id = p_player
    for update;
  v_milestones := check_ascendant_milestones(v_lifetime_stats, v_transcend_count, v_ascendant_milestones);

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
         achievements = achievements || (v_achievement_result -> 'newKeys')
   where player_id = p_player;

  return jsonb_build_object('gained', p_gained, 'resource', p_resource, 'stopped', p_stop, 'actually_unlocked', v_actually_unlocked);
end;
$$;

revoke all on function public.collect_gather(uuid, uuid, text, int, timestamptz, boolean, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.collect_gather(uuid, uuid, text, int, timestamptz, boolean, jsonb, text[]) to service_role;
