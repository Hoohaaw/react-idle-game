-- record_login: the one genuinely new write path in the achievements system (spec 2026-09-13
-- §4c) — nothing today tracks player sessions. Idempotent per UTC calendar day via
-- last_login_date, so the client (Task 12) can call this every session-start without needing its
-- own perfectly-reliable throttle; a second call the same day is a harmless no-op.

create or replace function public.record_login(
  p_player uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_last_login_date date;
  v_days_played integer;
  v_lifetime_stats jsonb;
  v_transcend_count integer;
  v_reset_count integer;
  v_shards_earned_total integer;
  v_achievement_counters jsonb;
  v_achievements jsonb;
  v_unlocked_characters jsonb;
  v_achievement_result jsonb;
begin
  select last_login_date, days_played, lifetime_stats, transcend_count, reset_count,
         ascendant_shards_earned_total, achievement_counters, achievements, unlocked_characters
    into v_last_login_date, v_days_played, v_lifetime_stats, v_transcend_count, v_reset_count,
         v_shards_earned_total, v_achievement_counters, v_achievements, v_unlocked_characters
    from public.profiles
   where player_id = p_player
   for update;

  if not found then
    raise exception 'record_login: player not found';
  end if;

  if v_last_login_date is not distinct from current_date then
    -- Already recorded today (UTC) — clean no-op, no re-check needed (days_played hasn't moved).
    return jsonb_build_object('daysPlayed', v_days_played, 'newlyClaimed', '[]'::jsonb);
  end if;

  v_days_played := v_days_played + 1;

  v_achievement_result := check_achievements(
    v_lifetime_stats,
    (select count(*) from jsonb_object_keys(v_unlocked_characters))::int,
    v_reset_count, v_transcend_count, v_shards_earned_total, v_days_played,
    v_achievement_counters, v_achievements
  );

  update public.profiles
     set last_login_date = current_date,
         days_played     = v_days_played,
         achievements    = achievements || (v_achievement_result -> 'newKeys')
   where player_id = p_player;

  return jsonb_build_object(
    'daysPlayed', v_days_played,
    'newlyClaimed', coalesce((select jsonb_agg(k) from jsonb_object_keys(v_achievement_result -> 'newKeys') as k), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.record_login(uuid) from public, anon, authenticated;
grant execute on function public.record_login(uuid) to service_role;
