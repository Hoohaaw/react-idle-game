-- recruit_character: gains a lifetime-stat increment (charactersRecruited), same shape as
-- claim_mission's / collect_gather's p_lifetime_stats extension (20260820120000_claim_mission_
-- acquisition.sql / 20260820130000_collect_gather_acquisition.sql — read those migrations'
-- comments for the full rationale). Recruiting always succeeds if this function doesn't raise, so
-- the calling Edge Function passes { charactersRecruited: 1 } unconditionally — no win/loss split
-- like claim_mission's.
--
-- Preserves every existing behavior of recruit_character VERBATIM — the unlock check, the gold
-- lock/read/deduct, the player_characters insert. Only the new lifetime-stats loop is added, right
-- after the gold deduction and before the insert. Safe without an extra explicit lock: the
-- function's existing `select ... for update` on profiles (reading currencies->>'gold') already
-- locks the same row earlier in the same transaction.
drop function public.recruit_character(uuid, text, text, numeric, boolean);

create or replace function public.recruit_character(
  p_player           uuid,
  p_character_def_id text,
  p_char_key         text,
  p_gold_cost        numeric,
  p_condition_exists boolean,
  p_lifetime_stats   jsonb default '{}'::jsonb
) returns public.player_characters
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unlocked boolean;
  v_gold     numeric;
  v_row      public.player_characters;
  v_key      text;
  v_val      numeric;
begin
  if p_condition_exists then
    select (unlocked_characters ? p_char_key) into v_unlocked
      from public.profiles
     where player_id = p_player;
    if not coalesce(v_unlocked, false) then
      raise exception 'recruit_character: not unlocked yet';
    end if;
  end if;

  select coalesce((currencies->>'gold')::numeric, 0) into v_gold
    from public.profiles
   where player_id = p_player
   for update;
  if coalesce(v_gold, 0) < p_gold_cost then
    raise exception 'recruit_character: insufficient gold';
  end if;

  update public.profiles
     set currencies = jsonb_set(currencies, array['gold'], to_jsonb(v_gold - p_gold_cost))
   where player_id = p_player;

  -- Lifetime stats: atomic increments (same pattern as claim_mission/collect_gather).
  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_lifetime_stats, '{}'::jsonb))
  loop
    update public.profiles
       set lifetime_stats = jsonb_set(lifetime_stats, array[v_key],
             to_jsonb(coalesce((lifetime_stats->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;

  insert into public.player_characters (player_id, character_def_id)
  values (p_player, p_character_def_id)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.recruit_character(uuid, text, text, numeric, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.recruit_character(uuid, text, text, numeric, boolean, jsonb) to service_role;
