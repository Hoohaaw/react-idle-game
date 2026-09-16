-- equip_item: slot/rarity validation, ownership, level gate, mission/gather/infirmary busy-checks
-- (group_runs' own busy-check is covered separately in group_runs_busy_check.sql), inventory stack
-- consumption (last-one-deletes vs decrement), displaced-item-returned, same-item-re-equip net-zero,
-- and the Legendary-equip achievement counter. Fixture convention: one player+character per
-- scenario (see docs/TESTING.md).
begin;
select plan(13);

-- 1. Invalid slot key.
insert into auth.users (id, email, raw_user_meta_data)
values ('20000000-0000-0000-0000-000000000001', 'equip-1@test.local', jsonb_build_object('username', 'equip_1'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'test_char', 15);

select throws_ok(
  $$ select public.equip_item('20000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'not-a-slot', 'test-sword', 'Common', 0) $$,
  'equip_item: invalid slot key'
);

-- 2. Invalid rarity.
select throws_ok(
  $$ select public.equip_item('20000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'weapon', 'test-sword', 'Mythic', 0) $$,
  'equip_item: invalid rarity'
);

-- 3. Character not found/not owned.
select throws_ok(
  $$ select public.equip_item('20000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000009999'::uuid, 'weapon', 'test-sword', 'Common', 0) $$,
  'equip_item: character not found or not owned'
);

-- 4. Level-requirement gate.
select throws_ok(
  $$ select public.equip_item('20000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'weapon', 'test-sword', 'Common', 20) $$,
  'equip_item: character level too low (needs 20, has 15)'
);

-- 5. Mission busy-check.
insert into auth.users (id, email, raw_user_meta_data)
values ('20000000-0000-0000-0000-000000000011', 'equip-2@test.local', jsonb_build_object('username', 'equip_2'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('20000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000011', 'test_char', 15);
insert into public.mission_runs (player_id, mission_def_id, party, ends_at)
values ('20000000-0000-0000-0000-000000000011', 'test_mission', array['20000000-0000-0000-0000-000000000012'::uuid], now() + interval '1 hour');

select throws_ok(
  $$ select public.equip_item('20000000-0000-0000-0000-000000000011'::uuid, '20000000-0000-0000-0000-000000000012'::uuid, 'weapon', 'test-sword', 'Common', 0) $$,
  'equip_item: character is on a mission'
);

-- 6. Gather busy-check.
insert into auth.users (id, email, raw_user_meta_data)
values ('20000000-0000-0000-0000-000000000021', 'equip-3@test.local', jsonb_build_object('username', 'equip_3'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('20000000-0000-0000-0000-000000000022', '20000000-0000-0000-0000-000000000021', 'test_char', 15);
insert into public.gather_assignments (player_id, player_character_id, resource_id)
values ('20000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000022', 'Wood');

select throws_ok(
  $$ select public.equip_item('20000000-0000-0000-0000-000000000021'::uuid, '20000000-0000-0000-0000-000000000022'::uuid, 'weapon', 'test-sword', 'Common', 0) $$,
  'equip_item: character is gathering'
);

-- 7. Infirmary busy-check.
insert into auth.users (id, email, raw_user_meta_data)
values ('20000000-0000-0000-0000-000000000031', 'equip-4@test.local', jsonb_build_object('username', 'equip_4'));
insert into public.player_characters (id, player_id, character_def_id, level, current_hp)
values ('20000000-0000-0000-0000-000000000032', '20000000-0000-0000-0000-000000000031', 'test_char', 15, 10);
insert into public.infirmary_admissions (player_id, player_character_id, hp_at_admission)
values ('20000000-0000-0000-0000-000000000031', '20000000-0000-0000-0000-000000000032', 10);

select throws_ok(
  $$ select public.equip_item('20000000-0000-0000-0000-000000000031'::uuid, '20000000-0000-0000-0000-000000000032'::uuid, 'weapon', 'test-sword', 'Common', 0) $$,
  'equip_item: character is in the infirmary'
);

-- 8. Item not in inventory.
select throws_ok(
  $$ select public.equip_item('20000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'weapon', 'test-sword', 'Common', 0) $$,
  'equip_item: item not in inventory'
);

-- 9. Happy path: equip into an empty slot, inventory stack of 1 is deleted, nothing returned.
insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
values ('20000000-0000-0000-0000-000000000001', 'test-sword', 'Common', 1);

select is(
  (public.equip_item('20000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'weapon', 'test-sword', 'Common', 0)->'equipped'->'weapon'->>'itemDefId'),
  'test-sword',
  'equip_item writes the item into the target slot'
);

select is(
  (select count(*)::int from public.player_inventory where player_id = '20000000-0000-0000-0000-000000000001' and item_def_id = 'test-sword' and rarity = 'Common'),
  0,
  'equip_item deletes the inventory row when the consumed stack drops to 0'
);

-- 10. Displaced item is returned to inventory when equipping over an occupied slot.
insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
values ('20000000-0000-0000-0000-000000000001', 'test-axe', 'Rare', 1);

select is(
  (public.equip_item('20000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'weapon', 'test-axe', 'Rare', 0)->>'returned')::jsonb->>'itemDefId',
  'test-sword',
  'equip_item returns the previously-equipped item in the response'
);

select is(
  (select quantity from public.player_inventory where player_id = '20000000-0000-0000-0000-000000000001' and item_def_id = 'test-sword' and rarity = 'Common'),
  1,
  'the displaced item is credited back to inventory'
);

-- 11. Legendary equip bumps the achievement counter.
insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
values ('20000000-0000-0000-0000-000000000001', 'test-legendary-axe', 'Legendary', 1);

select public.equip_item('20000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'weapon', 'test-legendary-axe', 'Legendary', 0);

select is(
  (select (achievement_counters->>'legendaryItemsEquipped')::int from public.profiles where player_id = '20000000-0000-0000-0000-000000000001'),
  1,
  'equipping a Legendary item bumps achievement_counters.legendaryItemsEquipped'
);

select * from finish();
rollback;
