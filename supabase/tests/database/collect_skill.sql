-- collect_skill: goldSpent's sibling — per-skill time/XP lifetime-stat tracking (TODO.md
-- "Expand lifetime stats tracking" queue). Narrow scope — this is the only pgTAP coverage for
-- collect_skill in this repo; it does not re-test ownership/ambient skill-leveling behavior.
begin;
select plan(3);

insert into auth.users (id, email, raw_user_meta_data)
values ('70000000-0000-0000-0000-000000000001', 'skill-lifetime-1@test.local', jsonb_build_object('username', 'skill_lifetime_1'));
insert into public.player_characters (id, player_id, character_def_id, level)
values ('70000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', 'test_char', 10);
insert into public.skill_assignments (id, player_id, player_character_id, skill_key)
values ('70000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', 'religion');

select public.collect_skill(
  '70000000-0000-0000-0000-000000000001'::uuid,
  '70000000-0000-0000-0000-000000000003'::uuid,
  'religion', 2, 30, now(), false,
  jsonb_build_object('skillSecondsSpent.religion', 90, 'skillXpEarned.religion', 45)
);

select is(
  (select (lifetime_stats->>'skillSecondsSpent.religion')::int from public.profiles where player_id = '70000000-0000-0000-0000-000000000001'),
  90,
  'collect_skill increments the dynamic skillSecondsSpent.<skillKey> key'
);

select is(
  (select (lifetime_stats->>'skillXpEarned.religion')::int from public.profiles where player_id = '70000000-0000-0000-0000-000000000001'),
  45,
  'collect_skill increments the dynamic skillXpEarned.<skillKey> key'
);

-- A second collect accumulates rather than overwrites.
select public.collect_skill(
  '70000000-0000-0000-0000-000000000001'::uuid,
  '70000000-0000-0000-0000-000000000003'::uuid,
  'religion', 2, 60, now(), false,
  jsonb_build_object('skillSecondsSpent.religion', 30, 'skillXpEarned.religion', 15)
);

select is(
  (select (lifetime_stats->>'skillSecondsSpent.religion')::int from public.profiles where player_id = '70000000-0000-0000-0000-000000000001'),
  120,
  'a second collect accumulates onto the existing total rather than overwriting it'
);

select * from finish();
rollback;
