-- Character acquisition ledger (docs/superpowers/specs/2026-08-20-character-acquisition-design.md).
--
-- Two new registry-JSONB columns on profiles (ADR-0004 pattern — same shape as `currencies`,
-- `resources`, `map_progress`): adding a new tracked key needs no migration, only a code-registry
-- entry (src/lib/lifetimeStats.ts) or a new authored characterDef.
--
-- 1. lifetime_stats — cumulative totals that DON'T EXIST anywhere else in this schema. Confirmed:
--    mission_runs rows are DELETED on claim (20260612180001_activities.sql), and
--    gather_assignments only tracks the current live cycle (last_collected_at), not history. So
--    "total gold ever earned" / "total seconds spent on missions" / "total <resource> ever
--    gathered" have no other source. Increments-only — spending currencies/resources never
--    decrements this. Written by claim_mission (goldEarned, missionSecondsSent — this migration's
--    sibling 20260820120000) and collect_gather (resourceGathered.<key> — sibling 20260820130000).
--
-- 2. unlocked_characters — the canonical "is this character available to hire yet" record,
--    `{ "<charKey>": "<ISO timestamp first unlocked>" }`. A missing key means still locked. Per the
--    spec's full-blind-surprise rule, the client only ever reads its OWN unlocked_characters map —
--    it never queries "which characters are still locked" (there is no such query in this plan).
--    Additive-only: once a key is set it is never removed (a character is never re-locked).

alter table public.profiles
  add column lifetime_stats jsonb not null default '{}'::jsonb;

comment on column public.profiles.lifetime_stats is
  'Cumulative, increments-only totals used by character-acquisition conditions (goldEarned, missionSecondsSent, resourceGathered.<key> — src/lib/lifetimeStats.ts). Never decremented by spending. Written only by claim_mission / collect_gather (service role).';

alter table public.profiles
  add column unlocked_characters jsonb not null default '{}'::jsonb;

comment on column public.profiles.unlocked_characters is
  'Characters this player has unlocked (are eligible to hire) — { "<charKey>": "<ISO timestamp>" }. A missing key means still locked. Additive-only: never cleared once set. Written only by claim_mission / collect_gather / recruit_character (service role). No RLS change needed — the existing "profiles_select_own" owner-read policy already covers this column.';
