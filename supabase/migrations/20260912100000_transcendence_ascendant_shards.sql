-- Transcendence (ADR-0023's hard-wipe half, spec docs/superpowers/specs/2026-09-12-transcendence-
-- ascendant-shards-design.md). Ascendant Shards are earned continuously through milestone
-- thresholds on lifetime stats (check_ascendant_milestones, called from inside every RPC that can
-- move a tracked metric — never computed in TypeScript, to avoid the double-award race
-- reset_player was fixed for), not as a lump sum at the moment of Transcending.

alter table public.profiles
  add column ascendant_shards integer not null default 0 check (ascendant_shards >= 0);
alter table public.profiles
  add column ascendant_shop   jsonb   not null default '{}'::jsonb;
alter table public.profiles
  add column ascendant_milestones jsonb not null default '{}'::jsonb;
alter table public.profiles
  add column transcend_count integer not null default 0 check (transcend_count >= 0);

comment on column public.profiles.ascendant_shards is
  'Spendable currency earned via milestone thresholds on lifetime stats (ADR-0023/spec 2026-09-12). Never wiped by reset_player or transcend_player.';
comment on column public.profiles.ascendant_shop is
  '{ "<nodeKey>": <level> } for flat nodes (missionSpeed/goldFind/magicFind/xpGain/resourceGain/rarityBias) and "<charKey>.power"/"<charKey>.vitality" for per-character nodes. Never wiped.';
comment on column public.profiles.ascendant_milestones is
  '{ "<metricKey>.<thresholdIndex>": true } — permanent record of claimed milestone thresholds. A key present here can never award Shards again, account-lifetime. Never wiped.';
comment on column public.profiles.transcend_count is
  'How many times the player has Transcended. Never wiped — also has its own milestone ladder (every 2).';

-- ---------------------------------------------------------------------------------------------
-- check_ascendant_milestones: shared by every RPC that can move a tracked metric (claim_mission,
-- collect_gather, claim_group_stage, transcend_player). Mirrors src/lib/ascendantMilestones.ts's
-- ASCENDANT_MILESTONES exactly — when a new metric is added there, add its ladder here too, in the
-- same commit (src/lib/reset.ts's SQL/TS duplication is the same accepted tradeoff: Postgres can't
-- import TypeScript). Takes the CALLING RPC's own locked, POST-delta state (never re-queries), so
-- two concurrent claims serialize on the same row lock and can never both see a threshold as
-- unclaimed. Only ever called from inside another SECURITY DEFINER function — never invoked
-- directly via PostgREST — but src/test/migration-policy.test.ts enumerates every non-trigger
-- function regardless, so it still needs its own revoke/grant pair.
-- ---------------------------------------------------------------------------------------------
create or replace function public.check_ascendant_milestones(
  p_lifetime_stats  jsonb,
  p_transcend_count integer,
  p_claimed         jsonb
) returns jsonb
language plpgsql
as $$
declare
  v_shards   integer := 0;
  v_new_keys jsonb := '{}'::jsonb;
  v_ladder   record;
  v_key      text;
  v_value    numeric;
begin
  for v_ladder in
    select * from (values
      ('goldEarned',              array[1000,10000,100000,1000000,10000000]),
      ('resourceGathered.Wood',   array[500,5000,50000,500000]),
      ('resourceGathered.Copper', array[500,5000,50000,500000]),
      ('resourceGathered.Stone',  array[500,5000,50000,500000]),
      ('resourceGathered.Coal',   array[500,5000,50000,500000]),
      ('resourceGathered.Iron',   array[500,5000,50000,500000]),
      ('resourceGathered.Silver', array[500,5000,50000,500000]),
      ('resourceGathered.Bronze', array[500,5000,50000,500000]),
      ('resourceGathered.Gold',   array[500,5000,50000,500000]),
      ('resourceGathered.Platinum', array[500,5000,50000,500000]),
      ('missionsCleared',        array[50,500,5000]),
      ('dungeonsCleared',        array[10,100,1000]),
      ('raidsCleared',           array[5,50,500])
    ) as t(metric_key, thresholds)
  loop
    v_value := coalesce((p_lifetime_stats ->> v_ladder.metric_key)::numeric, 0);
    for i in 1..array_length(v_ladder.thresholds, 1) loop
      v_key := v_ladder.metric_key || '.' || (i - 1);
      if v_value >= v_ladder.thresholds[i] and not coalesce(p_claimed ? v_key, false) then
        v_shards := v_shards + 1;
        v_new_keys := v_new_keys || jsonb_build_object(v_key, true);
      end if;
    end loop;
  end loop;

  for i in 1..25 loop
    v_key := 'transcendCount.' || (i - 1);
    if p_transcend_count >= i * 2 and not coalesce(p_claimed ? v_key, false) then
      v_shards := v_shards + 1;
      v_new_keys := v_new_keys || jsonb_build_object(v_key, true);
    end if;
  end loop;

  return jsonb_build_object('shards', v_shards, 'newKeys', v_new_keys);
end;
$$;

revoke all on function public.check_ascendant_milestones(jsonb, integer, jsonb) from public, anon, authenticated;
grant execute on function public.check_ascendant_milestones(jsonb, integer, jsonb) to service_role;

-- ---------------------------------------------------------------------------------------------
-- transcend_player: the hard-reset action. Busy-checked the same as reset_player; the gate
-- (every raid cleared) is checked by the calling Edge Function, not here (a UX gate, not a
-- security boundary — same split reset_player uses). p_protected_ids are player_characters.id[]
-- the player chose at Transcend time; their rows and unlocked_characters entries survive.
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
begin
  select coalesce((echo_shop ->> 'protectedSlots')::int, 0), transcend_count, ascendant_milestones, lifetime_stats
    into v_protected_slots, v_transcend_count, v_ascendant_milestones, v_lifetime_stats
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
  then
    raise exception 'transcend_player: a character is busy';
  end if;

  v_transcend_count := v_transcend_count + 1;
  v_milestones := check_ascendant_milestones(v_lifetime_stats, v_transcend_count, v_ascendant_milestones);
  v_awarded := (v_milestones ->> 'shards')::int;

  update public.profiles
     set currencies           = '{}'::jsonb,
         resources            = '{}'::jsonb,
         map_progress         = '{}'::jsonb,
         infirmary_level      = 1,
         echoes               = 0,
         echo_shop            = '{}'::jsonb,
         unlocked_characters  = (
           select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
           from jsonb_each(unlocked_characters)
           where key in (select character_def_id from public.player_characters
                         where id = any(p_protected_ids))
         ),
         transcend_count      = v_transcend_count,
         ascendant_shards     = ascendant_shards + v_awarded,
         ascendant_milestones = ascendant_milestones || (v_milestones -> 'newKeys')
   where player_id = p_player;

  delete from public.group_runs where player_id = p_player;
  delete from public.player_characters where player_id = p_player and not (id = any(p_protected_ids));

  return jsonb_build_object('shardsAwarded', v_awarded, 'transcendCount', v_transcend_count);
end;
$$;

revoke all on function public.transcend_player(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.transcend_player(uuid, uuid[]) to service_role;

-- ---------------------------------------------------------------------------------------------
-- purchase_ascendant_shop_node: buy the next level of one Ascendant Shop node. Same shape as
-- purchase_echo_shop_node (spec 2026-09-11's Echo Shop), pointed at ascendant_shards/ascendant_shop
-- instead. p_cost is resolved authoritatively by the calling Edge Function from the CODE registry
-- (src/lib/ascendantShop.ts) — no Sanity round-trip for flat nodes; per-character nodes still
-- validate the charKey against Sanity in the Edge Function before calling this.
-- ---------------------------------------------------------------------------------------------
create or replace function public.purchase_ascendant_shop_node(
  p_player   uuid,
  p_node_key text,
  p_cost     integer
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_shards integer;
  v_shop   jsonb;
begin
  if p_node_key is null or length(p_node_key) = 0 then
    raise exception 'purchase_ascendant_shop_node: node key required';
  end if;
  if p_cost is null or p_cost < 0 then
    raise exception 'purchase_ascendant_shop_node: invalid cost';
  end if;

  select ascendant_shards into v_shards
    from public.profiles where player_id = p_player for update;
  if coalesce(v_shards, 0) < p_cost then
    raise exception 'purchase_ascendant_shop_node: insufficient shards (have %, need %)', coalesce(v_shards, 0), p_cost;
  end if;

  update public.profiles
     set ascendant_shards = ascendant_shards - p_cost,
         ascendant_shop = jsonb_set(ascendant_shop, array[p_node_key], to_jsonb(coalesce((ascendant_shop->>p_node_key)::int, 0) + 1))
   where player_id = p_player
   returning ascendant_shop into v_shop;

  return jsonb_build_object('ascendantShop', v_shop);
end;
$$;

revoke all on function public.purchase_ascendant_shop_node(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.purchase_ascendant_shop_node(uuid, text, integer) to service_role;
