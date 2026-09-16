-- The "character is in a dungeon or raid" busy-check is near-identical across four RPCs
-- (equip_item, unequip_item, choose_blessing, respec_blessings) — one file, parametrized over the
-- four function names, instead of four near-duplicate test files.
--
-- Fixture convention (see docs/TESTING.md): each scenario gets its OWN player+character. Reusing
-- one across scenarios risks cross-contamination when an earlier call mutates shared state (e.g.
-- a successful start_group_stage leaves the character "busy" for the rest of the file).
begin;
select plan(4);

-- equip_item
insert into auth.users (id, email, raw_user_meta_data)
values ('10000000-0000-0000-0000-000000000001', 'busy-equip@test.local', jsonb_build_object('username', 'busy_equip'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'test_char', 15);
insert into public.player_inventory (player_id, item_def_id, rarity)
values ('10000000-0000-0000-0000-000000000001', 'test-sword', 'Common');
insert into public.group_runs (player_id, kind, def_key, party)
values ('10000000-0000-0000-0000-000000000001', 'dungeon', 'test_dungeon', array['10000000-0000-0000-0000-000000000002'::uuid]);

select throws_ok(
  $$ select public.equip_item('10000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, 'weapon', 'test-sword', 'Common', 0) $$,
  'equip_item: character is in a dungeon or raid'
);

-- unequip_item
insert into auth.users (id, email, raw_user_meta_data)
values ('10000000-0000-0000-0000-000000000011', 'busy-unequip@test.local', jsonb_build_object('username', 'busy_unequip'));
insert into public.player_characters (id, player_id, character_def_id, level, equipped)
values ('10000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000011', 'test_char', 15,
        jsonb_build_object('weapon', jsonb_build_object('itemDefId', 'test-sword', 'rarity', 'Common')));
insert into public.group_runs (player_id, kind, def_key, party)
values ('10000000-0000-0000-0000-000000000011', 'dungeon', 'test_dungeon', array['10000000-0000-0000-0000-000000000012'::uuid]);

select throws_ok(
  $$ select public.unequip_item('10000000-0000-0000-0000-000000000011'::uuid, '10000000-0000-0000-0000-000000000012'::uuid, 'weapon') $$,
  'unequip_item: character is in a dungeon or raid'
);

-- choose_blessing
insert into auth.users (id, email, raw_user_meta_data)
values ('10000000-0000-0000-0000-000000000021', 'busy-blessing@test.local', jsonb_build_object('username', 'busy_blessing'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('10000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000021', 'test_char', 15);
insert into public.group_runs (player_id, kind, def_key, party)
values ('10000000-0000-0000-0000-000000000021', 'dungeon', 'test_dungeon', array['10000000-0000-0000-0000-000000000022'::uuid]);

select throws_ok(
  $$ select public.choose_blessing('10000000-0000-0000-0000-000000000021'::uuid, '10000000-0000-0000-0000-000000000022'::uuid, 'row1', 'a') $$,
  'choose_blessing: character is in a dungeon or raid'
);

-- respec_blessings
insert into auth.users (id, email, raw_user_meta_data)
values ('10000000-0000-0000-0000-000000000031', 'busy-respec@test.local', jsonb_build_object('username', 'busy_respec'));
insert into public.player_characters (id, player_id, character_def_id, level, blessings)
values ('10000000-0000-0000-0000-000000000032', '10000000-0000-0000-0000-000000000031', 'test_char', 15,
        jsonb_build_object('row1', 'a'));
insert into public.group_runs (player_id, kind, def_key, party)
values ('10000000-0000-0000-0000-000000000031', 'dungeon', 'test_dungeon', array['10000000-0000-0000-0000-000000000032'::uuid]);

select throws_ok(
  $$ select public.respec_blessings('10000000-0000-0000-0000-000000000031'::uuid, '10000000-0000-0000-0000-000000000032'::uuid, 100) $$,
  'respec_blessings: character is in a dungeon or raid'
);

select * from finish();
rollback;
