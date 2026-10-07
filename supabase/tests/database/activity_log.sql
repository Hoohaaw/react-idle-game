-- log_event: insert + retention-cap-at-200 behavior. RLS/grant posture (the select policy scoped
-- to auth.uid(), the required `grant select ... to authenticated`, and the absence of any client
-- write grant) is covered structurally by src/test/migration-policy.test.ts's existing static
-- checks — none of the other files under this directory role-switch to test row-level policy
-- enforcement for any table, so a new pattern isn't introduced here either.
begin;
select plan(4);

insert into auth.users (id, email, raw_user_meta_data)
values ('60000000-0000-0000-0000-000000000001', 'activity-1@test.local', jsonb_build_object('username', 'activity_1'));

-- 1. Inserts a row with the given type/payload.
select public.log_event(
  '60000000-0000-0000-0000-000000000001'::uuid, 'mission_started'::text, jsonb_build_object('missionName', 'Goblin Outpost')
);

select is(
  (select payload->>'missionName' from public.player_events
    where player_id = '60000000-0000-0000-0000-000000000001' and type = 'mission_started'),
  'Goblin Outpost',
  'log_event inserts a row with the given type and payload'
);

-- 2. Retention cap: bulk-seed 200 older rows directly (cheap fixture setup, same convention
-- respec_blessings.sql uses for its own fixtures), spaced a minute apart so ordering is
-- deterministic, then call log_event a 201st time and confirm the count stays at 200.
delete from public.player_events where player_id = '60000000-0000-0000-0000-000000000001';

insert into public.player_events (player_id, type, payload, created_at)
select '60000000-0000-0000-0000-000000000001'::uuid, 'gather_collected', '{}'::jsonb,
       now() - (n || ' minutes')::interval
from generate_series(1, 200) as n;

select public.log_event('60000000-0000-0000-0000-000000000001'::uuid, 'mission_started'::text, '{}'::jsonb);

select is(
  (select count(*)::int from public.player_events where player_id = '60000000-0000-0000-0000-000000000001'),
  200,
  'log_event prunes back to 200 rows after a 201st insert'
);

-- 3. The pruned row is specifically the OLDEST one (seeded 200 minutes ago), not an arbitrary one.
select is(
  (select count(*)::int from public.player_events
    where player_id = '60000000-0000-0000-0000-000000000001'
      and created_at <= now() - interval '199 minutes 30 seconds'),
  0,
  'the oldest row (200 minutes old) was the one pruned'
);

-- 4. A second player's events are untouched by the first player's prune.
insert into auth.users (id, email, raw_user_meta_data)
values ('60000000-0000-0000-0000-000000000002', 'activity-2@test.local', jsonb_build_object('username', 'activity_2'));
select public.log_event('60000000-0000-0000-0000-000000000002'::uuid, 'mission_started'::text, '{}'::jsonb);

select is(
  (select count(*)::int from public.player_events where player_id = '60000000-0000-0000-0000-000000000002'),
  1,
  'the cap is scoped per-player, not global'
);

select * from finish();
rollback;
