# Activity Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give players a simple, readable log of what happened on their account — missions/dungeons/raids started and claimed, characters leveling/recruited/downed, crafting, gathering, skills, blessings, shop purchases, infirmary, reset/transcend.

**Architecture:** One new `player_events` table + one shared `log_event(p_player, p_type, p_payload)` RPC (insert + 200-row-per-player retention prune, atomic). 21 existing Edge Functions each get one (or two, for the sites that also log a `character_leveled` event) new `admin.rpc('log_event', ...)` call, wrapped in try/catch, fired after their existing logic already succeeded. Reads are direct from the client via RLS (no Edge Function needed) through a new `src/lib/events.ts` registry + `src/features/activity/` page.

**Tech Stack:** Supabase (Postgres/pgTAP, Deno Edge Functions), React 19 + TanStack Query, Vitest.

**Spec:** [docs/superpowers/specs/2026-09-18-activity-log-design.md](../specs/2026-09-18-activity-log-design.md)

## Global Constraints

- Every mutation goes through a `security definer` RPC — never a raw `.insert()`/`.update()` from an Edge Function's admin client (verified project-wide convention, not just ADR-0003's letter).
- Every `admin.rpc('log_event', ...)` call is wrapped in `try/catch`, logs to `console.error`, never rethrows — a lost log row must never cost a player their actual reward/level-up/purchase.
- Every RLS-enabled table needs BOTH an RLS policy AND an explicit `grant select ... to authenticated` — confirmed via `src/test/migration-policy.test.ts`, which statically enforces this (and the RPC revoke/grant posture) across every migration in the repo; it will fail the build if either is missing on `player_events` or `log_event`.
- Retention cap: 200 rows per player, enforced inside `log_event` itself, not by any caller.
- No pagination, no filters, no day-grouping, no icons on the frontend — a plain newest-first list of sentences (explicit non-goal in the spec).
- `supabase/functions/*.ts` files ARE linted by `npm run lint` (ESLint's flat config globs `**/*.{ts,tsx}` with no exclusion for `supabase/functions`) but are NOT part of the `tsc -b` project (`tsconfig.app.json`'s `include` is `["src"]` only) and have no Deno unit-test harness in this repo — so each Edge Function task's verification is `npm run lint` clean + careful manual review, matching how every other Edge Function change in this codebase has actually been verified (no test file precedent to follow here).

---

## Task 1: `player_events` table + `log_event` RPC

**Files:**
- Create: `supabase/migrations/20260918100000_activity_log.sql`
- Test: `supabase/tests/database/activity_log.sql`

**Interfaces:**
- Produces: `public.log_event(p_player uuid, p_type text, p_payload jsonb default '{}'::jsonb) returns void` — every later task calls this by name. `public.player_events` table, columns `id uuid`, `player_id uuid`, `type text`, `payload jsonb`, `created_at timestamptz`.

- [ ] **Step 1: Write the migration**

```sql
-- Activity Log (docs/superpowers/specs/2026-09-18-activity-log-design.md) — a per-player event
-- ledger the game never had. Every mutation in this codebase already goes through a SECURITY
-- DEFINER RPC (never a raw insert from an Edge Function's admin client); log_event follows the
-- same shape so retention (the 200-row-per-player cap) is enforced in exactly one place regardless
-- of which of the ~21 call sites triggered the insert.
create table public.player_events (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references auth.users (id) on delete cascade,
  type       text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index player_events_player_created_idx
  on public.player_events (player_id, created_at desc);

alter table public.player_events enable row level security;

grant select on public.player_events to authenticated;

create policy "player_events_select_own"
  on public.player_events for select to authenticated
  using (player_id = (select auth.uid()));
-- Intentionally NO client insert/update/delete policy (ADR-0003) — same shape as
-- infirmary_admissions (supabase/migrations/20260707150000_infirmary.sql).

create or replace function public.log_event(
  p_player  uuid,
  p_type    text,
  p_payload jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.player_events (player_id, type, payload)
  values (p_player, p_type, p_payload);

  -- Cap at 200 most recent per player — enforced here, once, regardless of which of the ~21
  -- call sites triggered the insert.
  delete from public.player_events
   where id in (
     select id from public.player_events
      where player_id = p_player
      order by created_at desc
      offset 200
   );
end;
$$;

revoke all on function public.log_event(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.log_event(uuid, text, jsonb) to service_role;
```

- [ ] **Step 2: Write the pgTAP test**

```sql
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
  '60000000-0000-0000-0000-000000000001'::uuid, 'mission_started', jsonb_build_object('missionName', 'Goblin Outpost')
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

select public.log_event('60000000-0000-0000-0000-000000000001'::uuid, 'mission_started', '{}'::jsonb);

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
select public.log_event('60000000-0000-0000-0000-000000000002'::uuid, 'mission_started', '{}'::jsonb);

select is(
  (select count(*)::int from public.player_events where player_id = '60000000-0000-0000-0000-000000000002'),
  1,
  'the cap is scoped per-player, not global'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Run the pgTAP suite**

Run: `npx supabase test db`
Expected: all files pass, including the new `activity_log.sql` (4/4 assertions).

- [ ] **Step 4: Run the migration-policy static lint**

Run: `npx vitest run src/test/migration-policy.test.ts`
Expected: PASS — confirms `player_events` has its required `grant select`, no client write grant exists, and `log_event` is revoked-then-granted-to-service_role correctly.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260918100000_activity_log.sql supabase/tests/database/activity_log.sql
git commit -m "feat: player_events table + log_event RPC for the activity log"
```

---

## Task 2: Shared character-name lookup helper

**Files:**
- Create: `supabase/functions/_shared/characterName.ts`

**Interfaces:**
- Consumes: nothing from Task 1 directly (independent of the migration, but logically part of the same feature).
- Produces: `fetchCharacterName(admin, playerId: string, characterId: string): Promise<string>` — used by Tasks 12 (gather-start), 15 (skill-start), 18 (blessing-choose), 19 (blessing-respec), 11 (infirmary-admit), 21 (infirmary-discharge).

**Why this exists:** 6 of the 21 write sites only have a `characterId` in scope, not the character's Sanity-authored display name — unlike mission-claim/group-claim-stage, which already fetch full character defs for combat and can get `name` for free by adding one field to an existing GROQ projection. Fetching a name from just an id needs two round trips (`player_characters` for `character_def_id`, then Sanity for `name`) that would otherwise be copy-pasted six times.

- [ ] **Step 1: Write the helper**

```ts
import { sanityQuery } from './sanity.ts'
import type { createAdminClient } from './supabaseAdmin.ts'

type AdminClient = ReturnType<typeof createAdminClient>

// Best-effort character display-name lookup for activity-log payloads (docs/superpowers/specs/
// 2026-09-18-activity-log-design.md) — several call sites only have a characterId, not the
// character's Sanity-authored name, and don't otherwise fetch player_characters. Never throws —
// callers treat a lookup failure the same as their own log_event failure (best-effort, never
// blocks the real action); a failure just yields the 'Unknown' fallback.
export async function fetchCharacterName(admin: AdminClient, playerId: string, characterId: string): Promise<string> {
  try {
    const { data: charRow } = await admin
      .from('player_characters')
      .select('character_def_id')
      .eq('id', characterId)
      .eq('player_id', playerId)
      .maybeSingle()
    if (!charRow) return 'Unknown'
    const def = await sanityQuery<{ name?: string } | null>(
      `*[_type == "characterDef" && charKey == $key][0]{ name }`,
      { key: charRow.character_def_id },
    )
    return def?.name ?? 'Unknown'
  } catch (e) {
    console.error('fetchCharacterName failed', e)
    return 'Unknown'
  }
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean (no new errors on the new file).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/characterName.ts
git commit -m "feat: shared fetchCharacterName helper for activity-log payloads"
```

---

## Task 3: `src/lib/events.ts` — event registry + formatter

**Files:**
- Create: `src/lib/events.ts`
- Test: `src/lib/events.test.ts`

**Interfaces:**
- Consumes: nothing (pure module, no dependency on Tasks 1/2 being deployed — only needs to agree with their payload shapes, which the spec's catalog already fixes).
- Produces: `EventType`, `PlayerEvent`, `formatEvent(event: PlayerEvent): string` — consumed by Task 4.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/events.test.ts
import { describe, it, expect } from 'vitest'
import { formatEvent, type PlayerEvent } from './events'

function ev(type: PlayerEvent['type'], payload: Record<string, unknown>): PlayerEvent {
  return { id: 'x', type, payload, createdAt: '2026-09-18T00:00:00.000Z' }
}

describe('formatEvent', () => {
  it('mission_started', () => {
    expect(formatEvent(ev('mission_started', { missionName: 'Goblin Outpost' })))
      .toBe('Sent party to Goblin Outpost')
  })

  it('mission_claimed — win with full rewards', () => {
    expect(formatEvent(ev('mission_claimed', { missionName: 'Goblin Outpost', result: 'win', gold: 120, xp: 85, itemCount: 2 })))
      .toBe('Cleared Goblin Outpost — +120 gold, +85 XP, 2 items')
  })

  it('mission_claimed — party wiped', () => {
    expect(formatEvent(ev('mission_claimed', { missionName: 'Frozen Pass', result: 'party-wiped' })))
      .toBe('Frozen Pass ended in a party wipe')
  })

  it('mission_claimed — timeout', () => {
    expect(formatEvent(ev('mission_claimed', { missionName: 'Frozen Pass', result: 'timeout' })))
      .toBe('Frozen Pass ended in a timeout')
  })

  it('group_stage_started', () => {
    expect(formatEvent(ev('group_stage_started', { contentName: 'Emberdeep Vault', kind: 'dungeon', stageIndex: 3 })))
      .toBe('Started Emberdeep Vault (stage 4)')
  })

  it('group_stage_claimed — win', () => {
    expect(formatEvent(ev('group_stage_claimed', { contentName: 'Emberdeep Vault', kind: 'dungeon', stageIndex: 3, result: 'win', gold: 200, itemCount: 1 })))
      .toBe('Cleared Emberdeep Vault (stage 4) — +200 gold, 1 item')
  })

  it('group_stage_claimed — loss', () => {
    expect(formatEvent(ev('group_stage_claimed', { contentName: 'Duskmaw Reliquary', kind: 'raid', stageIndex: 0, result: 'loss' })))
      .toBe('Duskmaw Reliquary (stage 1) ended in a loss')
  })

  it('character_leveled', () => {
    expect(formatEvent(ev('character_leveled', { characterName: 'Sir Aldric', newLevel: 12 })))
      .toBe('Sir Aldric reached level 12')
  })

  it('character_recruited', () => {
    expect(formatEvent(ev('character_recruited', { characterName: 'Lyra Swift' })))
      .toBe('Recruited Lyra Swift')
  })

  it('character_downed', () => {
    expect(formatEvent(ev('character_downed', { characterName: 'Sir Aldric' })))
      .toBe('Sir Aldric was downed')
  })

  it('craft_started', () => {
    expect(formatEvent(ev('craft_started', { recipeName: 'Iron Band' })))
      .toBe('Started crafting Iron Band')
  })

  it('item_crafted', () => {
    expect(formatEvent(ev('item_crafted', { itemName: 'Iron Band', rarity: 'Uncommon' })))
      .toBe('Crafted Iron Band (Uncommon)')
  })

  it('item_upgraded — plural', () => {
    expect(formatEvent(ev('item_upgraded', { count: 3 }))).toBe('Upgraded 3 items')
  })

  it('item_upgraded — singular', () => {
    expect(formatEvent(ev('item_upgraded', { count: 1 }))).toBe('Upgraded 1 item')
  })

  it('gather_started', () => {
    expect(formatEvent(ev('gather_started', { resource: 'Copper', characterName: 'Lyra Swift' })))
      .toBe('Sent Lyra Swift to gather Copper')
  })

  it('gather_collected', () => {
    expect(formatEvent(ev('gather_collected', { resource: 'Copper', amount: 45 })))
      .toBe('Gathered 45 Copper')
  })

  it('skill_started', () => {
    expect(formatEvent(ev('skill_started', { skillName: 'Religion', characterName: 'Sir Aldric' })))
      .toBe('Sent Sir Aldric to train Religion')
  })

  it('skill_collected', () => {
    expect(formatEvent(ev('skill_collected', { skillName: 'Religion', xpGained: 120, stopped: false })))
      .toBe('Trained Religion — +120 XP')
  })

  it('blessing_chosen', () => {
    expect(formatEvent(ev('blessing_chosen', { characterName: 'Sir Aldric', choiceLabel: 'Cleave Mastery' })))
      .toBe('Sir Aldric chose a blessing: Cleave Mastery')
  })

  it('blessing_respec', () => {
    expect(formatEvent(ev('blessing_respec', { characterName: 'Sir Aldric' })))
      .toBe("Respecced Sir Aldric's blessing tree")
  })

  it('ascendant_purchased', () => {
    expect(formatEvent(ev('ascendant_purchased', { nodeLabel: 'Ascendant Haste' })))
      .toBe('Purchased Ascendant node: Ascendant Haste')
  })

  it('echo_purchased', () => {
    expect(formatEvent(ev('echo_purchased', { nodeLabel: 'Mission Speed' })))
      .toBe('Purchased Echo Shop node: Mission Speed')
  })

  it('infirmary_upgraded', () => {
    expect(formatEvent(ev('infirmary_upgraded', { newLevel: 4 })))
      .toBe('Upgraded the Infirmary to level 4')
  })

  it('infirmary_discharged — fully healed', () => {
    expect(formatEvent(ev('infirmary_discharged', { characterName: 'Sir Aldric', fullyHealed: true })))
      .toBe('Sir Aldric left the infirmary, fully healed')
  })

  it('infirmary_discharged — early', () => {
    expect(formatEvent(ev('infirmary_discharged', { characterName: 'Sir Aldric', fullyHealed: false })))
      .toBe('Sir Aldric left the infirmary early, partially healed')
  })

  it('player_reset — with award', () => {
    expect(formatEvent(ev('player_reset', { echoesAwarded: 340 })))
      .toBe('Reset — earned 340 Echoes')
  })

  it('player_reset — no payload', () => {
    expect(formatEvent(ev('player_reset', {}))).toBe('Reset')
  })

  it('player_transcended — with award', () => {
    expect(formatEvent(ev('player_transcended', { shardsAwarded: 12 })))
      .toBe('Transcended — earned 12 Ascendant Shards')
  })

  it('player_transcended — no payload', () => {
    expect(formatEvent(ev('player_transcended', {}))).toBe('Transcended')
  })

  it('falls back gracefully on a missing string field', () => {
    expect(formatEvent(ev('character_recruited', {}))).toBe('Recruited (unknown)')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/events.test.ts`
Expected: FAIL with "Cannot find module './events'" (the module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/events.ts
// The activity-log event-type registry (docs/superpowers/specs/2026-09-18-activity-log-design.md).
// Mirrors lifetimeStats.ts's registry style: one place that knows every event type, its payload
// shape, and how to render it as a single sentence. Payloads are read from a JSONB column filled in
// by 21 different Edge Functions (never by the client — ADR-0003), so every field is read
// defensively; a malformed/missing field falls back to a generic fragment rather than throwing.

export type EventType =
  | 'mission_started' | 'mission_claimed'
  | 'group_stage_started' | 'group_stage_claimed'
  | 'character_leveled' | 'character_recruited' | 'character_downed'
  | 'craft_started' | 'item_crafted' | 'item_upgraded'
  | 'gather_started' | 'gather_collected'
  | 'skill_started' | 'skill_collected'
  | 'blessing_chosen' | 'blessing_respec'
  | 'ascendant_purchased' | 'echo_purchased'
  | 'infirmary_upgraded' | 'infirmary_discharged'
  | 'player_reset' | 'player_transcended'

export type PlayerEvent = {
  id: string
  type: EventType
  payload: Record<string, unknown>
  createdAt: string
}

function str(payload: Record<string, unknown>, key: string, fallback = '(unknown)'): string {
  const v = payload[key]
  return typeof v === 'string' && v.length > 0 ? v : fallback
}

function num(payload: Record<string, unknown>, key: string): number | undefined {
  const v = payload[key]
  return typeof v === 'number' ? v : undefined
}

function bool(payload: Record<string, unknown>, key: string): boolean {
  return payload[key] === true
}

function rewardSuffix(payload: Record<string, unknown>): string {
  const parts: string[] = []
  const gold = num(payload, 'gold')
  if (gold) parts.push(`+${gold.toLocaleString()} gold`)
  const xp = num(payload, 'xp')
  if (xp) parts.push(`+${xp.toLocaleString()} XP`)
  const itemCount = num(payload, 'itemCount')
  if (itemCount) parts.push(`${itemCount} item${itemCount === 1 ? '' : 's'}`)
  return parts.length ? ` — ${parts.join(', ')}` : ''
}

const RESULT_LABEL: Record<string, string> = {
  timeout: ' ended in a timeout',
  loss: ' ended in a loss',
  'party-wiped': ' ended in a party wipe',
}

export function formatEvent(event: PlayerEvent): string {
  const p = event.payload
  switch (event.type) {
    case 'mission_started':
      return `Sent party to ${str(p, 'missionName')}`
    case 'mission_claimed': {
      const result = str(p, 'result', 'win')
      if (result === 'win') return `Cleared ${str(p, 'missionName')}${rewardSuffix(p)}`
      return `${str(p, 'missionName')}${RESULT_LABEL[result] ?? ' ended in a loss'}`
    }
    case 'group_stage_started': {
      const stageIndex = num(p, 'stageIndex') ?? 0
      return `Started ${str(p, 'contentName')} (stage ${stageIndex + 1})`
    }
    case 'group_stage_claimed': {
      const stageIndex = num(p, 'stageIndex') ?? 0
      const result = str(p, 'result', 'win')
      if (result === 'win') return `Cleared ${str(p, 'contentName')} (stage ${stageIndex + 1})${rewardSuffix(p)}`
      return `${str(p, 'contentName')} (stage ${stageIndex + 1})${RESULT_LABEL[result] ?? ' ended in a loss'}`
    }
    case 'character_leveled':
      return `${str(p, 'characterName')} reached level ${num(p, 'newLevel') ?? '?'}`
    case 'character_recruited':
      return `Recruited ${str(p, 'characterName')}`
    case 'character_downed':
      return `${str(p, 'characterName')} was downed`
    case 'craft_started':
      return `Started crafting ${str(p, 'recipeName')}`
    case 'item_crafted':
      return `Crafted ${str(p, 'itemName')} (${str(p, 'rarity', 'Common')})`
    case 'item_upgraded': {
      const count = num(p, 'count') ?? 0
      return `Upgraded ${count} item${count === 1 ? '' : 's'}`
    }
    case 'gather_started':
      return `Sent ${str(p, 'characterName')} to gather ${str(p, 'resource')}`
    case 'gather_collected':
      return `Gathered ${num(p, 'amount') ?? 0} ${str(p, 'resource')}`
    case 'skill_started':
      return `Sent ${str(p, 'characterName')} to train ${str(p, 'skillName')}`
    case 'skill_collected':
      return `Trained ${str(p, 'skillName')} — +${num(p, 'xpGained') ?? 0} XP`
    case 'blessing_chosen':
      return `${str(p, 'characterName')} chose a blessing: ${str(p, 'choiceLabel')}`
    case 'blessing_respec':
      return `Respecced ${str(p, 'characterName')}'s blessing tree`
    case 'ascendant_purchased':
      return `Purchased Ascendant node: ${str(p, 'nodeLabel')}`
    case 'echo_purchased':
      return `Purchased Echo Shop node: ${str(p, 'nodeLabel')}`
    case 'infirmary_upgraded':
      return `Upgraded the Infirmary to level ${num(p, 'newLevel') ?? '?'}`
    case 'infirmary_discharged':
      return bool(p, 'fullyHealed')
        ? `${str(p, 'characterName')} left the infirmary, fully healed`
        : `${str(p, 'characterName')} left the infirmary early, partially healed`
    case 'player_reset': {
      const echoes = num(p, 'echoesAwarded')
      return echoes ? `Reset — earned ${echoes.toLocaleString()} Echoes` : 'Reset'
    }
    case 'player_transcended': {
      const shards = num(p, 'shardsAwarded')
      return shards ? `Transcended — earned ${shards.toLocaleString()} Ascendant Shards` : 'Transcended'
    }
    default:
      return 'Something happened'
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/events.test.ts`
Expected: PASS, 28/28.

- [ ] **Step 5: Commit**

```bash
git add src/lib/events.ts src/lib/events.test.ts
git commit -m "feat: activity-log event-type registry and formatter"
```

---

## Task 4: `/activity` page

**Files:**
- Create: `src/services/activity.ts`
- Create: `src/features/activity/hooks.ts`
- Create: `src/features/activity/ActivityPage.tsx`
- Create: `src/features/activity/index.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/organisms/GameHeader.tsx:14-35` (the `NAV` array)

**Interfaces:**
- Consumes: `PlayerEvent`, `EventType`, `formatEvent` from Task 3 (`src/lib/events.ts`). `player_events` table from Task 1 (RLS-scoped direct read — must exist for `fetchActivity` to return real rows, but the page renders correctly against zero rows too, so this isn't a hard blocker for building/testing the page itself).
- Produces: `ActivityPage` (default export of the feature's `index.ts`), routed at `/activity`.

- [ ] **Step 1: Write the read service**

```ts
// src/services/activity.ts
import { supabase } from '@/lib/supabase'
import type { PlayerEvent, EventType } from '@/lib/events'

// The player's activity feed, read directly from player_events (RLS owner-read, SELECT-only grant
// — ADR-0003). Already capped at 200 rows server-side by log_event, so one query is the whole feed;
// no pagination. Newest first.
export async function fetchActivity(): Promise<PlayerEvent[]> {
  const { data, error } = await supabase
    .from('player_events')
    .select('id, type, payload, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id as string,
    type: row.type as EventType,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    createdAt: row.created_at as string,
  }))
}
```

- [ ] **Step 2: Write the hook**

```ts
// src/features/activity/hooks.ts
import { useQuery } from '@tanstack/react-query'
import { fetchActivity } from '@/services/activity'

export function useActivity() {
  return useQuery({ queryKey: ['activity'], queryFn: fetchActivity })
}
```

- [ ] **Step 3: Write the page**

```tsx
// src/features/activity/ActivityPage.tsx
import { useActivity } from './hooks'
import { formatEvent } from '@/lib/events'

export default function ActivityPage() {
  const { data: events, isLoading } = useActivity()

  if (isLoading || !events) {
    return <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
  }

  return (
    <div>
      <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 16 }}>Activity</h2>
      {events.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No activity yet — go play!</p>
      ) : (
        <div style={{
          borderRadius: 8,
          border: '1px solid var(--color-gold-dark)',
          background: 'linear-gradient(180deg, var(--color-bg-raised) 0%, var(--color-bg-panel) 100%)',
          overflow: 'hidden',
        }}>
          {events.map((event, i) => (
            <div
              key={event.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
                padding: '10px 16px',
                borderTop: i === 0 ? 'none' : '1px solid var(--color-bg-base)',
              }}
            >
              <span style={{ color: 'var(--color-text-primary)', fontSize: 13 }}>{formatEvent(event)}</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                {new Date(event.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Write the barrel**

```ts
// src/features/activity/index.ts
// Public API of the Activity feature.
// Import from '@/features/activity' — never reach into the feature's internals from outside.

export { default as ActivityPage } from './ActivityPage'
```

- [ ] **Step 5: Route it**

In `src/App.tsx`, add the lazy import next to the other feature-module pages:

```ts
const ActivityPage = lazy(() => import('@/features/activity').then((m) => ({ default: m.ActivityPage })))
```

And add the route inside the existing `RequireAuth` > `GameLayout` block, next to `/statistics`:

```tsx
<Route path="/statistics" element={<StatisticsPage />} />
<Route path="/activity" element={<ActivityPage />} />
```

- [ ] **Step 6: Add the nav link**

In `src/components/organisms/GameHeader.tsx`'s `NAV` array, add an entry next to `'Statistics'`:

```ts
  { label: 'Statistics', to: '/statistics' },
  { label: 'Activity', to: '/activity' },
```

- [ ] **Step 7: Lint and build**

Run: `npm run lint && npm run build`
Expected: both clean.

- [ ] **Step 8: Manual verification (empty state)**

Start the dev server (`npm run dev`), sign in, navigate to `/activity`. Expected: "No activity yet — go play!" (no `player_events` rows exist yet at this point in the plan — Tasks 5-25 are what start populating it). Confirm the nav link works and the page doesn't error.

- [ ] **Step 9: Commit**

```bash
git add src/services/activity.ts src/features/activity/ src/App.tsx src/components/organisms/GameHeader.tsx
git commit -m "feat: /activity page"
```

---

## Tasks 5-25: the 21 write sites

Every task below follows the same shape: modify one `supabase/functions/<name>/index.ts`, add one (or two) `admin.rpc('log_event', ...)` calls wrapped in try/catch after the existing logic already succeeded, run `npm run lint`, commit. **Consumes** `log_event` from Task 1 for all of them; the six noted also consume `fetchCharacterName` from Task 2. These 21 tasks have no dependencies on each other (different files, no shared imports between them) — dispatch them as an independent parallel cluster once Tasks 1-2 are done, per this repo's pre-flight-scan convention for independent task clusters.

### Task 5: `mission-start` → `mission_started`

**Files:** Modify: `supabase/functions/mission-start/index.ts`

- [ ] **Step 1: Add `name` to the Sanity query and log after success**

In `MissionDef` (line 51-55), add `name?: string`:

```ts
  type MissionDef = {
    name?: string
    durationSeconds?: number
    stage?: number
    map?: { mapKey?: string; order?: number; prevMapKey?: string | null } | null
  }
```

In the GROQ query (line 58-67), add `name,` as the first projected field:

```ts
    def = await sanityQuery<MissionDef | null>(
      `*[_type == "missionDef" && missionKey == $id][0]{
        name, durationSeconds, stage,
        "map": map->{
          mapKey, order,
          "prevMapKey": *[_type == "mapDef" && order < ^.order] | order(order desc)[0].mapKey
        }
      }`,
      { id: missionDefId },
    )
```

Right before the final `return json({ run }, 201)` (line 130), add:

```ts
  try {
    await admin.rpc('log_event', {
      p_player: playerId,
      p_type: 'mission_started',
      p_payload: { missionName: def.name ?? 'Unknown Mission' },
    })
  } catch (e) {
    console.error('activity log failed (mission_started) — continuing', e)
  }

  return json({ run }, 201)
```

- [ ] **Step 2: Lint** — Run: `npm run lint`. Expected: clean.
- [ ] **Step 3: Commit**

```bash
git add supabase/functions/mission-start/index.ts
git commit -m "feat: log mission_started activity event"
```

### Task 6: `mission-claim` → `mission_claimed` + `character_leveled`

**Files:** Modify: `supabase/functions/mission-claim/index.ts`

- [ ] **Step 1: Add `name` to both Sanity queries**

`MissionForClaim` type (line 82-96): add `name?: string` as the first field.
`MISSION_GROQ` (line 121-131): add `name,` right after the opening `{`.
`CharDefRow` type (line 97-107): add `name?: string` as the first field.
`CHARDEFS_GROQ` (line 133-140): add `name,` right after `charKey,`.

- [ ] **Step 2: Accumulate total XP granted**

Change the `charUpdates` block (line 328-340) to also track a running XP total:

```ts
  let totalXpGained = 0
  const charUpdates = chars.map((c) => {
    const endHp = Math.round(result.endingHp[c.id] ?? 0)
    let level = c.level
    let xp = c.xp
    if (win && endHp > 0 && baseXp > 0) {
      const xpMult = 1 + Math.max(0, statsById[c.id]?.xpGain ?? 0) / 100
      const gained = Math.round(finalReward(baseXp, mods) * xpMult * firstClearMult)
      totalXpGained += gained
      const rolled = applyXp(c.level, c.xp, gained)
      level = rolled.level
      xp = rolled.xp
    }
    return { id: c.id, level, xp, current_hp: endHp }
  })
```

- [ ] **Step 3: Log after the RPC succeeds**

Right before the final `return json(...)` (line 478), add:

```ts
  try {
    await admin.rpc('log_event', {
      p_player: playerId,
      p_type: 'mission_claimed',
      p_payload: {
        missionName: mission.name ?? 'Unknown Mission',
        result: win ? 'win' : (result.reason === 'party-wiped' ? 'party-wiped' : 'timeout'),
        ...(win && (currencies['gold'] ?? 0) > 0 ? { gold: currencies['gold'] } : {}),
        ...(win && totalXpGained > 0 ? { xp: totalXpGained } : {}),
        ...(win && loot.length > 0 ? { itemCount: loot.length } : {}),
      },
    })
  } catch (e) {
    console.error('activity log failed (mission_claimed) — continuing', e)
  }

  await Promise.allSettled(
    chars.map(async (c, i) => {
      const updated = charUpdates[i]
      if (updated.level <= c.level) return
      const def = charDefByKey.get(c.character_def_id)
      try {
        await admin.rpc('log_event', {
          p_player: playerId,
          p_type: 'character_leveled',
          p_payload: { characterName: def?.name ?? 'Unknown', newLevel: updated.level },
        })
      } catch (e) {
        console.error('activity log failed (character_leveled) — continuing', e)
      }
    }),
  )
```

- [ ] **Step 4: Lint** — Run: `npm run lint`. Expected: clean.
- [ ] **Step 5: Commit**

```bash
git add supabase/functions/mission-claim/index.ts
git commit -m "feat: log mission_claimed and character_leveled activity events"
```

### Task 7: `group-start-stage` → `group_stage_started`

**Files:** Modify: `supabase/functions/group-start-stage/index.ts`

- [ ] **Step 1: Add `name` to the Sanity query and log after success**

`GroupDef` type (line 17): add `name?: string`:

```ts
type GroupDef = { name?: string; stages?: { durationSeconds?: number }[]; gateKey?: string | null } | null
```

GROQ query (line 61-64):

```ts
    def = await sanityQuery<GroupDef>(
      `*[_type == "${sanityType}" && ${keyField} == $key][0]{ name, stages[]{ durationSeconds }, "gateKey": mapGate->mapKey }`,
      { key: defKey },
    )
```

Right before `return json({ run: groupRun }, 201)` (line 104), add:

```ts
  try {
    await admin.rpc('log_event', {
      p_player: playerId,
      p_type: 'group_stage_started',
      p_payload: { contentName: def.name ?? 'Unknown', kind, stageIndex },
    })
  } catch (e) {
    console.error('activity log failed (group_stage_started) — continuing', e)
  }

  return json({ run: groupRun }, 201)
```

- [ ] **Step 2: Lint** — Run: `npm run lint`. Expected: clean.
- [ ] **Step 3: Commit**

```bash
git add supabase/functions/group-start-stage/index.ts
git commit -m "feat: log group_stage_started activity event"
```

### Task 8: `group-claim-stage` → `group_stage_claimed` + `character_leveled`

**Files:** Modify: `supabase/functions/group-claim-stage/index.ts`

- [ ] **Step 1: Add `name` to both Sanity queries**

`GroupDefRow` type (line 46): `type GroupDefRow = { name?: string; stages?: StageRow[] } | null`.

`groupDef` GROQ (line 129-138): add `name,` right after the opening `{`:

```ts
    groupDef = await sanityQuery<GroupDefRow>(
      `*[_type == "${sanityType}" && ${keyField} == $key][0]{
        name,
        stages[]{
          baseXp, rewards[]{ kind, code, amount },
          loot[]{ dropChance, quantityMin, quantityMax, rarityWeights[]{ rarity, weight }, "itemKey": item->itemKey },
          encounter->{ timeLimitSeconds, enemies[]{ count, "enemy": enemy->{ enemyKey, archetype, health, attack, damageType, speed, defense, resistance, resistances[]{ school, value }, block, critChance, critDamage, armorPen, dodge, healthRegen, spikeEverySeconds, spikeMultiplier } } }
        }
      }`,
      { key: defKey },
    )
```

`CharDefRow` type (line 47-51): add `name?: string` as the first field.
`CHARDEFS_GROQ` (line 58-65): add `name,` right after `charKey,`.

- [ ] **Step 2: Accumulate total XP granted**

Same change as Task 6, applied to this file's `charUpdates` block (line 210-222):

```ts
  let totalXpGained = 0
  const charUpdates = chars.map((c) => {
    const endHp = Math.round(result.endingHp[c.id] ?? 0)
    let level = c.level
    let xp = c.xp
    if (win && endHp > 0 && baseXp > 0) {
      const xpMult = 1 + Math.max(0, statsById[c.id]?.xpGain ?? 0) / 100
      const gained = Math.round(finalReward(baseXp, mods) * xpMult)
      totalXpGained += gained
      const rolled = applyXp(c.level, c.xp, gained)
      level = rolled.level
      xp = rolled.xp
    }
    return { id: c.id, level, xp, current_hp: endHp }
  })
```

- [ ] **Step 3: Log after the RPC succeeds**

Right before the final `return json({...}, 200)` (line 268), add:

```ts
  try {
    await admin.rpc('log_event', {
      p_player: playerId,
      p_type: 'group_stage_claimed',
      p_payload: {
        contentName: groupDef?.name ?? 'Unknown',
        kind, stageIndex,
        result: win ? 'win' : 'loss',
        ...(win && (currencies['gold'] ?? 0) > 0 ? { gold: currencies['gold'] } : {}),
        ...(win && loot.length > 0 ? { itemCount: loot.length } : {}),
      },
    })
  } catch (e) {
    console.error('activity log failed (group_stage_claimed) — continuing', e)
  }

  await Promise.allSettled(
    chars.map(async (c, i) => {
      const updated = charUpdates[i]
      if (updated.level <= c.level) return
      const def = charDefByKey.get(c.character_def_id)
      try {
        await admin.rpc('log_event', {
          p_player: playerId,
          p_type: 'character_leveled',
          p_payload: { characterName: def?.name ?? 'Unknown', newLevel: updated.level },
        })
      } catch (e) {
        console.error('activity log failed (character_leveled) — continuing', e)
      }
    }),
  )
```

- [ ] **Step 4: Lint** — Run: `npm run lint`. Expected: clean.
- [ ] **Step 5: Commit**

```bash
git add supabase/functions/group-claim-stage/index.ts
git commit -m "feat: log group_stage_claimed and character_leveled activity events"
```

### Task 9: `recruit` → `character_recruited`

**Files:** Modify: `supabase/functions/recruit/index.ts`

- [ ] **Step 1: Add `name` to the Sanity query and log after success**

`AcquisitionRow` type (line 18-21): add `name?: string`:

```ts
type AcquisitionRow = {
  charKey: string
  name?: string
  acquisition?: { goldCost?: number; condition?: { type?: string } } | null
}
```

`ACQUISITION_GROQ` (line 23-25):

```ts
const ACQUISITION_GROQ = `*[_type == "characterDef" && charKey == $key][0]{
  charKey, name, acquisition{ goldCost, condition{ type } }
}`
```

Right before `return json({ character: charRow }, 201)` (line 83), add:

```ts
  try {
    await admin.rpc('log_event', {
      p_player: playerId,
      p_type: 'character_recruited',
      p_payload: { characterName: row.name ?? characterDefId },
    })
  } catch (e) {
    console.error('activity log failed (character_recruited) — continuing', e)
  }

  return json({ character: charRow }, 201)
```

- [ ] **Step 2: Lint** — Run: `npm run lint`. Expected: clean.
- [ ] **Step 3: Commit**

```bash
git add supabase/functions/recruit/index.ts
git commit -m "feat: log character_recruited activity event"
```

### Task 10: `craft-start` → `craft_started`

**Files:** Modify: `supabase/functions/craft-start/index.ts`

- [ ] **Step 1: Add `name` to the Sanity query and log after success**

`RecipeDef` type (line 17-20): add `name?: string`:

```ts
type RecipeDef = {
  name?: string
  durationSeconds?: number
  reagents?: { kind?: string; resource?: string | null; quantity?: number; itemKey?: string | null }[]
} | null
```

GROQ query (line 55-61):

```ts
    def = await sanityQuery<RecipeDef>(
      `*[_type == "recipeDef" && recipeKey == $key][0]{
        name, durationSeconds,
        reagents[]{ kind, resource, quantity, "itemKey": item->itemKey }
      }`,
      { key: recipeDefId },
    )
```

Right before `return json({ run }, 201)` (line 101), add:

```ts
  try {
    await admin.rpc('log_event', {
      p_player: playerId,
      p_type: 'craft_started',
      p_payload: { recipeName: def.name ?? recipeDefId },
    })
  } catch (e) {
    console.error('activity log failed (craft_started) — continuing', e)
  }

  return json({ run }, 201)
```

- [ ] **Step 2: Lint** — Run: `npm run lint`. Expected: clean.
- [ ] **Step 3: Commit**

```bash
git add supabase/functions/craft-start/index.ts
git commit -m "feat: log craft_started activity event"
```

### Task 11: `craft-claim` → `item_crafted`

**Files:** Modify: `supabase/functions/craft-claim/index.ts`

- [ ] **Step 1: Add the result item's `name` to the Sanity query (via the already-dereferenced `result->`) and log after success**

`RecipeDef` type (line 17): add `resultItemName`:

```ts
type RecipeDef = { resultItemKey?: string | null; resultItemName?: string | null; resultRarityWeights?: { rarity: string; weight: number }[] | null } | null
```

GROQ query (line 56-59):

```ts
    def = await sanityQuery<RecipeDef>(
      `*[_type == "recipeDef" && recipeKey == $key][0]{ "resultItemKey": result->itemKey, "resultItemName": result->name, resultRarityWeights[]{ rarity, weight } }`,
      { key: recipeDefId },
    )
```

Right before `return json({ itemDefId: granted.item_def_id, rarity: granted.rarity }, 200)` (line 89), add:

```ts
  try {
    await admin.rpc('log_event', {
      p_player: playerId,
      p_type: 'item_crafted',
      p_payload: { itemName: def.resultItemName ?? def.resultItemKey, rarity: granted.rarity },
    })
  } catch (e) {
    console.error('activity log failed (item_crafted) — continuing', e)
  }

  return json({ itemDefId: granted.item_def_id, rarity: granted.rarity }, 200)
```

- [ ] **Step 2: Lint** — Run: `npm run lint`. Expected: clean.
- [ ] **Step 3: Commit**

```bash
git add supabase/functions/craft-claim/index.ts
git commit -m "feat: log item_crafted activity event"
```

### Task 12: `gather-start` → `gather_started`

**Files:** Modify: `supabase/functions/gather-start/index.ts`

- [ ] **Step 1: Import the helpers, resolve the character's name, and log after success**

Add to the imports (line 1-3):

```ts
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { MINE_BY_RESOURCE } from '../../../src/lib/gather.ts'
import { fetchCharacterName } from '../_shared/characterName.ts'
```

Right before `return json({ assignment }, 201)` (line 56), add:

```ts
  try {
    const characterName = await fetchCharacterName(admin, playerId, characterId)
    await admin.rpc('log_event', {
      p_player: playerId,
      p_type: 'gather_started',
      p_payload: { resource: resourceId, characterName },
    })
  } catch (e) {
    console.error('activity log failed (gather_started) — continuing', e)
  }

  return json({ assignment }, 201)
```

- [ ] **Step 2: Lint** — Run: `npm run lint`. Expected: clean.
- [ ] **Step 3: Commit**

```bash
git add supabase/functions/gather-start/index.ts
git commit -m "feat: log gather_started activity event"
```

### Task 13: `gather-collect` → `gather_collected`

**Files:** Modify: `supabase/functions/gather-collect/index.ts`

- [ ] **Step 1: Log after success, gated on `gained > 0 || stop`**

Right before `return json({ gained, resource: assignment.resource_id, stopped: stop, newlyUnlocked }, 200)` (line 162), add:

```ts
  if (gained > 0 || stop) {
    try {
      await admin.rpc('log_event', {
        p_player: playerId,
        p_type: 'gather_collected',
        p_payload: { resource: assignment.resource_id, amount: gained },
      })
    } catch (e) {
      console.error('activity log failed (gather_collected) — continuing', e)
    }
  }

  return json({ gained, resource: assignment.resource_id, stopped: stop, newlyUnlocked }, 200)
```

- [ ] **Step 2: Lint** — Run: `npm run lint`. Expected: clean.
- [ ] **Step 3: Commit**

```bash
git add supabase/functions/gather-collect/index.ts
git commit -m "feat: log gather_collected activity event"
```

### Task 14: `skill-start` → `skill_started`

**Files:** Modify: `supabase/functions/skill-start/index.ts`

- [ ] **Step 1: Import the helper and log after success**

Add to the imports (line 1-4):

```ts
// supabase/functions/skill-start/index.ts
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { SKILL_BY_KEY } from '../../../src/lib/skills.ts'
import { fetchCharacterName } from '../_shared/characterName.ts'
```

Right before `return json({ assignment }, 201)` (line 57), add:

```ts
  try {
    const characterName = await fetchCharacterName(admin, playerId, characterId)
    await admin.rpc('log_event', {
      p_player: playerId,
      p_type: 'skill_started',
      p_payload: { skillName: SKILL_BY_KEY[skillKey].label, characterName },
    })
  } catch (e) {
    console.error('activity log failed (skill_started) — continuing', e)
  }

  return json({ assignment }, 201)
```

- [ ] **Step 2: Lint** — Run: `npm run lint`. Expected: clean.
- [ ] **Step 3: Commit**

```bash
git add supabase/functions/skill-start/index.ts
git commit -m "feat: log skill_started activity event"
```

### Task 15: `skill-collect` → `skill_collected`

**Files:** Modify: `supabase/functions/skill-collect/index.ts`

- [ ] **Step 1: Log after success**

Right before `return json({ gainedXp: gained, skillKey: assignment.skill_key, newLevel, newXp, stopped: stop }, 200)` (line 94), add:

```ts
  try {
    await admin.rpc('log_event', {
      p_player: playerId,
      p_type: 'skill_collected',
      p_payload: { skillName: skill.label, xpGained: gained, stopped: stop },
    })
  } catch (e) {
    console.error('activity log failed (skill_collected) — continuing', e)
  }

  return json({ gainedXp: gained, skillKey: assignment.skill_key, newLevel, newXp, stopped: stop }, 200)
```

- [ ] **Step 2: Lint** — Run: `npm run lint`. Expected: clean.
- [ ] **Step 3: Commit**

```bash
git add supabase/functions/skill-collect/index.ts
git commit -m "feat: log skill_collected activity event"
```

### Task 16: `blessing-choose` → `blessing_chosen`

**Files:** Modify: `supabase/functions/blessing-choose/index.ts`

- [ ] **Step 1: Import `sanityQuery`, resolve character name + choice title, and log after success**

Add to the imports (line 1-2):

```ts
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { sanityQuery } from '../_shared/sanity.ts'
```

Right before `return json(data, 200)` (line 62), add:

```ts
  try {
    const { data: charRow } = await admin
      .from('player_characters')
      .select('character_def_id')
      .eq('id', characterId)
      .eq('player_id', playerId)
      .maybeSingle()
    let characterName = 'Unknown'
    let choiceLabel = `${row} choice ${choice.toUpperCase()}`
    if (charRow) {
      const def = await sanityQuery<{
        name?: string
        blessingTree?: { row?: string; choices?: { choiceId?: string; title?: string }[] }[]
      } | null>(
        `*[_type == "characterDef" && charKey == $key][0]{
          name, blessingTree[]{ row, choices[]{ choiceId, title } }
        }`,
        { key: charRow.character_def_id },
      )
      characterName = def?.name ?? 'Unknown'
      const treeRow = def?.blessingTree?.find((r) => r.row === row)
      const picked = treeRow?.choices?.find((c) => c.choiceId === choice)
      if (picked?.title) choiceLabel = picked.title
    }
    await admin.rpc('log_event', {
      p_player: playerId,
      p_type: 'blessing_chosen',
      p_payload: { characterName, choiceLabel },
    })
  } catch (e) {
    console.error('activity log failed (blessing_chosen) — continuing', e)
  }

  return json(data, 200)
```

- [ ] **Step 2: Lint** — Run: `npm run lint`. Expected: clean.
- [ ] **Step 3: Commit**

```bash
git add supabase/functions/blessing-choose/index.ts
git commit -m "feat: log blessing_chosen activity event"
```

### Task 17: `blessing-respec` → `blessing_respec`

**Files:** Modify: `supabase/functions/blessing-respec/index.ts`

- [ ] **Step 1: Import the helper and log after success**

Add to the imports (line 1-3):

```ts
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { RESPEC_COST } from '../../../src/lib/blessings.ts'
import { fetchCharacterName } from '../_shared/characterName.ts'
```

Right before `return json(data, 200)` (line 53), add:

```ts
  try {
    const characterName = await fetchCharacterName(admin, playerId, characterId)
    await admin.rpc('log_event', {
      p_player: playerId,
      p_type: 'blessing_respec',
      p_payload: { characterName },
    })
  } catch (e) {
    console.error('activity log failed (blessing_respec) — continuing', e)
  }

  return json(data, 200)
```

- [ ] **Step 2: Lint** — Run: `npm run lint`. Expected: clean.
- [ ] **Step 3: Commit**

```bash
git add supabase/functions/blessing-respec/index.ts
git commit -m "feat: log blessing_respec activity event"
```

### Task 18: `ascendant-shop-purchase` → `ascendant_purchased`

**Files:** Modify: `supabase/functions/ascendant-shop-purchase/index.ts`

- [ ] **Step 1: Import `sanityQuery` and `FlatAscendantKind`, resolve the node label, and log after success**

Change the imports (line 1-4):

```ts
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { characterDefExists, sanityQuery } from '../_shared/sanity.ts'
import { FLAT_ASCENDANT_NODES, type FlatAscendantKind } from '../../../src/lib/ascendantShop.ts'
```

Right before `return json(result, 200)` (line 68), add:

```ts
  try {
    let nodeLabel: string = nodeKey
    if (nodeKey in FLAT_ASCENDANT_NODES) {
      nodeLabel = FLAT_ASCENDANT_NODES[nodeKey as FlatAscendantKind].label
    } else {
      const dot = nodeKey.lastIndexOf('.')
      const charKey = nodeKey.slice(0, dot)
      const kind = nodeKey.slice(dot + 1)
      const charDef = await sanityQuery<{ name?: string } | null>(
        `*[_type == "characterDef" && charKey == $key][0]{ name }`,
        { key: charKey },
      )
      nodeLabel = `${kind === 'power' ? 'Power' : 'Vitality'} (${charDef?.name ?? charKey})`
    }
    await admin.rpc('log_event', {
      p_player: playerId,
      p_type: 'ascendant_purchased',
      p_payload: { nodeLabel },
    })
  } catch (e) {
    console.error('activity log failed (ascendant_purchased) — continuing', e)
  }

  return json(result, 200)
```

- [ ] **Step 2: Lint** — Run: `npm run lint`. Expected: clean.
- [ ] **Step 3: Commit**

```bash
git add supabase/functions/ascendant-shop-purchase/index.ts
git commit -m "feat: log ascendant_purchased activity event"
```

### Task 19: `echo-shop-purchase` → `echo_purchased`

**Files:** Modify: `supabase/functions/echo-shop-purchase/index.ts`

- [ ] **Step 1: Log after success**

Right before `return json(result, 200)` (line 49), add:

```ts
  try {
    await admin.rpc('log_event', {
      p_player: playerId,
      p_type: 'echo_purchased',
      p_payload: { nodeLabel: ECHO_SHOP_NODES[nodeKey].label },
    })
  } catch (e) {
    console.error('activity log failed (echo_purchased) — continuing', e)
  }

  return json(result, 200)
```

- [ ] **Step 2: Lint** — Run: `npm run lint`. Expected: clean.
- [ ] **Step 3: Commit**

```bash
git add supabase/functions/echo-shop-purchase/index.ts
git commit -m "feat: log echo_purchased activity event"
```

### Task 20: `infirmary-upgrade` → `infirmary_upgraded`

**Files:** Modify: `supabase/functions/infirmary-upgrade/index.ts`

- [ ] **Step 1: Log after success**

Right before `return json({ infirmary_level: newLevel }, 200)` (line 120), add:

```ts
  try {
    await admin.rpc('log_event', {
      p_player: playerId,
      p_type: 'infirmary_upgraded',
      p_payload: { newLevel },
    })
  } catch (e) {
    console.error('activity log failed (infirmary_upgraded) — continuing', e)
  }

  return json({ infirmary_level: newLevel }, 200)
```

- [ ] **Step 2: Lint** — Run: `npm run lint`. Expected: clean.
- [ ] **Step 3: Commit**

```bash
git add supabase/functions/infirmary-upgrade/index.ts
git commit -m "feat: log infirmary_upgraded activity event"
```

### Task 21: `infirmary-admit` → `character_downed`

**Files:** Modify: `supabase/functions/infirmary-admit/index.ts`

- [ ] **Step 1: Import the helper and log after success, using the existing `current_hp === 0` gate**

Add to the imports (line 1-4):

```ts
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { maxHpByCharacter, type CharRowForHp } from '../_shared/charMaxHp.ts'
import { bedsForLevel } from '../../../src/lib/infirmary.ts'
import { fetchCharacterName } from '../_shared/characterName.ts'
```

Right before `return json({ admission }, 201)` (line 94), add:

```ts
  if (char.current_hp === 0) {
    try {
      const characterName = await fetchCharacterName(admin, playerId, characterId)
      await admin.rpc('log_event', {
        p_player: playerId,
        p_type: 'character_downed',
        p_payload: { characterName },
      })
    } catch (e) {
      console.error('activity log failed (character_downed) — continuing', e)
    }
  }

  return json({ admission }, 201)
```

- [ ] **Step 2: Lint** — Run: `npm run lint`. Expected: clean.
- [ ] **Step 3: Commit**

```bash
git add supabase/functions/infirmary-admit/index.ts
git commit -m "feat: log character_downed activity event"
```

### Task 22: `infirmary-discharge` → `infirmary_discharged`

**Files:** Modify: `supabase/functions/infirmary-discharge/index.ts`

- [ ] **Step 1: Import the helper and log after success**

Add to the imports (line 1-4):

```ts
import { corsHeaders } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { statsByCharacter, type CharRowForHp } from '../_shared/charMaxHp.ts'
import { healState } from '../../../src/lib/infirmary.ts'
import { fetchCharacterName } from '../_shared/characterName.ts'
```

Right before `return json({ characterId, current_hp: newHp, phase: state.phase }, 200)` (line 108), add:

```ts
  try {
    const characterName = await fetchCharacterName(admin, playerId, characterId)
    await admin.rpc('log_event', {
      p_player: playerId,
      p_type: 'infirmary_discharged',
      p_payload: { characterName, fullyHealed: state.phase === 'full' },
    })
  } catch (e) {
    console.error('activity log failed (infirmary_discharged) — continuing', e)
  }

  return json({ characterId, current_hp: newHp, phase: state.phase }, 200)
```

- [ ] **Step 2: Lint** — Run: `npm run lint`. Expected: clean.
- [ ] **Step 3: Commit**

```bash
git add supabase/functions/infirmary-discharge/index.ts
git commit -m "feat: log infirmary_discharged activity event"
```

### Task 23: `item-upgrade` → `item_upgraded`

**Files:** Modify: `supabase/functions/item-upgrade/index.ts`

- [ ] **Step 1: Log after success, gated on a nonzero count**

Right before `return json({ ok: true }, 200)` (line 72), add:

```ts
  if (itemsUpgraded > 0) {
    try {
      await admin.rpc('log_event', {
        p_player: playerId,
        p_type: 'item_upgraded',
        p_payload: { count: itemsUpgraded },
      })
    } catch (e) {
      console.error('activity log failed (item_upgraded) — continuing', e)
    }
  }

  return json({ ok: true }, 200)
```

- [ ] **Step 2: Lint** — Run: `npm run lint`. Expected: clean.
- [ ] **Step 3: Commit**

```bash
git add supabase/functions/item-upgrade/index.ts
git commit -m "feat: log item_upgraded activity event"
```

### Task 24: `reset-player` → `player_reset`

**Files:** Modify: `supabase/functions/reset-player/index.ts`

- [ ] **Step 1: Log after success, reading `echoesAwarded` off the RPC's own result**

Right before `return json(result, 200)` (line 65), add:

```ts
  try {
    const echoesAwarded = (result as { echoesAwarded?: number } | null)?.echoesAwarded
    await admin.rpc('log_event', {
      p_player: playerId,
      p_type: 'player_reset',
      p_payload: echoesAwarded ? { echoesAwarded } : {},
    })
  } catch (e) {
    console.error('activity log failed (player_reset) — continuing', e)
  }

  return json(result, 200)
```

- [ ] **Step 2: Lint** — Run: `npm run lint`. Expected: clean.
- [ ] **Step 3: Commit**

```bash
git add supabase/functions/reset-player/index.ts
git commit -m "feat: log player_reset activity event"
```

### Task 25: `transcend-player` → `player_transcended`

**Files:** Modify: `supabase/functions/transcend-player/index.ts`

- [ ] **Step 1: Log after success, reading `shardsAwarded` off the RPC's own result**

Right before `return json(result, 200)` (line 71), add:

```ts
  try {
    const shardsAwarded = (result as { shardsAwarded?: number } | null)?.shardsAwarded
    await admin.rpc('log_event', {
      p_player: playerId,
      p_type: 'player_transcended',
      p_payload: shardsAwarded ? { shardsAwarded } : {},
    })
  } catch (e) {
    console.error('activity log failed (player_transcended) — continuing', e)
  }

  return json(result, 200)
```

- [ ] **Step 2: Lint** — Run: `npm run lint`. Expected: clean.
- [ ] **Step 3: Commit**

```bash
git add supabase/functions/transcend-player/index.ts
git commit -m "feat: log player_transcended activity event"
```

---

## Task 26: ADR + TODO.md + full-suite verification

**Files:**
- Modify: `docs/DECISIONS.md`
- Modify: `TODO.md`

**Interfaces:** Consumes everything from Tasks 1-25 (this is the closing task — run after all 21 write-site tasks and the frontend are merged together).

- [ ] **Step 1: Add the ADR**

Append a new numbered ADR to `docs/DECISIONS.md` (use the next available number — check the file's last entry first, since other work may have landed ADRs since this plan was written) recording:
- The `log_event`-RPC approach: one shared RPC does insert + 200-row-per-player retention prune atomically, called from 21 Edge Functions, instead of a raw insert per site or a DB trigger per source table.
- Why raw inserts were rejected: breaks this repo's established "every mutation goes through a SECURITY DEFINER RPC" convention, and would repeat (or inconsistently skip) the prune logic 21 times.
- Why triggers were rejected: several source tables (`mission_runs`, `craft_runs`, `gather_assignments`) are deleted as part of the normal claim/collect flow, so there's no reliable `AFTER INSERT` hook at the right semantic moment, and a trigger has no access to Edge-Function-computed values (gold granted, XP gained, etc.).
- Pointer to the spec: `docs/superpowers/specs/2026-09-18-activity-log-design.md`.

- [ ] **Step 2: Update TODO.md**

Replace the old "History / activity log component" bullet (`## Decisions queue — 2026-07-10...` section) with a `[x]` done entry summarizing what shipped, pointing at `src/lib/events.ts`, `src/features/activity/`, and the new ADR, following this file's existing `↳ context:` convention.

- [ ] **Step 3: Full local verification**

Run, in order:
```bash
npm run lint
npm run build
npx vitest run
npx supabase test db
```
Expected: all four clean/passing — lint clean, build clean, full Vitest suite passing (base 508 + this plan's ~29 new `formatEvent` tests), pgTAP suite passing (base 79 + this plan's 4 new `activity_log.sql` assertions).

- [ ] **Step 4: Manual end-to-end verification**

With the local Supabase stack running, start the dev server, sign in, and exercise at least: send a mission and claim it (win), recruit a character, start and claim a craft, gather and collect, start and stop a skill, choose a blessing, purchase one Echo Shop node. After each, check `/activity` shows a new row with a sensible sentence. This is the first point in the plan where the feature can be seen working end-to-end — every earlier task's automated checks (lint/vitest/pgTAP) can't substitute for actually looking at the page.

- [ ] **Step 5: Commit**

```bash
git add docs/DECISIONS.md TODO.md
git commit -m "docs: activity log ADR + TODO.md entry"
```

---

## Self-review notes (from the plan author, not a task)

- **Spec coverage:** every row of the spec's §4 catalog (22 event types / 21 sites) has a task. §3's schema is Task 1 verbatim. §5's frontend is Task 4. §6's error handling (try/catch, never blocking) is applied identically in every site task. §7's testing is Task 1 (pgTAP) + Task 3 (Vitest) + Task 26 (full-suite + manual). §8's documentation follow-through is Task 26.
- **Corrections made during planning that the spec got approximately-but-not-exactly right** (found by actually reading every file instead of inferring from precedent): `reset_player`/`transcend_player` return `echoesAwarded`/`shardsAwarded` (not the spec's placeholder `echoesEarned`/`shardsEarned`) — fixed throughout. `gather-start`/`skill-start`/`blessing-choose`/`blessing-respec`/`infirmary-admit`/`infirmary-discharge` do NOT already have a character's Sanity name in scope the way the spec assumed "character rows already fetched" covered — this added Task 2 (`fetchCharacterName`), a shared helper not in the original spec but a direct, minimal consequence of it.
- **Type consistency:** `EventType`/payload field names in Task 3's `formatEvent` match every site task's `p_payload` object shape exactly (cross-checked field-by-field while writing this plan).
