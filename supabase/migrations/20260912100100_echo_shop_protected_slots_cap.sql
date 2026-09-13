-- purchase_echo_shop_node gains a cap specific to the new protectedSlots node (spec §4c,
-- ADR-0053's original node has no per-node cap concept — every other node stays uncapped).
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
  v_current_level integer;
begin
  if p_node_key is null or length(p_node_key) = 0 then
    raise exception 'purchase_echo_shop_node: node key required';
  end if;
  if p_cost is null or p_cost < 0 then
    raise exception 'purchase_echo_shop_node: invalid cost';
  end if;

  select echoes, echo_shop into v_echoes, v_shop
    from public.profiles where player_id = p_player for update;
  v_current_level := coalesce((v_shop ->> p_node_key)::int, 0);

  if p_node_key = 'protectedSlots' and v_current_level >= 5 then
    raise exception 'purchase_echo_shop_node: protected slots already at maximum (5)';
  end if;

  if coalesce(v_echoes, 0) < p_cost then
    raise exception 'purchase_echo_shop_node: insufficient echoes (have %, need %)', coalesce(v_echoes, 0), p_cost;
  end if;

  update public.profiles
     set echoes = echoes - p_cost,
         echo_shop = jsonb_set(echo_shop, array[p_node_key], to_jsonb(v_current_level + 1))
   where player_id = p_player
   returning echo_shop into v_shop;

  return jsonb_build_object('echoShop', v_shop);
end;
$$;

revoke all on function public.purchase_echo_shop_node(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.purchase_echo_shop_node(uuid, text, integer) to service_role;
