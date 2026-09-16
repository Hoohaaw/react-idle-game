-- claim_craft gains lifetime-stat plumbing it never had (crafting shipped without
-- acquisition-ledger integration, same scope cut as group runs) — same generic
-- p_lifetime_stats loop claim_mission/collect_gather/claim_group_stage already use. This is a
-- genuine signature change (new parameter), so the old 4-arg version must be dropped first, same
-- pattern 20260912100300_claim_group_stage_lifetime_stats.sql used. Every other line of the
-- existing function is preserved verbatim from 20260910110000_craft_runs.sql; only the new
-- declare block and loop are added.
drop function public.claim_craft(uuid, text, text, text);

create or replace function public.claim_craft(
  p_player             uuid,
  p_recipe_def_id      text,
  p_result_item_def_id text,
  p_result_rarity      text,
  p_lifetime_stats     jsonb default '{}'::jsonb
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

  return jsonb_build_object('item_def_id', p_result_item_def_id, 'rarity', p_result_rarity);
end;
$$;

revoke all on function public.claim_craft(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.claim_craft(uuid, text, text, text, jsonb) to service_role;
