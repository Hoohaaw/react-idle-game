-- upgrade_items gains lifetime-stat plumbing (itemsUpgraded) — same generic p_lifetime_stats
-- loop claim_mission/collect_gather/claim_group_stage/recruit_character/claim_craft already use.
-- This is a genuine signature change (new parameter), so the old 2-arg version must be dropped
-- first, same pattern the other lifetime-stats migrations used.
--
-- Unlike every other precedent, upgrade_items processes a BATCH (p_ops array) where each op
-- produces a variable number of upgraded items (consume_count / 5). Computing "how many items
-- were upgraded this call" belongs in the calling Edge Function, which already has the full ops
-- array — this RPC stays a dumb generic applier identical in shape to the other precedents, and
-- the new loop runs once, after the whole batch loop, on the total the caller already computed.
--
-- Preserves every existing line of the batch loop VERBATIM (rarity-order validation,
-- consume_count validation, the `for update` inventory lock, the deduct, the upsert into the
-- target rarity). Safe without an extra lock on profiles: a blind additive UPDATE is already
-- atomic per statement (same reasoning already verified for claim_craft's migration).
drop function public.upgrade_items(uuid, jsonb);

create or replace function public.upgrade_items(
  p_player          uuid,
  p_ops             jsonb,  -- [{ item_def_id, from_rarity, consume_count }, ...]
  p_lifetime_stats  jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_op           jsonb;
  v_item_def_id  text;
  v_from_rarity  text;
  v_consume      integer;
  v_to_rarity    text;
  v_have         integer;
  v_key          text;
  v_val          numeric;
begin
  for v_op in select * from jsonb_array_elements(p_ops)
  loop
    v_item_def_id := v_op->>'item_def_id';
    v_from_rarity := v_op->>'from_rarity';
    v_consume     := (v_op->>'consume_count')::integer;

    -- Validate rarity order and derive target rarity.
    v_to_rarity := case v_from_rarity
      when 'Common'   then 'Uncommon'
      when 'Uncommon' then 'Rare'
      when 'Rare'     then 'Epic'
      when 'Epic'     then 'Legendary'
      else null
    end;
    if v_to_rarity is null then
      raise exception 'upgrade_items: cannot upgrade from %', v_from_rarity;
    end if;

    -- Validate consume_count is a positive multiple of 5 within a sane upper bound.
    if v_consume <= 0 or v_consume % 5 != 0 then
      raise exception 'upgrade_items: consume_count must be a positive multiple of 5';
    end if;
    if v_consume > 10000 then
      raise exception 'upgrade_items: consume_count exceeds maximum (10000)';
    end if;

    -- Lock source stack and verify sufficient quantity.
    select quantity into v_have
      from public.player_inventory
     where player_id    = p_player
       and item_def_id  = v_item_def_id
       and rarity       = v_from_rarity
     for update;

    if not found or v_have < v_consume then
      raise exception 'upgrade_items: insufficient quantity of % (%) — have %, need %',
        v_item_def_id, v_from_rarity, coalesce(v_have, 0), v_consume;
    end if;

    -- Deduct source stack (delete when fully consumed).
    if v_have = v_consume then
      delete from public.player_inventory
       where player_id   = p_player
         and item_def_id = v_item_def_id
         and rarity      = v_from_rarity;
    else
      update public.player_inventory
         set quantity = quantity - v_consume
       where player_id   = p_player
         and item_def_id = v_item_def_id
         and rarity      = v_from_rarity;
    end if;

    -- Add produced items to target rarity stack (upsert).
    insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
    values (p_player, v_item_def_id, v_to_rarity, v_consume / 5)
    on conflict (player_id, item_def_id, rarity)
      do update set quantity = player_inventory.quantity + excluded.quantity;
  end loop;

  -- Lifetime stats: atomic increments (same pattern as claim_mission/collect_gather).
  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_lifetime_stats, '{}'::jsonb))
  loop
    update public.profiles
       set lifetime_stats = jsonb_set(lifetime_stats, array[v_key],
             to_jsonb(coalesce((lifetime_stats->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
  end loop;
end;
$$;

-- Revoke direct-call access from all non-service roles (ADR-0003: Edge Function only).
revoke all on function public.upgrade_items(uuid, jsonb, jsonb) from public, anon, authenticated;
