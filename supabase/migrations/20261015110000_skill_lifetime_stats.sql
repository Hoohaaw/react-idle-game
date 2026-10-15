-- goldSpent's sibling from the same TODO.md queue: per-skill time/XP lifetime-stat tracking.
-- Drop + recreate for the new 8th param — the live function has 7 params.
drop function if exists public.collect_skill(uuid, uuid, text, int, int, timestamptz, boolean);

create or replace function public.collect_skill(
  p_player                 uuid,
  p_assignment_id          uuid,
  p_skill_key              text,
  p_new_level              int,
  p_new_xp                 int,
  p_new_last_collected_at  timestamptz,
  p_stop                   boolean,
  p_lifetime_stats         jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_char uuid;
  v_key  text;
  v_val  numeric;
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

  -- Lifetime stats: atomic increments (same pattern as claim_mission/recruit_character). A bare
  -- per-key additive update is atomic on its own — no new lock needed, same reasoning as
  -- claim_craft/upgrade_items (this RPC's own lock, if any, is on skill_assignments/
  -- player_characters, a different table, and doesn't need to cover this update either).
  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_lifetime_stats, '{}'::jsonb))
  loop
    update public.profiles
       set lifetime_stats = jsonb_set(lifetime_stats, array[v_key],
             to_jsonb(coalesce((lifetime_stats->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;

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

revoke all on function public.collect_skill(uuid, uuid, text, int, int, timestamptz, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.collect_skill(uuid, uuid, text, int, int, timestamptz, boolean, jsonb) to service_role;
