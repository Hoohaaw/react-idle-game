-- start_group_stage: party validation, all five busy-checks (mission/gather/infirmary/skill/
-- another-group-run), map gate, fresh-run creation, the double-start guard, daily/weekly lockout
-- boundaries, and stage-index mismatch. Fixture convention: one player+character(s) per scenario.
begin;
select plan(21);

-- 1. Invalid kind.
insert into auth.users (id, email, raw_user_meta_data)
values ('60000000-0000-0000-0000-000000000001', 'start-1@test.local', jsonb_build_object('username', 'start_1'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('60000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', 'test_char', 15);

select throws_ok(
  $$ select public.start_group_stage('60000000-0000-0000-0000-000000000001'::uuid, 'quest', 'test_dungeon', array['60000000-0000-0000-0000-000000000002'::uuid], 0, 7, 60, 'daily', null) $$,
  'start_group_stage: invalid kind'
);

-- 2. Empty party.
select throws_ok(
  $$ select public.start_group_stage('60000000-0000-0000-0000-000000000001'::uuid, 'dungeon', 'test_dungeon', array[]::uuid[], 0, 7, 60, 'daily', null) $$,
  'start_group_stage: party required'
);

-- 3. Duplicate character.
select throws_ok(
  $$ select public.start_group_stage('60000000-0000-0000-0000-000000000001'::uuid, 'dungeon', 'test_dungeon', array['60000000-0000-0000-0000-000000000002'::uuid, '60000000-0000-0000-0000-000000000002'::uuid], 0, 7, 60, 'daily', null) $$,
  'start_group_stage: duplicate character in party'
);

-- 4. Invalid duration.
select throws_ok(
  $$ select public.start_group_stage('60000000-0000-0000-0000-000000000001'::uuid, 'dungeon', 'test_dungeon', array['60000000-0000-0000-0000-000000000002'::uuid], 0, 7, 0, 'daily', null) $$,
  'start_group_stage: invalid duration'
);

-- 5. Downed character rejected.
insert into auth.users (id, email, raw_user_meta_data)
values ('60000000-0000-0000-0000-000000000011', 'start-2@test.local', jsonb_build_object('username', 'start_2'));
insert into public.player_characters (id, player_id, character_def_id, level, current_hp)
values ('60000000-0000-0000-0000-000000000012', '60000000-0000-0000-0000-000000000011', 'test_char', 15, 0);

select throws_ok(
  $$ select public.start_group_stage('60000000-0000-0000-0000-000000000011'::uuid, 'dungeon', 'test_dungeon', array['60000000-0000-0000-0000-000000000012'::uuid], 0, 7, 60, 'daily', null) $$,
  'start_group_stage: a character is not owned or is downed'
);

-- 6. Mission busy-check.
insert into auth.users (id, email, raw_user_meta_data)
values ('60000000-0000-0000-0000-000000000021', 'start-3@test.local', jsonb_build_object('username', 'start_3'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('60000000-0000-0000-0000-000000000022', '60000000-0000-0000-0000-000000000021', 'test_char', 15);
insert into public.mission_runs (player_id, mission_def_id, party, ends_at)
values ('60000000-0000-0000-0000-000000000021', 'test_mission', array['60000000-0000-0000-0000-000000000022'::uuid], now() + interval '1 hour');

select throws_ok(
  $$ select public.start_group_stage('60000000-0000-0000-0000-000000000021'::uuid, 'dungeon', 'test_dungeon', array['60000000-0000-0000-0000-000000000022'::uuid], 0, 7, 60, 'daily', null) $$,
  'start_group_stage: a character is on a mission'
);

-- 7. Gather busy-check.
insert into auth.users (id, email, raw_user_meta_data)
values ('60000000-0000-0000-0000-000000000031', 'start-4@test.local', jsonb_build_object('username', 'start_4'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('60000000-0000-0000-0000-000000000032', '60000000-0000-0000-0000-000000000031', 'test_char', 15);
insert into public.gather_assignments (player_id, player_character_id, resource_id)
values ('60000000-0000-0000-0000-000000000031', '60000000-0000-0000-0000-000000000032', 'Wood');

select throws_ok(
  $$ select public.start_group_stage('60000000-0000-0000-0000-000000000031'::uuid, 'dungeon', 'test_dungeon', array['60000000-0000-0000-0000-000000000032'::uuid], 0, 7, 60, 'daily', null) $$,
  'start_group_stage: a character is gathering'
);

-- 8. Infirmary busy-check.
insert into auth.users (id, email, raw_user_meta_data)
values ('60000000-0000-0000-0000-000000000041', 'start-5@test.local', jsonb_build_object('username', 'start_5'));
insert into public.player_characters (id, player_id, character_def_id, level, current_hp)
values ('60000000-0000-0000-0000-000000000042', '60000000-0000-0000-0000-000000000041', 'test_char', 15, 10);
insert into public.infirmary_admissions (player_id, player_character_id, hp_at_admission)
values ('60000000-0000-0000-0000-000000000041', '60000000-0000-0000-0000-000000000042', 10);

select throws_ok(
  $$ select public.start_group_stage('60000000-0000-0000-0000-000000000041'::uuid, 'dungeon', 'test_dungeon', array['60000000-0000-0000-0000-000000000042'::uuid], 0, 7, 60, 'daily', null) $$,
  'start_group_stage: a character is in the infirmary'
);

-- 9. Skill-training busy-check.
insert into auth.users (id, email, raw_user_meta_data)
values ('60000000-0000-0000-0000-000000000051', 'start-6@test.local', jsonb_build_object('username', 'start_6'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('60000000-0000-0000-0000-000000000052', '60000000-0000-0000-0000-000000000051', 'test_char', 15);
insert into public.skill_assignments (player_id, player_character_id, skill_key)
values ('60000000-0000-0000-0000-000000000051', '60000000-0000-0000-0000-000000000052', 'religion');

select throws_ok(
  $$ select public.start_group_stage('60000000-0000-0000-0000-000000000051'::uuid, 'dungeon', 'test_dungeon', array['60000000-0000-0000-0000-000000000052'::uuid], 0, 7, 60, 'daily', null) $$,
  'start_group_stage: a character is training a skill'
);

-- 10. Character busy in ANOTHER dungeon/raid.
insert into auth.users (id, email, raw_user_meta_data)
values ('60000000-0000-0000-0000-000000000061', 'start-7@test.local', jsonb_build_object('username', 'start_7'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('60000000-0000-0000-0000-000000000062', '60000000-0000-0000-0000-000000000061', 'test_char', 15);
insert into public.group_runs (player_id, kind, def_key, party, stage_ends_at)
values ('60000000-0000-0000-0000-000000000061', 'raid', 'other_raid', array['60000000-0000-0000-0000-000000000062'::uuid], now() + interval '1 hour');

select throws_ok(
  $$ select public.start_group_stage('60000000-0000-0000-0000-000000000061'::uuid, 'dungeon', 'test_dungeon', array['60000000-0000-0000-0000-000000000062'::uuid], 0, 7, 60, 'daily', null) $$,
  'start_group_stage: a character is in another dungeon or raid'
);

-- 11. Map gate not cleared.
insert into auth.users (id, email, raw_user_meta_data)
values ('60000000-0000-0000-0000-000000000071', 'start-8@test.local', jsonb_build_object('username', 'start_8'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('60000000-0000-0000-0000-000000000072', '60000000-0000-0000-0000-000000000071', 'test_char', 15);

select throws_ok(
  $$ select public.start_group_stage('60000000-0000-0000-0000-000000000071'::uuid, 'dungeon', 'test_dungeon', array['60000000-0000-0000-0000-000000000072'::uuid], 0, 7, 60, 'daily', 'gravemarch') $$,
  'start_group_stage: map not cleared'
);

-- 12. Map gate satisfied -> fresh run created.
update public.profiles set map_progress = jsonb_build_object('gravemarch', 7) where player_id = '60000000-0000-0000-0000-000000000071';

select is(
  (public.start_group_stage('60000000-0000-0000-0000-000000000071'::uuid, 'dungeon', 'test_dungeon', array['60000000-0000-0000-0000-000000000072'::uuid], 0, 7, 60, 'daily', 'gravemarch')).status,
  'in_progress',
  'start_group_stage creates a fresh run once the map gate is satisfied'
);

-- 13. Fresh-run creation shape (no gate) — status/stage-index/party/stage_ends_at.
select is(
  (select count(*)::int from public.group_runs where player_id = '60000000-0000-0000-0000-000000000001' and kind = 'dungeon' and def_key = 'fresh_test'),
  0,
  'sanity: no fresh_test run exists yet before creation'
);

select public.start_group_stage('60000000-0000-0000-0000-000000000001'::uuid, 'dungeon', 'fresh_test', array['60000000-0000-0000-0000-000000000002'::uuid], 0, 7, 60, 'daily', null);

select results_eq(
  $$ select status, current_stage_index, party, (stage_ends_at is not null) from public.group_runs where player_id = '60000000-0000-0000-0000-000000000001' and kind = 'dungeon' and def_key = 'fresh_test' $$,
  $$ values ('in_progress'::text, 0, array['60000000-0000-0000-0000-000000000002'::uuid], true) $$,
  'fresh run is created with the correct status/stage-index/party/stage_ends_at shape'
);

-- 14. Fresh run with nonzero p_stage_index rejected.
insert into auth.users (id, email, raw_user_meta_data)
values ('60000000-0000-0000-0000-000000000111', 'start-12@test.local', jsonb_build_object('username', 'start_12'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('60000000-0000-0000-0000-000000000112', '60000000-0000-0000-0000-000000000111', 'test_char', 15);

select throws_ok(
  $$ select public.start_group_stage('60000000-0000-0000-0000-000000000111'::uuid, 'raid', 'never_started', array['60000000-0000-0000-0000-000000000112'::uuid], 3, 7, 60, 'daily', null) $$,
  'start_group_stage: no run in progress'
);

-- 15. Double-start guard: a stage already in flight.
select throws_ok(
  $$ select public.start_group_stage('60000000-0000-0000-0000-000000000001'::uuid, 'dungeon', 'fresh_test', array['60000000-0000-0000-0000-000000000002'::uuid], 0, 7, 60, 'daily', null) $$,
  'start_group_stage: a stage is already in flight'
);

-- 16. Stage-index mismatch on an in-progress, not-in-flight run.
update public.group_runs
   set current_stage_index = 2, stage_started_at = null, stage_ends_at = null, party = '{}'
 where player_id = '60000000-0000-0000-0000-000000000001' and kind = 'dungeon' and def_key = 'fresh_test';

select throws_ok(
  $$ select public.start_group_stage('60000000-0000-0000-0000-000000000001'::uuid, 'dungeon', 'fresh_test', array['60000000-0000-0000-0000-000000000002'::uuid], 5, 7, 60, 'daily', null) $$,
  'start_group_stage: wrong stage index for this run'
);

-- 17. Daily lockout: still locked.
insert into auth.users (id, email, raw_user_meta_data)
values ('60000000-0000-0000-0000-000000000081', 'start-9@test.local', jsonb_build_object('username', 'start_9'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('60000000-0000-0000-0000-000000000082', '60000000-0000-0000-0000-000000000081', 'test_char', 15);
insert into public.group_runs (player_id, kind, def_key, current_stage_index, status, party, last_cleared_at)
values ('60000000-0000-0000-0000-000000000081', 'dungeon', 'locked_daily', 3, 'complete', '{}',
        date_trunc('day', now() at time zone 'UTC') at time zone 'UTC');

select throws_ok(
  $$ select public.start_group_stage('60000000-0000-0000-0000-000000000081'::uuid, 'dungeon', 'locked_daily', array['60000000-0000-0000-0000-000000000082'::uuid], 0, 7, 60, 'daily', null) $$
);

-- 18. Daily lockout: reset boundary passed, run resets to a fresh stage 0.
insert into auth.users (id, email, raw_user_meta_data)
values ('60000000-0000-0000-0000-000000000091', 'start-10@test.local', jsonb_build_object('username', 'start_10'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('60000000-0000-0000-0000-000000000092', '60000000-0000-0000-0000-000000000091', 'test_char', 15);
insert into public.group_runs (player_id, kind, def_key, current_stage_index, status, party, last_cleared_at)
values ('60000000-0000-0000-0000-000000000091', 'dungeon', 'unlocked_daily', 3, 'complete', '{}',
        now() at time zone 'UTC' - interval '2 days');

select results_eq(
  $$ select status, current_stage_index from public.group_runs where player_id = '60000000-0000-0000-0000-000000000091' and kind = 'dungeon' and def_key = 'unlocked_daily' $$,
  $$ values ('complete'::text, 3) $$,
  'sanity: run is complete/stage-3 before the reset call'
);

select public.start_group_stage('60000000-0000-0000-0000-000000000091'::uuid, 'dungeon', 'unlocked_daily', array['60000000-0000-0000-0000-000000000092'::uuid], 0, 7, 60, 'daily', null);

select results_eq(
  $$ select status, current_stage_index, last_cleared_at from public.group_runs where player_id = '60000000-0000-0000-0000-000000000091' and kind = 'dungeon' and def_key = 'unlocked_daily' $$,
  $$ values ('in_progress'::text, 0, null::timestamptz) $$,
  'past the reset boundary, a fresh run resets status/stage-index/last_cleared_at correctly'
);

-- 19. Weekly lockout: still locked (further out than the daily boundary).
insert into auth.users (id, email, raw_user_meta_data)
values ('60000000-0000-0000-0000-000000000101', 'start-11@test.local', jsonb_build_object('username', 'start_11'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('60000000-0000-0000-0000-000000000102', '60000000-0000-0000-0000-000000000101', 'test_char', 15);
insert into public.group_runs (player_id, kind, def_key, current_stage_index, status, party, last_cleared_at)
values ('60000000-0000-0000-0000-000000000101', 'raid', 'locked_weekly', 3, 'complete', '{}',
        date_trunc('day', now() at time zone 'UTC') at time zone 'UTC');

select throws_ok(
  $$ select public.start_group_stage('60000000-0000-0000-0000-000000000101'::uuid, 'raid', 'locked_weekly', array['60000000-0000-0000-0000-000000000102'::uuid], 0, 7, 60, 'weekly', null) $$
);

select * from finish();
rollback;
