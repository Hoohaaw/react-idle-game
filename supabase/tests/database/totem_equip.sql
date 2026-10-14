-- totem_equip: equip_totem/unequip_totem — no busy-check (account-level, not scoped to any
-- one character), free swap, missing-profile guard, and (final-branch-review fix,
-- 20261013100000_totem_equip_ownership.sql) an ownership check that doesn't consume the stack.
begin;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data)
values ('60000000-0000-0000-0000-000000000001', 'totem-1@test.local', jsonb_build_object('username', 'totem_1'));

-- 0. Equipping an unowned totem is rejected.
select throws_ok(
  $$ select public.equip_totem('60000000-0000-0000-0000-000000000001'::uuid, 'totem-of-minor-warding') $$,
  'equip_totem: totem not owned'
);

-- Own one copy of the totem (same player_inventory shape claim_craft grants it at: rarity
-- 'Common', since totems never roll a rarity).
insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
values ('60000000-0000-0000-0000-000000000001', 'totem-of-minor-warding', 'Common', 1);

-- 1. Equipping an owned totem writes active_totem_id.
select is(
  public.equip_totem('60000000-0000-0000-0000-000000000001'::uuid, 'totem-of-minor-warding'),
  'totem-of-minor-warding',
  'equip_totem writes and returns the totem id'
);

select is(
  (select active_totem_id from public.profiles where player_id = '60000000-0000-0000-0000-000000000001'),
  'totem-of-minor-warding',
  'active_totem_id is set on the profile row'
);

-- Equipping must NOT consume/decrement the inventory stack — it stays durable.
select is(
  (select quantity from public.player_inventory
    where player_id = '60000000-0000-0000-0000-000000000001'
      and item_def_id = 'totem-of-minor-warding' and rarity = 'Common'),
  1,
  'equipping a totem does not decrement the owned stack'
);

-- 2. Swapping to a different OWNED totem is free and immediate (no busy-check, no cost).
insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
values ('60000000-0000-0000-0000-000000000001', 'totem-of-swiftness', 'Common', 1);
select public.equip_totem('60000000-0000-0000-0000-000000000001'::uuid, 'totem-of-swiftness');
select is(
  (select active_totem_id from public.profiles where player_id = '60000000-0000-0000-0000-000000000001'),
  'totem-of-swiftness',
  'swapping totems overwrites the previous one, no error'
);

-- 3. Unequipping clears it back to null.
select public.unequip_totem('60000000-0000-0000-0000-000000000001'::uuid);
select is(
  (select active_totem_id from public.profiles where player_id = '60000000-0000-0000-0000-000000000001'),
  null,
  'unequip_totem clears active_totem_id to null'
);

select * from finish();
rollback;
