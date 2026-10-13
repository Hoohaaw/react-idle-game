-- mission_consumables: start_mission's new p_consumables param — ownership/quantity
-- validation, atomic consumption, and recording onto consumables_used. Slot-count/heal-cap
-- validation is covered separately in src/lib/consumables.test.ts (pure TS, Task 2) since
-- it needs Sanity-sourced data this RPC never sees.
begin;
select plan(5);

insert into auth.users (id, email, raw_user_meta_data)
values ('50000000-0000-0000-0000-000000000001', 'mp-1@test.local', jsonb_build_object('username', 'mp_1'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'test_char', 25);

-- 1. Rejects an unowned/missing consumable.
select throws_ok(
  $$ select public.start_mission(
       '50000000-0000-0000-0000-000000000001'::uuid, 'test_mission',
       array['50000000-0000-0000-0000-000000000002'::uuid], 60, null, null, null,
       jsonb_build_array(jsonb_build_object('characterId', '50000000-0000-0000-0000-000000000002', 'consumableDefId', 'no-such-potion'))
     ) $$,
  'start_mission: consumable no-such-potion not in inventory'
);

-- 2. Happy path: owning 1 of a consumable lets dispatch succeed and consumes it.
insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
values ('50000000-0000-0000-0000-000000000001', 'minor-healing-potion', 'Common', 1);

select is(
  (public.start_mission(
     '50000000-0000-0000-0000-000000000001'::uuid, 'test_mission',
     array['50000000-0000-0000-0000-000000000002'::uuid], 60, null, null, null,
     jsonb_build_array(jsonb_build_object('characterId', '50000000-0000-0000-0000-000000000002', 'consumableDefId', 'minor-healing-potion'))
   )).consumables_used,
  jsonb_build_array(jsonb_build_object('characterId', '50000000-0000-0000-0000-000000000002', 'consumableDefId', 'minor-healing-potion')),
  'start_mission records the validated loadout onto the new run'
);

select is(
  (select quantity from public.player_inventory
    where player_id = '50000000-0000-0000-0000-000000000001' and item_def_id = 'minor-healing-potion' and rarity = 'Common'),
  null,
  'start_mission deletes the inventory stack once it hits zero'
);

-- 3. Consumption happens even for a dispatch with no consumables at all (default empty array).
delete from public.mission_runs where player_id = '50000000-0000-0000-0000-000000000001';
select is(
  (public.start_mission(
     '50000000-0000-0000-0000-000000000001'::uuid, 'test_mission',
     array['50000000-0000-0000-0000-000000000002'::uuid], 60, null, null, null
   )).consumables_used,
  '[]'::jsonb,
  'omitting p_consumables defaults to an empty loadout, not an error'
);

-- 4. A second item of the same def decrements rather than deletes.
delete from public.mission_runs where player_id = '50000000-0000-0000-0000-000000000001';
insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
values ('50000000-0000-0000-0000-000000000001', 'fire-resistance-draught', 'Common', 2);

select public.start_mission(
  '50000000-0000-0000-0000-000000000001'::uuid, 'test_mission',
  array['50000000-0000-0000-0000-000000000002'::uuid], 60, null, null, null,
  jsonb_build_array(jsonb_build_object('characterId', '50000000-0000-0000-0000-000000000002', 'consumableDefId', 'fire-resistance-draught'))
);

select is(
  (select quantity from public.player_inventory
    where player_id = '50000000-0000-0000-0000-000000000001' and item_def_id = 'fire-resistance-draught' and rarity = 'Common'),
  1,
  'start_mission decrements (not deletes) a stack with more than 1 remaining'
);

select * from finish();
rollback;
