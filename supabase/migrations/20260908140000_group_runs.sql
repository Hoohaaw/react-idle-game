-- Dungeons & raids: group_runs table + the two group-stage RPCs (docs/superpowers/specs/
-- 2026-09-08-dungeons-and-raids-design.md). A character may be in at most one activity — that
-- rule already spans mission_runs/gather_assignments/infirmary_admissions; this migration adds
-- group_runs as a fourth table in the same mutual-exclusion set.

create table public.group_runs (
  player_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('dungeon', 'raid')),
  def_key text not null,
  current_stage_index int not null default 0,
  status text not null default 'in_progress' check (status in ('in_progress', 'complete')),
  party uuid[] not null default '{}',
  stage_started_at timestamptz,
  stage_ends_at timestamptz,
  last_cleared_at timestamptz,
  primary key (player_id, kind, def_key)
);

alter table public.group_runs enable row level security;

create policy "owner can read own group runs"
  on public.group_runs for select
  using (auth.uid() = player_id);
-- No insert/update/delete policies: all writes go through the SECURITY DEFINER RPCs below
-- (ADR-0003) — RLS with no write policy means clients cannot write at all.

-- ---------------------------------------------------------------------------------------------
-- Extend the existing busy checks: a character mid-dungeon/raid-stage must not be dispatchable
-- to a mission, a mine, or the infirmary. Each function below is redefined with its full existing
-- body (from supabase/migrations/20260713090000_map_progression.sql and
-- 20260707150000_infirmary.sql respectively) plus one new `group_runs` exists-check.
-- ---------------------------------------------------------------------------------------------

create or replace function public.start_mission(
  p_player           uuid,
  p_mission_def_id   text,
  p_party            uuid[],
  p_duration_seconds integer,
  p_map_key          text    default null,
  p_stage            int     default null,
  p_prev_map_key     text    default null
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

  insert into public.mission_runs (player_id, mission_def_id, party, started_at, ends_at)
  values (p_player, p_mission_def_id, p_party, now(), now() + make_interval(secs => p_duration_seconds))
  returning * into v_run;

  return v_run;
end;
$$;

revoke all on function public.start_mission(uuid, text, uuid[], integer, text, int, text) from public, anon, authenticated;
grant execute on function public.start_mission(uuid, text, uuid[], integer, text, int, text) to service_role;

create or replace function public.start_gather(
  p_player      uuid,
  p_char        uuid,
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

  perform 1 from public.player_characters
   where id = p_char and player_id = p_player
   for update;

  select count(*) into v_alive
    from public.player_characters
   where id = p_char and player_id = p_player
     and (current_hp is null or current_hp > 0);
  if v_alive <> 1 then
    raise exception 'start_gather: character is not owned or is downed';
  end if;

  if exists (select 1 from public.gather_assignments where player_character_id = p_char) then
    raise exception 'start_gather: character is already gathering';
  end if;
  if exists (select 1 from public.mission_runs where player_id = p_player and party && array[p_char]) then
    raise exception 'start_gather: character is on a mission';
  end if;
  if exists (select 1 from public.infirmary_admissions where player_character_id = p_char) then
    raise exception 'start_gather: a character is in the infirmary';
  end if;
  if exists (select 1 from public.group_runs where player_id = p_player and party && array[p_char]) then
    raise exception 'start_gather: a character is in a dungeon or raid';
  end if;

  if exists (select 1 from public.gather_assignments where player_id = p_player and resource_id = p_resource_id) then
    raise exception 'start_gather: that mine already has a gatherer';
  end if;

  insert into public.gather_assignments (player_id, player_character_id, resource_id, started_at)
  values (p_player, p_char, p_resource_id, now())
  returning * into v_assignment;

  return v_assignment;
end;
$$;

revoke all on function public.start_gather(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.start_gather(uuid, uuid, text) to service_role;

create or replace function public.admit_infirmary(
  p_player uuid,
  p_char   uuid,
  p_max_beds int
) returns public.infirmary_admissions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_hp int;
  v_admission  public.infirmary_admissions;
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

  if exists (select 1 from public.infirmary_admissions where player_character_id = p_char) then
    raise exception 'admit_infirmary: character is already admitted';
  end if;

  if (select count(*) from public.infirmary_admissions where player_id = p_player) >= p_max_beds then
    raise exception 'admit_infirmary: infirmary is full';
  end if;

  insert into public.infirmary_admissions (player_id, player_character_id, hp_at_admission)
  values (p_player, p_char, v_current_hp)
  returning * into v_admission;

  return v_admission;
end;
$$;

revoke all on function public.admit_infirmary(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.admit_infirmary(uuid, uuid, int) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Four more existing mutation RPCs never got the group_runs busy check: equip_item, unequip_item,
-- choose_blessing, respec_blessings. Each is redefined below with its full existing body (from
-- 20260715120000_item_level_requirement.sql, 20260708120000_gear_equip.sql,
-- 20260715130000_blessing_choose.sql, 20260715140000_blessing_respec.sql respectively) plus one
-- new `group_runs` exists-check, inserted alongside their existing mission/gather/infirmary busy
-- checks — a character mid-dungeon/raid-stage must not be able to swap gear, equip/unequip, pick a
-- blessing, or respec mid-fight.
-- ---------------------------------------------------------------------------------------------

create or replace function public.equip_item(
  p_player          uuid,
  p_char            uuid,
  p_slot_key        text,
  p_item_def_id     text,
  p_rarity          text,
  p_required_level  integer default 0
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_equipped     jsonb;
  v_new_equipped jsonb;
  v_prev         jsonb;
  v_qty          integer;
  v_level        integer;
begin
  -- 1. Validate slot key.
  if p_slot_key not in (
    'head', 'shoulders', 'chest', 'hands', 'legs', 'feet',
    'weapon', 'offhand',
    'ring1', 'ring2', 'ring3', 'ring4',
    'trinket1', 'trinket2'
  ) then
    raise exception 'equip_item: invalid slot key';
  end if;

  -- 2. Validate rarity.
  if p_rarity not in ('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary') then
    raise exception 'equip_item: invalid rarity';
  end if;

  -- 3. Lock the character row and capture equipped + level; fail if not owned.
  select equipped, level into v_equipped, v_level
    from public.player_characters
   where id = p_char and player_id = p_player
   for update;
  if not found then
    raise exception 'equip_item: character not found or not owned';
  end if;

  -- 3b. Level-requirement gate (ADR-0043).
  if v_level < p_required_level then
    raise exception 'equip_item: character level too low (needs %, has %)', p_required_level, v_level;
  end if;

  -- 4. Busy checks.
  if exists (
    select 1 from public.mission_runs
     where player_id = p_player and party && array[p_char]
  ) then
    raise exception 'equip_item: character is on a mission';
  end if;
  if exists (
    select 1 from public.gather_assignments
     where player_character_id = p_char
  ) then
    raise exception 'equip_item: character is gathering';
  end if;
  if exists (
    select 1 from public.infirmary_admissions
     where player_character_id = p_char
  ) then
    raise exception 'equip_item: character is in the infirmary';
  end if;
  if exists (
    select 1 from public.group_runs
     where player_id = p_player and party && array[p_char]
  ) then
    raise exception 'equip_item: character is in a dungeon or raid';
  end if;

  -- 5. Lock the incoming inventory stack; fail if not present.
  select quantity into v_qty
    from public.player_inventory
   where player_id = p_player
     and item_def_id = p_item_def_id
     and rarity = p_rarity
   for update;
  if not found then
    raise exception 'equip_item: item not in inventory';
  end if;

  -- 6. Capture the item currently in the target slot (may be null / SQL NULL).
  v_prev := v_equipped -> p_slot_key;

  -- 7. Consume the incoming stack.
  if v_qty = 1 then
    delete from public.player_inventory
     where player_id = p_player
       and item_def_id = p_item_def_id
       and rarity = p_rarity;
  else
    update public.player_inventory
       set quantity = quantity - 1
     where player_id = p_player
       and item_def_id = p_item_def_id
       and rarity = p_rarity;
  end if;

  -- 8. Return displaced item to inventory (if there was one).
  --    Equipping the same item+rarity that is already in the slot is a harmless net-zero:
  --    step 7 decremented the stack, this upsert brings it back to the same count.
  if v_prev is not null then
    insert into public.player_inventory (player_id, item_def_id, rarity)
    values (p_player, v_prev->>'itemDefId', v_prev->>'rarity')
    on conflict (player_id, item_def_id, rarity)
    do update set quantity = player_inventory.quantity + 1;
  end if;

  -- 9. Write the new item into the slot, capturing the resulting equipped map.
  update public.player_characters
     set equipped = jsonb_set(
           coalesce(equipped, '{}'::jsonb),
           array[p_slot_key],
           jsonb_build_object('itemDefId', p_item_def_id, 'rarity', p_rarity)
         )
   where id = p_char and player_id = p_player
  returning equipped into v_new_equipped;

  return jsonb_build_object(
    'equipped', v_new_equipped,
    'returned', coalesce(v_prev, 'null'::jsonb)
  );
end;
$$;

revoke all on function public.equip_item(uuid, uuid, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.equip_item(uuid, uuid, text, text, text, integer) to service_role;

create or replace function public.unequip_item(
  p_player   uuid,
  p_char     uuid,
  p_slot_key text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_equipped     jsonb;
  v_new_equipped jsonb;
  v_item         jsonb;
begin
  -- 1. Validate slot key.
  if p_slot_key not in (
    'head', 'shoulders', 'chest', 'hands', 'legs', 'feet',
    'weapon', 'offhand',
    'ring1', 'ring2', 'ring3', 'ring4',
    'trinket1', 'trinket2'
  ) then
    raise exception 'unequip_item: invalid slot key';
  end if;

  -- 2. Lock the character row and capture equipped; fail if not owned.
  select equipped into v_equipped
    from public.player_characters
   where id = p_char and player_id = p_player
   for update;
  if not found then
    raise exception 'unequip_item: character not found or not owned';
  end if;

  -- 3. Busy checks.
  if exists (
    select 1 from public.mission_runs
     where player_id = p_player and party && array[p_char]
  ) then
    raise exception 'unequip_item: character is on a mission';
  end if;
  if exists (
    select 1 from public.gather_assignments
     where player_character_id = p_char
  ) then
    raise exception 'unequip_item: character is gathering';
  end if;
  if exists (
    select 1 from public.infirmary_admissions
     where player_character_id = p_char
  ) then
    raise exception 'unequip_item: character is in the infirmary';
  end if;
  if exists (
    select 1 from public.group_runs
     where player_id = p_player and party && array[p_char]
  ) then
    raise exception 'unequip_item: character is in a dungeon or raid';
  end if;

  -- 4. Verify the slot is occupied.
  v_item := v_equipped -> p_slot_key;
  if v_item is null then
    raise exception 'unequip_item: slot is empty';
  end if;

  -- 5. Return the item to inventory.
  insert into public.player_inventory (player_id, item_def_id, rarity)
  values (p_player, v_item->>'itemDefId', v_item->>'rarity')
  on conflict (player_id, item_def_id, rarity)
  do update set quantity = player_inventory.quantity + 1;

  -- 6. Remove the slot key from the equipped map.
  update public.player_characters
     set equipped = equipped - p_slot_key
   where id = p_char and player_id = p_player
  returning equipped into v_new_equipped;

  return jsonb_build_object(
    'equipped', v_new_equipped,
    'returned', v_item
  );
end;
$$;

revoke all on function public.unequip_item(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.unequip_item(uuid, uuid, text) to service_role;

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

  return jsonb_build_object('blessings', v_blessings);
end;
$$;

revoke all on function public.choose_blessing(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.choose_blessing(uuid, uuid, text, text) to service_role;

create or replace function public.respec_blessings(
  p_player uuid,
  p_char   uuid,
  p_cost   numeric
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_blessings jsonb;
  v_gold      numeric;
begin
  -- 1. Lock the character row and capture blessings; fail if not owned.
  select blessings into v_blessings
    from public.player_characters
   where id = p_char and player_id = p_player
   for update;
  if not found then
    raise exception 'respec_blessings: character not found or not owned';
  end if;
  v_blessings := coalesce(v_blessings, '{}'::jsonb);

  -- 2. Nothing to respec — don't charge for a no-op.
  if v_blessings = '{}'::jsonb then
    raise exception 'respec_blessings: no blessings to respec';
  end if;

  -- 3. Busy checks (verbatim from choose_blessing — respeccing mid-mission is nonsensical).
  if exists (
    select 1 from public.mission_runs
     where player_id = p_player and party && array[p_char]
  ) then
    raise exception 'respec_blessings: character is on a mission';
  end if;
  if exists (
    select 1 from public.gather_assignments
     where player_character_id = p_char
  ) then
    raise exception 'respec_blessings: character is gathering';
  end if;
  if exists (
    select 1 from public.infirmary_admissions
     where player_character_id = p_char
  ) then
    raise exception 'respec_blessings: character is in the infirmary';
  end if;
  if exists (
    select 1 from public.group_runs
     where player_id = p_player and party && array[p_char]
  ) then
    raise exception 'respec_blessings: character is in a dungeon or raid';
  end if;

  -- 4. Lock the profile and verify gold funds (single fixed key, unlike upgrade_infirmary's
  --    generic currencies+resources loop — right-sized for a game with exactly one currency).
  select coalesce((currencies->>'gold')::numeric, 0) into v_gold
    from public.profiles
   where player_id = p_player
   for update;
  if v_gold < p_cost then
    raise exception 'respec_blessings: insufficient gold (needs %, has %)', p_cost, v_gold;
  end if;

  -- 5. Deduct gold.
  update public.profiles
     set currencies = jsonb_set(currencies, array['gold'], to_jsonb(v_gold - p_cost))
   where player_id = p_player;

  -- 6. Wipe the tree.
  update public.player_characters
     set blessings = '{}'::jsonb
   where id = p_char and player_id = p_player
  returning blessings into v_blessings;

  return jsonb_build_object('blessings', v_blessings);
end;
$$;

revoke all on function public.respec_blessings(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.respec_blessings(uuid, uuid, numeric) to service_role;

-- ---------------------------------------------------------------------------------------------
-- start_group_stage: validate + dispatch the CURRENT stage of a dungeon/raid run. p_lockout is
-- 'daily' or 'weekly' (src/lib/groupContent.ts's GROUP_LOCKOUT, passed in by the Edge Function —
-- this RPC does calendar math but doesn't hardcode which kind maps to which cadence). p_map_gate
-- is the mapKey the content is authored to gate on (dungeonDef/raidDef's mapGate reference,
-- resolved by the Edge Function) — null means the def has no gate authored (skip the check).
-- ---------------------------------------------------------------------------------------------
create or replace function public.start_group_stage(
  p_player           uuid,
  p_kind             text,
  p_def_key          text,
  p_party            uuid[],
  p_stage_index      int,
  p_total_stages     int,
  p_duration_seconds int,
  p_lockout          text,   -- 'daily' | 'weekly'
  p_map_gate         text    default null
) returns public.group_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_size        int := cardinality(p_party);
  v_owned_alive int;
  v_run         public.group_runs;
  v_next_reset  timestamptz;
  v_map_prog    jsonb;
begin
  if p_kind not in ('dungeon', 'raid') then
    raise exception 'start_group_stage: invalid kind';
  end if;
  if v_size < 1 then
    raise exception 'start_group_stage: party required';
  end if;
  if v_size <> (select count(distinct e) from unnest(p_party) e) then
    raise exception 'start_group_stage: duplicate character in party';
  end if;
  if p_duration_seconds is null or p_duration_seconds < 1 then
    raise exception 'start_group_stage: invalid duration';
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
    raise exception 'start_group_stage: a character is not owned or is downed';
  end if;

  if exists (select 1 from public.mission_runs where player_id = p_player and party && p_party) then
    raise exception 'start_group_stage: a character is on a mission';
  end if;
  if exists (select 1 from public.gather_assignments where player_character_id = any(p_party)) then
    raise exception 'start_group_stage: a character is gathering';
  end if;
  if exists (select 1 from public.infirmary_admissions where player_character_id = any(p_party)) then
    raise exception 'start_group_stage: a character is in the infirmary';
  end if;
  -- A character mid-stage on a DIFFERENT dungeon/raid run is also busy (party is only ever
  -- non-empty while a stage is in flight — cleared on every claim, see claim_group_stage below).
  if exists (
    select 1 from public.group_runs
     where player_id = p_player and party && p_party
       and not (kind = p_kind and def_key = p_def_key)
  ) then
    raise exception 'start_group_stage: a character is in another dungeon or raid';
  end if;

  if p_map_gate is not null then
    select map_progress into v_map_prog from public.profiles where player_id = p_player;
    if coalesce((v_map_prog->>p_map_gate)::int, 0) < 7 then
      raise exception 'start_group_stage: map not cleared';
    end if;
  end if;

  -- Load or create the run row, locking it against concurrent starts of the same run.
  select * into v_run from public.group_runs
   where player_id = p_player and kind = p_kind and def_key = p_def_key
   for update;

  if not found then
    if p_stage_index <> 0 then
      raise exception 'start_group_stage: no run in progress';
    end if;
    insert into public.group_runs (player_id, kind, def_key, current_stage_index, status, party, stage_started_at, stage_ends_at)
    values (p_player, p_kind, p_def_key, 0, 'in_progress', p_party, now(), now() + make_interval(secs => p_duration_seconds))
    returning * into v_run;
    return v_run;
  end if;

  if v_run.stage_ends_at is not null then
    raise exception 'start_group_stage: a stage is already in flight';
  end if;

  if v_run.status = 'complete' then
    v_next_reset := date_trunc('day', v_run.last_cleared_at at time zone 'UTC') at time zone 'UTC' + interval '1 day';
    if p_lockout = 'weekly' then
      v_next_reset := v_next_reset + (((7 - extract(dow from v_next_reset at time zone 'UTC')::int) % 7) * interval '1 day');
    end if;
    if v_next_reset is null or now() < v_next_reset then
      raise exception 'start_group_stage: still locked out until %', v_next_reset;
    end if;
    if p_stage_index <> 0 then
      raise exception 'start_group_stage: a fresh run must start at stage 0';
    end if;
    update public.group_runs
       set current_stage_index = 0, status = 'in_progress', party = p_party,
           stage_started_at = now(), stage_ends_at = now() + make_interval(secs => p_duration_seconds),
           last_cleared_at = null
     where player_id = p_player and kind = p_kind and def_key = p_def_key
     returning * into v_run;
    return v_run;
  end if;

  if p_stage_index <> v_run.current_stage_index then
    raise exception 'start_group_stage: wrong stage index for this run';
  end if;

  update public.group_runs
     set party = p_party, stage_started_at = now(),
         stage_ends_at = now() + make_interval(secs => p_duration_seconds)
   where player_id = p_player and kind = p_kind and def_key = p_def_key
   returning * into v_run;

  return v_run;
end;
$$;

revoke all on function public.start_group_stage(uuid, text, text, uuid[], int, int, int, text, text) from public, anon, authenticated;
grant execute on function public.start_group_stage(uuid, text, text, uuid[], int, int, int, text, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- claim_group_stage: apply a resolved stage's outcome atomically. Mirrors claim_mission's shape
-- (char_updates/loot/currencies/resources) but advances a stage cursor instead of deleting a row,
-- and never advances on a loss (spec §5 step 3: retry the same stage, no progress lost).
-- ---------------------------------------------------------------------------------------------
create or replace function public.claim_group_stage(
  p_player        uuid,
  p_kind          text,
  p_def_key       text,
  p_won           boolean,
  p_char_updates  jsonb,
  p_loot          jsonb,
  p_currencies    jsonb,
  p_resources     jsonb,
  p_is_last_stage boolean
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run   public.group_runs;
  v_char  jsonb;
  v_loot  jsonb;
  v_key   text;
  v_val   numeric;
begin
  select * into v_run from public.group_runs
   where player_id = p_player and kind = p_kind and def_key = p_def_key
     and now() >= stage_ends_at
   for update;
  if not found then
    raise exception 'claim_group_stage: not claimable (no run, not finished, or already claimed)';
  end if;

  for v_char in select * from jsonb_array_elements(coalesce(p_char_updates, '[]'::jsonb))
  loop
    update public.player_characters
       set level = (v_char->>'level')::int,
           xp = (v_char->>'xp')::int,
           current_hp = (v_char->>'current_hp')::int
     where id = (v_char->>'id')::uuid and player_id = p_player;
  end loop;

  if p_won then
    for v_loot in select * from jsonb_array_elements(coalesce(p_loot, '[]'::jsonb))
    loop
      insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
      values (p_player, v_loot->>'item_def_id', v_loot->>'rarity', (v_loot->>'quantity')::int)
      on conflict (player_id, item_def_id, rarity)
        do update set quantity = public.player_inventory.quantity + excluded.quantity;
    end loop;

    for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_currencies, '{}'::jsonb))
    loop
      update public.profiles
         set currencies = jsonb_set(currencies, array[v_key],
               to_jsonb(coalesce((currencies->>v_key)::numeric, 0) + v_val))
       where player_id = p_player;
    end loop;
    for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_resources, '{}'::jsonb))
    loop
      update public.profiles
         set resources = jsonb_set(resources, array[v_key],
               to_jsonb(coalesce((resources->>v_key)::numeric, 0) + v_val))
       where player_id = p_player;
    end loop;
  end if;

  if p_won and p_is_last_stage then
    update public.group_runs
       set status = 'complete', party = '{}', stage_started_at = null, stage_ends_at = null,
           last_cleared_at = now()
     where player_id = p_player and kind = p_kind and def_key = p_def_key;
  elsif p_won then
    update public.group_runs
       set current_stage_index = current_stage_index + 1, party = '{}',
           stage_started_at = null, stage_ends_at = null
     where player_id = p_player and kind = p_kind and def_key = p_def_key;
  else
    -- Loss: same stage, party freed to redispatch (reshuffled or not).
    update public.group_runs
       set party = '{}', stage_started_at = null, stage_ends_at = null
     where player_id = p_player and kind = p_kind and def_key = p_def_key;
  end if;

  return jsonb_build_object('won', p_won, 'party', v_run.party);
end;
$$;

revoke all on function public.claim_group_stage(uuid, text, text, boolean, jsonb, jsonb, jsonb, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.claim_group_stage(uuid, text, text, boolean, jsonb, jsonb, jsonb, jsonb, boolean) to service_role;
