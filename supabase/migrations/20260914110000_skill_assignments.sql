-- Indefinite skill assignments (docs/superpowers/specs/2026-09-14-skill-assignments-design.md).
-- Adds per-character skill level/XP storage + the skill_assignments activity table. Mirrors
-- gather_assignments (20260612180001_activities.sql) — same shape, same RLS/grant pattern — but
-- with NO per-skill-node scarcity: any number of characters can train the same skill at once,
-- since skill XP is per-character, not a shared pool (unlike a mine's one-gatherer-per-node rule).

alter table public.player_characters
  add column skills jsonb not null default '{}';

comment on column public.player_characters.skills is
  'Per-character skill level/XP map, e.g. {"religion": {"level": 1, "xp": 0}}. Independent of the
   character''s own level/xp (leveling.ts) — a level-50 character can still train skills. Written
   only by collect_skill (ADR-0003); a missing key means untrained, treated client/server-side as
   {level: 1, xp: 0}.';

create table public.skill_assignments (
  id                  uuid primary key default gen_random_uuid(),
  player_id           uuid not null references auth.users (id) on delete cascade,
  player_character_id uuid not null references public.player_characters (id) on delete cascade,
  skill_key           text not null,
  last_collected_at   timestamptz not null default now(),

  unique (player_character_id) -- a character trains at most one skill at a time
);

comment on table public.skill_assignments is
  'A character continuously training a skill (docs/superpowers/specs/2026-09-14-skill-assignments-design.md).
   Accrual computed server-side from elapsed ticks (src/lib/skills.ts), same shape as
   gather_assignments. No per-skill_key uniqueness — many characters may train the same skill at once.';

alter table public.skill_assignments enable row level security;

create policy "skill_assignments_select_own"
  on public.skill_assignments for select to authenticated
  using (player_id = (select auth.uid()));

grant select on public.skill_assignments to authenticated;
grant select, insert, update, delete on public.skill_assignments to service_role;
