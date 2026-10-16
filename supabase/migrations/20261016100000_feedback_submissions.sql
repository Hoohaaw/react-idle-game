-- feedback_submissions: a player support/feedback mailbox (TODO.md D9 — "no contact form, no
-- Discord/social links anywhere in the app"). Alex reads submissions from the Supabase dashboard;
-- no in-app "view my past submissions" UI is planned, but owner-read is still granted to match
-- this project's standing rule (CLAUDE.md: "Every gameplay table = RLS owner-read + explicit
-- GRANTs + no client write").
create table public.feedback_submissions (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references auth.users (id) on delete cascade,
  message    text not null check (length(message) > 0 and length(message) <= 1000),
  created_at timestamptz not null default now()
);

comment on table public.feedback_submissions is
  'Player-submitted support/feedback messages. All writes via submit_feedback (service role) — never a direct client insert. Read in the Supabase dashboard.';

create index feedback_submissions_player_created_idx
  on public.feedback_submissions (player_id, created_at desc);

alter table public.feedback_submissions enable row level security;

grant select on public.feedback_submissions to authenticated;

create policy "feedback_submissions_select_own"
  on public.feedback_submissions for select to authenticated
  using (player_id = (select auth.uid()));
-- Intentionally NO client insert/update/delete policy (ADR-0003).

create or replace function public.submit_feedback(
  p_player  uuid,
  p_message text
) returns public.feedback_submissions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_last timestamptz;
  v_row  public.feedback_submissions;
begin
  if p_message is null or length(trim(p_message)) = 0 then
    raise exception 'submit_feedback: message is required';
  end if;
  if length(p_message) > 1000 then
    raise exception 'submit_feedback: message is too long (max 1000 characters)';
  end if;

  -- Rate limit: at most one submission every 5 minutes per player. No row lock here —
  -- deliberately: this guards against spam, not a financial exploit, so the tiny race window
  -- of two near-simultaneous submissions both slipping through is an accepted tradeoff rather
  -- than the for-update-on-read discipline the money-moving RPCs need.
  select created_at into v_last
    from public.feedback_submissions
   where player_id = p_player
   order by created_at desc
   limit 1;

  if v_last is not null and now() - v_last < interval '5 minutes' then
    raise exception 'submit_feedback: please wait a few minutes before submitting again';
  end if;

  insert into public.feedback_submissions (player_id, message)
  values (p_player, trim(p_message))
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.submit_feedback(uuid, text) from public, anon, authenticated;
grant execute on function public.submit_feedback(uuid, text) to service_role;
