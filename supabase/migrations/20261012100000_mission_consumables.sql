-- Mission-prep consumables (docs/superpowers/specs/2026-10-12-mission-prep-consumables-
-- design.md §F): a per-character, self-only heal/buff loadout, validated and CONSUMED at
-- dispatch (same timing as start_craft's reagent deduction), recorded on the run so
-- mission-claim knows what to apply later. Slot-count and heal-category-cap validation
-- happen in the mission-start Edge Function (needs Sanity-sourced level/bonusSlot/category
-- data this RPC can't reach) — this RPC owns only the DB-side guarantee: ownership and
-- quantity, same split equip_item/start_craft already use for their own reagent/item checks.
-- Body below is copied verbatim from 20260914110200_skill_busy_checks.sql's start_mission,
-- plus the new p_consumables param and the consumption loop marked NEW below.

alter table public.mission_runs
  add column consumables_used jsonb not null default '[]'::jsonb;

comment on column public.mission_runs.consumables_used is
  'The validated {characterId, consumableDefId}[] loadout spent at dispatch. Read by mission-claim to build each Combatant''s heal-trigger/buff fields.';

drop function public.start_mission(uuid, text, uuid[], integer, text, int, text);

create or replace function public.start_mission(
  p_player           uuid,
  p_mission_def_id   text,
  p_party            uuid[],
  p_duration_seconds integer,
  p_map_key          text    default null,
  p_stage            int     default null,
  p_prev_map_key     text    default null,
  p_consumables      jsonb   default '[]'::jsonb
) returns public.mission_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_size        int := cardinality(p_party);
  v_owned_alive int;
  v_run         public.mission_runs;
  v_map_prog    jsonb;
  v_cleared     int;
  v_prev_cleared int;
  v_item        jsonb;
  v_char        text;
  v_cdef        text;
  v_qty         integer;
begin
  if v_size is null or v_size < 1 or v_size > 3 then
    raise exception 'start_mission: party size must be 1..3';
  end if;
  if v_size <> (select count(distinct e) from unnest(p_party) e) then
    raise exception 'start_mission: duplicate character in party';
  end if;
  if p_duration_seconds is null or p_duration_seconds < 1 then
    raise exception 'start_mission: invalid duration';
  end if;

  perform 1 from public.player_characters
   where id = any(p_party) and player_id = p_player
   for update;

  select count(*) into v_owned_alive
    from public.player_characters
   where id = any(p_party)
     and player_id = p_player
     and (current_hp is null or current_hp > 0);
  if v_owned_alive <> v_size then
    raise exception 'start_mission: a character is not owned or is downed';
  end if;

  if exists (select 1 from public.gather_assignments where player_character_id = any(p_party)) then
    raise exception 'start_mission: a character is gathering';
  end if;
  if exists (select 1 from public.mission_runs where player_id = p_player and party && p_party) then
    raise exception 'start_mission: a character is already on a mission';
  end if;
  if exists (select 1 from public.infirmary_admissions where player_character_id = any(p_party)) then
    raise exception 'start_mission: a character is in the infirmary';
  end if;
  if exists (select 1 from public.group_runs where player_id = p_player and party && p_party) then
    raise exception 'start_mission: a character is in a dungeon or raid';
  end if;
  if exists (select 1 from public.skill_assignments where player_character_id = any(p_party)) then
    raise exception 'start_mission: a character is training a skill';
  end if;

  if p_map_key is not null and p_stage is not null then
    select map_progress into v_map_prog from public.profiles where player_id = p_player;
    v_cleared := coalesce((v_map_prog->>p_map_key)::int, 0);
    if p_stage > v_cleared + 1 then
      raise exception 'start_mission: stage locked (cleared %, requested %)', v_cleared, p_stage;
    end if;
    if p_prev_map_key is not null then
      v_prev_cleared := coalesce((v_map_prog->>p_prev_map_key)::int, 0);
      if v_prev_cleared < 7 then
        raise exception 'start_mission: map locked — defeat the previous boss (% cleared % of 7)', p_prev_map_key, v_prev_cleared;
      end if;
    end if;
  end if;

  -- NEW: mission-prep consumables. Lock + verify + consume each submitted item, atomically,
  -- before the run is inserted. Ownership and quantity only — slot-count/heal-cap were
  -- already validated by the mission-start Edge Function (see header comment).
  for v_item in select * from jsonb_array_elements(coalesce(p_consumables, '[]'::jsonb))
  loop
    v_char := v_item->>'characterId';
    v_cdef := v_item->>'consumableDefId';
    if v_char is null or v_cdef is null then
      raise exception 'start_mission: invalid consumable entry';
    end if;
    select quantity into v_qty
      from public.player_inventory
     where player_id = p_player and item_def_id = v_cdef and rarity = 'Common'
     for update;
    if not found or v_qty < 1 then
      raise exception 'start_mission: consumable % not in inventory', v_cdef;
    end if;
    if v_qty = 1 then
      delete from public.player_inventory
       where player_id = p_player and item_def_id = v_cdef and rarity = 'Common';
    else
      update public.player_inventory
         set quantity = quantity - 1
       where player_id = p_player and item_def_id = v_cdef and rarity = 'Common';
    end if;
  end loop;

  insert into public.mission_runs (player_id, mission_def_id, party, started_at, ends_at, consumables_used)
  values (p_player, p_mission_def_id, p_party, now(), now() + make_interval(secs => p_duration_seconds), p_consumables)
  returning * into v_run;

  return v_run;
end;
$$;

revoke all on function public.start_mission(uuid, text, uuid[], integer, text, int, text, jsonb) from public, anon, authenticated;
grant execute on function public.start_mission(uuid, text, uuid[], integer, text, int, text, jsonb) to service_role;
