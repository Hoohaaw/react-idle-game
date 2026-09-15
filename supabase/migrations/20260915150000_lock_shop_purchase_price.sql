-- Lock the shop purchase PRICE, not just the award (echo/ascendant shop race fix).
-- purchase_echo_shop_node and purchase_ascendant_shop_node already locked the profile row
-- (`select ... for update`) before checking balance and applying the purchase, but the PRICE
-- they checked the balance against was a caller-supplied p_cost, computed by the Edge Function
-- from an UNLOCKED read taken before the RPC call. Two concurrent purchases at the same node
-- level both compute the same (correct-at-the-time) price, both pass the balance check
-- sequentially under the lock, both succeed — the node level increments twice but only one
-- purchase's worth of currency was validated at the right price. Same shape as ADR-0054's
-- milestone double-award race, one layer down: there the AWARD wasn't locked, here it's the
-- PRICE. Fix: recompute the cost SERVER-SIDE, under the same row lock that reads the current
-- level, by porting the pricing formula (floor(costBase * costGrowth ** currentLevel)) from
-- src/lib/echoShop.ts / src/lib/ascendantShop.ts into SQL — p_cost is dropped entirely
-- (ADR-0003: never trust a client-computed price).
--
-- double precision (not numeric) for the cost math: Postgres double precision and JS numbers are
-- both IEEE-754 doubles, so the SQL-computed price matches what the client's
-- nodeCost()/flatNodeCost()/charNodeCost() functions display in the UI for the same level as
-- closely as floating point allows; numeric's exact decimal arithmetic would silently diverge
-- from JS's binary-float rounding at some levels, making the UI's displayed "next upgrade cost"
-- wrong even though the actual charge is correct.
--
-- Both functions change signature (p_cost dropped), so the old 3-arg overloads are dropped
-- before the 2-arg replacements are created (matches 20260715120000_item_level_requirement.sql's
-- pattern for a changed-arity signature change).

drop function if exists public.purchase_echo_shop_node(uuid, text, integer);
drop function if exists public.purchase_ascendant_shop_node(uuid, text, integer);

-- ---------------------------------------------------------------------------------------------
-- purchase_echo_shop_node: buy the next level of one Echo Shop node. Cost is now resolved
-- authoritatively HERE, under the same row lock that reads the current level (see file header) —
-- pricing mirrors src/lib/echoShop.ts's ECHO_SHOP_NODES exactly; add a node kind there, add its
-- costBase/costGrowth branch here, in the same commit. Unknown node keys are rejected outright
-- (this used to be implicitly trusted via whatever p_cost the client sent).
-- ---------------------------------------------------------------------------------------------
create or replace function public.purchase_echo_shop_node(
  p_player   uuid,
  p_node_key text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_echoes        integer;
  v_shop          jsonb;
  v_current_level integer;
  v_cost_base     double precision;
  v_cost_growth   double precision;
  v_cost          integer;
begin
  if p_node_key is null or length(p_node_key) = 0 then
    raise exception 'purchase_echo_shop_node: node key required';
  end if;

  select echoes, echo_shop into v_echoes, v_shop
    from public.profiles where player_id = p_player for update;
  v_current_level := coalesce((v_shop ->> p_node_key)::int, 0);

  if p_node_key = 'protectedSlots' and v_current_level >= 5 then
    raise exception 'purchase_echo_shop_node: protected slots already at maximum (5)';
  end if;

  if p_node_key in ('missionSpeed', 'goldGain') then
    v_cost_base := 20;
    v_cost_growth := 1.15;
  elsif p_node_key = 'protectedSlots' then
    v_cost_base := 500;
    v_cost_growth := 1.8;
  elsif p_node_key like 'gatherRate.%' or p_node_key like 'resourceGain.%' then
    v_cost_base := 15;
    v_cost_growth := 1.12;
  else
    raise exception 'purchase_echo_shop_node: unknown node key %', p_node_key;
  end if;

  v_cost := floor(v_cost_base * power(v_cost_growth::double precision, v_current_level::double precision))::integer;

  if coalesce(v_echoes, 0) < v_cost then
    raise exception 'purchase_echo_shop_node: insufficient echoes (have %, need %)', coalesce(v_echoes, 0), v_cost;
  end if;

  update public.profiles
     set echoes = echoes - v_cost,
         echo_shop = jsonb_set(echo_shop, array[p_node_key], to_jsonb(v_current_level + 1))
   where player_id = p_player
   returning echo_shop into v_shop;

  return jsonb_build_object('echoShop', v_shop);
end;
$$;

revoke all on function public.purchase_echo_shop_node(uuid, text) from public, anon, authenticated;
grant execute on function public.purchase_echo_shop_node(uuid, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- purchase_ascendant_shop_node: buy the next level of one Ascendant Shop node. Cost is now
-- resolved authoritatively HERE, under the same row lock that reads the current level (see file
-- header) — pricing mirrors src/lib/ascendantShop.ts's FLAT_ASCENDANT_NODES/char node constants
-- exactly. Per-character nodes (<charKey>.power / <charKey>.vitality) share one price regardless
-- of charKey, matched by suffix — the charKey itself is still validated against Sanity by the
-- calling Edge Function (external content lookup, can't move into SQL). Unknown node keys are
-- rejected outright (this used to be implicitly trusted via whatever p_cost the client sent).
-- ---------------------------------------------------------------------------------------------
create or replace function public.purchase_ascendant_shop_node(
  p_player   uuid,
  p_node_key text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_shards        integer;
  v_shop          jsonb;
  v_current_level integer;
  v_cost_base     double precision;
  v_cost_growth   double precision;
  v_cost          integer;
begin
  if p_node_key is null or length(p_node_key) = 0 then
    raise exception 'purchase_ascendant_shop_node: node key required';
  end if;

  select ascendant_shards, ascendant_shop into v_shards, v_shop
    from public.profiles where player_id = p_player for update;
  v_current_level := coalesce((v_shop ->> p_node_key)::int, 0);

  if p_node_key in ('missionSpeed', 'goldFind', 'magicFind', 'xpGain', 'resourceGain') then
    v_cost_base := 200;
    v_cost_growth := 1.35;
  elsif p_node_key = 'rarityBias' then
    v_cost_base := 250;
    v_cost_growth := 1.4;
  elsif p_node_key like '%.power' or p_node_key like '%.vitality' then
    v_cost_base := 500;
    v_cost_growth := 1.5;
  else
    raise exception 'purchase_ascendant_shop_node: unknown node key %', p_node_key;
  end if;

  v_cost := floor(v_cost_base * power(v_cost_growth::double precision, v_current_level::double precision))::integer;

  if coalesce(v_shards, 0) < v_cost then
    raise exception 'purchase_ascendant_shop_node: insufficient shards (have %, need %)', coalesce(v_shards, 0), v_cost;
  end if;

  update public.profiles
     set ascendant_shards = ascendant_shards - v_cost,
         ascendant_shop = jsonb_set(ascendant_shop, array[p_node_key], to_jsonb(v_current_level + 1))
   where player_id = p_player
   returning ascendant_shop into v_shop;

  return jsonb_build_object('ascendantShop', v_shop);
end;
$$;

revoke all on function public.purchase_ascendant_shop_node(uuid, text) from public, anon, authenticated;
grant execute on function public.purchase_ascendant_shop_node(uuid, text) to service_role;
