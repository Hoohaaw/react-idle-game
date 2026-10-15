-- upgrade_infirmary: goldSpent lifetime-stat tracking (TODO.md "Expand lifetime stats tracking"
-- queue). Narrow scope — this is the only pgTAP coverage for upgrade_infirmary in this repo;
-- it does not re-test the pre-existing funds/sequential-level checks, only the new param.
begin;
select plan(2);

insert into auth.users (id, email, raw_user_meta_data)
values ('60000000-0000-0000-0000-000000000001', 'infirmary-lifetime-1@test.local', jsonb_build_object('username', 'infirmary_lifetime_1'));
update public.profiles
   set currencies = jsonb_build_object('gold', 500),
       resources  = jsonb_build_object('Wood', 100)
 where player_id = '60000000-0000-0000-0000-000000000001';

select public.upgrade_infirmary(
  '60000000-0000-0000-0000-000000000001'::uuid,
  2,
  jsonb_build_object('gold', 100),
  jsonb_build_object('Wood', 50),
  '[]'::jsonb,
  jsonb_build_object('goldSpent', 100)
);

select is(
  (select infirmary_level from public.profiles where player_id = '60000000-0000-0000-0000-000000000001'),
  2,
  'upgrade_infirmary still increments infirmary_level with the new param present'
);

select is(
  (select (lifetime_stats->>'goldSpent')::int from public.profiles where player_id = '60000000-0000-0000-0000-000000000001'),
  100,
  'upgrade_infirmary increments lifetime_stats.goldSpent by the passed amount'
);

select * from finish();
rollback;
