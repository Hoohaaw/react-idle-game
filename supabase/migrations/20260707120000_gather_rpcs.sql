-- Gather RPCs: atomic assign (start_gather) + atomic collect/stop (collect_gather). ADR-0019.
--
-- Mirrors the mission RPCs (20260705140000_mission_rpcs.sql): the gather accrual math runs in TypeScript
-- (the gather Edge Functions, from src/lib/gather.ts), so these RPCs are the *write* boundary — each does
-- its mutations in one transaction. Both are SECURITY DEFINER with a pinned search_path, execute-granted to
-- service_role ONLY (the Edge Functions call them; clients cannot — ADR-0003). The gather_assignments table
-- + its RLS/grants already exist (20260612180001_activities.sql); this migration only adds the two RPCs.

-- start_gather: assign a character to a resource node, atomically. A character may be in at most one
-- activity (mission OR gather) — a rule that spans tables, enforced here under a row lock on the character
-- (FOR UPDATE serializes two concurrent assignments of the same character).
create or replace function public.start_gather(
  p_player uuid,
  p_char uuid,
  p_resource_id text
) returns public.gather_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alive int;
  v_assignment public.gather_assignments;
begin
  if p_char is null then
    raise exception 'start_gather: character required';
  end if;
  if p_resource_id is null or length(p_resource_id) = 0 then
    raise exception 'start_gather: resource required';
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
    raise exception 'start_gather: character is not owned or is downed';
  end if;

  -- Busy elsewhere?
  if exists (select 1 from public.gather_assignments where player_character_id = p_char) then
    raise exception 'start_gather: character is already gathering';
  end if;
  if exists (select 1 from public.mission_runs where player_id = p_player and party && array[p_char]) then
    raise exception 'start_gather: character is on a mission';
  end if;

  -- One gatherer per resource node (v1) — matches the UI's single-slot mine.
  if exists (select 1 from public.gather_assignments where player_id = p_player and resource_id = p_resource_id) then
    raise exception 'start_gather: that mine already has a gatherer';
  end if;

  insert into public.gather_assignments (player_id, player_character_id, resource_id)
  values (p_player, p_char, p_resource_id)
  returning * into v_assignment;

  return v_assignment;
end;
$$;

-- Same lockdown as the mission RPCs: Supabase auto-grants EXECUTE on new public functions to anon +
-- authenticated, so revoking from PUBLIC alone is NOT enough — revoke from them too (ADR-0003).
revoke all on function public.start_gather(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.start_gather(uuid, uuid, text) to service_role;

-- collect_gather: bank a gatherer's accrued yield atomically, optionally stopping (unassigning). The Edge
-- Function computes the payout from elapsed ticks (src/lib/gather.ts) and passes it in; this function
-- applies it in one transaction. `p_new_last_collected_at` is derived from the OLD timestamp advanced by
-- the consumed ticks (NOT now()) — so the partial-tick remainder carries over and there's no read/apply race.
create or replace function public.collect_gather(
  p_player uuid,
  p_assignment_id uuid,
  p_resource text,
  p_gained int,
  p_new_last_collected_at timestamptz,
  p_stop boolean
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owned int;
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

  return jsonb_build_object('gained', p_gained, 'resource', p_resource, 'stopped', p_stop);
end;
$$;

revoke all on function public.collect_gather(uuid, uuid, text, int, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.collect_gather(uuid, uuid, text, int, timestamptz, boolean) to service_role;
