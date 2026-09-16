-- respec_blessings: ownership, no-op rejection, mission/gather/infirmary busy-checks (group_runs'
-- own check is in group_runs_busy_check.sql), gold balance check, tree wipe. Fixture convention:
-- one player+character per scenario.
begin;
select plan(8);

-- 1. Character not found/not owned.
insert into auth.users (id, email, raw_user_meta_data)
values ('50000000-0000-0000-0000-000000000001', 'respec-1@test.local', jsonb_build_object('username', 'respec_1'));

select throws_ok(
  $$ select public.respec_blessings('50000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000009999'::uuid, 100) $$,
  'respec_blessings: character not found or not owned'
);

-- 2. Nothing to respec.
insert into public.player_characters (id, player_id, character_def_id, level)
values ('50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'test_char', 15);

select throws_ok(
  $$ select public.respec_blessings('50000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, 100) $$,
  'respec_blessings: no blessings to respec'
);

-- 3. Mission busy-check.
insert into auth.users (id, email, raw_user_meta_data)
values ('50000000-0000-0000-0000-000000000011', 'respec-2@test.local', jsonb_build_object('username', 'respec_2'));
insert into public.player_characters (id, player_id, character_def_id, level, blessings)
values ('50000000-0000-0000-0000-000000000012', '50000000-0000-0000-0000-000000000011', 'test_char', 15,
        jsonb_build_object('row1', 'a'));
insert into public.mission_runs (player_id, mission_def_id, party, ends_at)
values ('50000000-0000-0000-0000-000000000011', 'test_mission', array['50000000-0000-0000-0000-000000000012'::uuid], now() + interval '1 hour');

select throws_ok(
  $$ select public.respec_blessings('50000000-0000-0000-0000-000000000011'::uuid, '50000000-0000-0000-0000-000000000012'::uuid, 100) $$,
  'respec_blessings: character is on a mission'
);

-- 4. Gather busy-check.
insert into auth.users (id, email, raw_user_meta_data)
values ('50000000-0000-0000-0000-000000000021', 'respec-3@test.local', jsonb_build_object('username', 'respec_3'));
insert into public.player_characters (id, player_id, character_def_id, level, blessings)
values ('50000000-0000-0000-0000-000000000022', '50000000-0000-0000-0000-000000000021', 'test_char', 15,
        jsonb_build_object('row1', 'a'));
insert into public.gather_assignments (player_id, player_character_id, resource_id)
values ('50000000-0000-0000-0000-000000000021', '50000000-0000-0000-0000-000000000022', 'Wood');

select throws_ok(
  $$ select public.respec_blessings('50000000-0000-0000-0000-000000000021'::uuid, '50000000-0000-0000-0000-000000000022'::uuid, 100) $$,
  'respec_blessings: character is gathering'
);

-- 5. Infirmary busy-check.
insert into auth.users (id, email, raw_user_meta_data)
values ('50000000-0000-0000-0000-000000000031', 'respec-4@test.local', jsonb_build_object('username', 'respec_4'));
insert into public.player_characters (id, player_id, character_def_id, level, current_hp, blessings)
values ('50000000-0000-0000-0000-000000000032', '50000000-0000-0000-0000-000000000031', 'test_char', 15, 10,
        jsonb_build_object('row1', 'a'));
insert into public.infirmary_admissions (player_id, player_character_id, hp_at_admission)
values ('50000000-0000-0000-0000-000000000031', '50000000-0000-0000-0000-000000000032', 10);

select throws_ok(
  $$ select public.respec_blessings('50000000-0000-0000-0000-000000000031'::uuid, '50000000-0000-0000-0000-000000000032'::uuid, 100) $$,
  'respec_blessings: character is in the infirmary'
);

-- 6. Insufficient gold.
update public.player_characters set blessings = jsonb_build_object('row1', 'a') where id = '50000000-0000-0000-0000-000000000002';

select throws_ok(
  $$ select public.respec_blessings('50000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, 100) $$,
  'respec_blessings: insufficient gold (needs 100, has 0)'
);

-- 7. Happy path: sufficient gold wipes the tree and deducts the cost.
update public.profiles set currencies = jsonb_build_object('gold', 500) where player_id = '50000000-0000-0000-0000-000000000001';

select is(
  (public.respec_blessings('50000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, 100)->'blessings') = '{}'::jsonb,
  true,
  'respec_blessings wipes the blessings tree'
);

select is(
  (select (currencies->>'gold')::int from public.profiles where player_id = '50000000-0000-0000-0000-000000000001'),
  400,
  'respec_blessings deducts the cost from gold'
);

select * from finish();
rollback;
