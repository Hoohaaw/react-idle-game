-- claim_group_stage: not-claimable guards (no run / not started / not finished), the double-claim
-- guard, win/loss state transitions (advance vs complete vs retry-same-stage), char_updates,
-- loot/currency/resource application on win (and non-application on loss), the unconditional
-- lifetime_stats plumbing, and the level-cap achievement counter. Fixture convention: one
-- player+character(s) per scenario.
begin;
select plan(14);

-- 1. Not claimable: no run at all.
insert into auth.users (id, email, raw_user_meta_data)
values ('70000000-0000-0000-0000-000000000001', 'claim-1@test.local', jsonb_build_object('username', 'claim_1'));

select throws_ok(
  $$ select public.claim_group_stage('70000000-0000-0000-0000-000000000001'::uuid, 'dungeon', 'no_such_run', true, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, false) $$,
  'claim_group_stage: not claimable (no run, not finished, or already claimed)'
);

-- 2. Not claimable: run exists but never started (stage_ends_at null).
insert into public.group_runs (player_id, kind, def_key, current_stage_index, status, party)
values ('70000000-0000-0000-0000-000000000001', 'dungeon', 'not_started', 0, 'in_progress', '{}');

select throws_ok(
  $$ select public.claim_group_stage('70000000-0000-0000-0000-000000000001'::uuid, 'dungeon', 'not_started', true, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, false) $$,
  'claim_group_stage: not claimable (no run, not finished, or already claimed)'
);

-- 3. Not claimable: stage not finished yet (stage_ends_at in the future).
insert into public.group_runs (player_id, kind, def_key, current_stage_index, status, party, stage_started_at, stage_ends_at)
values ('70000000-0000-0000-0000-000000000001', 'dungeon', 'not_finished', 0, 'in_progress', '{}', now(), now() + interval '1 hour');

select throws_ok(
  $$ select public.claim_group_stage('70000000-0000-0000-0000-000000000001'::uuid, 'dungeon', 'not_finished', true, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, false) $$,
  'claim_group_stage: not claimable (no run, not finished, or already claimed)'
);

-- 4/5. Double-claim guard + win/not-last-stage advances current_stage_index.
insert into auth.users (id, email, raw_user_meta_data)
values ('70000000-0000-0000-0000-000000000011', 'claim-2@test.local', jsonb_build_object('username', 'claim_2'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('70000000-0000-0000-0000-000000000012', '70000000-0000-0000-0000-000000000011', 'test_char', 15);
insert into public.group_runs (player_id, kind, def_key, current_stage_index, status, party, stage_started_at, stage_ends_at)
values ('70000000-0000-0000-0000-000000000011', 'dungeon', 'win_advance', 2, 'in_progress',
        array['70000000-0000-0000-0000-000000000012'::uuid], now() - interval '1 minute', now() - interval '1 second');

select public.claim_group_stage('70000000-0000-0000-0000-000000000011'::uuid, 'dungeon', 'win_advance', true, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, false);

select results_eq(
  $$ select current_stage_index, status, party, (stage_ends_at is null) from public.group_runs where player_id = '70000000-0000-0000-0000-000000000011' and kind = 'dungeon' and def_key = 'win_advance' $$,
  $$ values (3, 'in_progress'::text, '{}'::uuid[], true) $$,
  'winning a non-last stage advances current_stage_index by 1, clears party/timestamps, keeps status in_progress'
);

select throws_ok(
  $$ select public.claim_group_stage('70000000-0000-0000-0000-000000000011'::uuid, 'dungeon', 'win_advance', true, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, false) $$,
  'claim_group_stage: not claimable (no run, not finished, or already claimed)'
);

-- 6. Win, last stage: run completes.
insert into auth.users (id, email, raw_user_meta_data)
values ('70000000-0000-0000-0000-000000000021', 'claim-3@test.local', jsonb_build_object('username', 'claim_3'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('70000000-0000-0000-0000-000000000022', '70000000-0000-0000-0000-000000000021', 'test_char', 15);
insert into public.group_runs (player_id, kind, def_key, current_stage_index, status, party, stage_started_at, stage_ends_at)
values ('70000000-0000-0000-0000-000000000021', 'raid', 'win_complete', 6, 'in_progress',
        array['70000000-0000-0000-0000-000000000022'::uuid], now() - interval '1 minute', now() - interval '1 second');

select public.claim_group_stage('70000000-0000-0000-0000-000000000021'::uuid, 'raid', 'win_complete', true, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, true);

select results_eq(
  $$ select status, party, (last_cleared_at is not null) from public.group_runs where player_id = '70000000-0000-0000-0000-000000000021' and kind = 'raid' and def_key = 'win_complete' $$,
  $$ values ('complete'::text, '{}'::uuid[], true) $$,
  'winning the last stage completes the run and sets last_cleared_at'
);

-- 7. Loss: same stage, party freed, status unchanged.
insert into auth.users (id, email, raw_user_meta_data)
values ('70000000-0000-0000-0000-000000000031', 'claim-4@test.local', jsonb_build_object('username', 'claim_4'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('70000000-0000-0000-0000-000000000032', '70000000-0000-0000-0000-000000000031', 'test_char', 15);
insert into public.group_runs (player_id, kind, def_key, current_stage_index, status, party, stage_started_at, stage_ends_at)
values ('70000000-0000-0000-0000-000000000031', 'dungeon', 'lose_retry', 4, 'in_progress',
        array['70000000-0000-0000-0000-000000000032'::uuid], now() - interval '1 minute', now() - interval '1 second');

select public.claim_group_stage('70000000-0000-0000-0000-000000000031'::uuid, 'dungeon', 'lose_retry', false, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, false);

select results_eq(
  $$ select current_stage_index, status, party, (stage_ends_at is null) from public.group_runs where player_id = '70000000-0000-0000-0000-000000000031' and kind = 'dungeon' and def_key = 'lose_retry' $$,
  $$ values (4, 'in_progress'::text, '{}'::uuid[], true) $$,
  'losing keeps the same stage index and status, only clears the party/timestamps for a retry'
);

-- 8. char_updates writes level/xp/current_hp.
insert into auth.users (id, email, raw_user_meta_data)
values ('70000000-0000-0000-0000-000000000041', 'claim-5@test.local', jsonb_build_object('username', 'claim_5'));
insert into public.player_characters (id, player_id, character_def_id, level, xp)
values ('70000000-0000-0000-0000-000000000042', '70000000-0000-0000-0000-000000000041', 'test_char', 10, 0);
insert into public.group_runs (player_id, kind, def_key, current_stage_index, status, party, stage_started_at, stage_ends_at)
values ('70000000-0000-0000-0000-000000000041', 'dungeon', 'char_updates', 0, 'in_progress',
        array['70000000-0000-0000-0000-000000000042'::uuid], now() - interval '1 minute', now() - interval '1 second');

select public.claim_group_stage(
  '70000000-0000-0000-0000-000000000041'::uuid, 'dungeon', 'char_updates', true,
  jsonb_build_array(jsonb_build_object('id', '70000000-0000-0000-0000-000000000042', 'level', 12, 'xp', 340, 'current_hp', 55)),
  '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, false
);

select results_eq(
  $$ select level, xp, current_hp from public.player_characters where id = '70000000-0000-0000-0000-000000000042' $$,
  $$ values (12, 340, 55) $$,
  'claim_group_stage writes char_updates onto the named character'
);

-- 9. Win applies loot (fresh stack + incrementing an existing one) and currency/resource gains.
insert into auth.users (id, email, raw_user_meta_data)
values ('70000000-0000-0000-0000-000000000051', 'claim-6@test.local', jsonb_build_object('username', 'claim_6'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('70000000-0000-0000-0000-000000000052', '70000000-0000-0000-0000-000000000051', 'test_char', 15);
insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
values ('70000000-0000-0000-0000-000000000051', 'existing-loot', 'Rare', 3);
insert into public.group_runs (player_id, kind, def_key, current_stage_index, status, party, stage_started_at, stage_ends_at)
values ('70000000-0000-0000-0000-000000000051', 'dungeon', 'loot_win', 0, 'in_progress',
        array['70000000-0000-0000-0000-000000000052'::uuid], now() - interval '1 minute', now() - interval '1 second');

select public.claim_group_stage(
  '70000000-0000-0000-0000-000000000051'::uuid, 'dungeon', 'loot_win', true, '[]'::jsonb,
  jsonb_build_array(
    jsonb_build_object('item_def_id', 'fresh-loot', 'rarity', 'Common', 'quantity', 2),
    jsonb_build_object('item_def_id', 'existing-loot', 'rarity', 'Rare', 'quantity', 5)
  ),
  jsonb_build_object('gold', 50), jsonb_build_object('Wood', 10), false
);

select results_eq(
  $$ select item_def_id, rarity, quantity from public.player_inventory where player_id = '70000000-0000-0000-0000-000000000051' order by item_def_id $$,
  $$ values ('existing-loot'::text, 'Rare'::text, 8), ('fresh-loot'::text, 'Common'::text, 2) $$,
  'win claim upserts loot: a fresh stack is created, an existing stack is incremented'
);

select results_eq(
  $$ select (currencies->>'gold')::int, (resources->>'Wood')::int from public.profiles where player_id = '70000000-0000-0000-0000-000000000051' $$,
  $$ values (50, 10) $$,
  'win claim increments currencies and resources by the given amounts'
);

-- 10. Loss does NOT apply loot/currency/resources even when provided.
insert into auth.users (id, email, raw_user_meta_data)
values ('70000000-0000-0000-0000-000000000061', 'claim-7@test.local', jsonb_build_object('username', 'claim_7'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('70000000-0000-0000-0000-000000000062', '70000000-0000-0000-0000-000000000061', 'test_char', 15);
insert into public.group_runs (player_id, kind, def_key, current_stage_index, status, party, stage_started_at, stage_ends_at)
values ('70000000-0000-0000-0000-000000000061', 'dungeon', 'loot_loss', 0, 'in_progress',
        array['70000000-0000-0000-0000-000000000062'::uuid], now() - interval '1 minute', now() - interval '1 second');

select public.claim_group_stage(
  '70000000-0000-0000-0000-000000000061'::uuid, 'dungeon', 'loot_loss', false, '[]'::jsonb,
  jsonb_build_array(jsonb_build_object('item_def_id', 'should-not-appear', 'rarity', 'Common', 'quantity', 1)),
  jsonb_build_object('gold', 999), jsonb_build_object('Wood', 999), false
);

select is(
  (select count(*)::int from public.player_inventory where player_id = '70000000-0000-0000-0000-000000000061'),
  0,
  'a loss does not apply loot even when p_loot is non-empty'
);

select is(
  (select coalesce((currencies->>'gold')::int, 0) from public.profiles where player_id = '70000000-0000-0000-0000-000000000061'),
  0,
  'a loss does not apply currency gains even when p_currencies is non-empty'
);

-- 11. lifetime_stats increments apply unconditionally, even on a loss.
insert into auth.users (id, email, raw_user_meta_data)
values ('70000000-0000-0000-0000-000000000071', 'claim-8@test.local', jsonb_build_object('username', 'claim_8'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('70000000-0000-0000-0000-000000000072', '70000000-0000-0000-0000-000000000071', 'test_char', 15);
insert into public.group_runs (player_id, kind, def_key, current_stage_index, status, party, stage_started_at, stage_ends_at)
values ('70000000-0000-0000-0000-000000000071', 'dungeon', 'lifetime_stats_loss', 0, 'in_progress',
        array['70000000-0000-0000-0000-000000000072'::uuid], now() - interval '1 minute', now() - interval '1 second');

select public.claim_group_stage(
  '70000000-0000-0000-0000-000000000071'::uuid, 'dungeon', 'lifetime_stats_loss', false, '[]'::jsonb,
  '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, false, jsonb_build_object('dungeonsAttempted', 1)
);

select is(
  (select (lifetime_stats->>'dungeonsAttempted')::int from public.profiles where player_id = '70000000-0000-0000-0000-000000000071'),
  1,
  'lifetime_stats increments apply even on a loss'
);

-- 12. A character reaching level 50 via char_updates bumps charactersReachedLevelCap.
insert into auth.users (id, email, raw_user_meta_data)
values ('70000000-0000-0000-0000-000000000081', 'claim-9@test.local', jsonb_build_object('username', 'claim_9'));
insert into public.player_characters (id, player_id, character_def_id, level, xp)
values ('70000000-0000-0000-0000-000000000082', '70000000-0000-0000-0000-000000000081', 'test_char', 49, 0);
insert into public.group_runs (player_id, kind, def_key, current_stage_index, status, party, stage_started_at, stage_ends_at)
values ('70000000-0000-0000-0000-000000000081', 'dungeon', 'level_cap', 0, 'in_progress',
        array['70000000-0000-0000-0000-000000000082'::uuid], now() - interval '1 minute', now() - interval '1 second');

select public.claim_group_stage(
  '70000000-0000-0000-0000-000000000081'::uuid, 'dungeon', 'level_cap', true,
  jsonb_build_array(jsonb_build_object('id', '70000000-0000-0000-0000-000000000082', 'level', 50, 'xp', 0, 'current_hp', null)),
  '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, false
);

select is(
  (select (achievement_counters->>'charactersReachedLevelCap')::int from public.profiles where player_id = '70000000-0000-0000-0000-000000000081'),
  1,
  'a character reaching level 50 via char_updates bumps achievement_counters.charactersReachedLevelCap'
);

select * from finish();
rollback;
