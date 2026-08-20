-- recruit_character: the atomic recruit write (docs/superpowers/specs/2026-08-20-character-
-- acquisition-design.md §7). Replaces the bare INSERT the `recruit` Edge Function used to do
-- directly — now there's a real acquisition gate (unlock condition + gold cost) that must be
-- re-validated server-side in the same transaction as the write, not trusted from the client.
--
-- Contract: the calling Edge Function has ALREADY fetched the character's acquisition.goldCost and
-- whether it has a condition at all from Sanity — this RPC's job is the atomic re-validate + write:
--   - if p_condition_exists, unlocked_characters must contain p_char_key (server truth, not the
--     Edge Function's earlier read — re-checked here inside the same transaction as the write)
--   - currencies.gold must be >= p_gold_cost
--   - deduct gold, insert player_characters
-- The existing UNIQUE(player_id, character_def_id) constraint still enforces "one of each character,
-- ever" — a duplicate recruit attempt raises Postgres's own unique_violation (23505), and because
-- this whole function body is one implicit transaction, an aborted insert rolls back the gold
-- deduction too. No special handling needed for that case.
create or replace function public.recruit_character(
  p_player          uuid,
  p_character_def_id text,
  p_char_key         text,
  p_gold_cost        numeric,
  p_condition_exists boolean
) returns public.player_characters
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unlocked boolean;
  v_gold     numeric;
  v_row      public.player_characters;
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

  insert into public.player_characters (player_id, character_def_id)
  values (p_player, p_character_def_id)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.recruit_character(uuid, text, text, numeric, boolean) from public, anon, authenticated;
grant execute on function public.recruit_character(uuid, text, text, numeric, boolean) to service_role;
