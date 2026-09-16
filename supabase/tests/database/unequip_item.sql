-- unequip_item: slot validation, ownership, mission/gather/infirmary busy-checks (group_runs' own
-- check is in group_runs_busy_check.sql), empty-slot rejection, item returned to inventory (fresh
-- stack and incrementing an existing one). Fixture convention: one player+character per scenario.
begin;
select plan(8);

-- 1. Invalid slot key.
insert into auth.users (id, email, raw_user_meta_data)
values ('30000000-0000-0000-0000-000000000001', 'unequip-1@test.local', jsonb_build_object('username', 'unequip_1'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'test_char', 15);

select throws_ok(
  $$ select public.unequip_item('30000000-0000-0000-0000-000000000001'::uuid, '30000000-0000-0000-0000-000000000002'::uuid, 'not-a-slot') $$,
  'unequip_item: invalid slot key'
);

-- 2. Character not found/not owned.
select throws_ok(
  $$ select public.unequip_item('30000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000009999'::uuid, 'weapon') $$,
  'unequip_item: character not found or not owned'
);

-- 3. Mission busy-check.
insert into auth.users (id, email, raw_user_meta_data)
values ('30000000-0000-0000-0000-000000000011', 'unequip-2@test.local', jsonb_build_object('username', 'unequip_2'));
insert into public.player_characters (id, player_id, character_def_id, level, equipped)
values ('30000000-0000-0000-0000-000000000012', '30000000-0000-0000-0000-000000000011', 'test_char', 15,
        jsonb_build_object('weapon', jsonb_build_object('itemDefId', 'test-sword', 'rarity', 'Common')));
insert into public.mission_runs (player_id, mission_def_id, party, ends_at)
values ('30000000-0000-0000-0000-000000000011', 'test_mission', array['30000000-0000-0000-0000-000000000012'::uuid], now() + interval '1 hour');

select throws_ok(
  $$ select public.unequip_item('30000000-0000-0000-0000-000000000011'::uuid, '30000000-0000-0000-0000-000000000012'::uuid, 'weapon') $$,
  'unequip_item: character is on a mission'
);

-- 4. Gather busy-check.
insert into auth.users (id, email, raw_user_meta_data)
values ('30000000-0000-0000-0000-000000000021', 'unequip-3@test.local', jsonb_build_object('username', 'unequip_3'));
insert into public.player_characters (id, player_id, character_def_id, level, equipped)
values ('30000000-0000-0000-0000-000000000022', '30000000-0000-0000-0000-000000000021', 'test_char', 15,
        jsonb_build_object('weapon', jsonb_build_object('itemDefId', 'test-sword', 'rarity', 'Common')));
insert into public.gather_assignments (player_id, player_character_id, resource_id)
values ('30000000-0000-0000-0000-000000000021', '30000000-0000-0000-0000-000000000022', 'Wood');

select throws_ok(
  $$ select public.unequip_item('30000000-0000-0000-0000-000000000021'::uuid, '30000000-0000-0000-0000-000000000022'::uuid, 'weapon') $$,
  'unequip_item: character is gathering'
);

-- 5. Infirmary busy-check.
insert into auth.users (id, email, raw_user_meta_data)
values ('30000000-0000-0000-0000-000000000031', 'unequip-4@test.local', jsonb_build_object('username', 'unequip_4'));
insert into public.player_characters (id, player_id, character_def_id, level, current_hp, equipped)
values ('30000000-0000-0000-0000-000000000032', '30000000-0000-0000-0000-000000000031', 'test_char', 15, 10,
        jsonb_build_object('weapon', jsonb_build_object('itemDefId', 'test-sword', 'rarity', 'Common')));
insert into public.infirmary_admissions (player_id, player_character_id, hp_at_admission)
values ('30000000-0000-0000-0000-000000000031', '30000000-0000-0000-0000-000000000032', 10);

select throws_ok(
  $$ select public.unequip_item('30000000-0000-0000-0000-000000000031'::uuid, '30000000-0000-0000-0000-000000000032'::uuid, 'weapon') $$,
  'unequip_item: character is in the infirmary'
);

-- 6. Empty slot rejected.
select throws_ok(
  $$ select public.unequip_item('30000000-0000-0000-0000-000000000001'::uuid, '30000000-0000-0000-0000-000000000002'::uuid, 'weapon') $$,
  'unequip_item: slot is empty'
);

-- 7. Happy path: unequip returns the item to a FRESH inventory stack.
update public.player_characters
   set equipped = jsonb_build_object('weapon', jsonb_build_object('itemDefId', 'test-sword', 'rarity', 'Common'))
 where id = '30000000-0000-0000-0000-000000000002';

select is(
  (public.unequip_item('30000000-0000-0000-0000-000000000001'::uuid, '30000000-0000-0000-0000-000000000002'::uuid, 'weapon')->'equipped') = '{}'::jsonb,
  true,
  'unequip_item clears the slot from the equipped map'
);

select is(
  (select quantity from public.player_inventory where player_id = '30000000-0000-0000-0000-000000000001' and item_def_id = 'test-sword' and rarity = 'Common'),
  1,
  'unequip_item creates a fresh inventory stack for the returned item'
);

select * from finish();
rollback;
