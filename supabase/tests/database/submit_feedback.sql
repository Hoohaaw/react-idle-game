-- submit_feedback: validation, the 1000-char cap, and the 5-minute per-player cooldown
-- (TODO.md D9). Fixture convention: one player per scenario, per the project's other pgTAP files.
begin;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data)
values ('80000000-0000-0000-0000-000000000001', 'feedback-1@test.local', jsonb_build_object('username', 'feedback_1'));

-- 1. Empty message rejected.
select throws_ok(
  $$ select public.submit_feedback('80000000-0000-0000-0000-000000000001'::uuid, '') $$,
  'submit_feedback: message is required'
);

-- 2. Whitespace-only message rejected (trimmed before the length check).
select throws_ok(
  $$ select public.submit_feedback('80000000-0000-0000-0000-000000000001'::uuid, '   ') $$,
  'submit_feedback: message is required'
);

-- 3. Over-length message rejected (1001 chars).
select throws_ok(
  $$ select public.submit_feedback('80000000-0000-0000-0000-000000000001'::uuid, repeat('a', 1001)) $$,
  'submit_feedback: message is too long (max 1000 characters)'
);

-- 4. Happy path: first submission succeeds and is trimmed.
select is(
  (public.submit_feedback('80000000-0000-0000-0000-000000000001'::uuid, '  Found a bug in the mines page.  ')).message,
  'Found a bug in the mines page.',
  'submit_feedback inserts the trimmed message'
);

-- 5. A second submission immediately after is rate-limited.
select throws_ok(
  $$ select public.submit_feedback('80000000-0000-0000-0000-000000000001'::uuid, 'Another message') $$,
  'submit_feedback: please wait a few minutes before submitting again'
);

-- 6. After the cooldown window elapses, a new submission succeeds. Backdates the existing row
-- rather than waiting 5 real minutes.
update public.feedback_submissions
   set created_at = now() - interval '6 minutes'
 where player_id = '80000000-0000-0000-0000-000000000001';

select is(
  (public.submit_feedback('80000000-0000-0000-0000-000000000001'::uuid, 'Second message, after cooldown')).message,
  'Second message, after cooldown',
  'submit_feedback succeeds again once the cooldown has elapsed'
);

-- 7. Both submissions are on record.
select is(
  (select count(*)::int from public.feedback_submissions where player_id = '80000000-0000-0000-0000-000000000001'),
  2,
  'both submissions are persisted'
);

select * from finish();
rollback;
