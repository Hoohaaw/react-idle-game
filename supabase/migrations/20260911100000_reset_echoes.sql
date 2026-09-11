-- Reset (ADR-0053, the soft-reset half of ADR-0023's two-tier prestige split) — profiles.
-- transcendence_count is renamed reset_count (the OLD single-tier design this column tracked is
-- what ADR-0023 called "Reset"; the harder full-wipe "Transcendence" tier is a separate future
-- spec, not this one — see docs/superpowers/specs/2026-09-11-reset-echoes-design.md).
--
-- echoes is a DEDICATED column, deliberately not a key inside `currencies` — reset_player wipes
-- currencies wholesale as part of the reset; if Echoes lived inside that same map, the very
-- reward a reset just earned would be wiped in the same statement. echo_shop is also its own
-- column: { "<nodeKey>": <levelPurchased> }, a missing key = level 0, and reset_player never
-- touches it — that permanence is the whole point (spec §4a).

alter table public.profiles rename column transcendence_count to reset_count;

alter table public.profiles
  add column echoes    integer not null default 0 check (echoes >= 0);
alter table public.profiles
  add column echo_shop jsonb   not null default '{}'::jsonb;

comment on column public.profiles.reset_count is
  'How many times the player has done a soft Reset (ADR-0053). Display/achievement counter only — no reward multiplier reads it (the old flat transcendenceCount x 10% bonus is retired in favor of the Echo Shop''s explicit bonuses).';
comment on column public.profiles.echoes is
  'Spendable currency earned by resetting (ADR-0053). Separate from `currencies` on purpose — see the table-level note above. Written only by reset_player / purchase_echo_shop_node (service role).';
comment on column public.profiles.echo_shop is
  '{ "<nodeKey>": <levelPurchased> } — permanent, never wiped by a reset. nodeKey matches src/lib/echoShop.ts''s ECHO_SHOP_NODES registry. Written only by purchase_echo_shop_node (service role).';

-- ---------------------------------------------------------------------------------------------
-- reset_player: the soft-reset action. Busy-checked across every activity table this codebase
-- has (mission/gather/group/infirmary/craft); gated on the order-1 map's boss being cleared
-- (checked by the calling Edge Function, not here — a UX gate, not a security boundary, same
-- split as every other *-start function in this codebase). p_total_stages and p_lifetime_gold
-- are computed by the Edge Function from the player's OWN profile row (map_progress summed,
-- lifetime_stats.goldEarned) — this function only does the atomic wipe + award.
-- ---------------------------------------------------------------------------------------------
create or replace function public.reset_player(
  p_player        uuid,
  p_total_stages  integer,
  p_lifetime_gold numeric
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_awarded integer;
begin
  perform 1 from public.profiles where player_id = p_player for update;

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
    raise exception 'reset_player: a character is busy';
  end if;

  -- STAGE_RATE=10, GOLD_RATE=2 — first-pass provisional constants (spec §3's non-goal on
  -- tuning), same treatment as combat.ts's COMBAT block: shape is final, numbers are tuned
  -- later against real playtest data via a calc-script pass.
  v_awarded := floor(coalesce(p_total_stages, 0) * 10) + floor(sqrt(greatest(coalesce(p_lifetime_gold, 0), 0)) * 2);

  update public.profiles
     set currencies      = '{}'::jsonb,
         resources       = '{}'::jsonb,
         map_progress    = '{}'::jsonb,
         infirmary_level = 1,
         echoes          = echoes + v_awarded,
         reset_count     = reset_count + 1
   where player_id = p_player;

  delete from public.group_runs where player_id = p_player;

  return jsonb_build_object('echoesAwarded', v_awarded);
end;
$$;

revoke all on function public.reset_player(uuid, integer, numeric) from public, anon, authenticated;
grant execute on function public.reset_player(uuid, integer, numeric) to service_role;

-- ---------------------------------------------------------------------------------------------
-- purchase_echo_shop_node: buy the next level of one Echo Shop node. p_cost is resolved
-- authoritatively by the calling Edge Function from the CODE registry (src/lib/echoShop.ts) —
-- no Sanity round-trip, the shop is mechanical content, not authored (ADR-0004/ADR-0003). This
-- function locks the row, verifies the balance, and applies both writes atomically.
-- ---------------------------------------------------------------------------------------------
create or replace function public.purchase_echo_shop_node(
  p_player   uuid,
  p_node_key text,
  p_cost     integer
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_echoes integer;
  v_shop   jsonb;
begin
  if p_node_key is null or length(p_node_key) = 0 then
    raise exception 'purchase_echo_shop_node: node key required';
  end if;
  if p_cost is null or p_cost < 0 then
    raise exception 'purchase_echo_shop_node: invalid cost';
  end if;

  select echoes into v_echoes
    from public.profiles where player_id = p_player for update;
  if coalesce(v_echoes, 0) < p_cost then
    raise exception 'purchase_echo_shop_node: insufficient echoes (have %, need %)', coalesce(v_echoes, 0), p_cost;
  end if;

  update public.profiles
     set echoes = echoes - p_cost,
         echo_shop = jsonb_set(echo_shop, array[p_node_key], to_jsonb(coalesce((echo_shop->>p_node_key)::int, 0) + 1))
   where player_id = p_player
   returning echo_shop into v_shop;

  return jsonb_build_object('echoShop', v_shop);
end;
$$;

revoke all on function public.purchase_echo_shop_node(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.purchase_echo_shop_node(uuid, text, integer) to service_role;
