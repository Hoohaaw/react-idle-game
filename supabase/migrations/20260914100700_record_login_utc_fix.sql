-- Final whole-branch review finding: record_login's day-boundary check used bare `current_date`,
-- which resolves in the session's TimeZone setting, not necessarily UTC — correct today (the
-- hosted project's session TimeZone is UTC, confirmed via `show timezone;` during Task 7's manual
-- verification) but fragile by construction, since every other promise in this feature (the column
-- comment, this function's own header comment, the client's todayUtc() = toISOString().slice(0,10))
-- is explicitly UTC. Pinned explicitly with `at time zone 'UTC'`, matching the precedent already
-- used elsewhere in this repo for a daily boundary (20260908140000_group_runs.sql's weekly/daily
-- lockout logic). Every other line preserved VERBATIM from 20260914100600_record_login.sql. Same
-- 1-arg signature.

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
  v_today date;
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

  v_today := (now() at time zone 'UTC')::date;

  if v_last_login_date is not distinct from v_today then
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
     set last_login_date = v_today,
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
