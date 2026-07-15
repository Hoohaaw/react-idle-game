-- Blessing respec (ADR-0047): respec_blessings lets a player pay gold to wipe a character's
-- entire blessing tree back to '{}'::jsonb in one shot. All-or-nothing by design — row2/3/4
-- structurally require the previous row already picked (choose_blessing enforces this), so a
-- partial clear (e.g. row3 only) would leave the tree in an invalid state unless it also
-- cascaded; wiping everything sidesteps that entirely. Mirrors choose_blessing's lock/guard/
-- busy-check/raise convention (20260715130000_blessing_choose.sql); the gold-cost check mirrors
-- upgrade_infirmary's lock-profiles/verify-balance/deduct idiom (20260707150000_infirmary.sql),
-- collapsed to a single scalar since respec only ever spends gold — no resources, no
-- currencies-map abstraction needed (src/lib/currencies.ts has exactly one currency today).

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
