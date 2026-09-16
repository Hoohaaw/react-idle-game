-- choose_blessing: row/choice validation, level gate per row, immutability guard, strict-sequence
-- guard, mission/gather/infirmary busy-checks (group_runs' own check is in
-- group_runs_busy_check.sql), and the capstone-earned achievement counter. Fixture convention: one
-- player+character per scenario.
begin;
select plan(11);

-- 1. Invalid row.
insert into auth.users (id, email, raw_user_meta_data)
values ('40000000-0000-0000-0000-000000000001', 'blessing-1@test.local', jsonb_build_object('username', 'blessing_1'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'test_char', 50);

select throws_ok(
  $$ select public.choose_blessing('40000000-0000-0000-0000-000000000001'::uuid, '40000000-0000-0000-0000-000000000002'::uuid, 'row9', 'a') $$,
  'choose_blessing: invalid row'
);

-- 2. Invalid choice.
select throws_ok(
  $$ select public.choose_blessing('40000000-0000-0000-0000-000000000001'::uuid, '40000000-0000-0000-0000-000000000002'::uuid, 'row1', 'c') $$,
  'choose_blessing: invalid choice'
);

-- 3. Character not found/not owned.
select throws_ok(
  $$ select public.choose_blessing('40000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000009999'::uuid, 'row1', 'a') $$,
  'choose_blessing: character not found or not owned'
);

-- 4. Level gate.
insert into auth.users (id, email, raw_user_meta_data)
values ('40000000-0000-0000-0000-000000000011', 'blessing-2@test.local', jsonb_build_object('username', 'blessing_2'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('40000000-0000-0000-0000-000000000012', '40000000-0000-0000-0000-000000000011', 'test_char', 5);

select throws_ok(
  $$ select public.choose_blessing('40000000-0000-0000-0000-000000000011'::uuid, '40000000-0000-0000-0000-000000000012'::uuid, 'row1', 'a') $$,
  'choose_blessing: character level too low (needs 10, has 5)'
);

-- 5. Immutability guard: row already chosen.
insert into auth.users (id, email, raw_user_meta_data)
values ('40000000-0000-0000-0000-000000000021', 'blessing-3@test.local', jsonb_build_object('username', 'blessing_3'));
insert into public.player_characters (id, player_id, character_def_id, level, blessings)
values ('40000000-0000-0000-0000-000000000022', '40000000-0000-0000-0000-000000000021', 'test_char', 50,
        jsonb_build_object('row1', 'a'));

select throws_ok(
  $$ select public.choose_blessing('40000000-0000-0000-0000-000000000021'::uuid, '40000000-0000-0000-0000-000000000022'::uuid, 'row1', 'b') $$,
  'choose_blessing: row already chosen'
);

-- 6. Strict sequence: row2 before row1.
select throws_ok(
  $$ select public.choose_blessing('40000000-0000-0000-0000-000000000001'::uuid, '40000000-0000-0000-0000-000000000002'::uuid, 'row2', 'a') $$,
  'choose_blessing: row1 must be chosen first'
);

-- 7. Mission busy-check.
insert into auth.users (id, email, raw_user_meta_data)
values ('40000000-0000-0000-0000-000000000031', 'blessing-4@test.local', jsonb_build_object('username', 'blessing_4'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('40000000-0000-0000-0000-000000000032', '40000000-0000-0000-0000-000000000031', 'test_char', 50);
insert into public.mission_runs (player_id, mission_def_id, party, ends_at)
values ('40000000-0000-0000-0000-000000000031', 'test_mission', array['40000000-0000-0000-0000-000000000032'::uuid], now() + interval '1 hour');

select throws_ok(
  $$ select public.choose_blessing('40000000-0000-0000-0000-000000000031'::uuid, '40000000-0000-0000-0000-000000000032'::uuid, 'row1', 'a') $$,
  'choose_blessing: character is on a mission'
);

-- 8. Happy path: row1 pick at level 50 (below 50 for capstone test comes next).
select is(
  (public.choose_blessing('40000000-0000-0000-0000-000000000001'::uuid, '40000000-0000-0000-0000-000000000002'::uuid, 'row1', 'a')->>'blessings')::jsonb->>'row1',
  'a',
  'choose_blessing writes the pick into the blessings map'
);

-- 9. Sequential picks through row4 at level 50 bump the capstone-earned counter (row4 requires
-- level >= 40; capstone counted immediately since this character is already >= 50).
insert into auth.users (id, email, raw_user_meta_data)
values ('40000000-0000-0000-0000-000000000041', 'blessing-5@test.local', jsonb_build_object('username', 'blessing_5'));
insert into public.player_characters (id, player_id, character_def_id, level, blessings)
values ('40000000-0000-0000-0000-000000000042', '40000000-0000-0000-0000-000000000041', 'test_char', 50,
        jsonb_build_object('row1', 'a', 'row2', 'a', 'row3', 'a'));

select is(
  (public.choose_blessing('40000000-0000-0000-0000-000000000041'::uuid, '40000000-0000-0000-0000-000000000042'::uuid, 'row4', 'a')->'blessings'->>'row4'),
  'a',
  'choose_blessing writes row4 when the sequence is already satisfied'
);

select is(
  (select (achievement_counters->>'capstonesEarned')::int from public.profiles where player_id = '40000000-0000-0000-0000-000000000041'),
  1,
  'picking row4 at character level >= 50 bumps achievement_counters.capstonesEarned'
);

-- 10. Picking row4 BELOW level 50 does NOT bump the counter (capstone not yet earned — the other
-- trigger point, a later level-up, is a different RPC's responsibility, out of scope here).
insert into auth.users (id, email, raw_user_meta_data)
values ('40000000-0000-0000-0000-000000000051', 'blessing-6@test.local', jsonb_build_object('username', 'blessing_6'));
insert into public.player_characters (id, player_id, character_def_id, level, blessings)
values ('40000000-0000-0000-0000-000000000052', '40000000-0000-0000-0000-000000000051', 'test_char', 40,
        jsonb_build_object('row1', 'a', 'row2', 'a', 'row3', 'a'));

select public.choose_blessing('40000000-0000-0000-0000-000000000051'::uuid, '40000000-0000-0000-0000-000000000052'::uuid, 'row4', 'a');

select is(
  (select achievement_counters->>'capstonesEarned' from public.profiles where player_id = '40000000-0000-0000-0000-000000000051'),
  null,
  'picking row4 below level 50 does not bump the capstone counter'
);

select * from finish();
rollback;
