-- collect_gather: gains lifetime-stat increments + newly-unlocked-character writes, same shape as
-- claim_mission's extension (20260820120000_claim_mission_acquisition.sql — read that migration's
-- comment for the full rationale). p_lifetime_stats here only ever carries a single
-- resourceGathered.<key> entry (the resource just collected) — gather-collect can't satisfy any
-- OTHER condition type in one call.
drop function public.collect_gather(uuid, uuid, text, int, timestamptz, boolean);

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
begin
  -- Guard: the assignment exists + is owned.
  select count(*) into v_owned
    from public.gather_assignments
   where id = p_assignment_id and player_id = p_player;
  if v_owned <> 1 then
    raise exception 'collect_gather: assignment not found or not owned';
  end if;

  -- Credit banked resources into the JSONB wallet (skip a no-op zero collect).
  if p_gained > 0 then
    update public.profiles
       set resources = jsonb_set(resources, array[p_resource],
             to_jsonb(coalesce((resources->>p_resource)::numeric, 0) + p_gained))
     where player_id = p_player;
  end if;

  if p_stop then
    -- Stop = collect the remainder, then free the character.
    delete from public.gather_assignments where id = p_assignment_id and player_id = p_player;
  else
    update public.gather_assignments
       set last_collected_at = p_new_last_collected_at
     where id = p_assignment_id and player_id = p_player;
  end if;

  -- Lifetime stats: atomic increments.
  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_lifetime_stats, '{}'::jsonb))
  loop
    update public.profiles
       set lifetime_stats = jsonb_set(lifetime_stats, array[v_key],
             to_jsonb(coalesce((lifetime_stats->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;

  -- Newly-unlocked characters: additive-only, same idempotent pattern as claim_mission.
  -- The check (key not already present) and the write happen in the SAME statement via the WHERE clause,
  -- so two concurrent collect_gather calls for the same player racing on the same charKey can't both
  -- see "not present" and both report the unlock (no separate SELECT to go stale before the UPDATE lands).
  foreach v_key in array coalesce(p_newly_unlocked, '{}')
  loop
    update public.profiles
       set unlocked_characters = jsonb_set(unlocked_characters, array[v_key], to_jsonb(now()))
     where player_id = p_player and not (unlocked_characters ? v_key);
    if found then
      v_actually_unlocked := array_append(v_actually_unlocked, v_key);
    end if;
  end loop;

  return jsonb_build_object('gained', p_gained, 'resource', p_resource, 'stopped', p_stop, 'actually_unlocked', v_actually_unlocked);
end;
$$;

revoke all on function public.collect_gather(uuid, uuid, text, int, timestamptz, boolean, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.collect_gather(uuid, uuid, text, int, timestamptz, boolean, jsonb, text[]) to service_role;
