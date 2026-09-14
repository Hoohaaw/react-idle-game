-- transcend_player / reset_player gain a skill_assignments busy-check (final whole-branch review of
-- docs/superpowers/plans/2026-09-14-skill-assignments.md, ADR-0056). Both already check the
-- player isn't mid-mission/gather/dungeon-raid/infirmary/craft before wiping their account — a
-- character mid-skill-training was the one activity missing from that list, so Transcending or
-- Resetting while a character trained silently discarded that character's accrued-but-uncollected
-- skill XP via skill_assignments' cascade-delete on player_characters. Each function is redefined
-- below with its current full body (transcend_player from 20260914100300_transcend_player_
-- achievements.sql, reset_player from 20260911100000_reset_echoes.sql) plus one new `or exists`
-- clause in the existing busy-check chain, mirroring gather_assignments' join-through-
-- player_characters shape (skill_assignments has the same player_id + player_character_id
-- columns as gather_assignments).

create or replace function public.transcend_player(
  p_player uuid,
  p_protected_ids uuid[]
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_protected_slots integer;
  v_transcend_count integer;
  v_ascendant_milestones jsonb;
  v_lifetime_stats jsonb;
  v_milestones jsonb;
  v_awarded integer;
  v_reset_count integer;
  v_shards_earned_total integer;
  v_days_played integer;
  v_achievement_counters jsonb;
  v_achievements jsonb;
  v_unlocked_characters jsonb;
  v_achievement_result jsonb;
begin
  select coalesce((echo_shop ->> 'protectedSlots')::int, 0), transcend_count, ascendant_milestones,
         lifetime_stats, reset_count, ascendant_shards_earned_total, days_played,
         achievement_counters, achievements, unlocked_characters
    into v_protected_slots, v_transcend_count, v_ascendant_milestones,
         v_lifetime_stats, v_reset_count, v_shards_earned_total, v_days_played,
         v_achievement_counters, v_achievements, v_unlocked_characters
    from public.profiles
   where player_id = p_player
   for update;

  if not found then
    raise exception 'transcend_player: player not found';
  end if;

  if cardinality(p_protected_ids) > v_protected_slots then
    raise exception 'transcend_player: too many protected characters (have % slots, chose %)', v_protected_slots, cardinality(p_protected_ids);
  end if;
  if exists (
    select 1 from unnest(p_protected_ids) as pid
    where not exists (select 1 from public.player_characters where id = pid and player_id = p_player)
  ) then
    raise exception 'transcend_player: a protected character does not belong to this player';
  end if;

  if exists (select 1 from public.mission_runs where player_id = p_player)
    or exists (
      select 1 from public.gather_assignments ga
        join public.player_characters pc on pc.id = ga.player_character_id
       where pc.player_id = p_player
    )
    or exists (select 1 from public.group_runs where player_id = p_player and cardinality(party) > 0)
    or exists (
      select 1 from public.infirmary_admissions ia
        join public.player_characters pc on pc.id = ia.player_character_id
       where pc.player_id = p_player
    )
    or exists (select 1 from public.craft_runs where player_id = p_player)
    or exists (
      select 1 from public.skill_assignments sk
        join public.player_characters pc on pc.id = sk.player_character_id
       where pc.player_id = p_player
    )
  then
    raise exception 'transcend_player: a character is busy';
  end if;

  v_transcend_count := v_transcend_count + 1;
  v_milestones := check_ascendant_milestones(v_lifetime_stats, v_transcend_count, v_ascendant_milestones);
  v_awarded := (v_milestones ->> 'shards')::int;

  v_achievement_result := check_achievements(
    v_lifetime_stats,
    (select count(*) from jsonb_object_keys(v_unlocked_characters))::int,
    v_reset_count, v_transcend_count, v_shards_earned_total + v_awarded, v_days_played,
    v_achievement_counters, v_achievements
  );

  update public.profiles
     set currencies           = '{}'::jsonb,
         resources            = '{}'::jsonb,
         map_progress         = '{}'::jsonb,
         infirmary_level      = 1,
         echoes               = 0,
         echo_shop            = '{}'::jsonb,
         unlocked_characters  = (
           select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
           from jsonb_each(unlocked_characters)
           where key in (select character_def_id from public.player_characters
                         where id = any(p_protected_ids))
         ),
         transcend_count      = v_transcend_count,
         ascendant_shards     = ascendant_shards + v_awarded,
         ascendant_shards_earned_total = ascendant_shards_earned_total + v_awarded,
         ascendant_milestones = ascendant_milestones || (v_milestones -> 'newKeys'),
         achievements         = achievements || (v_achievement_result -> 'newKeys')
   where player_id = p_player;

  insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
  select p_player, item.value ->> 'itemDefId', item.value ->> 'rarity', count(*)::int
    from public.player_characters pc,
         jsonb_each(pc.equipped) as item
   where pc.player_id = p_player and not (pc.id = any(p_protected_ids))
   group by item.value ->> 'itemDefId', item.value ->> 'rarity'
  on conflict (player_id, item_def_id, rarity)
  do update set quantity = public.player_inventory.quantity + excluded.quantity;

  delete from public.group_runs where player_id = p_player;
  delete from public.player_characters where player_id = p_player and not (id = any(p_protected_ids));

  return jsonb_build_object('shardsAwarded', v_awarded, 'transcendCount', v_transcend_count);
end;
$$;

revoke all on function public.transcend_player(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.transcend_player(uuid, uuid[]) to service_role;

create or replace function public.reset_player(
  p_player uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_awarded        integer;
  v_map_progress   jsonb;
  v_lifetime_stats jsonb;
  v_total_stages   numeric;
  v_lifetime_gold  numeric;
begin
  select map_progress, lifetime_stats
    into v_map_progress, v_lifetime_stats
    from public.profiles
   where player_id = p_player
   for update;

  if not found then
    raise exception 'reset_player: player not found';
  end if;

  if exists (select 1 from public.mission_runs where player_id = p_player)
    or exists (
      select 1 from public.gather_assignments ga
        join public.player_characters pc on pc.id = ga.player_character_id
       where pc.player_id = p_player
    )
    or exists (select 1 from public.group_runs where player_id = p_player and cardinality(party) > 0)
    or exists (
      select 1 from public.infirmary_admissions ia
        join public.player_characters pc on pc.id = ia.player_character_id
       where pc.player_id = p_player
    )
    or exists (select 1 from public.craft_runs where player_id = p_player)
    or exists (
      select 1 from public.skill_assignments sk
        join public.player_characters pc on pc.id = sk.player_character_id
       where pc.player_id = p_player
    )
  then
    raise exception 'reset_player: a character is busy';
  end if;

  select coalesce(sum((value)::numeric), 0)
    into v_total_stages
    from jsonb_each_text(coalesce(v_map_progress, '{}'::jsonb));

  v_lifetime_gold := coalesce((v_lifetime_stats ->> 'goldEarned')::numeric, 0);

  -- STAGE_RATE=10, GOLD_RATE=2 — first-pass provisional constants (spec §3's non-goal on
  -- tuning), same treatment as combat.ts's COMBAT block: shape is final, numbers are tuned
  -- later against real playtest data via a calc-script pass.
  v_awarded := floor(v_total_stages * 10) + floor(sqrt(greatest(v_lifetime_gold, 0)) * 2);

  update public.profiles
     set currencies      = '{}'::jsonb,
         resources       = '{}'::jsonb,
         map_progress    = '{}'::jsonb,
         infirmary_level = 1,
         echoes          = echoes + v_awarded,
         reset_count     = reset_count + 1
   where player_id = p_player;

  delete from public.group_runs where player_id = p_player;

  return jsonb_build_object('echoesAwarded', v_awarded);
end;
$$;

revoke all on function public.reset_player(uuid) from public, anon, authenticated;
grant execute on function public.reset_player(uuid) to service_role;
