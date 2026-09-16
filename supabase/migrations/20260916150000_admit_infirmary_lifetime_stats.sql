-- admit_infirmary gains lifetime-stat plumbing (charactersDowned) — same generic p_lifetime_stats
-- loop claim_mission/collect_gather/claim_group_stage/recruit_character/claim_craft/upgrade_items
-- already use. This is a genuine signature change (new parameter), so the old 3-arg version must
-- be dropped first, same pattern the other lifetime-stats migrations used.
--
-- Preserves every existing line of the function VERBATIM (the player_characters `for update`
-- lock, the current_hp null check, the four busy-checks — mission/gather/group/skill — the
-- already-admitted check, the bed-capacity check, the infirmary_admissions insert). Only the new
-- declare vars and loop are added, right after the insert and before the return. Safe without an
-- extra lock on profiles: a blind additive UPDATE is already atomic per statement (same reasoning
-- already verified for claim_craft's / upgrade_items' migrations) — the existing `for update` on
-- player_characters locks a different table and doesn't cover profiles.lifetime_stats anyway.
drop function public.admit_infirmary(uuid, uuid, int);

create or replace function public.admit_infirmary(
  p_player uuid,
  p_char   uuid,
  p_max_beds int,
  p_lifetime_stats jsonb default '{}'::jsonb
) returns public.infirmary_admissions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_hp int;
  v_admission  public.infirmary_admissions;
  v_key        text;
  v_val        numeric;
begin
  perform 1 from public.player_characters
   where id = p_char and player_id = p_player
   for update;

  select current_hp into v_current_hp
    from public.player_characters
   where id = p_char and player_id = p_player;
  if not found then
    raise exception 'admit_infirmary: character not found or not owned';
  end if;

  if v_current_hp is null then
    raise exception 'admit_infirmary: character is at full health (current_hp is null)';
  end if;

  if exists (select 1 from public.mission_runs where player_id = p_player and party && array[p_char]) then
    raise exception 'admit_infirmary: character is on a mission';
  end if;
  if exists (select 1 from public.gather_assignments where player_character_id = p_char) then
    raise exception 'admit_infirmary: character is gathering';
  end if;
  if exists (select 1 from public.group_runs where player_id = p_player and party && array[p_char]) then
    raise exception 'admit_infirmary: character is in a dungeon or raid';
  end if;
  -- New: also busy if training a skill (2026-09-14, skill assignments).
  if exists (select 1 from public.skill_assignments where player_character_id = p_char) then
    raise exception 'admit_infirmary: character is training a skill';
  end if;

  if exists (select 1 from public.infirmary_admissions where player_character_id = p_char) then
    raise exception 'admit_infirmary: character is already admitted';
  end if;

  if (select count(*) from public.infirmary_admissions where player_id = p_player) >= p_max_beds then
    raise exception 'admit_infirmary: infirmary is full';
  end if;

  insert into public.infirmary_admissions (player_id, player_character_id, hp_at_admission)
  values (p_player, p_char, v_current_hp)
  returning * into v_admission;

  -- Lifetime stats: atomic increments (same pattern as claim_mission/collect_gather).
  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_lifetime_stats, '{}'::jsonb))
  loop
    update public.profiles
       set lifetime_stats = jsonb_set(lifetime_stats, array[v_key],
             to_jsonb(coalesce((lifetime_stats->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;

  return v_admission;
end;
$$;

revoke all on function public.admit_infirmary(uuid, uuid, int, jsonb) from public, anon, authenticated;
grant execute on function public.admit_infirmary(uuid, uuid, int, jsonb) to service_role;
