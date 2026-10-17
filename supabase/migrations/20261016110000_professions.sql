-- Profession system (docs/superpowers/specs/2026-10-16-profession-system-design.md). Account-
-- wide (profiles.professions), NOT per-character — see Decision 1 for why this differs from the
-- per-character, passive Skills system (skill_assignments, ADR-0056).
alter table public.profiles
  add column professions jsonb not null default '{}'::jsonb;

comment on column public.profiles.professions is
  'Account-wide profession progress: { "<professionKey>": { "level": int, "xp": int, "knownRecipes": [recipeKey, ...] } }. Absent key = level 0, no recipes known. Same reset tier as currencies/resources/echo_shop — survives Reset, wiped at Transcendence.';

-- ---------------------------------------------------------------------------------------------
-- start_craft: unchanged 5-param signature plus a new 6th param, so existing callers (the 3
-- reference recipes with no profession) keep working with p_profession_key omitted/null. When
-- it IS set, the caller must know the recipe already — Decision 3's new server-authoritative
-- gate. Every other line copied verbatim from 20260923100000_craft_cancel.sql.
-- ---------------------------------------------------------------------------------------------
create or replace function public.start_craft(
  p_player             uuid,
  p_recipe_def_id      text,
  p_resource_reagents  jsonb,
  p_item_reagents      jsonb,
  p_duration_seconds   integer,
  p_profession_key     text default null
) returns public.craft_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line      jsonb;
  v_code      text;
  v_need      integer;
  v_have      numeric;
  v_item      text;
  v_rarity    text;
  v_run       public.craft_runs;
  v_known     jsonb;
begin
  if p_recipe_def_id is null or length(p_recipe_def_id) = 0 then
    raise exception 'start_craft: recipe required';
  end if;
  if p_duration_seconds is null or p_duration_seconds < 1 then
    raise exception 'start_craft: invalid duration';
  end if;

  if p_profession_key is not null then
    select professions -> p_profession_key -> 'knownRecipes' into v_known
      from public.profiles
     where player_id = p_player;
    if v_known is null or not (v_known ? p_recipe_def_id) then
      raise exception 'start_craft: recipe not known for this profession';
    end if;
  end if;

  -- One craft at a time: the primary key is the mutex. A concurrent second start conflicts
  -- here and raises before anything is spent; craft_runs is touched by no other RPC, so this
  -- introduces no lock-order dependency.
  insert into public.craft_runs (player_id, recipe_def_id, started_at, ends_at, resource_reagents, item_reagents)
  values (p_player, p_recipe_def_id, now(), now() + make_interval(secs => p_duration_seconds),
          coalesce(p_resource_reagents, '[]'::jsonb), coalesce(p_item_reagents, '[]'::jsonb))
  on conflict (player_id) do nothing
  returning * into v_run;
  if v_run.player_id is null then
    raise exception 'start_craft: a craft is already in progress';
  end if;

  -- Item reagents: lock each chosen (item, rarity) stack, verify, deduct (delete at zero) —
  -- the same consume idiom upgrade_items uses (20260709000000_upgrade_items_rpc.sql).
  for v_line in select * from jsonb_array_elements(coalesce(p_item_reagents, '[]'::jsonb))
  loop
    v_item   := v_line->>'item_def_id';
    v_rarity := v_line->>'rarity';
    v_need   := (v_line->>'quantity')::integer;
    if v_item is null or v_rarity is null or v_need is null or v_need < 1 then
      raise exception 'start_craft: invalid item reagent';
    end if;
    select quantity into v_have
      from public.player_inventory
     where player_id = p_player and item_def_id = v_item and rarity = v_rarity
     for update;
    if not found or v_have < v_need then
      raise exception 'start_craft: not enough % (%) — have %, need %', v_item, v_rarity, coalesce(v_have, 0), v_need;
    end if;
    if v_have = v_need then
      delete from public.player_inventory
       where player_id = p_player and item_def_id = v_item and rarity = v_rarity;
    else
      update public.player_inventory
         set quantity = quantity - v_need
       where player_id = p_player and item_def_id = v_item and rarity = v_rarity;
    end if;
  end loop;

  -- Lock the wallet (inventory was locked above — same inventory-before-profiles order as
  -- claim_mission / claim_group_stage). A missing profile must fail loudly, not skip the charge.
  perform 1 from public.profiles where player_id = p_player for update;
  if not found then
    raise exception 'start_craft: no profile';
  end if;

  -- Resource reagents: verify then deduct each from the JSONB wallet.
  for v_line in select * from jsonb_array_elements(coalesce(p_resource_reagents, '[]'::jsonb))
  loop
    v_code := v_line->>'code';
    v_need := (v_line->>'quantity')::integer;
    if v_code is null or v_need is null or v_need < 1 then
      raise exception 'start_craft: invalid resource reagent';
    end if;
    select coalesce((resources->>v_code)::numeric, 0) into v_have
      from public.profiles where player_id = p_player;
    if v_have < v_need then
      raise exception 'start_craft: not enough % (have %, need %)', v_code, v_have, v_need;
    end if;
    update public.profiles
       set resources = jsonb_set(resources, array[v_code], to_jsonb(v_have - v_need))
     where player_id = p_player;
  end loop;

  return v_run;
end;
$$;

revoke all on function public.start_craft(uuid, text, jsonb, jsonb, integer, text) from public, anon, authenticated;
grant execute on function public.start_craft(uuid, text, jsonb, jsonb, integer, text) to service_role;

-- The old 5-arg start_craft is a different overload now that a 6th param was added via create or
-- replace (Postgres treats a differing arg list as a NEW overload, not a replacement — the
-- upgrade_items precedent, CLAUDE.md). Drop it explicitly so only the 6-arg version remains.
drop function if exists public.start_craft(uuid, text, jsonb, jsonb, integer);

-- ---------------------------------------------------------------------------------------------
-- claim_craft: drop + recreate for the new params (genuine signature change, same upgrade_items
-- precedent). Every line through the lifetime_stats loop is copied verbatim from
-- 20260916130000_claim_craft_lifetime_stats.sql; the profession block is new.
-- ---------------------------------------------------------------------------------------------
drop function if exists public.claim_craft(uuid, text, text, text, jsonb);

create or replace function public.claim_craft(
  p_player                uuid,
  p_recipe_def_id         text,
  p_result_item_def_id    text,
  p_result_rarity         text,
  p_lifetime_stats        jsonb default '{}'::jsonb,
  p_profession_key        text default null,
  p_profession_level      int default null,
  p_profession_xp         int default null,
  p_newly_known_recipes   text[] default array[]::text[]
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text;
  v_val numeric;
begin
  if p_result_rarity not in ('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary') then
    raise exception 'claim_craft: invalid rarity';
  end if;

  delete from public.craft_runs
   where player_id = p_player and recipe_def_id = p_recipe_def_id and now() >= ends_at;
  if not found then
    raise exception 'claim_craft: not claimable (no craft, wrong recipe, not finished, or already claimed)';
  end if;

  insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
  values (p_player, p_result_item_def_id, p_result_rarity, 1)
  on conflict (player_id, item_def_id, rarity)
    do update set quantity = public.player_inventory.quantity + excluded.quantity;

  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_lifetime_stats, '{}'::jsonb))
  loop
    update public.profiles
       set lifetime_stats = jsonb_set(lifetime_stats, array[v_key],
             to_jsonb(coalesce((lifetime_stats->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;

  -- Profession XP + newly-known recipes (level-up rewards, Decision 4 channel 3). The caller
  -- (craft-claim Edge Function) already computed the new level/xp via applyProfessionXp (TS) and
  -- resolved any grantedAtLevel recipes from Sanity — this just persists what was computed,
  -- merged onto the existing knownRecipes array (duplicates are harmless: knownRecipes is
  -- checked with `?` containment, never counted).
  if p_profession_key is not null then
    update public.profiles
       set professions = jsonb_set(
             professions,
             array[p_profession_key],
             coalesce(professions -> p_profession_key, jsonb_build_object('level', 0, 'xp', 0, 'knownRecipes', '[]'::jsonb))
               || jsonb_build_object(
                    'level', p_profession_level,
                    'xp', p_profession_xp,
                    'knownRecipes', coalesce(professions -> p_profession_key -> 'knownRecipes', '[]'::jsonb) || to_jsonb(p_newly_known_recipes)
                  )
           )
     where player_id = p_player;
  end if;

  return jsonb_build_object('item_def_id', p_result_item_def_id, 'rarity', p_result_rarity);
end;
$$;

revoke all on function public.claim_craft(uuid, text, text, text, jsonb, text, int, int, text[]) from public, anon, authenticated;
grant execute on function public.claim_craft(uuid, text, text, text, jsonb, text, int, int, text[]) to service_role;

-- ---------------------------------------------------------------------------------------------
-- learn_profession_recipe: buy a recipe from the profession expert for gold (Decision 4 channel
-- 1). p_cost/p_required_level are resolved server-side by the Edge Function from Sanity — the
-- client is never trusted for either. Locks profiles in the same read that checks both gold and
-- current level (this project's for-update-on-read rule).
-- ---------------------------------------------------------------------------------------------
create or replace function public.learn_profession_recipe(
  p_player         uuid,
  p_profession_key text,
  p_recipe_key     text,
  p_cost           int,
  p_required_level int
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_gold  numeric;
  v_level int;
  v_known jsonb;
begin
  select coalesce((currencies->>'gold')::numeric, 0),
         coalesce((professions -> p_profession_key ->> 'level')::int, 0),
         coalesce(professions -> p_profession_key -> 'knownRecipes', '[]'::jsonb)
    into v_gold, v_level, v_known
    from public.profiles
   where player_id = p_player
   for update;

  if not found then
    raise exception 'learn_profession_recipe: no profile';
  end if;
  if v_level < p_required_level then
    raise exception 'learn_profession_recipe: profession level too low (needs %, has %)', p_required_level, v_level;
  end if;
  if v_known ? p_recipe_key then
    raise exception 'learn_profession_recipe: recipe already known';
  end if;
  if v_gold < p_cost then
    raise exception 'learn_profession_recipe: insufficient gold (needs %, has %)', p_cost, v_gold;
  end if;

  update public.profiles
     set currencies = jsonb_set(currencies, array['gold'], to_jsonb(v_gold - p_cost)),
         professions = jsonb_set(
           professions,
           array[p_profession_key],
           coalesce(professions -> p_profession_key, jsonb_build_object('level', 0, 'xp', 0, 'knownRecipes', '[]'::jsonb))
             || jsonb_build_object('knownRecipes', v_known || to_jsonb(array[p_recipe_key]))
         )
   where player_id = p_player;

  return jsonb_build_object('recipeKey', p_recipe_key, 'goldSpent', p_cost);
end;
$$;

revoke all on function public.learn_profession_recipe(uuid, text, text, int, int) from public, anon, authenticated;
grant execute on function public.learn_profession_recipe(uuid, text, text, int, int) to service_role;

-- ---------------------------------------------------------------------------------------------
-- claim_profession_quest: turn in a reagent-line-shaped cost (resources + items + currency) at
-- the profession expert, once, for a recipe reward (Decision 4 channel 2; level-10-exclusive
-- quests are just entries with p_required_level = 10, not a separate mechanism). Verify-then-
-- deduct order mirrors start_craft: item reagents first (locked, deducted), then the profile
-- wallet (locked once, gold AND resources deducted from that same lock) — never partially spend
-- before confirming every line is payable.
-- ---------------------------------------------------------------------------------------------
create or replace function public.claim_profession_quest(
  p_player            uuid,
  p_profession_key    text,
  p_quest_key         text,
  p_required_level    int,
  p_reward_recipe_key text,
  p_resource_cost     jsonb default '[]'::jsonb,
  p_item_cost         jsonb default '[]'::jsonb,
  p_currency_cost     jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line     jsonb;
  v_item     text;
  v_rarity   text;
  v_need     integer;
  v_code     text;
  v_have     numeric;
  v_level    int;
  v_known    jsonb;
  v_completed jsonb;
begin
  select coalesce((professions -> p_profession_key ->> 'level')::int, 0),
         coalesce(professions -> p_profession_key -> 'knownRecipes', '[]'::jsonb),
         coalesce(professions -> p_profession_key -> 'completedQuests', '[]'::jsonb)
    into v_level, v_known, v_completed
    from public.profiles
   where player_id = p_player
   for update;

  if not found then
    raise exception 'claim_profession_quest: no profile';
  end if;
  if v_level < p_required_level then
    raise exception 'claim_profession_quest: profession level too low (needs %, has %)', p_required_level, v_level;
  end if;
  if v_completed ? p_quest_key then
    raise exception 'claim_profession_quest: quest already completed';
  end if;

  -- Item reagents: verify first, deduct in the same loop (same idiom as start_craft).
  for v_line in select * from jsonb_array_elements(coalesce(p_item_cost, '[]'::jsonb))
  loop
    v_item   := v_line->>'item_def_id';
    v_rarity := v_line->>'rarity';
    v_need   := (v_line->>'quantity')::integer;
    select quantity into v_have
      from public.player_inventory
     where player_id = p_player and item_def_id = v_item and rarity = v_rarity
     for update;
    if not found or v_have < v_need then
      raise exception 'claim_profession_quest: not enough % (%) — have %, need %', v_item, v_rarity, coalesce(v_have, 0), v_need;
    end if;
    if v_have = v_need then
      delete from public.player_inventory
       where player_id = p_player and item_def_id = v_item and rarity = v_rarity;
    else
      update public.player_inventory
         set quantity = quantity - v_need
       where player_id = p_player and item_def_id = v_item and rarity = v_rarity;
    end if;
  end loop;

  -- Resource + currency cost: verify every line against the already-locked profile row before
  -- deducting any of them. Each read takes its own `for update` (this project's rule: a read that
  -- decides a grant/deduction must lock in that same read, never rely on an earlier statement in
  -- the same function having already locked it — ADR-0054 bit this twice).
  for v_line in select * from jsonb_array_elements(coalesce(p_resource_cost, '[]'::jsonb))
  loop
    v_code := v_line->>'code';
    v_need := (v_line->>'quantity')::integer;
    if v_code is null or v_need is null or v_need < 1 then
      raise exception 'claim_profession_quest: invalid resource cost';
    end if;
    select coalesce((resources->>v_code)::numeric, 0) into v_have
      from public.profiles where player_id = p_player for update;
    if v_have < v_need then
      raise exception 'claim_profession_quest: not enough resource % (have %, need %)', v_code, v_have, v_need;
    end if;
  end loop;
  for v_line in select * from jsonb_array_elements(coalesce(p_currency_cost, '[]'::jsonb))
  loop
    v_code := v_line->>'code';
    v_need := (v_line->>'quantity')::integer;
    if v_code is null or v_need is null or v_need < 1 then
      raise exception 'claim_profession_quest: invalid currency cost';
    end if;
    select coalesce((currencies->>v_code)::numeric, 0) into v_have
      from public.profiles where player_id = p_player for update;
    if v_have < v_need then
      raise exception 'claim_profession_quest: not enough currency % (have %, need %)', v_code, v_have, v_need;
    end if;
  end loop;

  for v_line in select * from jsonb_array_elements(coalesce(p_resource_cost, '[]'::jsonb))
  loop
    v_code := v_line->>'code';
    v_need := (v_line->>'quantity')::integer;
    update public.profiles
       set resources = jsonb_set(resources, array[v_code], to_jsonb(coalesce((resources->>v_code)::numeric, 0) - v_need))
     where player_id = p_player;
  end loop;
  for v_line in select * from jsonb_array_elements(coalesce(p_currency_cost, '[]'::jsonb))
  loop
    v_code := v_line->>'code';
    v_need := (v_line->>'quantity')::integer;
    update public.profiles
       set currencies = jsonb_set(currencies, array[v_code], to_jsonb(coalesce((currencies->>v_code)::numeric, 0) - v_need))
     where player_id = p_player;
  end loop;

  update public.profiles
     set professions = jsonb_set(
           professions,
           array[p_profession_key],
           coalesce(professions -> p_profession_key, jsonb_build_object('level', 0, 'xp', 0, 'knownRecipes', '[]'::jsonb))
             || jsonb_build_object(
                  'knownRecipes', v_known || to_jsonb(array[p_reward_recipe_key]),
                  'completedQuests', v_completed || to_jsonb(array[p_quest_key])
                )
         )
   where player_id = p_player;

  return jsonb_build_object('rewardRecipeKey', p_reward_recipe_key);
end;
$$;

revoke all on function public.claim_profession_quest(uuid, text, text, int, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.claim_profession_quest(uuid, text, text, int, text, jsonb, jsonb, jsonb) to service_role;

-- ---------------------------------------------------------------------------------------------
-- transcend_player: redefined with professions added to the reset list. Every other line is
-- copied verbatim from 20260914110300_transcend_reset_skill_busy_check.sql.
-- ---------------------------------------------------------------------------------------------
create or replace function public.transcend_player(
  p_player uuid,
  p_protected_ids uuid[]
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_protected_slots integer;
  v_transcend_count integer;
  v_ascendant_milestones jsonb;
  v_lifetime_stats jsonb;
  v_milestones jsonb;
  v_awarded integer;
  v_reset_count integer;
  v_shards_earned_total integer;
  v_days_played integer;
  v_achievement_counters jsonb;
  v_achievements jsonb;
  v_unlocked_characters jsonb;
  v_achievement_result jsonb;
begin
  select coalesce((echo_shop ->> 'protectedSlots')::int, 0), transcend_count, ascendant_milestones,
         lifetime_stats, reset_count, ascendant_shards_earned_total, days_played,
         achievement_counters, achievements, unlocked_characters
    into v_protected_slots, v_transcend_count, v_ascendant_milestones,
         v_lifetime_stats, v_reset_count, v_shards_earned_total, v_days_played,
         v_achievement_counters, v_achievements, v_unlocked_characters
    from public.profiles
   where player_id = p_player
   for update;

  if not found then
    raise exception 'transcend_player: player not found';
  end if;

  if cardinality(p_protected_ids) > v_protected_slots then
    raise exception 'transcend_player: too many protected characters (have % slots, chose %)', v_protected_slots, cardinality(p_protected_ids);
  end if;
  if exists (
    select 1 from unnest(p_protected_ids) as pid
    where not exists (select 1 from public.player_characters where id = pid and player_id = p_player)
  ) then
    raise exception 'transcend_player: a protected character does not belong to this player';
  end if;

  if exists (select 1 from public.mission_runs where player_id = p_player)
    or exists (
      select 1 from public.gather_assignments ga
        join public.player_characters pc on pc.id = ga.player_character_id
       where pc.player_id = p_player
    )
    or exists (select 1 from public.group_runs where player_id = p_player and cardinality(party) > 0)
    or exists (
      select 1 from public.infirmary_admissions ia
        join public.player_characters pc on pc.id = ia.player_character_id
       where pc.player_id = p_player
    )
    or exists (select 1 from public.craft_runs where player_id = p_player)
    or exists (
      select 1 from public.skill_assignments sk
        join public.player_characters pc on pc.id = sk.player_character_id
       where pc.player_id = p_player
    )
  then
    raise exception 'transcend_player: a character is busy';
  end if;

  v_transcend_count := v_transcend_count + 1;
  v_milestones := check_ascendant_milestones(v_lifetime_stats, v_transcend_count, v_ascendant_milestones);
  v_awarded := (v_milestones ->> 'shards')::int;

  v_achievement_result := check_achievements(
    v_lifetime_stats,
    (select count(*) from jsonb_object_keys(v_unlocked_characters))::int,
    v_reset_count, v_transcend_count, v_shards_earned_total + v_awarded, v_days_played,
    v_achievement_counters, v_achievements
  );

  update public.profiles
     set currencies           = '{}'::jsonb,
         resources            = '{}'::jsonb,
         map_progress         = '{}'::jsonb,
         infirmary_level      = 1,
         echoes               = 0,
         echo_shop            = '{}'::jsonb,
         professions          = '{}'::jsonb,
         unlocked_characters  = (
           select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
           from jsonb_each(unlocked_characters)
           where key in (select character_def_id from public.player_characters
                         where id = any(p_protected_ids))
         ),
         transcend_count      = v_transcend_count,
         ascendant_shards     = ascendant_shards + v_awarded,
         ascendant_shards_earned_total = ascendant_shards_earned_total + v_awarded,
         ascendant_milestones = ascendant_milestones || (v_milestones -> 'newKeys'),
         achievements         = achievements || (v_achievement_result -> 'newKeys')
   where player_id = p_player;

  insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
  select p_player, item.value ->> 'itemDefId', item.value ->> 'rarity', count(*)::int
    from public.player_characters pc,
         jsonb_each(pc.equipped) as item
   where pc.player_id = p_player and not (pc.id = any(p_protected_ids))
   group by item.value ->> 'itemDefId', item.value ->> 'rarity'
  on conflict (player_id, item_def_id, rarity)
  do update set quantity = public.player_inventory.quantity + excluded.quantity;

  delete from public.group_runs where player_id = p_player;
  delete from public.player_characters where player_id = p_player and not (id = any(p_protected_ids));

  return jsonb_build_object('shardsAwarded', v_awarded, 'transcendCount', v_transcend_count);
end;
$$;

revoke all on function public.transcend_player(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.transcend_player(uuid, uuid[]) to service_role;
