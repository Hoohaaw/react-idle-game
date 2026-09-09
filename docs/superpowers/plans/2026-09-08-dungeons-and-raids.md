# Dungeons & Raids Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a new multi-stage, party-scaled mission type (dungeons: 5-player, 3 escalating bosses; raids: 10-player, 1 hard boss) with themed loot, daily/weekly lockouts, and one working reference dungeon + one working reference raid.

**Architecture:** Two new Sanity document types (`dungeonDef`, `raidDef`) sharing a `groupStage` object, a new `group_runs` Postgres table, two new Edge Functions (`group-start-stage`, `group-claim-stage`) mirroring the existing `mission-start`/`mission-claim` shape, a small `src/lib/groupContent.ts` for party-cap/lockout rules, and a new `src/features/groupContent/` UI module. A pure loot-rolling helper is extracted from `mission-claim` into `src/lib/loot.ts` so both the old and new Edge Functions share it (and it gets real unit tests, unlike the rest of the Deno-only Edge Function code).

**Tech Stack:** React 19 + Vite + TypeScript (strict), Zustand, TanStack Query, Tailwind-free inline-style components (matches this repo's existing `MissionDispatch` style), Supabase (Postgres + Edge Functions, Deno), Sanity (drafts perspective), Vitest.

**Spec:** [`docs/superpowers/specs/2026-09-08-dungeons-and-raids-design.md`](../specs/2026-09-08-dungeons-and-raids-design.md) — read it first; this plan implements it task-by-task and does not restate its rationale.

## Global Constraints

- Party caps: dungeon 5, raid 10 (spec §4d) — enforced **server-side** in the new Edge Functions (today's `mission-start` has no server-side party-size check at all; this gap is *not* retrofitted onto it — spec §3 non-goals).
- Stage kinds: `trash` | `boss` only (spec §4a).
- Lockout: dungeon resets daily at 00:00 UTC, raid resets weekly at Sunday 00:00 UTC (spec §4d) — these are fixed calendar boundaries shared by all players, not a per-player rolling cooldown.
- Loss on any stage: retry the same stage, no progress lost (spec §2/§5).
- No per-school character resist affixes (spec §3 non-goal) — themed gear only boosts existing stats.
- No new enemy tier beyond the gating map's own tier band (spec §7) — if reference content deviates from `scripts/balance/enemies.ts`'s tier-template values, a sweep is required per `docs/BALANCE.md`; this plan's reference content uses **unmodified template values**, so no sweep task is included (verified in Task 15).
- Every SQL function follows this repo's existing convention exactly: `security definer`, `set search_path = public, pg_temp`, `revoke all ... from public, anon, authenticated`, `grant execute ... to service_role` (ADR-0003 — clients never call these directly).
- `npm run lint`, `npm run build`, `npm test` must all pass before every commit (repo CLAUDE.md).

---

### Task 1: `group_runs` table, cross-busy-check updates, and the two group RPCs

**Files:**
- Create: `supabase/migrations/20260908140000_group_runs.sql`

**Interfaces:**
- Produces: table `public.group_runs(player_id, kind, def_key, current_stage_index, status, party, stage_started_at, stage_ends_at, last_cleared_at)`, RPC `public.start_group_stage(p_player uuid, p_kind text, p_def_key text, p_party uuid[], p_stage_index int, p_total_stages int, p_duration_seconds int, p_lockout text) returns public.group_runs`, RPC `public.claim_group_stage(p_player uuid, p_kind text, p_def_key text, p_won boolean, p_char_updates jsonb, p_loot jsonb, p_currencies jsonb, p_resources jsonb, p_is_last_stage boolean) returns jsonb`.

- [ ] **Step 1: Write the migration file**

```sql
-- Dungeons & raids: group_runs table + the two group-stage RPCs (docs/superpowers/specs/
-- 2026-09-08-dungeons-and-raids-design.md). A character may be in at most one activity — that
-- rule already spans mission_runs/gather_assignments/infirmary_admissions; this migration adds
-- group_runs as a fourth table in the same mutual-exclusion set.

create table public.group_runs (
  player_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('dungeon', 'raid')),
  def_key text not null,
  current_stage_index int not null default 0,
  status text not null default 'in_progress' check (status in ('in_progress', 'complete')),
  party uuid[] not null default '{}',
  stage_started_at timestamptz,
  stage_ends_at timestamptz,
  last_cleared_at timestamptz,
  primary key (player_id, kind, def_key)
);

alter table public.group_runs enable row level security;

create policy "owner can read own group runs"
  on public.group_runs for select
  using (auth.uid() = player_id);
-- No insert/update/delete policies: all writes go through the SECURITY DEFINER RPCs below
-- (ADR-0003) — RLS with no write policy means clients cannot write at all.

-- ---------------------------------------------------------------------------------------------
-- Extend the existing busy checks: a character mid-dungeon/raid-stage must not be dispatchable
-- to a mission, a mine, or the infirmary. Each function below is redefined with its full existing
-- body (from supabase/migrations/20260713090000_map_progression.sql and
-- 20260707150000_infirmary.sql respectively) plus one new `group_runs` exists-check.
-- ---------------------------------------------------------------------------------------------

create or replace function public.start_mission(
  p_player           uuid,
  p_mission_def_id   text,
  p_party            uuid[],
  p_duration_seconds integer,
  p_map_key          text    default null,
  p_stage            int     default null,
  p_prev_map_key     text    default null
) returns public.mission_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_size        int := cardinality(p_party);
  v_owned_alive int;
  v_run         public.mission_runs;
  v_map_prog    jsonb;
  v_cleared     int;
  v_prev_cleared int;
begin
  if v_size is null or v_size < 1 or v_size > 3 then
    raise exception 'start_mission: party size must be 1..3';
  end if;
  if v_size <> (select count(distinct e) from unnest(p_party) e) then
    raise exception 'start_mission: duplicate character in party';
  end if;
  if p_duration_seconds is null or p_duration_seconds < 1 then
    raise exception 'start_mission: invalid duration';
  end if;

  perform 1 from public.player_characters
   where id = any(p_party) and player_id = p_player
   for update;

  select count(*) into v_owned_alive
    from public.player_characters
   where id = any(p_party)
     and player_id = p_player
     and (current_hp is null or current_hp > 0);
  if v_owned_alive <> v_size then
    raise exception 'start_mission: a character is not owned or is downed';
  end if;

  if exists (select 1 from public.gather_assignments where player_character_id = any(p_party)) then
    raise exception 'start_mission: a character is gathering';
  end if;
  if exists (select 1 from public.mission_runs where player_id = p_player and party && p_party) then
    raise exception 'start_mission: a character is already on a mission';
  end if;
  if exists (select 1 from public.infirmary_admissions where player_character_id = any(p_party)) then
    raise exception 'start_mission: a character is in the infirmary';
  end if;
  if exists (select 1 from public.group_runs where player_id = p_player and party && p_party) then
    raise exception 'start_mission: a character is in a dungeon or raid';
  end if;

  if p_map_key is not null and p_stage is not null then
    select map_progress into v_map_prog from public.profiles where player_id = p_player;
    v_cleared := coalesce((v_map_prog->>p_map_key)::int, 0);
    if p_stage > v_cleared + 1 then
      raise exception 'start_mission: stage not yet unlocked';
    end if;
    if p_prev_map_key is not null then
      v_prev_cleared := coalesce((v_map_prog->>p_prev_map_key)::int, 0);
      if v_prev_cleared < 7 then
        raise exception 'start_mission: previous map not cleared';
      end if;
    end if;
  end if;

  insert into public.mission_runs (player_id, mission_def_id, party, started_at, ends_at)
  values (p_player, p_mission_def_id, p_party, now(), now() + make_interval(secs => p_duration_seconds))
  returning * into v_run;

  return v_run;
end;
$$;

revoke all on function public.start_mission(uuid, text, uuid[], integer, text, int, text) from public, anon, authenticated;
grant execute on function public.start_mission(uuid, text, uuid[], integer, text, int, text) to service_role;

create or replace function public.start_gather(
  p_player      uuid,
  p_char        uuid,
  p_resource_id text
) returns public.gather_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alive int;
  v_assignment public.gather_assignments;
begin
  if p_char is null then
    raise exception 'start_gather: character required';
  end if;
  if p_resource_id is null or length(p_resource_id) = 0 then
    raise exception 'start_gather: resource required';
  end if;

  perform 1 from public.player_characters
   where id = p_char and player_id = p_player
   for update;

  select count(*) into v_alive
    from public.player_characters
   where id = p_char and player_id = p_player
     and (current_hp is null or current_hp > 0);
  if v_alive <> 1 then
    raise exception 'start_gather: character is not owned or is downed';
  end if;

  if exists (select 1 from public.gather_assignments where player_character_id = p_char) then
    raise exception 'start_gather: character is already gathering';
  end if;
  if exists (select 1 from public.mission_runs where player_id = p_player and party && array[p_char]) then
    raise exception 'start_gather: character is on a mission';
  end if;
  if exists (select 1 from public.infirmary_admissions where player_character_id = p_char) then
    raise exception 'start_gather: a character is in the infirmary';
  end if;
  if exists (select 1 from public.group_runs where player_id = p_player and party && array[p_char]) then
    raise exception 'start_gather: a character is in a dungeon or raid';
  end if;

  if exists (select 1 from public.gather_assignments where player_id = p_player and resource_id = p_resource_id) then
    raise exception 'start_gather: that mine already has a gatherer';
  end if;

  insert into public.gather_assignments (player_id, player_character_id, resource_id, started_at)
  values (p_player, p_char, p_resource_id, now())
  returning * into v_assignment;

  return v_assignment;
end;
$$;

revoke all on function public.start_gather(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.start_gather(uuid, uuid, text) to service_role;

create or replace function public.admit_infirmary(
  p_player uuid,
  p_char   uuid,
  p_max_beds int
) returns public.infirmary_admissions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_hp int;
  v_admission  public.infirmary_admissions;
begin
  perform 1 from public.player_characters
   where id = p_char and player_id = p_player
   for update;

  select current_hp into v_current_hp
    from public.player_characters
   where id = p_char and player_id = p_player;
  if not found then
    raise exception 'admit_infirmary: character not found or not owned';
  end if;

  if v_current_hp is null then
    raise exception 'admit_infirmary: character is at full health (current_hp is null)';
  end if;

  if exists (select 1 from public.mission_runs where player_id = p_player and party && array[p_char]) then
    raise exception 'admit_infirmary: character is on a mission';
  end if;
  if exists (select 1 from public.gather_assignments where player_character_id = p_char) then
    raise exception 'admit_infirmary: character is gathering';
  end if;
  if exists (select 1 from public.group_runs where player_id = p_player and party && array[p_char]) then
    raise exception 'admit_infirmary: character is in a dungeon or raid';
  end if;

  if exists (select 1 from public.infirmary_admissions where player_character_id = p_char) then
    raise exception 'admit_infirmary: character is already admitted';
  end if;

  if (select count(*) from public.infirmary_admissions where player_id = p_player) >= p_max_beds then
    raise exception 'admit_infirmary: infirmary is full';
  end if;

  insert into public.infirmary_admissions (player_id, player_character_id, hp_at_admission)
  values (p_player, p_char, v_current_hp)
  returning * into v_admission;

  return v_admission;
end;
$$;

revoke all on function public.admit_infirmary(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.admit_infirmary(uuid, uuid, int) to service_role;

-- ---------------------------------------------------------------------------------------------
-- start_group_stage: validate + dispatch the CURRENT stage of a dungeon/raid run. p_lockout is
-- 'daily' or 'weekly' (src/lib/groupContent.ts's GROUP_LOCKOUT, passed in by the Edge Function —
-- this RPC does calendar math but doesn't hardcode which kind maps to which cadence).
-- ---------------------------------------------------------------------------------------------
create or replace function public.start_group_stage(
  p_player           uuid,
  p_kind             text,
  p_def_key          text,
  p_party            uuid[],
  p_stage_index      int,
  p_total_stages     int,
  p_duration_seconds int,
  p_lockout          text -- 'daily' | 'weekly'
) returns public.group_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_size        int := cardinality(p_party);
  v_owned_alive int;
  v_run         public.group_runs;
  v_next_reset  timestamptz;
begin
  if p_kind not in ('dungeon', 'raid') then
    raise exception 'start_group_stage: invalid kind';
  end if;
  if v_size < 1 then
    raise exception 'start_group_stage: party required';
  end if;
  if v_size <> (select count(distinct e) from unnest(p_party) e) then
    raise exception 'start_group_stage: duplicate character in party';
  end if;
  if p_duration_seconds is null or p_duration_seconds < 1 then
    raise exception 'start_group_stage: invalid duration';
  end if;

  perform 1 from public.player_characters
   where id = any(p_party) and player_id = p_player
   for update;

  select count(*) into v_owned_alive
    from public.player_characters
   where id = any(p_party)
     and player_id = p_player
     and (current_hp is null or current_hp > 0);
  if v_owned_alive <> v_size then
    raise exception 'start_group_stage: a character is not owned or is downed';
  end if;

  if exists (select 1 from public.mission_runs where player_id = p_player and party && p_party) then
    raise exception 'start_group_stage: a character is on a mission';
  end if;
  if exists (select 1 from public.gather_assignments where player_character_id = any(p_party)) then
    raise exception 'start_group_stage: a character is gathering';
  end if;
  if exists (select 1 from public.infirmary_admissions where player_character_id = any(p_party)) then
    raise exception 'start_group_stage: a character is in the infirmary';
  end if;
  -- A character mid-stage on a DIFFERENT dungeon/raid run is also busy (party is only ever
  -- non-empty while a stage is in flight — cleared on every claim, see claim_group_stage below).
  if exists (
    select 1 from public.group_runs
     where player_id = p_player and party && p_party
       and not (kind = p_kind and def_key = p_def_key)
  ) then
    raise exception 'start_group_stage: a character is in another dungeon or raid';
  end if;

  -- Load or create the run row, locking it against concurrent starts of the same run.
  select * into v_run from public.group_runs
   where player_id = p_player and kind = p_kind and def_key = p_def_key
   for update;

  if not found then
    if p_stage_index <> 0 then
      raise exception 'start_group_stage: no run in progress';
    end if;
    insert into public.group_runs (player_id, kind, def_key, current_stage_index, status, party, stage_started_at, stage_ends_at)
    values (p_player, p_kind, p_def_key, 0, 'in_progress', p_party, now(), now() + make_interval(secs => p_duration_seconds))
    returning * into v_run;
    return v_run;
  end if;

  if v_run.stage_ends_at is not null then
    raise exception 'start_group_stage: a stage is already in flight';
  end if;

  if v_run.status = 'complete' then
    v_next_reset := case p_lockout
      when 'daily' then date_trunc('day', v_run.last_cleared_at) + interval '1 day'
      when 'weekly' then date_trunc('week', v_run.last_cleared_at) + interval '1 week' -- Postgres weeks start Monday; 'week 00:00 Sunday' = trunc('week') + 6 days, see below
      else null
    end;
    if p_lockout = 'weekly' then
      v_next_reset := date_trunc('week', v_run.last_cleared_at) + interval '6 days';
    end if;
    if v_next_reset is null or now() < v_next_reset then
      raise exception 'start_group_stage: still locked out until %', v_next_reset;
    end if;
    if p_stage_index <> 0 then
      raise exception 'start_group_stage: a fresh run must start at stage 0';
    end if;
    update public.group_runs
       set current_stage_index = 0, status = 'in_progress', party = p_party,
           stage_started_at = now(), stage_ends_at = now() + make_interval(secs => p_duration_seconds),
           last_cleared_at = null
     where player_id = p_player and kind = p_kind and def_key = p_def_key
     returning * into v_run;
    return v_run;
  end if;

  if p_stage_index <> v_run.current_stage_index then
    raise exception 'start_group_stage: wrong stage index for this run';
  end if;

  update public.group_runs
     set party = p_party, stage_started_at = now(),
         stage_ends_at = now() + make_interval(secs => p_duration_seconds)
   where player_id = p_player and kind = p_kind and def_key = p_def_key
   returning * into v_run;

  return v_run;
end;
$$;

revoke all on function public.start_group_stage(uuid, text, text, uuid[], int, int, int, text) from public, anon, authenticated;
grant execute on function public.start_group_stage(uuid, text, text, uuid[], int, int, int, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- claim_group_stage: apply a resolved stage's outcome atomically. Mirrors claim_mission's shape
-- (char_updates/loot/currencies/resources) but advances a stage cursor instead of deleting a row,
-- and never advances on a loss (spec §5 step 3: retry the same stage, no progress lost).
-- ---------------------------------------------------------------------------------------------
create or replace function public.claim_group_stage(
  p_player        uuid,
  p_kind          text,
  p_def_key       text,
  p_won           boolean,
  p_char_updates  jsonb,
  p_loot          jsonb,
  p_currencies    jsonb,
  p_resources     jsonb,
  p_is_last_stage boolean
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run   public.group_runs;
  v_char  jsonb;
  v_loot  jsonb;
  v_key   text;
  v_val   numeric;
begin
  select * into v_run from public.group_runs
   where player_id = p_player and kind = p_kind and def_key = p_def_key
     and now() >= stage_ends_at
   for update;
  if not found then
    raise exception 'claim_group_stage: not claimable (no run, not finished, or already claimed)';
  end if;

  for v_char in select * from jsonb_array_elements(coalesce(p_char_updates, '[]'::jsonb))
  loop
    update public.player_characters
       set level = (v_char->>'level')::int,
           xp = (v_char->>'xp')::int,
           current_hp = (v_char->>'current_hp')::int
     where id = (v_char->>'id')::uuid and player_id = p_player;
  end loop;

  if p_won then
    for v_loot in select * from jsonb_array_elements(coalesce(p_loot, '[]'::jsonb))
    loop
      insert into public.player_inventory (player_id, item_def_id, rarity, quantity)
      values (p_player, v_loot->>'item_def_id', v_loot->>'rarity', (v_loot->>'quantity')::int)
      on conflict (player_id, item_def_id, rarity)
        do update set quantity = public.player_inventory.quantity + excluded.quantity;
    end loop;

    for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_currencies, '{}'::jsonb))
    loop
      update public.profiles
         set currencies = jsonb_set(currencies, array[v_key],
               to_jsonb(coalesce((currencies->>v_key)::numeric, 0) + v_val))
       where player_id = p_player;
    end loop;
    for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_resources, '{}'::jsonb))
    loop
      update public.profiles
         set resources = jsonb_set(resources, array[v_key],
               to_jsonb(coalesce((resources->>v_key)::numeric, 0) + v_val))
       where player_id = p_player;
    end loop;
  end if;

  if p_won and p_is_last_stage then
    update public.group_runs
       set status = 'complete', party = '{}', stage_started_at = null, stage_ends_at = null,
           last_cleared_at = now()
     where player_id = p_player and kind = p_kind and def_key = p_def_key;
  elsif p_won then
    update public.group_runs
       set current_stage_index = current_stage_index + 1, party = '{}',
           stage_started_at = null, stage_ends_at = null
     where player_id = p_player and kind = p_kind and def_key = p_def_key;
  else
    -- Loss: same stage, party freed to redispatch (reshuffled or not).
    update public.group_runs
       set party = '{}', stage_started_at = null, stage_ends_at = null
     where player_id = p_player and kind = p_kind and def_key = p_def_key;
  end if;

  return jsonb_build_object('won', p_won, 'party', v_run.party);
end;
$$;

revoke all on function public.claim_group_stage(uuid, text, text, boolean, jsonb, jsonb, jsonb, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.claim_group_stage(uuid, text, text, boolean, jsonb, jsonb, jsonb, jsonb, boolean) to service_role;
```

- [ ] **Step 2: Apply the migration locally and verify it runs clean**

Run: `supabase db reset` (or `supabase migration up` against your local stack, per this repo's Supabase CLI setup).
Expected: no SQL errors; `group_runs` appears in `supabase migration list` as applied.

- [ ] **Step 3: Manual RPC smoke check**

Run (via `supabase db execute` or the SQL editor against the local stack), using a real test player/character id from your local seed data:

```sql
select public.start_group_stage(
  '<player-uuid>', 'dungeon', 'test-key', array['<char-uuid>']::uuid[], 0, 9, 5, 'daily'
);
select public.claim_group_stage(
  '<player-uuid>', 'dungeon', 'test-key', true, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, false
);
select * from public.group_runs where player_id = '<player-uuid>';
```

Expected: first call inserts a row with `current_stage_index = 0`, `stage_ends_at` ~5s out; after waiting 5s the second call succeeds and the row now shows `current_stage_index = 1`, `party = '{}'`, `stage_ends_at = null`. This is the only verification available — this repo has no pgTAP/Deno test infra (accepted gap, same as `recruit_character`, spec §10).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260908140000_group_runs.sql
git commit -m "feat: add group_runs table and group-stage RPCs for dungeons/raids"
```

---

### Task 2: `src/lib/loot.ts` — extract the loot-rolling helpers

**Files:**
- Create: `src/lib/loot.ts`
- Create: `src/lib/loot.test.ts`

**Interfaces:**
- Produces: `rollRarity(weights: { rarity: string; weight: number }[] | undefined, rng: () => number): string`, `rollItemLoot(lines: LootLine[], rng: () => number, opts: { magicFind: number; luck: number }): { item_def_id: string; rarity: string; quantity: number }[]` where `LootLine = { itemKey: string | null; dropChance?: number; quantityMin?: number; quantityMax?: number; rarityWeights?: { rarity: string; weight: number }[] }`.
- Consumes: nothing new — pure functions, no imports beyond the types they define.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/loot.test.ts
import { describe, it, expect } from 'vitest'
import { rollRarity, rollItemLoot } from './loot'

function fixedRng(...values: number[]): () => number {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

describe('rollRarity', () => {
  it('returns Common when weights are empty or undefined', () => {
    expect(rollRarity(undefined, () => 0.5)).toBe('Common')
    expect(rollRarity([], () => 0.5)).toBe('Common')
  })

  it('picks proportionally to weight', () => {
    const weights = [{ rarity: 'Common', weight: 80 }, { rarity: 'Epic', weight: 20 }]
    expect(rollRarity(weights, () => 0)).toBe('Common') // r=0 -> first bucket
    expect(rollRarity(weights, () => 0.9999)).toBe('Epic') // r near total -> last bucket
  })

  it('ignores zero-weight entries', () => {
    const weights = [{ rarity: 'Legendary', weight: 0 }, { rarity: 'Rare', weight: 1 }]
    expect(rollRarity(weights, () => 0.5)).toBe('Rare')
  })
})

describe('rollItemLoot', () => {
  it('skips a line with no itemKey', () => {
    const result = rollItemLoot([{ itemKey: null, dropChance: 100 }], fixedRng(0), { magicFind: 0, luck: 0 })
    expect(result).toEqual([])
  })

  it('rolls no drop when the roll exceeds dropChance', () => {
    const result = rollItemLoot(
      [{ itemKey: 'sword', dropChance: 10 }],
      fixedRng(0.5), // 0.5*100=50 >= 10 -> no drop
      { magicFind: 0, luck: 0 },
    )
    expect(result).toEqual([])
  })

  it('rolls a drop, applies magicFind to chance, and rolls quantity/rarity', () => {
    const result = rollItemLoot(
      [{ itemKey: 'sword', dropChance: 50, quantityMin: 1, quantityMax: 1, rarityWeights: [{ rarity: 'Epic', weight: 1 }] }],
      fixedRng(0.4, 0, 0), // dropChance roll 40 < 50+magicFind -> drops; rarity roll 0; quantity roll 0
      { magicFind: 0, luck: 0 },
    )
    expect(result).toEqual([{ item_def_id: 'sword', rarity: 'Epic', quantity: 1 }])
  })

  it('luck can add +1 quantity', () => {
    const result = rollItemLoot(
      [{ itemKey: 'sword', dropChance: 100, quantityMin: 1, quantityMax: 1 }],
      fixedRng(0, 0, 0, 0), // drop roll, rarity roll (no weights->Common path skips rng), quantity roll, luck roll = 0 < luck
      { magicFind: 0, luck: 100 },
    )
    expect(result[0].quantity).toBe(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/loot.test.ts`
Expected: FAIL with "Cannot find module './loot'" (file doesn't exist yet).

- [ ] **Step 3: Write the implementation** (moved verbatim from `supabase/functions/mission-claim/index.ts` lines 142–153 and 376–387, generalized into two named exports)

```typescript
// src/lib/loot.ts
// Loot-rolling helpers shared by mission-claim and group-claim-stage (dungeons/raids). Pure and
// framework-agnostic so both the Deno Edge Functions (via relative import) and this repo's Vitest
// suite can use/test the exact same logic — single source of truth, same reasoning as combat.ts.

export type RarityWeight = { rarity: string; weight: number }
export type LootLine = {
  itemKey: string | null
  dropChance?: number
  quantityMin?: number
  quantityMax?: number
  rarityWeights?: RarityWeight[]
}
export type RolledLoot = { item_def_id: string; rarity: string; quantity: number }

/** Weighted rarity pick (independent per-item roll — ADR-0017). Empty/zero weights → Common. */
export function rollRarity(weights: RarityWeight[] | undefined, rng: () => number): string {
  const list = (weights ?? []).filter((w) => (w.weight ?? 0) > 0)
  if (list.length === 0) return 'Common'
  const total = list.reduce((s, w) => s + w.weight, 0)
  let r = rng() * total
  for (const w of list) {
    r -= w.weight
    if (r < 0) return w.rarity
  }
  return list[list.length - 1].rarity
}

/** Rolls every loot line independently against its own dropChance (scaled by magicFind, capped at
 *  100), then a rarity roll and a quantity roll (± luck) for each that drops. */
export function rollItemLoot(
  lines: LootLine[],
  rng: () => number,
  opts: { magicFind: number; luck: number },
): RolledLoot[] {
  const loot: RolledLoot[] = []
  for (const drop of lines) {
    if (!drop.itemKey) continue
    const chance = Math.min(100, (drop.dropChance ?? 0) * (1 + opts.magicFind / 100))
    if (rng() * 100 >= chance) continue
    const rarity = rollRarity(drop.rarityWeights, rng)
    const qMin = drop.quantityMin ?? 1
    const qMax = Math.max(qMin, drop.quantityMax ?? qMin)
    let quantity = qMin + Math.floor(rng() * (qMax - qMin + 1))
    if (rng() * 100 < opts.luck) quantity += 1
    loot.push({ item_def_id: drop.itemKey, rarity, quantity })
  }
  return loot
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/loot.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/loot.ts src/lib/loot.test.ts
git commit -m "feat: extract rollRarity/rollItemLoot into src/lib/loot.ts"
```

---

### Task 3: Refactor `mission-claim` to use `src/lib/loot.ts`

**Files:**
- Modify: `supabase/functions/mission-claim/index.ts:1-11` (imports), `:142-153` (delete local `rollRarity`), `:376-387` (replace inline loop)

**Interfaces:**
- Consumes: `rollRarity`, `rollItemLoot` from `../../../src/lib/loot.ts` (Task 2).

- [ ] **Step 1: Add the import and delete the local `rollRarity`**

In `supabase/functions/mission-claim/index.ts`, change the import block (lines 1–36) to add:

```typescript
import { rollRarity, rollItemLoot } from '../../../src/lib/loot.ts'
```

Delete the local function at lines 142–153:

```typescript
/** Weighted rarity pick (independent per-item roll — ADR-0017). Empty/zero weights → Common. */
function rollRarity(weights: { rarity: string; weight: number }[] | undefined, rng: () => number): string {
  const list = (weights ?? []).filter((w) => (w.weight ?? 0) > 0)
  if (list.length === 0) return 'Common'
  const total = list.reduce((s, w) => s + w.weight, 0)
  let r = rng() * total
  for (const w of list) {
    r -= w.weight
    if (r < 0) return w.rarity
  }
  return list[list.length - 1].rarity
}
```

(`rollRarity` is still called later, at what's now line ~381, in the `characterLootDrop` loop — that call stays as-is, now resolving to the imported function.)

- [ ] **Step 2: Replace the inline item-loot loop**

Replace this block (originally lines 376–387):

```typescript
    const lootRng = makeRng(`${run.id}:loot`)
    for (const drop of mission.loot ?? []) {
      if (!drop.itemKey) continue
      const chance = Math.min(100, (drop.dropChance ?? 0) * (1 + magicFind / 100))
      if (lootRng() * 100 >= chance) continue // this item didn't drop
      const rarity = rollRarity(drop.rarityWeights, lootRng)
      const qMin = drop.quantityMin ?? 1
      const qMax = Math.max(qMin, drop.quantityMax ?? qMin)
      let quantity = qMin + Math.floor(lootRng() * (qMax - qMin + 1))
      if (lootRng() * 100 < luck) quantity += 1
      loot.push({ item_def_id: drop.itemKey, rarity, quantity })
    }
```

with:

```typescript
    const lootRng = makeRng(`${run.id}:loot`)
    loot.push(...rollItemLoot(mission.loot ?? [], lootRng, { magicFind, luck }))
```

Note `loot` is declared a few lines above as `const loot: { item_def_id: string; rarity: string; quantity: number }[] = []` — leave that declaration as-is; `rollItemLoot`'s return type is structurally identical.

- [ ] **Step 3: Verify behavior is unchanged**

This repo has no automated Edge Function tests (accepted gap, spec §10), so verification is: (a) `npx tsc --noEmit` (or the project's normal `npm run build`, which includes `tsc -b`) passes with no new type errors in this file, and (b) a manual read-through confirming the replaced block is byte-for-byte the same RNG call sequence as before (same `lootRng()` calls in the same order: dropChance roll, rarity roll, quantity roll, luck roll — `rollItemLoot`'s internals in Task 2 were copied verbatim from this exact code, so the sequence is identical by construction).

Run: `npm run build`
Expected: PASS, no new errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/mission-claim/index.ts
git commit -m "refactor: mission-claim uses the shared src/lib/loot.ts helpers"
```

---

### Task 4: `src/lib/groupContent.ts` — party caps and lockout math

**Files:**
- Create: `src/lib/groupContent.ts`
- Create: `src/lib/groupContent.test.ts`

**Interfaces:**
- Produces: `type GroupKind = 'dungeon' | 'raid'`, `GROUP_PARTY_CAP: Record<GroupKind, number>`, `GROUP_LOCKOUT: Record<GroupKind, 'daily' | 'weekly'>`, `isLockedOut(lastClearedAt: string | null, lockout: 'daily' | 'weekly', now?: Date): boolean`, `nextResetBoundary(lastClearedAt: string, lockout: 'daily' | 'weekly'): Date`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/groupContent.test.ts
import { describe, it, expect } from 'vitest'
import { GROUP_PARTY_CAP, GROUP_LOCKOUT, isLockedOut, nextResetBoundary } from './groupContent'

describe('groupContent constants', () => {
  it('dungeon caps at 5, raid at 10', () => {
    expect(GROUP_PARTY_CAP.dungeon).toBe(5)
    expect(GROUP_PARTY_CAP.raid).toBe(10)
  })
  it('dungeon locks out daily, raid weekly', () => {
    expect(GROUP_LOCKOUT.dungeon).toBe('daily')
    expect(GROUP_LOCKOUT.raid).toBe('weekly')
  })
})

describe('nextResetBoundary', () => {
  it('daily: next UTC midnight after the cleared timestamp', () => {
    const boundary = nextResetBoundary('2026-09-08T13:00:00.000Z', 'daily')
    expect(boundary.toISOString()).toBe('2026-09-09T00:00:00.000Z')
  })
  it('daily: cleared exactly at midnight rolls to the FOLLOWING midnight', () => {
    const boundary = nextResetBoundary('2026-09-09T00:00:00.000Z', 'daily')
    expect(boundary.toISOString()).toBe('2026-09-10T00:00:00.000Z')
  })
  it('weekly: next Sunday UTC midnight after a mid-week clear', () => {
    // 2026-09-08 is a Tuesday; next Sunday 00:00 UTC is 2026-09-13.
    const boundary = nextResetBoundary('2026-09-08T13:00:00.000Z', 'weekly')
    expect(boundary.toISOString()).toBe('2026-09-13T00:00:00.000Z')
  })
  it('weekly: cleared exactly at a Sunday-midnight boundary rolls to the FOLLOWING Sunday', () => {
    const boundary = nextResetBoundary('2026-09-13T00:00:00.000Z', 'weekly')
    expect(boundary.toISOString()).toBe('2026-09-20T00:00:00.000Z')
  })
})

describe('isLockedOut', () => {
  it('never locked out when there is no prior clear', () => {
    expect(isLockedOut(null, 'daily')).toBe(false)
  })
  it('locked out before the reset boundary, free after it', () => {
    const clearedAt = '2026-09-08T13:00:00.000Z' // boundary: 2026-09-09T00:00:00Z
    expect(isLockedOut(clearedAt, 'daily', new Date('2026-09-08T23:59:59.000Z'))).toBe(true)
    expect(isLockedOut(clearedAt, 'daily', new Date('2026-09-09T00:00:00.000Z'))).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/groupContent.test.ts`
Expected: FAIL with "Cannot find module './groupContent'".

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/groupContent.ts
// Party-size and lockout rules for dungeons/raids (docs/superpowers/specs/2026-09-08-dungeons-
// and-raids-design.md §4d) — rules of the TYPE, not authored per-def, same status as today's
// mission MAX_PARTY = 3 constant.

export type GroupKind = 'dungeon' | 'raid'
export type Lockout = 'daily' | 'weekly'

export const GROUP_PARTY_CAP: Record<GroupKind, number> = { dungeon: 5, raid: 10 }
export const GROUP_LOCKOUT: Record<GroupKind, Lockout> = { dungeon: 'daily', raid: 'weekly' }

/** The next fixed calendar boundary (UTC midnight for daily, Sunday UTC midnight for weekly)
 *  strictly AFTER `lastClearedAt`. A clear landing exactly ON a boundary rolls to the next one —
 *  the boundary is when the lockout LIFTS, not a moment you're still inside. */
export function nextResetBoundary(lastClearedAt: string, lockout: Lockout): Date {
  const cleared = new Date(lastClearedAt)
  const midnightAfter = new Date(Date.UTC(
    cleared.getUTCFullYear(), cleared.getUTCMonth(), cleared.getUTCDate() + 1,
  ))
  if (lockout === 'daily') return midnightAfter

  // Weekly: next Sunday 00:00 UTC strictly after `cleared`. getUTCDay(): 0=Sunday..6=Saturday.
  // Start from midnightAfter (already strictly after `cleared`) and walk forward to the next Sunday.
  const daysUntilSunday = (7 - midnightAfter.getUTCDay()) % 7
  return new Date(Date.UTC(
    midnightAfter.getUTCFullYear(), midnightAfter.getUTCMonth(),
    midnightAfter.getUTCDate() + daysUntilSunday,
  ))
}

/** Whether a fresh run is still blocked by the lockout from the last clear. */
export function isLockedOut(lastClearedAt: string | null, lockout: Lockout, now: Date = new Date()): boolean {
  if (!lastClearedAt) return false
  return now.getTime() < nextResetBoundary(lastClearedAt, lockout).getTime()
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/groupContent.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/groupContent.ts src/lib/groupContent.test.ts
git commit -m "feat: add groupContent party-cap and lockout-boundary rules"
```

---

### Task 5: Sanity schema — `groupStage`, `dungeonDef`, `raidDef`

**Files:**
- Create: `studio/schemaTypes/objects/groupStage.ts`
- Create: `studio/schemaTypes/dungeonDef.ts`
- Create: `studio/schemaTypes/raidDef.ts`
- Modify: `studio/schemaTypes/index.ts`

**Interfaces:**
- Consumes: `lootDrop`, `missionReward` object types (existing); `SCHOOL_DEFS` from `../../src/lib/schools.ts` (existing, same pattern as `characterDef.ts`'s `damageSchool` field).
- Produces: Sanity types `groupStage`, `dungeonDef`, `raidDef` registered in the schema array.

- [ ] **Step 1: `groupStage` object**

```typescript
// studio/schemaTypes/objects/groupStage.ts
import { defineType, defineField, defineArrayMember } from 'sanity'

// One stage of a dungeonDef/raidDef run (docs/superpowers/specs/2026-09-08-dungeons-and-raids-
// design.md §4a) — trash packs are an easy item-grab pace, boss stages are the real check. Reuses
// the existing lootDrop/missionReward objects as-is; no new drop mechanism.
export const groupStage = defineType({
  name: 'groupStage',
  title: 'Stage',
  type: 'object',
  fields: [
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      options: { list: [{ title: 'Trash', value: 'trash' }, { title: 'Boss', value: 'boss' }], layout: 'radio' },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'encounter',
      title: 'Encounter (the fight)',
      type: 'reference',
      to: [{ type: 'encounterDef' }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'durationSeconds',
      title: 'Duration (real-world wait, seconds)',
      description: 'Same meaning as missionDef.durationSeconds — the real-world wait, not the in-fight time limit.',
      type: 'number',
      validation: (rule) => rule.required().integer().min(1),
    }),
    defineField({
      name: 'baseXp',
      title: 'Base XP',
      type: 'number',
      initialValue: 0,
      validation: (rule) => rule.required().min(0),
    }),
    defineField({
      name: 'rewards',
      title: 'Guaranteed rewards',
      type: 'array',
      of: [defineArrayMember({ type: 'missionReward' })],
    }),
    defineField({
      name: 'loot',
      title: 'Loot table',
      type: 'array',
      of: [defineArrayMember({ type: 'lootDrop' })],
    }),
  ],
  preview: {
    select: { kind: 'kind', duration: 'durationSeconds', encounter: 'encounter.name' },
    prepare({ kind, duration, encounter }) {
      return { title: kind === 'boss' ? 'BOSS' : 'Trash', subtitle: [encounter, duration != null ? `${duration}s` : null].filter(Boolean).join(' · ') }
    },
  },
})
```

- [ ] **Step 2: `dungeonDef` document**

```typescript
// studio/schemaTypes/dungeonDef.ts
import { defineType, defineField, defineArrayMember } from 'sanity'
import { CircleIcon } from '@sanity/icons'
import { SCHOOL_DEFS } from '../../src/lib/schools'

const SCHOOL_OPTIONS = SCHOOL_DEFS.filter((s) => s.key !== 'physical').map((s) => ({
  title: `${s.label} ${s.icon}`,
  value: s.key,
}))

// A dungeon (docs/superpowers/specs/2026-09-08-dungeons-and-raids-design.md §4b): up to 5
// characters, exactly 3x (trash, trash, boss) — 9 stages total, boss difficulty escalating via
// encounter composition (spec §7), not tier. Gated by clearing `mapGate`'s stage 7.
export const dungeonDef = defineType({
  name: 'dungeonDef',
  title: 'Dungeon',
  type: 'document',
  icon: CircleIcon,
  fields: [
    defineField({ name: 'name', type: 'string', validation: (rule) => rule.required() }),
    defineField({
      name: 'dungeonKey',
      title: 'Dungeon key',
      description: 'Stable id (group_runs.def_key). Lowercase letters, numbers and hyphens. NEVER change once live.',
      type: 'string',
      validation: (rule) =>
        rule.required().custom((value) => {
          if (!value) return 'Required'
          if (!/^[a-z0-9-]+$/.test(value)) return 'Lowercase letters, numbers and hyphens only'
          return true
        }),
    }),
    defineField({
      name: 'theme',
      title: 'Theme (damage school)',
      description: 'Governs both flavor (item naming) and mechanics (this dungeon\'s enemyDefs should be authored with this damageType).',
      type: 'string',
      options: { list: SCHOOL_OPTIONS },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'mapGate',
      title: 'Map gate',
      description: 'Clearing this map\'s stage 7 unlocks the dungeon. Difficulty stays in this map\'s tier band (spec §7).',
      type: 'reference',
      to: [{ type: 'mapDef' }],
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'description', type: 'text', rows: 2 }),
    defineField({
      name: 'stages',
      title: 'Stages (exactly 9: trash, trash, boss ×3)',
      type: 'array',
      of: [defineArrayMember({ type: 'groupStage' })],
      validation: (rule) =>
        rule.required().length(9).custom((stages: { kind?: string }[] | undefined) => {
          if (!stages) return true
          const pattern = [0, 3, 6].every((i) => stages[i]?.kind === 'trash' && stages[i + 1]?.kind === 'trash' && stages[i + 2]?.kind === 'boss')
          return pattern || 'Must be exactly 3x (trash, trash, boss)'
        }),
    }),
  ],
  preview: {
    select: { title: 'name', theme: 'theme', key: 'dungeonKey' },
    prepare({ title, theme, key }) {
      return { title, subtitle: [theme, key].filter(Boolean).join(' · ') }
    },
  },
})
```

- [ ] **Step 3: `raidDef` document**

```typescript
// studio/schemaTypes/raidDef.ts
import { defineType, defineField, defineArrayMember } from 'sanity'
import { CircleIcon } from '@sanity/icons'
import { SCHOOL_DEFS } from '../../src/lib/schools'

const SCHOOL_OPTIONS = SCHOOL_DEFS.filter((s) => s.key !== 'physical').map((s) => ({
  title: `${s.label} ${s.icon}`,
  value: s.key,
}))

// A raid (spec §4c): up to 10 characters, exactly (trash, trash, trash, boss) — 4 stages. Same
// mapGate/theme pattern as dungeonDef; the boss stage carries the game's biggest Legendary weight.
export const raidDef = defineType({
  name: 'raidDef',
  title: 'Raid',
  type: 'document',
  icon: CircleIcon,
  fields: [
    defineField({ name: 'name', type: 'string', validation: (rule) => rule.required() }),
    defineField({
      name: 'raidKey',
      title: 'Raid key',
      description: 'Stable id (group_runs.def_key). Lowercase letters, numbers and hyphens. NEVER change once live.',
      type: 'string',
      validation: (rule) =>
        rule.required().custom((value) => {
          if (!value) return 'Required'
          if (!/^[a-z0-9-]+$/.test(value)) return 'Lowercase letters, numbers and hyphens only'
          return true
        }),
    }),
    defineField({
      name: 'theme',
      title: 'Theme (damage school)',
      type: 'string',
      options: { list: SCHOOL_OPTIONS },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'mapGate',
      title: 'Map gate',
      type: 'reference',
      to: [{ type: 'mapDef' }],
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'description', type: 'text', rows: 2 }),
    defineField({
      name: 'stages',
      title: 'Stages (exactly 4: trash, trash, trash, boss)',
      type: 'array',
      of: [defineArrayMember({ type: 'groupStage' })],
      validation: (rule) =>
        rule.required().length(4).custom((stages: { kind?: string }[] | undefined) => {
          if (!stages) return true
          const ok = stages[0]?.kind === 'trash' && stages[1]?.kind === 'trash' && stages[2]?.kind === 'trash' && stages[3]?.kind === 'boss'
          return ok || 'Must be exactly (trash, trash, trash, boss)'
        }),
    }),
  ],
  preview: {
    select: { title: 'name', theme: 'theme', key: 'raidKey' },
    prepare({ title, theme, key }) {
      return { title, subtitle: [theme, key].filter(Boolean).join(' · ') }
    },
  },
})
```

- [ ] **Step 4: Register in the schema index**

In `studio/schemaTypes/index.ts`, add imports and array entries:

```typescript
import { groupStage } from './objects/groupStage'
import { dungeonDef } from './dungeonDef'
import { raidDef } from './raidDef'
```

Add `groupStage, dungeonDef, raidDef,` to the `schemaTypes` array (anywhere after `lootDrop` and `missionReward`, which `groupStage` depends on).

- [ ] **Step 5: Verify the studio builds**

Run: `cd studio && npx sanity schema validate` (or `npm run build` inside `studio/`, per this repo's Sanity Studio setup).
Expected: no schema errors; `dungeonDef`, `raidDef` appear as new document types.

- [ ] **Step 6: Commit**

```bash
git add studio/schemaTypes/objects/groupStage.ts studio/schemaTypes/dungeonDef.ts studio/schemaTypes/raidDef.ts studio/schemaTypes/index.ts
git commit -m "feat: add dungeonDef/raidDef/groupStage Sanity schema"
```

---

### Task 6: `group-start-stage` Edge Function

**Files:**
- Create: `supabase/functions/group-start-stage/index.ts`

**Interfaces:**
- Consumes: `GROUP_PARTY_CAP`, `GROUP_LOCKOUT` from `../../../src/lib/groupContent.ts` (Task 4); `sanityQuery` from `../_shared/sanity.ts`; `createAdminClient` from `../_shared/supabaseAdmin.ts`; RPC `start_group_stage` (Task 1).
- Produces: `POST /group-start-stage` accepting `{ kind: 'dungeon'|'raid', defKey: string, party: string[] }`, returning `{ run: GroupRun }` (201) shaped like `group_runs`' columns.

- [ ] **Step 1: Write the function**

```typescript
// supabase/functions/group-start-stage/index.ts
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'
import { GROUP_PARTY_CAP, GROUP_LOCKOUT, type GroupKind } from '../../../src/lib/groupContent.ts'

// group-start-stage: dispatch the CURRENT stage of a dungeon/raid run (ADR-0003 server-authoritative
// write; docs/superpowers/specs/2026-09-08-dungeons-and-raids-design.md §5). Mirrors mission-start's
// shape: validate the caller, resolve authored content from Sanity (client not trusted for duration
// or stage count), hand off to the atomic start_group_stage RPC.

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type GroupDef = { stages?: { durationSeconds?: number }[] } | null

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  const admin = createAdminClient()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
  const playerId = userData.user.id

  let body: { kind?: unknown; defKey?: unknown; party?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const kind = body.kind
  const defKey = body.defKey
  const party = body.party
  if (kind !== 'dungeon' && kind !== 'raid') return json({ error: 'kind must be "dungeon" or "raid"' }, 400)
  if (typeof defKey !== 'string' || defKey.length === 0) return json({ error: 'defKey is required' }, 400)
  const cap = GROUP_PARTY_CAP[kind as GroupKind]
  if (!Array.isArray(party) || party.length < 1 || party.length > cap || !party.every((p) => typeof p === 'string')) {
    return json({ error: `party must be 1–${cap} character ids` }, 400)
  }

  // How many stages has this run already cleared? (group_runs row may not exist yet.)
  const { data: run } = await admin
    .from('group_runs')
    .select('current_stage_index, status')
    .eq('player_id', playerId)
    .eq('kind', kind)
    .eq('def_key', defKey)
    .maybeSingle()
  const stageIndex = run?.status === 'complete' ? 0 : (run?.current_stage_index ?? 0)

  const sanityType = kind === 'dungeon' ? 'dungeonDef' : 'raidDef'
  const keyField = kind === 'dungeon' ? 'dungeonKey' : 'raidKey'
  let def: GroupDef
  try {
    def = await sanityQuery<GroupDef>(
      `*[_type == "${sanityType}" && ${keyField} == $key][0]{ stages[]{ durationSeconds } }`,
      { key: defKey },
    )
  } catch (e) {
    console.error('Sanity group-content lookup failed', e)
    return json({ error: 'Could not validate content' }, 502)
  }
  if (!def || !def.stages) return json({ error: 'Unknown dungeon or raid' }, 404)
  const stage = def.stages[stageIndex]
  if (!stage || typeof stage.durationSeconds !== 'number' || stage.durationSeconds < 1) {
    return json({ error: 'Stage has no valid duration' }, 500)
  }

  const { data: groupRun, error: rpcErr } = await admin.rpc('start_group_stage', {
    p_player: playerId,
    p_kind: kind,
    p_def_key: defKey,
    p_party: party,
    p_stage_index: stageIndex,
    p_total_stages: def.stages.length,
    p_duration_seconds: stage.durationSeconds,
    p_lockout: GROUP_LOCKOUT[kind as GroupKind],
  })

  if (rpcErr) {
    const reason = rpcErr.message.replace(/^.*start_group_stage:\s*/, '')
    return json({ error: reason || 'Could not start stage' }, 409)
  }

  return json({ run: groupRun }, 201)
})
```

- [ ] **Step 2: Verify it type-checks and deploys**

Run: `npm run build` (Deno Edge Functions are excluded from the `tsc -b` project per this repo's `tsconfig`, so this mainly re-confirms Task 4's `src/lib/groupContent.ts` export shape is unchanged; the real check is Deno's own type-checker).
Run: `supabase functions deploy group-start-stage --no-verify-jwt` against your local stack (or `supabase functions serve` and a manual `curl`/Postman POST with a real JWT, party, kind, and defKey).
Expected: a first call for a not-yet-existing run creates a `group_runs` row and returns 201; a second call while a stage is in flight returns 409 "a stage is already in flight".

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/group-start-stage/index.ts
git commit -m "feat: add group-start-stage Edge Function"
```

---

### Task 7: `group-claim-stage` Edge Function

**Files:**
- Create: `supabase/functions/group-claim-stage/index.ts`

**Interfaces:**
- Consumes: `rollItemLoot` from `../../../src/lib/loot.ts` (Task 2); `simulateCombat`, `marginBonus`, `levelRewardBonus`, `makeRng`, `Combatant`, `Enemy` from `../../../src/lib/combat.ts`; `effectiveStats`, `finalReward`, `mergeBonuses`, `StatValue`, `StatGrowth`, `ItemDefBonuses`, `EquippedItem` from `../../../src/lib/stats.ts`; `applyXp` from `../../../src/lib/leveling.ts`; `resolveRole`, `CharacterRole` from `../../../src/lib/roles.ts`; `School` from `../../../src/lib/schools.ts`; `collectTraitBonuses`, `TraitDef`, `TraitContext` from `../../../src/lib/traits.ts`; `flattenBlessingTree`, `resolveBlessingAllocations`, `capstoneEarned`, `resolveCapstoneBonuses`, `resolveCapstoneAbility`, `RawBlessingRow`, `CapstoneDef`, `BlessingPicks` from `../../../src/lib/blessings.ts`; RPC `claim_group_stage` (Task 1).
- Produces: `POST /group-claim-stage` accepting `{ kind, defKey }`, returning the same response shape as `mission-claim` minus `firstClear`/`newlyUnlocked` (spec §3 non-goal: no acquisition-condition checks here), plus `stageIndex` and `runComplete`.

This mirrors `mission-claim`'s combatant-building (steps 5–9 of that file) exactly — same character/blessing/trait/item resolution, because that's character-intrinsic logic with no mission-specific assumptions. What's different: no map progress, no first-clear multiplier, no acquisition checks, and the RPC call advances a stage cursor instead of deleting a row.

- [ ] **Step 1: Write the function**

```typescript
// supabase/functions/group-claim-stage/index.ts
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'
import { simulateCombat, marginBonus, levelRewardBonus, makeRng, type Combatant, type Enemy } from '../../../src/lib/combat.ts'
import {
  effectiveStats, finalReward, mergeBonuses,
  type StatValue, type StatGrowth, type ItemDefBonuses, type EquippedItem,
} from '../../../src/lib/stats.ts'
import { applyXp } from '../../../src/lib/leveling.ts'
import { resolveRole, type CharacterRole } from '../../../src/lib/roles.ts'
import type { School } from '../../../src/lib/schools.ts'
import { collectTraitBonuses, partyAverageStat, type TraitDef, type TraitContext } from '../../../src/lib/traits.ts'
import {
  flattenBlessingTree, resolveBlessingAllocations, capstoneEarned,
  resolveCapstoneBonuses, resolveCapstoneAbility,
  type RawBlessingRow, type CapstoneDef, type BlessingPicks,
} from '../../../src/lib/blessings.ts'
import { rollItemLoot } from '../../../src/lib/loot.ts'

// group-claim-stage: the dungeon/raid combat resolver (spec §5). Combatant-building is IDENTICAL to
// mission-claim (character-intrinsic, not mission-specific) — deliberately not extracted into a
// shared module in this plan (spec's non-goals keep the refactor surface small; Task 3 already
// extracted the one piece that's pure ROI, the loot roll). No map progress, no first-clear
// multiplier, no acquisition-condition checks here (spec §3 non-goals).

const PARTY_BONUS_PER_EXTRA_MEMBER = 0.1

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type EnemyRow = {
  enemyKey: string; archetype?: string; health: number; attack: number; damageType: School; speed: number
  defense?: number; resistance?: number; resistances?: { school: School; value: number }[]
  block?: number; critChance?: number; critDamage?: number; armorPen?: number; dodge?: number
  healthRegen?: number; spikeEverySeconds?: number; spikeMultiplier?: number
}
type StageRow = {
  baseXp?: number
  rewards?: { kind: 'currency' | 'resource'; code: string; amount: number }[]
  loot?: { itemKey: string | null; dropChance?: number; quantityMin?: number; quantityMax?: number; rarityWeights?: { rarity: string; weight: number }[] }[]
  encounter?: { timeLimitSeconds: number; enemies: { count?: number; enemy: EnemyRow }[] } | null
}
type GroupDefRow = { stages?: StageRow[] } | null
type CharDefRow = {
  charKey: string; charClass: string; role?: CharacterRole | null; damageSchool?: School | null
  baseStats?: StatValue[]; growth?: StatGrowth[]; blessingTree?: RawBlessingRow[]
  capstone?: CapstoneDef; traits?: TraitDef[]
}
type ItemDefRow = { itemKey: string; statBonuses?: ItemDefBonuses['statBonuses'] }
type CharRow = {
  id: string; character_def_id: string; level: number; xp: number
  blessings: BlessingPicks | null; equipped: Record<string, EquippedItem> | null; current_hp: number | null
}

const CHARDEFS_GROQ = `*[_type == "characterDef" && charKey in $keys]{
  charKey, charClass, role, damageSchool,
  baseStats[]{ stat, value },
  growth[]{ stat, perLevel, milestones[]{ level, bonus } },
  blessingTree[]{ row, choices[]{ choiceId, effects[]{ stat, kind, value } } },
  capstone{ title, kind, effects[]{ stat, kind, value }, condition{ type, value }, abilityKind, abilityParams{ stat, kind, value } },
  traits[]->{ traitKey, name, condition{ type, value }, effects[]{ stat, kind, value } }
}`
const ITEMDEFS_GROQ = `*[_type == "itemDef" && itemKey in $keys]{ itemKey, statBonuses[]{ stat, kind, value } }`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Missing authorization' }, 401)

  const admin = createAdminClient()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401)
  const playerId = userData.user.id

  let body: { kind?: unknown; defKey?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const kind = body.kind
  const defKey = body.defKey
  if (kind !== 'dungeon' && kind !== 'raid') return json({ error: 'kind must be "dungeon" or "raid"' }, 400)
  if (typeof defKey !== 'string' || defKey.length === 0) return json({ error: 'defKey is required' }, 400)

  const { data: run, error: runErr } = await admin
    .from('group_runs')
    .select('current_stage_index, party, stage_started_at, stage_ends_at')
    .eq('player_id', playerId).eq('kind', kind).eq('def_key', defKey)
    .maybeSingle()
  if (runErr) return json({ error: 'Could not load run' }, 500)
  if (!run || !run.stage_ends_at) return json({ error: 'No stage in flight' }, 404)
  if (new Date(run.stage_ends_at).getTime() > Date.now()) return json({ error: 'Stage not finished' }, 409)

  const party = run.party as string[]
  const stageIndex = run.current_stage_index

  const { data: charsData, error: charsErr } = await admin
    .from('player_characters')
    .select('id, character_def_id, level, xp, blessings, equipped, current_hp')
    .in('id', party).eq('player_id', playerId)
  if (charsErr) return json({ error: 'Could not load party' }, 500)
  const chars = (charsData ?? []) as CharRow[]
  if (chars.length !== party.length) return json({ error: 'Party is missing characters' }, 500)

  const sanityType = kind === 'dungeon' ? 'dungeonDef' : 'raidDef'
  const keyField = kind === 'dungeon' ? 'dungeonKey' : 'raidKey'
  let groupDef: GroupDefRow
  let charDefs: CharDefRow[]
  let itemDefs: ItemDefRow[]
  try {
    groupDef = await sanityQuery<GroupDefRow>(
      `*[_type == "${sanityType}" && ${keyField} == $key][0]{
        stages[]{
          baseXp, rewards[]{ kind, code, amount },
          loot[]{ dropChance, quantityMin, quantityMax, rarityWeights[]{ rarity, weight }, "itemKey": item->itemKey },
          encounter->{ timeLimitSeconds, enemies[]{ count, "enemy": enemy->{ enemyKey, archetype, health, attack, damageType, speed, defense, resistance, resistances[]{ school, value }, block, critChance, critDamage, armorPen, dodge, healthRegen, spikeEverySeconds, spikeMultiplier } } }
        }
      }`,
      { key: defKey },
    )
    const charKeys = [...new Set(chars.map((c) => c.character_def_id))]
    charDefs = await sanityQuery<CharDefRow[]>(CHARDEFS_GROQ, { keys: charKeys })
    const itemKeys = [...new Set(chars.flatMap((c) => Object.values(c.equipped ?? {}).map((e) => e.itemDefId)))]
    itemDefs = itemKeys.length ? await sanityQuery<ItemDefRow[]>(ITEMDEFS_GROQ, { keys: itemKeys }) : []
  } catch (e) {
    console.error('Sanity fetch failed', e)
    return json({ error: 'Could not load stage content' }, 502)
  }
  const stage = groupDef?.stages?.[stageIndex]
  if (!stage || !stage.encounter) return json({ error: 'Stage or encounter not found' }, 404)
  const isLastStage = stageIndex === (groupDef!.stages!.length - 1)

  const charDefByKey = new Map(charDefs.map((d) => [d.charKey, d]))
  const itemDefById: Record<string, ItemDefBonuses> = Object.fromEntries(itemDefs.map((i) => [i.itemKey, { statBonuses: i.statBonuses }]))

  const traitCtx: TraitContext = {
    mapKey: null,
    enemyArchetypes: [...new Set(stage.encounter.enemies.map((l) => l.enemy.archetype).filter((a): a is string => Boolean(a)))],
    enemySchools: [...new Set(stage.encounter.enemies.map((l) => l.enemy.damageType))],
  }
  const statsById: Record<string, Record<string, number>> = {}
  const combatants: Combatant[] = []
  for (const c of chars) {
    const def = charDefByKey.get(c.character_def_id)
    if (!def) return json({ error: `Missing character definition: ${c.character_def_id}` }, 500)
    const picks = c.blessings ?? {}
    const earnedCapstone = capstoneEarned(c.level, picks)
    const stats = effectiveStats({
      level: c.level, baseStats: def.baseStats ?? [], growth: def.growth ?? [],
      blessingAllocations: resolveBlessingAllocations(picks), blessingNodes: flattenBlessingTree(def.blessingTree),
      equipped: c.equipped ?? {}, itemDefs: itemDefById,
      extraBonuses: mergeBonuses(
        collectTraitBonuses(def.traits ?? [], traitCtx),
        resolveCapstoneBonuses(def.capstone, earnedCapstone, traitCtx),
      ),
    })
    statsById[c.id] = stats
    combatants.push({
      id: c.id, role: resolveRole(def.charClass, def.role), stats,
      currentHp: c.current_hp ?? undefined, damageSchool: def.damageSchool ?? undefined,
      ability: resolveCapstoneAbility(def.capstone, earnedCapstone),
    })
  }

  const enemies: Enemy[] = []
  stage.encounter.enemies.forEach((line, li) => {
    const e = line.enemy
    for (let k = 0; k < (line.count ?? 1); k++) {
      enemies.push({
        id: `${e.enemyKey}-${li}-${k}`, health: e.health, attack: e.attack, damageType: e.damageType, speed: e.speed,
        defense: e.defense, resistance: e.resistance,
        resistances: e.resistances ? Object.fromEntries(e.resistances.map((r) => [r.school, r.value])) : undefined,
        block: e.block, critChance: e.critChance, critDamage: e.critDamage, armorPen: e.armorPen, dodge: e.dodge,
        healthRegen: e.healthRegen, spikeEverySeconds: e.spikeEverySeconds, spikeMultiplier: e.spikeMultiplier,
      })
    }
  })

  const runId = `${playerId}:${kind}:${defKey}:${stageIndex}`
  const result = simulateCombat({ party: combatants, encounter: { enemies, timeLimitSeconds: stage.encounter.timeLimitSeconds }, seed: runId })
  const win = result.outcome === 'win'

  const mods = {
    marginBonus: marginBonus(result.survivingHpPct),
    levelBonus: levelRewardBonus(chars.map((c) => c.level)),
    partyBonus: (chars.length - 1) * PARTY_BONUS_PER_EXTRA_MEMBER,
    transcendenceBonus: 0, // group content doesn't fold in transcendence (spec is silent; kept simple for v1)
  }
  const baseXp = typeof stage.baseXp === 'number' ? stage.baseXp : 0

  const charUpdates = chars.map((c) => {
    const endHp = Math.round(result.endingHp[c.id] ?? 0)
    let level = c.level
    let xp = c.xp
    if (win && endHp > 0 && baseXp > 0) {
      const xpMult = 1 + Math.max(0, statsById[c.id]?.xpGain ?? 0) / 100
      const gained = Math.round(finalReward(baseXp, mods) * xpMult)
      const rolled = applyXp(c.level, c.xp, gained)
      level = rolled.level
      xp = rolled.xp
    }
    return { id: c.id, level, xp, current_hp: endHp }
  })

  const partyStats = chars.map((c) => statsById[c.id] ?? {})
  const goldMult = 1 + Math.max(0, partyAverageStat(partyStats, 'goldFind')) / 100
  const magicFind = Math.max(0, partyAverageStat(partyStats, 'magicFind'))
  const luck = Math.max(0, partyAverageStat(partyStats, 'luck'))
  const currencies: Record<string, number> = {}
  const resources: Record<string, number> = {}
  let loot: { item_def_id: string; rarity: string; quantity: number }[] = []
  if (win) {
    for (const r of stage.rewards ?? []) {
      const isGold = r.kind === 'currency' && r.code === 'gold'
      const amount = Math.round(finalReward(r.amount, mods) * (isGold ? goldMult : 1))
      if (amount <= 0) continue
      const bucket = r.kind === 'resource' ? resources : currencies
      bucket[r.code] = (bucket[r.code] ?? 0) + amount
    }
    const lootRng = makeRng(`${runId}:loot`)
    loot = rollItemLoot(stage.loot ?? [], lootRng, { magicFind, luck })
  }

  const { data: claimData, error: claimErr } = await admin.rpc('claim_group_stage', {
    p_player: playerId, p_kind: kind, p_def_key: defKey, p_won: win,
    p_char_updates: charUpdates, p_loot: loot, p_currencies: currencies, p_resources: resources,
    p_is_last_stage: isLastStage,
  })
  if (claimErr) {
    console.error('claim_group_stage failed', claimErr)
    const reason = claimErr.message.replace(/^.*claim_group_stage:\s*/, '')
    return json({ error: reason || 'Could not claim stage' }, 409)
  }

  return json({
    outcome: result.outcome, reason: result.reason, survivingHpPct: result.survivingHpPct,
    durationSeconds: result.durationSeconds,
    rewards: { currencies, resources, loot },
    characters: charUpdates,
    stageIndex, runComplete: win && isLastStage,
  }, 200)
})
```

- [ ] **Step 2: Verify it deploys and resolves a stage**

Run: `supabase functions serve` locally, dispatch a stage via Task 6's function, wait for `stage_ends_at`, then POST to `group-claim-stage` with the same `kind`/`defKey` and a valid session JWT.
Expected: 200 with `outcome`, `characters`, `stageIndex`; `group_runs.current_stage_index` increments on a win (or `status` flips to `complete` if `runComplete: true`), stays put and `party` clears on a loss.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/group-claim-stage/index.ts
git commit -m "feat: add group-claim-stage Edge Function"
```

---

### Task 8: Hand-patch `database.types.ts` for `group_runs`

**Files:**
- Modify: `src/types/database.types.ts`

**Interfaces:**
- Produces: `Tables<'group_runs'>` resolving to `{ player_id: string; kind: 'dungeon' | 'raid'; def_key: string; current_stage_index: number; status: 'in_progress' | 'complete'; party: string[]; stage_started_at: string | null; stage_ends_at: string | null; last_cleared_at: string | null }`.

- [ ] **Step 1: Add the table entry**

Find the `Tables` object in `src/types/database.types.ts` (same place `mission_runs` and `profiles` are hand-patched, per this repo's accepted "no live DB connection for `supabase gen types`" workaround, ADR-0048 consequences). Add a `group_runs` entry matching the migration's columns exactly:

```typescript
group_runs: {
  Row: {
    player_id: string
    kind: 'dungeon' | 'raid'
    def_key: string
    current_stage_index: number
    status: 'in_progress' | 'complete'
    party: string[]
    stage_started_at: string | null
    stage_ends_at: string | null
    last_cleared_at: string | null
  }
  Insert: never // all writes go through the RPCs — no direct client insert (ADR-0003)
  Update: never
  Relationships: []
}
```

- [ ] **Step 2: Verify the type resolves**

Run: `npm run build`
Expected: PASS — confirms `Tables<'group_runs'>` (used by Task 9's service layer) type-checks.

- [ ] **Step 3: Commit**

```bash
git add src/types/database.types.ts
git commit -m "chore: hand-patch database.types.ts for group_runs"
```

---

### Task 9: `src/services/groupContent.ts`

**Files:**
- Create: `src/services/groupContent.ts`
- Create: `src/services/groupContent.test.ts`

**Interfaces:**
- Consumes: `sanity` from `./sanity`; `supabase` from `@/lib/supabase`; `invokeError` from `./_invoke`; `Tables` from `@/types/database.types` (Task 8); `School` from `@/lib/schools`.
- Produces: `type GroupRun = Tables<'group_runs'>`, `fetchDungeons(): Promise<GroupContentView[]>`, `fetchRaids(): Promise<GroupContentView[]>`, `fetchGroupRuns(): Promise<GroupRun[]>`, `fetchGroupBusyCharacterIds(): Promise<string[]>`, `startGroupStage(kind, defKey, party): Promise<GroupRun>`, `claimGroupStage(kind, defKey): Promise<GroupClaimResponse>`.

- [ ] **Step 1: Write the failing tests** (mocking pattern from `src/services/recruits.test.ts`)

```typescript
// src/services/groupContent.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./sanity', () => ({ sanity: { fetch: vi.fn() } }))
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(), functions: { invoke: vi.fn() } },
}))

import { sanity } from './sanity'
import { supabase } from '@/lib/supabase'
import { fetchDungeons, fetchGroupBusyCharacterIds, startGroupStage } from './groupContent'

describe('fetchDungeons', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries Sanity for dungeonDef documents', async () => {
    vi.mocked(sanity.fetch).mockResolvedValue([{ dungeonKey: 'emberdeep-vault', name: 'Emberdeep Vault', theme: 'fire' }] as never)
    const result = await fetchDungeons()
    expect(result).toEqual([{ dungeonKey: 'emberdeep-vault', name: 'Emberdeep Vault', theme: 'fire' }])
    expect(sanity.fetch).toHaveBeenCalledTimes(1)
    const [query] = vi.mocked(sanity.fetch).mock.calls[0]
    expect(query).toContain('dungeonDef')
  })
})

describe('fetchGroupBusyCharacterIds', () => {
  beforeEach(() => vi.clearAllMocks())

  it('flattens the party arrays of every in-flight group run', async () => {
    const eq = vi.fn().mockReturnThis()
    const not = vi.fn().mockResolvedValue({
      data: [{ party: ['a', 'b'] }, { party: ['c'] }],
      error: null,
    })
    vi.mocked(supabase.from).mockReturnValue({ select: vi.fn().mockReturnThis(), not } as never)
    const result = await fetchGroupBusyCharacterIds()
    expect(result).toEqual(['a', 'b', 'c'])
  })
})

describe('startGroupStage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invokes group-start-stage with kind/defKey/party', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { run: { def_key: 'x' } }, error: null } as never)
    const result = await startGroupStage('dungeon', 'emberdeep-vault', ['a', 'b'])
    expect(supabase.functions.invoke).toHaveBeenCalledWith('group-start-stage', {
      body: { kind: 'dungeon', defKey: 'emberdeep-vault', party: ['a', 'b'] },
    })
    expect(result).toEqual({ def_key: 'x' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/groupContent.test.ts`
Expected: FAIL with "Cannot find module './groupContent'".

- [ ] **Step 3: Write the implementation**

```typescript
// src/services/groupContent.ts
import { supabase } from '@/lib/supabase'
import { sanity } from './sanity'
import type { School } from '@/lib/schools'
import type { Tables } from '@/types/database.types'
import { invokeError } from './_invoke'

// Dungeons & raids data layer (docs/superpowers/specs/2026-09-08-dungeons-and-raids-design.md) —
// same three-layer shape as src/services/missions.ts: authored content from Sanity, runtime state
// from Supabase (RLS owner-scoped read), writes through the server-authoritative Edge Functions.

export type GroupKind = 'dungeon' | 'raid'
export type GroupRun = Tables<'group_runs'>

export type GroupContentView = {
  dungeonKey?: string
  raidKey?: string
  name: string
  theme: School
  description?: string
  stageCount: number
}

const DUNGEONS_QUERY = `*[_type == "dungeonDef"]{ dungeonKey, name, theme, description, "stageCount": count(stages) }`
const RAIDS_QUERY = `*[_type == "raidDef"]{ raidKey, name, theme, description, "stageCount": count(stages) }`

export async function fetchDungeons(): Promise<GroupContentView[]> {
  return sanity.fetch(DUNGEONS_QUERY)
}

export async function fetchRaids(): Promise<GroupContentView[]> {
  return sanity.fetch(RAIDS_QUERY)
}

export async function fetchGroupRuns(): Promise<GroupRun[]> {
  const { data, error } = await supabase.from('group_runs').select('*')
  if (error) throw error
  return data
}

/** Character ids currently mid-stage on ANY dungeon/raid run (party is only non-empty while a
 *  stage is in flight, spec §5) — feeds useRoster's `busy` derivation. */
export async function fetchGroupBusyCharacterIds(): Promise<string[]> {
  const { data, error } = await supabase.from('group_runs').select('party').not('party', 'eq', '{}')
  if (error) throw error
  return (data ?? []).flatMap((r) => r.party as string[])
}

export type GroupClaimResponse = {
  outcome: 'win' | 'loss'
  reason: string
  survivingHpPct: number
  durationSeconds: number
  rewards: { currencies: Record<string, number>; resources: Record<string, number>; loot: { item_def_id: string; rarity: string; quantity: number }[] }
  characters: { id: string; level: number; xp: number; current_hp: number }[]
  stageIndex: number
  runComplete: boolean
}

export async function startGroupStage(kind: GroupKind, defKey: string, party: string[]): Promise<GroupRun> {
  const { data, error } = await supabase.functions.invoke('group-start-stage', { body: { kind, defKey, party } })
  if (error) await invokeError(error, 'Could not start stage')
  return data.run as GroupRun
}

export async function claimGroupStage(kind: GroupKind, defKey: string): Promise<GroupClaimResponse> {
  const { data, error } = await supabase.functions.invoke('group-claim-stage', { body: { kind, defKey } })
  if (error) await invokeError(error, 'Could not claim stage')
  return data as GroupClaimResponse
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/groupContent.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/groupContent.ts src/services/groupContent.test.ts
git commit -m "feat: add src/services/groupContent.ts data layer"
```

---

### Task 10: Extend `useRoster`'s busy derivation

**Files:**
- Modify: `src/hooks/useRoster.ts:4` (import), `:87` (type), `:90-161` (hook body)

**Interfaces:**
- Consumes: `fetchGroupBusyCharacterIds` from `@/services/groupContent` (Task 9).
- Produces: `RosterMember.busy` widened to `'mission' | 'gathering' | 'infirmary' | 'group' | null`.

- [ ] **Step 1: Add the import**

Change line 3 area's imports to add:

```typescript
import { fetchGroupBusyCharacterIds } from '@/services/groupContent'
```

- [ ] **Step 2: Widen the `busy` type**

Change (line 87):

```typescript
  busy: 'mission' | 'gathering' | 'infirmary' | null
```

to:

```typescript
  busy: 'mission' | 'gathering' | 'infirmary' | 'group' | null
```

- [ ] **Step 3: Add the query and fold it into the busy derivation**

Add alongside the other private query hooks (after `useInfirmaryAdmissions`, before `useCharacterDefs`):

```typescript
function useGroupBusyCharacterIds() {
  return useQuery({ queryKey: ['groupBusyCharacterIds'], queryFn: fetchGroupBusyCharacterIds })
}
```

In `useRoster()`, add the hook call alongside the others:

```typescript
  const groupBusy = useGroupBusyCharacterIds()
```

and extend the `Set` construction:

```typescript
  const inGroupContent = new Set(groupBusy.data ?? [])
```

Change the `busy:` resolution (currently `gathering.has → onMission.has → admitted.has → null`) to check `inGroupContent` too:

```typescript
        busy: gathering.has(c.id)
          ? 'gathering'
          : onMission.has(c.id)
            ? 'mission'
            : admitted.has(c.id)
              ? 'infirmary'
              : inGroupContent.has(c.id)
                ? 'group'
                : null,
```

Add `groupBusy.data` to the `useMemo` dependency array, and `groupBusy.isLoading`/`groupBusy.error` to the returned `isLoading`/`error` (same pattern as the other five query hooks already there).

- [ ] **Step 4: Verify**

Run: `npm run build && npx vitest run`
Expected: PASS — no existing test mocks `useRoster` directly (it's exercised indirectly through component tests, if any), so this is a build + full-suite check rather than a new dedicated test file.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useRoster.ts
git commit -m "feat: teach useRoster about dungeon/raid busy state"
```

---

### Task 11: Promote `CharacterTile` to the shared UI kit

**Files:**
- Create: `src/components/molecules/CharacterTile.tsx`
- Modify: `src/features/missions/components/dispatchParts.tsx` (remove `CharacterTile`)
- Modify: `src/features/missions/components/MissionDispatch.tsx:9` (import path)

**Interfaces:**
- Produces: `CharacterTile({ char, selected, disabled, onToggle, traitCtx })` where `char: { id: string; name: string; charClass: string; level: number; role?: CharacterRole | null; damageSchool?: School; traits?: TraitDef[]; busy?: string | null; downed?: boolean }` — a generalized shape any feature's roster-derived type can satisfy structurally (both `DispatchChar` and Task 12's group-content roster view already have these fields).

CLAUDE.md's rule: "used by one feature → lives inside it. Needed by a second feature → promote it up to the shared layer." `CharacterTile` is about to gain a second consumer (Task 12's party picker) — promote it now rather than duplicate it.

- [ ] **Step 1: Create the promoted component** (identical body to the current `CharacterTile`, generalized prop type — no `DispatchChar` import)

```typescript
// src/components/molecules/CharacterTile.tsx
import { RoleBadge } from '@/components/atoms/RoleBadge'
import { SchoolBadge } from '@/components/atoms/SchoolBadge'
import { TraitChips } from '@/components/molecules/TraitChips'
import { resolveRole, type CharacterRole } from '@/lib/roles'
import { traitActive, type TraitContext, type TraitDef } from '@/lib/traits'
import type { School } from '@/lib/schools'

// A selectable roster row for any party-picker (mission dispatch, dungeon/raid). Promoted from
// src/features/missions/components/dispatchParts.tsx once a second consumer (groupContent)
// appeared — CLAUDE.md's "needed by a second feature -> promote to the shared layer" rule.
export type CharacterTileChar = {
  id: string
  name: string
  charClass: string
  level: number
  role?: CharacterRole | null
  damageSchool?: School
  traits?: TraitDef[]
  busy?: string | null
  downed?: boolean
}

export function CharacterTile({ char, selected, disabled, onToggle, traitCtx }: {
  char: CharacterTileChar
  selected: boolean
  disabled?: boolean
  onToggle: () => void
  traitCtx: TraitContext
}) {
  const note = char.busy ?? (char.downed ? 'Downed' : null)
  const traits = char.traits ?? []
  const activeKeys = new Set(traits.filter((t) => traitActive(t, traitCtx)).map((t) => t.traitKey))
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'left', width: '100%',
        padding: '14px 16px', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'Georgia, serif',
        border: `2px solid ${selected ? 'var(--color-gold-mid)' : 'var(--color-gold-dark)'}`,
        background: selected ? 'linear-gradient(180deg, #34161a 0%, #1e0a0c 100%)' : 'linear-gradient(180deg, #1a0a0c 0%, #100305 100%)',
        opacity: disabled ? 0.45 : 1,
        boxShadow: selected
          ? '0 0 0 1px #080101, 0 0 14px rgba(200,140,30,0.35), inset 0 1px 0 rgba(255,255,255,0.07)'
          : '0 0 0 1px #080101, inset 0 1px 0 rgba(255,255,255,0.05)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      <div style={{
        width: 52, height: 64, flexShrink: 0, borderRadius: '4px',
        border: '2px solid var(--color-gold-dark)',
        background: 'linear-gradient(180deg, #1a0608 0%, #0d0304 100%)',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <p style={{ color: 'var(--color-text-primary)', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{char.name}</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
            {char.charClass} · Lv {char.level}{note ? ` · ${note}` : ''}
          </p>
        </div>
        <div style={{ marginTop: '7px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <RoleBadge role={resolveRole(char.charClass, char.role)} size="sm" />
          {char.damageSchool && <SchoolBadge school={char.damageSchool} size="sm" />}
        </div>
        {traits.length > 0 && (
          <div style={{ marginTop: '7px' }}>
            <TraitChips traits={traits} activeKeys={activeKeys} />
          </div>
        )}
      </div>
      <span style={{
        width: 20, height: 20, flexShrink: 0, borderRadius: '50%',
        border: `2px solid ${selected ? 'var(--color-gold-mid)' : 'var(--color-gold-dark)'}`,
        background: selected ? 'radial-gradient(circle at 40% 35%, #f0d060, #7a4f10)' : 'transparent',
        boxShadow: selected ? '0 0 6px rgba(200,140,30,0.6)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#1a0608', fontSize: '12px', fontWeight: 'bold',
      }}>{selected ? '✓' : ''}</span>
    </button>
  )
}
```

- [ ] **Step 2: Remove `CharacterTile` from `dispatchParts.tsx`, re-export nothing extra**

Delete the `CharacterTile` function (and its now-unused `DispatchChar`/`TraitContext` imports if `InfoStat`/`RewardRow` don't need them — check: `InfoStat`/`RewardRow` use neither, so remove the `DispatchChar` import and the `traitActive`/`TraitContext` import from this file, keeping only what `InfoStat`/`RewardRow` need, which is nothing beyond React).

- [ ] **Step 3: Update `MissionDispatch.tsx`'s import**

Change:

```typescript
import { InfoStat, RewardRow, CharacterTile } from './dispatchParts'
```

to:

```typescript
import { InfoStat, RewardRow } from './dispatchParts'
import { CharacterTile } from '@/components/molecules/CharacterTile'
```

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run build`
Expected: PASS — `MissionDispatch.tsx`'s `roster.map(c => <CharacterTile char={c} .../>)` call still type-checks because `DispatchChar` structurally satisfies the new `CharacterTileChar` shape (same fields).

- [ ] **Step 5: Commit**

```bash
git add src/components/molecules/CharacterTile.tsx src/features/missions/components/dispatchParts.tsx src/features/missions/components/MissionDispatch.tsx
git commit -m "refactor: promote CharacterTile to the shared UI kit"
```

---

### Task 12: `src/features/groupContent/` — hooks + party picker

**Files:**
- Create: `src/features/groupContent/hooks.ts`
- Create: `src/features/groupContent/components/GroupPartyPicker.tsx`

**Interfaces:**
- Consumes: `fetchDungeons`, `fetchRaids`, `fetchGroupRuns`, `startGroupStage`, `claimGroupStage`, `GroupKind` from `@/services/groupContent` (Task 9); `GROUP_PARTY_CAP` from `@/lib/groupContent` (Task 4); `useRoster`, `RosterMember` from `@/hooks/useRoster` (Task 10); `CharacterTile` from `@/components/molecules/CharacterTile` (Task 11).
- Produces: `useDungeons()`, `useRaids()`, `useGroupRuns()`, `useStartGroupStage()`, `useClaimGroupStage()`; `GroupPartyPicker({ roster, cap, selected, onToggle })`.

- [ ] **Step 1: Write `hooks.ts`** (same shape as `src/features/missions/hooks.ts`)

```typescript
// src/features/groupContent/hooks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchDungeons, fetchRaids, fetchGroupRuns, startGroupStage, claimGroupStage, type GroupKind } from '@/services/groupContent'

export function useDungeons() {
  return useQuery({ queryKey: ['dungeons'], queryFn: fetchDungeons })
}
export function useRaids() {
  return useQuery({ queryKey: ['raids'], queryFn: fetchRaids })
}
export function useGroupRuns() {
  return useQuery({ queryKey: ['groupRuns'], queryFn: fetchGroupRuns })
}

export function useStartGroupStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ kind, defKey, party }: { kind: GroupKind; defKey: string; party: string[] }) =>
      startGroupStage(kind, defKey, party),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['groupRuns'] })
      void qc.invalidateQueries({ queryKey: ['groupBusyCharacterIds'] })
    },
  })
}

export function useClaimGroupStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ kind, defKey }: { kind: GroupKind; defKey: string }) => claimGroupStage(kind, defKey),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['groupRuns'] })
      void qc.invalidateQueries({ queryKey: ['groupBusyCharacterIds'] })
      void qc.invalidateQueries({ queryKey: ['ownedCharacters'] })
      void qc.invalidateQueries({ queryKey: ['profile'] })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}
```

- [ ] **Step 2: Write `GroupPartyPicker.tsx`** (generalizes `MissionDispatch`'s right-column party panel to an arbitrary `cap`)

```typescript
// src/features/groupContent/components/GroupPartyPicker.tsx
import { SectionLabel } from '@/components/molecules/SectionLabel'
import { CharacterTile } from '@/components/molecules/CharacterTile'
import type { RosterMember } from '@/hooks/useRoster'
import type { TraitContext } from '@/lib/traits'

// The dungeon/raid party panel — same visual language as MissionDispatch's right column, but the
// slot cap is a prop (5 for dungeons, 10 for raids, spec §4d) instead of a hardcoded 3.
export function GroupPartyPicker({ roster, cap, selected, onToggle, traitCtx }: {
  roster: RosterMember[]
  cap: number
  selected: string[]
  onToggle: (id: string) => void
  traitCtx: TraitContext
}) {
  return (
    <div className="atom-heavy" style={{
      borderRadius: 6, border: '2px solid var(--color-gold-dark)',
      background: 'linear-gradient(180deg, #180709 0%, #0e0304 100%)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      maxHeight: 'min(620px, 70vh)',
    }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--color-gold-dark)', flexShrink: 0 }}>
        <SectionLabel>Select Party — {selected.length}/{cap}</SectionLabel>
      </div>
      <div className="scrollbar-fantasy" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {roster.map((c) => {
          const isSelected = selected.includes(c.id)
          const unavailable = Boolean(c.busy) || c.currentHp === 0
          return (
            <CharacterTile
              key={c.id}
              char={{ ...c, busy: c.busy, downed: c.currentHp === 0 }}
              selected={isSelected}
              disabled={unavailable || (!isSelected && selected.length >= cap)}
              onToggle={() => onToggle(c.id)}
              traitCtx={traitCtx}
            />
          )
        })}
        {roster.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 11, fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>
            No available characters — recruit or free up your party.
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/groupContent/hooks.ts src/features/groupContent/components/GroupPartyPicker.tsx
git commit -m "feat: add groupContent hooks and party picker"
```

---

### Task 13: `GroupContentPage`, stage progress view, barrel, routing

**Files:**
- Create: `src/features/groupContent/components/StageProgress.tsx`
- Create: `src/features/groupContent/GroupContentPage.tsx`
- Create: `src/features/groupContent/index.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: everything from Tasks 9–12; `formatRemaining` from `@/lib/time`; `GROUP_PARTY_CAP` from `@/lib/groupContent`.
- Produces: routed page at `/dungeons` and `/raids` (same component, different `kind` prop), feature barrel `src/features/groupContent/index.ts`.

- [ ] **Step 1: `StageProgress.tsx`** — current stage / countdown / lockout state

```typescript
// src/features/groupContent/components/StageProgress.tsx
import { useEffect, useState } from 'react'
import { formatRemaining } from '@/lib/time'
import type { GroupRun } from '@/services/groupContent'

export function StageProgress({ run, stageCount, lockoutBoundary }: {
  run: GroupRun | undefined
  stageCount: number
  lockoutBoundary: Date | null
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (run?.status === 'complete' && lockoutBoundary) {
    return (
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
        Cleared — available again in {formatRemaining(lockoutBoundary.getTime() - now)}.
      </p>
    )
  }

  const stageIndex = run?.current_stage_index ?? 0
  const inFlight = run?.stage_ends_at ? new Date(run.stage_ends_at).getTime() : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p style={{ color: 'var(--color-text-primary)', fontSize: 13 }}>Stage {stageIndex + 1} / {stageCount}</p>
      {inFlight != null && (
        <p style={{ color: 'var(--color-text-gold)', fontSize: 13, fontWeight: 'bold' }}>
          {formatRemaining(inFlight - now)}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: `GroupContentPage.tsx`**

```typescript
// src/features/groupContent/GroupContentPage.tsx
import { useState } from 'react'
import { PrimaryButton } from '@/components/atoms/Button'
import { useRoster } from '@/hooks/useRoster'
import { GROUP_PARTY_CAP, GROUP_LOCKOUT, nextResetBoundary, type GroupKind } from '@/lib/groupContent'
import { useDungeons, useRaids, useGroupRuns, useStartGroupStage, useClaimGroupStage } from './hooks'
import { GroupPartyPicker } from './components/GroupPartyPicker'
import { StageProgress } from './components/StageProgress'

// One page, two routes (/dungeons, /raids) — `kind` picks which content list and party cap apply.
// Same page-composition pattern as MissionsPage: fetch content + runtime state, compose a picker.
export function GroupContentPage({ kind }: { kind: GroupKind }) {
  const { roster } = useRoster()
  const dungeons = useDungeons()
  const raids = useRaids()
  const content = kind === 'dungeon' ? dungeons.data : raids.data
  const runs = useGroupRuns()
  const startStage = useStartGroupStage()
  const claimStage = useClaimGroupStage()
  const [selectedDefKey, setSelectedDefKey] = useState<string | null>(null)
  const [party, setParty] = useState<string[]>([])

  const cap = GROUP_PARTY_CAP[kind]
  const toggle = (id: string) =>
    setParty((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= cap ? prev : [...prev, id]))

  const active = content?.find((c) => (kind === 'dungeon' ? c.dungeonKey : c.raidKey) === selectedDefKey)
  const defKey = kind === 'dungeon' ? active?.dungeonKey : active?.raidKey
  const run = runs.data?.find((r) => r.kind === kind && r.def_key === defKey)
  const lockoutBoundary = run?.last_cleared_at ? nextResetBoundary(run.last_cleared_at, GROUP_LOCKOUT[kind]) : null
  const isLockedOut = run?.status === 'complete' && lockoutBoundary != null && Date.now() < lockoutBoundary.getTime()
  const stageInFlight = Boolean(run?.stage_ends_at) && new Date(run!.stage_ends_at!).getTime() > Date.now()
  const canClaim = Boolean(run?.stage_ends_at) && !stageInFlight

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 24 }}>
      <h1 style={{ color: 'var(--color-text-gold)', fontSize: 22 }}>{kind === 'dungeon' ? 'Dungeons' : 'Raids'}</h1>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {(content ?? []).map((c) => {
          const key = kind === 'dungeon' ? c.dungeonKey! : c.raidKey!
          return (
            <button key={key} type="button" onClick={() => setSelectedDefKey(key)}
              style={{ padding: '10px 16px', border: '2px solid var(--color-gold-dark)', borderRadius: 6, background: selectedDefKey === key ? 'var(--color-gold-mid)' : 'transparent', cursor: 'pointer' }}>
              {c.name}
            </button>
          )
        })}
      </div>

      {active && defKey && (
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <StageProgress run={run} stageCount={active.stageCount} lockoutBoundary={lockoutBoundary} />
            {canClaim && (
              <PrimaryButton onClick={() => claimStage.mutate({ kind, defKey })}>Claim</PrimaryButton>
            )}
            {!isLockedOut && !stageInFlight && !canClaim && (
              <PrimaryButton disabled={party.length === 0 || startStage.isPending}
                onClick={() => startStage.mutate({ kind, defKey, party })}>
                {startStage.isPending ? 'Sending…' : `Send Party (${party.length})`}
              </PrimaryButton>
            )}
          </div>
          {!isLockedOut && !stageInFlight && !canClaim && (
            <div style={{ flex: 1 }}>
              <GroupPartyPicker roster={roster} cap={cap} selected={party} onToggle={toggle} traitCtx={{ mapKey: null, enemyArchetypes: [], enemySchools: [] }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Barrel**

```typescript
// src/features/groupContent/index.ts
// Public API of the groupContent feature (dungeons + raids). Import from '@/features/groupContent'
// — never reach into ./components/* from outside the feature.
export { GroupContentPage } from './GroupContentPage'
```

- [ ] **Step 4: Route wiring**

In `src/App.tsx`, add the import alongside the other feature/page imports:

```typescript
import { GroupContentPage } from '@/features/groupContent'
```

and two routes alongside the existing ones (after `/mines`, matching the existing indentation):

```typescript
            <Route path="/dungeons" element={<GroupContentPage kind="dungeon" />} />
            <Route path="/raids" element={<GroupContentPage kind="raid" />} />
```

- [ ] **Step 5: Verify**

Run: `npm run lint && npm run build && npx vitest run`
Expected: all PASS. Then manually: `npm run dev`, sign in, navigate to `/dungeons` and `/raids`, confirm the page renders with no console errors (empty lists are expected until Tasks 14–15 author content).

- [ ] **Step 6: Commit**

```bash
git add src/features/groupContent/components/StageProgress.tsx src/features/groupContent/GroupContentPage.tsx src/features/groupContent/index.ts src/App.tsx
git commit -m "feat: add GroupContentPage and wire /dungeons, /raids routes"
```

---

### Task 14: Reference content — dungeon "Emberdeep Vault"

**Files:** none (Sanity content only, authored via the Sanity MCP tools or Studio UI — not a code change).

Gated on Gravemarch (T2 boss tier). All enemy stats below are `scripts/balance/enemies.ts`'s **unmodified** T2 template values (`TIER_GROWTH ** 1 = 1.8`) — `damageType` is overridden to `fire` on every enemy (the theme), which is the one deliberate content choice; magnitudes are untouched, so no balance sweep is required (Global Constraints, spec §7).

T2 template math: `basic` hp=round(120×1.8)=216, atk=round(12×1.8)=22, def=round(5×1.8)=9; `swarm` hp=round(120×1.8×0.4)=86, atk=round(12×1.8×0.7)=15, def=9; `boss` hp=round(120×1.8×5)=1080, atk=round(12×1.8×1.5)=32, def=9, speed=10 for all (flat, ADR-0024). Tier ≤2 → no resistances (template rule).

- [ ] **Step 1: Create 3 `enemyDef` documents**

| itemKey (enemyKey) | name | archetype | health | attack | defense | speed | damageType |
|---|---|---|---|---|---|---|---|
| `enemy.emberdeep-basic` | Ember Wisp | basic | 216 | 22 | 9 | 10 | fire |
| `enemy.emberdeep-swarm` | Cinder Mote | swarm | 86 | 15 | 9 | 10 | fire |
| `enemy.emberdeep-boss` | The Smoldering Warden | boss | 1080 | 32 | 9 | 10 | fire |

`enemy.emberdeep-boss` also gets `spikeEverySeconds: 20`, `spikeMultiplier: 2.5` (ADR-0039 boss-spike convention).

- [ ] **Step 2: Create 4 `encounterDef` documents** (`timeLimitSeconds: 180` per ADR-0025 on all)

| encounterKey | enemies |
|---|---|
| `encounter.emberdeep-trash` | 2× `enemy.emberdeep-basic` |
| `encounter.emberdeep-boss1` | 1× `enemy.emberdeep-boss` + 1× `enemy.emberdeep-swarm` |
| `encounter.emberdeep-boss2` | 1× `enemy.emberdeep-boss` + 2× `enemy.emberdeep-swarm` |
| `encounter.emberdeep-boss3` | 1× `enemy.emberdeep-boss` + 3× `enemy.emberdeep-swarm` |

- [ ] **Step 3: Create 3 themed boss `itemDef` documents** (stat bonuses verified against `src/lib/itemBudget.ts`'s `auditItem` — shown per item; `RATE_TOLERANCE = 0.45` applies since all three have `minLevel > 3`)

| itemKey | name | slot | minLevel | statBonuses | rate check |
|---|---|---|---|---|---|
| `item.emberfang-gauntlets` | Emberfang Gauntlets | hands | 8 | `attack +6` (flat) | cost=6, rate=6/8=0.75 — hands target 0.7, band [0.385, 1.015] ✓ |
| `item.cinderforge-plate` | Cinderforge Plate | chest | 8 | `health +30` (flat), `defense +3` (flat) | cost=30×0.15+3=7.5, rate=7.5/8=0.9375 — chest target 0.75, band [0.4125, 1.0875] ✓ |
| `item.emberdeep-crown` | Emberdeep Crown | head | 12 | `intelligence +7` (flat), `health +20` (flat) | cost=7+20×0.15=10, rate=10/12=0.833 — head target 0.7, band [0.385, 1.015] ✓ |

Descriptions (flavor-text convention, `docs/ITEMS.md`): "Emberfang Gauntlets" — "Scaled in dying embers; the Warden's own claw-marks still smoke." "Cinderforge Plate" — "Forged in the Vault's furnace heart, still hot to the touch." "Emberdeep Crown" — "Worn by the Smoldering Warden itself — flame given a shape that thinks."

- [ ] **Step 4: Create the `dungeonDef` document**

`name`: "Emberdeep Vault", `dungeonKey`: `emberdeep-vault`, `theme`: `fire`, `mapGate`: reference to the `gravemarch` `mapDef`, `description`: "A buried furnace-temple beneath Gravemarch's barrows, where something old still burns."

`stages` (exactly 9, in order):

| # | kind | encounter | durationSeconds | baseXp | loot |
|---|---|---|---|---|---|
| 1 | trash | `encounter.emberdeep-trash` | 300 | 20 | rewards: gold 15 |
| 2 | trash | `encounter.emberdeep-trash` | 300 | 20 | rewards: gold 15 |
| 3 | boss | `encounter.emberdeep-boss1` | 3600 | 150 | rewards: gold 80; loot: `item.emberfang-gauntlets` dropChance 60, rarityWeights Rare:60/Epic:40 |
| 4 | trash | `encounter.emberdeep-trash` | 300 | 20 | rewards: gold 15 |
| 5 | trash | `encounter.emberdeep-trash` | 300 | 20 | rewards: gold 15 |
| 6 | boss | `encounter.emberdeep-boss2` | 3600 | 200 | rewards: gold 100; loot: `item.cinderforge-plate` dropChance 60, rarityWeights Rare:50/Epic:50 |
| 7 | trash | `encounter.emberdeep-trash` | 300 | 20 | rewards: gold 15 |
| 8 | trash | `encounter.emberdeep-trash` | 300 | 20 | rewards: gold 15 |
| 9 | boss | `encounter.emberdeep-boss3` | 5400 | 300 | rewards: gold 150; loot: `item.emberdeep-crown` dropChance 60, rarityWeights Epic:85/Legendary:5 |

- [ ] **Step 5: Verify in Studio**

Open the new `dungeonDef` document in Sanity Studio. Expected: no validation errors (the `stages` custom validator from Task 5 confirms the 3×(trash,trash,boss) pattern), all `itemDef` stat-bonus fields show green (no `itemBudgetError` banner).

- [ ] **Step 6: Commit** — content lives in Sanity, not this repo; no git commit for this task. Note the dungeon's key (`emberdeep-vault`) in the PR description for Task 17.

---

### Task 15: Reference content — raid "Duskmaw Reliquary"

**Files:** none (Sanity content only).

Gated on Frosthollow (T4 boss tier). T4 template math (`scale = 1.8^3 = 5.832`): `basic` hp=round(120×5.832)=700, atk=round(12×5.832)=70, def=round(5×5.832)=29; `swarm` hp=round(120×5.832×0.4)=280, atk=round(12×5.832×0.7)=49, def=29; `boss` hp=round(120×5.832×5)=3499, atk=round(12×5.832×1.5)=105, def=29; speed=10 for all. Tier ≤5 → template's mid-game rule: boss resists its own school at 100 (`resistancesFor`, `enemies.ts:64-68`). `damageType` overridden to `shadow` (theme) on every enemy — same "one deliberate content choice, magnitudes untouched" as Task 14, so no sweep required.

- [ ] **Step 1: Create 3 `enemyDef` documents**

| itemKey (enemyKey) | name | archetype | health | attack | defense | speed | damageType | resistances |
|---|---|---|---|---|---|---|---|---|
| `enemy.duskmaw-basic` | Duskmaw Adherent | basic | 700 | 70 | 29 | 10 | shadow | — |
| `enemy.duskmaw-swarm` | Duskmaw Wisp | swarm | 280 | 49 | 29 | 10 | shadow | — |
| `enemy.duskmaw-boss` | The Reliquary Warden | boss | 3499 | 105 | 29 | 10 | shadow | shadow: 100 |

`enemy.duskmaw-boss` also gets `spikeEverySeconds: 20`, `spikeMultiplier: 2.5`.

- [ ] **Step 2: Create 2 `encounterDef` documents** (`timeLimitSeconds: 180`)

| encounterKey | enemies |
|---|---|
| `encounter.duskmaw-trash` | 3× `enemy.duskmaw-basic` |
| `encounter.duskmaw-boss` | 1× `enemy.duskmaw-boss` + 2× `enemy.duskmaw-swarm` |

- [ ] **Step 3: Create 1 themed boss `itemDef` document**

| itemKey | name | slot | minLevel | statBonuses | rate check |
|---|---|---|---|---|---|
| `item.duskmaw-shroud` | Duskmaw Shroud | shoulders | 18 | `health +50` (flat), `resistance +6` (flat) | cost=50×0.15+6=13.5, rate=13.5/18=0.75 — shoulders target 0.7, band [0.385, 1.015] ✓ |

Description: "Duskmaw Shroud" — "Woven from the Reliquary's own silence; sound doesn't follow you in this."

- [ ] **Step 4: Create the `raidDef` document**

`name`: "Duskmaw Reliquary", `raidKey`: `duskmaw-reliquary`, `theme`: `shadow`, `mapGate`: reference to the `frosthollow` `mapDef`, `description`: "The vault Frosthollow's ice was grown to bury. It remembers being fed."

`stages` (exactly 4, in order):

| # | kind | encounter | durationSeconds | baseXp | loot |
|---|---|---|---|---|---|
| 1 | trash | `encounter.duskmaw-trash` | 300 | 60 | rewards: gold 40 |
| 2 | trash | `encounter.duskmaw-trash` | 300 | 60 | rewards: gold 40 |
| 3 | trash | `encounter.duskmaw-trash` | 300 | 60 | rewards: gold 40 |
| 4 | boss | `encounter.duskmaw-boss` | 86400 | 800 | rewards: gold 500; loot: `item.duskmaw-shroud` dropChance 80, rarityWeights Epic:70/Legendary:20 |

The 24-hour figure (spec §2) lands entirely on the boss stage (86400s); the three trash stages (300s each) are additive on top, for a ≈24h15m full clear — the boss is the headline wait.

- [ ] **Step 5: Verify in Studio**

Open the `raidDef` document. Expected: no validation errors (the (trash,trash,trash,boss) validator passes), `item.duskmaw-shroud` shows no `itemBudgetError`.

- [ ] **Step 6: Commit** — no git commit (Sanity content). Note the raid's key (`duskmaw-reliquary`) for Task 17.

---

### Task 16: Player guide entry

**Files:**
- Modify: `src/pages/gameStatsContent.ts`

**Interfaces:**
- Produces: a new `GuideSection` entry in the `GUIDE_SECTIONS` array.

- [ ] **Step 1: Add the section**

Add to the `GUIDE_SECTIONS` array in `src/pages/gameStatsContent.ts` (matching the existing `{ title, intro?, entries }` shape):

```typescript
  {
    title: 'Dungeons & Raids',
    intro: 'Bigger fights for bigger squads. Both are gated behind clearing a specific map, and both lock out for a while once you clear them — so plan around the wait, not around grinding them back-to-back.',
    entries: [
      { name: 'Dungeons', body: 'Up to 5 characters. Three bosses, each guarded by two easy trash packs first — the trash is a quick item-grab pace, the bosses are the real fight. Clearing all three locks the dungeon out until the next daily reset (00:00 UTC).' },
      { name: 'Raids', body: 'Up to 10 characters. Three trash packs, then one very hard boss — the whole run is a real commitment (the boss stage alone can run a full day). Clearing it locks the raid out until the next weekly reset (Sunday 00:00 UTC).' },
      { name: 'Losing a fight', body: 'Costs time, not progress — you keep everything already cleared in that run and just try the same stage again with whatever party you send next.' },
      { name: 'Themed loot', body: 'Each dungeon or raid has an elemental theme — its enemies deal that damage type, and its boss-dropped gear carries that flavor. Raid bosses carry the best chance in the game at a Legendary drop; a dungeon\'s final boss has a smaller chance at one too.' },
    ],
  },
```

- [ ] **Step 2: Verify**

Run: `npm run build`, then `npm run dev` and visually check `/game-stats` renders the new section.
Expected: renders with no layout breakage, consistent with the other sections.

- [ ] **Step 3: Commit**

```bash
git add src/pages/gameStatsContent.ts
git commit -m "docs: add Dungeons & Raids entry to the player guide"
```

---

### Task 17: ADR-0050 and TODO.md follow-up line

**Files:**
- Modify: `docs/DECISIONS.md`
- Modify: `TODO.md`

- [ ] **Step 1: Append ADR-0050 to `docs/DECISIONS.md`**

```markdown
## ADR-0050 — Dungeons & raids: multi-stage party-scaled content

**Date:** <ship date> · **Status:** Accepted (Alex)

**Context.** Missions were a single shape — one missionDef = one encounterDef = one fight, 3-player
party cap (client-side only, ADR-0016 never enforced it server-side). No content above the 3 live
maps offered a bigger, longer, higher-stakes format, and no Legendary-weighted loot beyond whatever
a map boss happened to author. Design worked out in
`docs/superpowers/specs/2026-09-08-dungeons-and-raids-design.md`; this ADR records what that spec's
implementation actually shipped.

**Decision.**
- **Two new content types, one shared engine.** `dungeonDef` (5-player cap, 3×(trash,trash,boss) =
  9 stages, daily lockout) and `raidDef` (10-player cap, (trash,trash,trash,boss) = 4 stages,
  weekly lockout) share a `groupStage` object and one pair of Edge Functions
  (`group-start-stage`/`group-claim-stage`) backed by one `group_runs` table — not two parallel
  systems.
- **Sequential per-stage dispatch, not one big wait.** Each stage is its own real-world
  dispatch/wait/claim, letting the party be reshuffled between stages; a loss retries the same
  stage without losing progress already made in that run.
- **Fixed calendar lockouts**, not rolling per-player cooldowns: dungeons reset at UTC midnight,
  raids at Sunday UTC midnight (`src/lib/groupContent.ts`).
- **Difficulty stays inside the gating map's own enemy tier** (`docs/BALANCE.md`'s T1–8 template,
  unmodified) — harder feel comes from stage count, party size, and boss-add escalation, not a new
  tier. The reference content (Task 14/15) authored zero deviation from template values, so no
  balance sweep was needed to ship it.
- **Loot reuses the existing `lootDrop` object as-is** — no new drop mechanism. Dungeon bosses cap
  at Epic except the 3rd (final) boss, which carries a small Legendary weight; the raid boss
  carries the largest Legendary weight in the game.
- **Themed, not resist-gated.** A dungeon/raid's `theme` (damage school) sets its enemies'
  `damageType` and its dropped gear's flavor. Per-school character resist affixes (`docs/ELEMENTS.md`
  v2) stayed explicitly deferred — themed gear here only boosts existing stats.
- **`rollRarity`/`rollItemLoot` extracted to `src/lib/loot.ts`** so both `mission-claim` and
  `group-claim-stage` share one tested implementation instead of two copies.
- **Reference content**: "Emberdeep Vault" (fire dungeon, gated on Gravemarch/T2) and "Duskmaw
  Reliquary" (shadow raid, gated on Frosthollow/T4) — 4 new themed itemDefs total, all verified
  against `itemBudget.ts`'s `auditItem`.

**Consequences.**
- Closes no existing TODO.md line (dungeons/raids weren't previously tracked there) — adds one for
  the deferred content-authoring wave (see below).
- **No automated test coverage for `group-start-stage`/`group-claim-stage`** — same accepted gap as
  `recruit_character` (no pgTAP/Deno test infra in this repo yet).
- **Bulk content authoring** (more dungeons, more raids, the full themed item sets each needs) is
  explicit follow-up work, not part of this ADR — same split this repo already used for maps
  (ADR-0034) vs. item authoring (ADR-0043/0044).
- **Per-school character resist affixes** (ELEMENTS.md v2) remain deferred, unblocked by nothing
  shipped here.
- No change to the combat engine's mitigation model, the blessing/trait systems, or existing
  mission/map mechanics beyond the new cross-busy-check additions to `start_mission`/`start_gather`/
  `admit_infirmary`.
```

- [ ] **Step 2: Add a TODO.md follow-up line**

Add to the "Current queue" section of `TODO.md`, matching the existing `- [ ]` line format:

```markdown
- [ ] **Dungeon/raid content-authoring wave** — ADR-0050 shipped the engine + one reference dungeon
  ("Emberdeep Vault") + one reference raid ("Duskmaw Reliquary"). More dungeons/raids and their
  full themed item sets are the deferred next wave, same split as maps (ADR-0034) vs. item
  authoring (ADR-0043/0044).
  `↳ context: project-dungeons-raids · docs/DECISIONS.md ADR-0050, studio/schemaTypes/dungeonDef.ts`
```

- [ ] **Step 3: Commit**

```bash
git add docs/DECISIONS.md TODO.md
git commit -m "docs: record ADR-0050 (dungeons & raids) and queue the content-authoring wave"
```

---

## Self-Review Notes

- **Spec coverage:** §4a–4e (schema) → Task 5/1; §5 (runtime flow) → Tasks 1/6/7; §6 (loot/theme) → Tasks 2/3/5/14/15; §7 (difficulty) → Tasks 14/15 (verified zero template deviation); §8 (UI) → Tasks 11–13; §9 (error handling) → Task 1's RPC guards + Task 6/7's Edge Function checks; §10 (testing) → Tasks 2/4/9 have real tests, Task 1/6/7 explicitly note the accepted Edge-Function-test gap; §11 (follow-ups) → Task 17's TODO.md line.
- **Reward-payout gap in the spec, resolved here:** the spec's §6 covered item loot but not currency/XP payout. This plan reuses the existing `marginBonus`/`levelRewardBonus`/`partyBonus`/`finalReward` pipeline as-is (Task 7) — the only judgment call made while writing the plan rather than the spec, flagged here for visibility. `transcendenceBonus` is left at 0 for group content (spec is silent on it; simplest consistent default for v1).
- **Type consistency check:** `GroupKind` (Task 4) used identically in Tasks 6, 7, 9, 12, 13. `GroupRun` (Task 9, aliasing `Tables<'group_runs'>` from Task 8) used identically in Tasks 12, 13. `CharacterTileChar` (Task 11) is satisfied structurally by both `DispatchChar` (existing) and `RosterMember` (Task 12's picker) — verified field-by-field (`id, name, charClass, level, role, damageSchool, traits, busy, downed`/`currentHp===0`).
