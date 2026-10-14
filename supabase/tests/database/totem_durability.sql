-- Totem durability (mission-prep spec): claim_mission decrements profiles.totem_charges for the
-- currently-equipped totem by 1 per claim (win or loss alike — these scenarios don't vary p_won,
-- since durability consumption doesn't depend on outcome). A missing totem_charges entry defaults
-- to 3 before decrementing. At 0 remaining the totem breaks: its charges entry is removed, one
-- copy is removed from player_inventory (or the row deleted if that was the last copy), and
-- active_totem_id is cleared to null. A claim with no totem equipped leaves totem_charges
-- completely untouched. Fixture convention: one player+character+mission_run per scenario (see
-- docs/TESTING.md) — each scenario's claim_mission call uses an empty p_char_updates/p_loot/
-- p_currencies/p_resources, since none of that is relevant to totem durability.
begin;
select plan(7);

-- 1. Decrementing an existing totem_charges entry by 1.
insert into auth.users (id, email, raw_user_meta_data)
values ('80000000-0000-0000-0000-000000000001', 'totem-dur-1@test.local', jsonb_build_object('username', 'totem_dur_1'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', 'test_char', 10);
insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
values ('80000000-0000-0000-0000-000000000001', 'test-totem-1', 'Common', 1);
update public.profiles
   set active_totem_id = 'test-totem-1', totem_charges = jsonb_build_object('test-totem-1', 2)
 where player_id = '80000000-0000-0000-0000-000000000001';
insert into public.mission_runs (id, player_id, mission_def_id, party, ends_at)
values ('80000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000001', 'test_mission',
        array['80000000-0000-0000-0000-000000000002'::uuid], now() - interval '1 minute');

select public.claim_mission(
  '80000000-0000-0000-0000-000000000001'::uuid, '80000000-0000-0000-0000-000000000003'::uuid,
  '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb
);

select is(
  (select (totem_charges->>'test-totem-1')::int from public.profiles where player_id = '80000000-0000-0000-0000-000000000001'),
  1,
  'claim_mission decrements an existing totem_charges entry by 1'
);

-- 2. A missing totem_charges entry defaults to 3 before decrementing (reads 2 after one claim).
insert into auth.users (id, email, raw_user_meta_data)
values ('80000000-0000-0000-0000-000000000011', 'totem-dur-2@test.local', jsonb_build_object('username', 'totem_dur_2'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('80000000-0000-0000-0000-000000000012', '80000000-0000-0000-0000-000000000011', 'test_char', 10);
insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
values ('80000000-0000-0000-0000-000000000011', 'test-totem-2', 'Common', 1);
update public.profiles
   set active_totem_id = 'test-totem-2'
 where player_id = '80000000-0000-0000-0000-000000000011';
insert into public.mission_runs (id, player_id, mission_def_id, party, ends_at)
values ('80000000-0000-0000-0000-000000000013', '80000000-0000-0000-0000-000000000011', 'test_mission',
        array['80000000-0000-0000-0000-000000000012'::uuid], now() - interval '1 minute');

select public.claim_mission(
  '80000000-0000-0000-0000-000000000011'::uuid, '80000000-0000-0000-0000-000000000013'::uuid,
  '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb
);

select is(
  (select (totem_charges->>'test-totem-2')::int from public.profiles where player_id = '80000000-0000-0000-0000-000000000011'),
  2,
  'a missing totem_charges entry defaults to 3 before decrementing, reading 2 after one claim'
);

-- 3. At 0 remaining the totem breaks: charges entry removed, active_totem_id cleared, and the
--    LAST copy in player_inventory is deleted (quantity was 1).
insert into auth.users (id, email, raw_user_meta_data)
values ('80000000-0000-0000-0000-000000000021', 'totem-dur-3@test.local', jsonb_build_object('username', 'totem_dur_3'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('80000000-0000-0000-0000-000000000022', '80000000-0000-0000-0000-000000000021', 'test_char', 10);
insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
values ('80000000-0000-0000-0000-000000000021', 'test-totem-3', 'Common', 1);
update public.profiles
   set active_totem_id = 'test-totem-3', totem_charges = jsonb_build_object('test-totem-3', 1)
 where player_id = '80000000-0000-0000-0000-000000000021';
insert into public.mission_runs (id, player_id, mission_def_id, party, ends_at)
values ('80000000-0000-0000-0000-000000000023', '80000000-0000-0000-0000-000000000021', 'test_mission',
        array['80000000-0000-0000-0000-000000000022'::uuid], now() - interval '1 minute');

select public.claim_mission(
  '80000000-0000-0000-0000-000000000021'::uuid, '80000000-0000-0000-0000-000000000023'::uuid,
  '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb
);

select is(
  (select totem_charges ? 'test-totem-3' from public.profiles where player_id = '80000000-0000-0000-0000-000000000021'),
  false,
  'a broken totem''s charges entry is removed'
);

select is(
  (select active_totem_id from public.profiles where player_id = '80000000-0000-0000-0000-000000000021'),
  null,
  'a broken totem clears active_totem_id to null'
);

select is(
  (select count(*)::int from public.player_inventory
    where player_id = '80000000-0000-0000-0000-000000000021' and item_def_id = 'test-totem-3' and rarity = 'Common'),
  0,
  'breaking the last copy of a totem deletes its player_inventory row'
);

-- 4. Breaking a totem with more than one copy owned decrements the stack instead of deleting it.
insert into auth.users (id, email, raw_user_meta_data)
values ('80000000-0000-0000-0000-000000000031', 'totem-dur-4@test.local', jsonb_build_object('username', 'totem_dur_4'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('80000000-0000-0000-0000-000000000032', '80000000-0000-0000-0000-000000000031', 'test_char', 10);
insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
values ('80000000-0000-0000-0000-000000000031', 'test-totem-4', 'Common', 2);
update public.profiles
   set active_totem_id = 'test-totem-4', totem_charges = jsonb_build_object('test-totem-4', 1)
 where player_id = '80000000-0000-0000-0000-000000000031';
insert into public.mission_runs (id, player_id, mission_def_id, party, ends_at)
values ('80000000-0000-0000-0000-000000000033', '80000000-0000-0000-0000-000000000031', 'test_mission',
        array['80000000-0000-0000-0000-000000000032'::uuid], now() - interval '1 minute');

select public.claim_mission(
  '80000000-0000-0000-0000-000000000031'::uuid, '80000000-0000-0000-0000-000000000033'::uuid,
  '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb
);

select is(
  (select quantity from public.player_inventory
    where player_id = '80000000-0000-0000-0000-000000000031' and item_def_id = 'test-totem-4' and rarity = 'Common'),
  1,
  'breaking a totem with 2+ copies owned decrements the stack instead of deleting the row'
);

-- 5. A claim with NO totem equipped leaves totem_charges completely untouched.
insert into auth.users (id, email, raw_user_meta_data)
values ('80000000-0000-0000-0000-000000000041', 'totem-dur-5@test.local', jsonb_build_object('username', 'totem_dur_5'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('80000000-0000-0000-0000-000000000042', '80000000-0000-0000-0000-000000000041', 'test_char', 10);
update public.profiles
   set active_totem_id = null, totem_charges = jsonb_build_object('some-other-totem', 1)
 where player_id = '80000000-0000-0000-0000-000000000041';
insert into public.mission_runs (id, player_id, mission_def_id, party, ends_at)
values ('80000000-0000-0000-0000-000000000043', '80000000-0000-0000-0000-000000000041', 'test_mission',
        array['80000000-0000-0000-0000-000000000042'::uuid], now() - interval '1 minute');

select public.claim_mission(
  '80000000-0000-0000-0000-000000000041'::uuid, '80000000-0000-0000-0000-000000000043'::uuid,
  '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb
);

select is(
  (select totem_charges from public.profiles where player_id = '80000000-0000-0000-0000-000000000041'),
  jsonb_build_object('some-other-totem', 1),
  'a claim with no totem equipped leaves totem_charges completely untouched'
);

select * from finish();
rollback;
