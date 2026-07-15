-- Blessing tree picks (ADR-0045): choose_blessing lets a player permanently pick one of two
-- choices for a row, gated by character level + strict row sequence. Mirrors equip_item's
-- row-lock/busy-check/raise convention (20260715120000_item_level_requirement.sql). The capstone
-- is NEVER written here — it's computed on read (level >= 50 AND row4 picked, ADR-0002), so this
-- RPC only ever handles row1..row4.

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

  -- 5. Write the pick.
  update public.player_characters
     set blessings = jsonb_set(v_blessings, array[p_row], to_jsonb(p_choice))
   where id = p_char and player_id = p_player
  returning blessings into v_blessings;

  return jsonb_build_object('blessings', v_blessings);
end;
$$;

revoke all on function public.choose_blessing(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.choose_blessing(uuid, uuid, text, text) to service_role;

comment on column public.player_characters.blessings is
  '{ "row1"|"row2"|"row3"|"row4": "a"|"b" } — player-chosen blessing-tree picks (ADR-0045). No capstone key: the capstone is computed on read (level >= 50 AND row4 picked), never written. Definitions live in Sanity characterDef.blessingTree/.capstone.';
