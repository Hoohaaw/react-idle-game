-- choose_blessing bumps achievement_counters.capstonesEarned when picking row4 immediately makes
-- the capstone earned (level already >= 50 at pick time — src/lib/blessings.ts's capstoneEarned:
-- level >= 50 && row4 picked). This is the SECOND of two trigger points for this counter — the
-- other is a later level-up while row4 is already picked, handled in claim_mission/
-- claim_group_stage (Tasks 2-3), since row4 can be picked as early as level 40. Every other line
-- preserved VERBATIM from 20260908140000_group_runs.sql's choose_blessing. Same signature.

create or replace function public.choose_blessing(
  p_player uuid,
  p_char   uuid,
  p_row    text,
  p_choice text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_blessings jsonb;
  v_level     integer;
  v_required  integer;
begin
  -- 1. Validate row + choice.
  if p_row not in ('row1', 'row2', 'row3', 'row4') then
    raise exception 'choose_blessing: invalid row';
  end if;
  if p_choice not in ('a', 'b') then
    raise exception 'choose_blessing: invalid choice';
  end if;

  -- 2. Required level per row — fixed engine constants (src/lib/blessings.ts
  --    BLESSING_ROW_LEVELS), not Sanity content, so hardcoded here like gear's slot-key enum.
  v_required := case p_row
    when 'row1' then 10
    when 'row2' then 20
    when 'row3' then 30
    when 'row4' then 40
  end;

  -- 3. Lock the character row and capture blessings + level; fail if not owned.
  select blessings, level into v_blessings, v_level
    from public.player_characters
   where id = p_char and player_id = p_player
   for update;
  if not found then
    raise exception 'choose_blessing: character not found or not owned';
  end if;
  v_blessings := coalesce(v_blessings, '{}'::jsonb);

  -- 3b. Level gate.
  if v_level < v_required then
    raise exception 'choose_blessing: character level too low (needs %, has %)', v_required, v_level;
  end if;

  -- 3c. Immutability guard — permanence is enforced here, not just a UI convention (ADR-0003).
  if v_blessings ? p_row then
    raise exception 'choose_blessing: row already chosen';
  end if;

  -- 3d. Strict sequence — row N requires row N-1 already picked.
  if p_row = 'row2' and not (v_blessings ? 'row1') then
    raise exception 'choose_blessing: row1 must be chosen first';
  end if;
  if p_row = 'row3' and not (v_blessings ? 'row2') then
    raise exception 'choose_blessing: row2 must be chosen first';
  end if;
  if p_row = 'row4' and not (v_blessings ? 'row3') then
    raise exception 'choose_blessing: row3 must be chosen first';
  end if;

  -- 4. Busy checks (mirrors equip_item — picking mid-mission could otherwise buff an in-flight claim).
  if exists (
    select 1 from public.mission_runs
     where player_id = p_player and party && array[p_char]
  ) then
    raise exception 'choose_blessing: character is on a mission';
  end if;
  if exists (
    select 1 from public.gather_assignments
     where player_character_id = p_char
  ) then
    raise exception 'choose_blessing: character is gathering';
  end if;
  if exists (
    select 1 from public.infirmary_admissions
     where player_character_id = p_char
  ) then
    raise exception 'choose_blessing: character is in the infirmary';
  end if;
  if exists (
    select 1 from public.group_runs
     where player_id = p_player and party && array[p_char]
  ) then
    raise exception 'choose_blessing: character is in a dungeon or raid';
  end if;

  -- 5. Write the pick.
  update public.player_characters
     set blessings = jsonb_set(v_blessings, array[p_row], to_jsonb(p_choice))
   where id = p_char and player_id = p_player
  returning blessings into v_blessings;

  -- 6. "Blessed" counter (spec §4e) — capstone becomes earned the instant row4 is picked at a
  --    character already >= level 50 (row4 itself only requires level >= 40).
  if p_row = 'row4' and v_level >= 50 then
    update public.profiles
       set achievement_counters = jsonb_set(
             coalesce(achievement_counters, '{}'::jsonb),
             array['capstonesEarned'],
             to_jsonb(coalesce((achievement_counters->>'capstonesEarned')::int, 0) + 1)
           )
     where player_id = p_player;
  end if;

  return jsonb_build_object('blessings', v_blessings);
end;
$$;

revoke all on function public.choose_blessing(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.choose_blessing(uuid, uuid, text, text) to service_role;
