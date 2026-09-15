-- start_skill / collect_skill: the write boundary for indefinite skill assignments (see
-- 20260914110000_skill_assignments.sql). Mirrors start_gather/collect_gather
-- (supabase/migrations/20260707120000_gather_rpcs.sql) — same SECURITY DEFINER / pinned
-- search_path / service_role-only lockdown, same TS-computes-SQL-persists division of labor: the
-- skill-collect Edge Function calls src/lib/gather.ts's accrue() and src/lib/leveling.ts's
-- applyXp() and passes the result in here — this migration never recomputes either curve.

create or replace function public.start_skill(
  p_player    uuid,
  p_char      uuid,
  p_skill_key text
) returns public.skill_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alive int;
  v_assignment public.skill_assignments;
begin
  if p_char is null then
    raise exception 'start_skill: character required';
  end if;
  if p_skill_key is null or length(p_skill_key) = 0 then
    raise exception 'start_skill: skill required';
  end if;

  -- Serialize concurrent assignment of the same character (busy-check + insert must not race).
  perform 1 from public.player_characters
   where id = p_char and player_id = p_player
   for update;

  -- Ownership + not-downed (current_hp null = full, 0 = downed).
  select count(*) into v_alive
    from public.player_characters
   where id = p_char and player_id = p_player
     and (current_hp is null or current_hp > 0);
  if v_alive <> 1 then
    raise exception 'start_skill: character is not owned or is downed';
  end if;

  -- Busy elsewhere? Five-table mutual-exclusion set (see this plan's Global Constraints).
  if exists (select 1 from public.skill_assignments where player_character_id = p_char) then
    raise exception 'start_skill: character is already training a skill';
  end if;
  if exists (select 1 from public.mission_runs where player_id = p_player and party && array[p_char]) then
    raise exception 'start_skill: character is on a mission';
  end if;
  if exists (select 1 from public.gather_assignments where player_character_id = p_char) then
    raise exception 'start_skill: character is gathering';
  end if;
  if exists (select 1 from public.infirmary_admissions where player_character_id = p_char) then
    raise exception 'start_skill: character is in the infirmary';
  end if;
  if exists (select 1 from public.group_runs where player_id = p_player and party && array[p_char]) then
    raise exception 'start_skill: character is in a dungeon or raid';
  end if;

  insert into public.skill_assignments (player_id, player_character_id, skill_key)
  values (p_player, p_char, p_skill_key)
  returning * into v_assignment;

  return v_assignment;
end;
$$;

revoke all on function public.start_skill(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.start_skill(uuid, uuid, text) to service_role;

create or replace function public.collect_skill(
  p_player                 uuid,
  p_assignment_id          uuid,
  p_skill_key              text,
  p_new_level              int,
  p_new_xp                 int,
  p_new_last_collected_at  timestamptz,
  p_stop                   boolean
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_char uuid;
begin
  -- Guard: the assignment exists + is owned. Also gives us which character to credit.
  select player_character_id into v_char
    from public.skill_assignments
   where id = p_assignment_id and player_id = p_player;
  if not found then
    raise exception 'collect_skill: assignment not found or not owned';
  end if;

  update public.player_characters
     set skills = jsonb_set(
           coalesce(skills, '{}'::jsonb),
           array[p_skill_key],
           jsonb_build_object('level', p_new_level, 'xp', p_new_xp)
         )
   where id = v_char and player_id = p_player;

  if p_stop then
    -- Stop = collect the remainder, then free the character.
    delete from public.skill_assignments where id = p_assignment_id and player_id = p_player;
  else
    update public.skill_assignments
       set last_collected_at = p_new_last_collected_at
     where id = p_assignment_id and player_id = p_player;
  end if;

  return jsonb_build_object('level', p_new_level, 'xp', p_new_xp, 'skillKey', p_skill_key, 'stopped', p_stop);
end;
$$;

revoke all on function public.collect_skill(uuid, uuid, text, int, int, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.collect_skill(uuid, uuid, text, int, int, timestamptz, boolean) to service_role;
