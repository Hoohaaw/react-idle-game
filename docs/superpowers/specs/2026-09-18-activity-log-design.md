# Activity Log — Design Spec

**Date:** 2026-09-18
**Status:** Approved for planning
**TODO.md item:** "History / activity log component"

## 1. Purpose

Players have no way to look back at what happened on their account. Missions,
gathers, and crafts are especially opaque: their underlying rows (`mission_runs`,
`gather_assignments`, `craft_runs`) are deleted or overwritten as part of the
normal claim/collect flow (see `src/lib/lifetimeStats.ts`'s module comment,
which already documents this for the lifetime-stats registry — the same
absence of a ledger applies here). This spec adds a genuine event ledger and a
simple page to read it.

**Explicit non-goals** (raised and deliberately cut during design):
- No filters, grouping by day, icons, or graphics — "just enough to show what
  was done," a plain newest-first list of one-line sentences.
- No pagination — the table is capped at 200 rows per player server-side, so
  one query returns the whole feed.
- No retroactive backfill — the log starts recording from the day this ships;
  history before that doesn't exist and isn't synthesized.
- Gear equip/unequip is explicitly OUT of scope for v1 (considered and cut
  during design — a player actively re-gearing would flood the feed; revisit
  later if wanted).
- `record-login` and `username-available` are explicitly OUT of scope —
  neither represents a player action worth showing back to the player
  (login bookkeeping is already an achievement counter; the latter isn't a
  mutation at all).

## 2. Architecture

**One shared `log_event` RPC, called from every write site**, not a raw insert
per Edge Function. This repo's existing convention (verified across every
Supabase-touching Edge Function in this codebase — `recruit`, `mission-claim`,
`admit_infirmary`, etc.) is that **no Edge Function ever inserts into a table
directly via the admin client; every mutation goes through a `security
definer` RPC**. That's the real shape behind ADR-0003 "server-authoritative
writes," not just "no client writes." A new `player_events` table gets the
same treatment: one RPC, `log_event(p_player, p_type, p_payload)`, does the
insert **and** the retention prune in a single atomic statement, and each of
the 21 call sites (below) adds one `admin.rpc('log_event', {...})` call after
its existing logic succeeds.

Two alternatives were considered and rejected:
- **Raw `.insert()` per site** — breaks the RPC-only-writes convention, and
  either repeats the prune logic 21 times or skips it inconsistently.
- **Postgres triggers on the source tables** — rejected because several
  source rows (`mission_runs`, `craft_runs`, `gather_assignments`) are
  *deleted* as part of the normal claim/collect flow, so there's no reliable
  `AFTER INSERT` hook that fires at the right semantic moment. A trigger also
  has no access to values that only exist inside the Edge Function's own
  computation (e.g. gold granted, XP gained) — the Edge Function already has
  everything needed; a trigger would have to re-derive it.

**Reads are direct from the client**, same as every other player-owned table
in this codebase (`profiles`, `player_characters`, etc.) — RLS scopes each
player to their own rows, no Edge Function needed for the read path. Only
writes go through the RPC.

## 3. Schema

```sql
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

create policy "player_events_select_own"
  on public.player_events for select to authenticated
  using (player_id = (select auth.uid()));
-- Intentionally NO client insert/update/delete policy (ADR-0003) — same
-- shape as infirmary_admissions (supabase/migrations/20260707150000_infirmary.sql).

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

  -- Cap at 200 most recent per player — enforced here, once, regardless of
  -- which of the 21 call sites triggered the insert.
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

Suggested migration filename (final timestamp picked at implementation time,
following this repo's `YYYYMMDDHHMMSS_<slug>.sql` convention):
`supabase/migrations/20260918100000_activity_log.sql`.

The `(player_id, created_at desc)` index serves both the prune subquery and
the feed's read query — no second index needed.

## 4. Event catalog

22 event types across 21 write sites. Every payload is deliberately minimal —
just what `formatEvent()` (§5) needs to render one sentence, nothing the
player would have to parse.

| Type | Site | Payload | Renders as |
|---|---|---|---|
| `mission_started` | `mission-start` | `{ missionName: string }` | "Sent party to Goblin Outpost" |
| `mission_claimed` | `mission-claim` | `{ missionName: string, result: 'win'\|'timeout'\|'party-wiped', gold?: number, xp?: number, itemCount?: number }` | "Cleared Goblin Outpost — +120 gold, +85 XP, 2 items" / "Frozen Pass ended in a party wipe" |
| `group_stage_started` | `group-start-stage` | `{ contentName: string, kind: 'dungeon'\|'raid', stageIndex: number }` | "Started Emberdeep Vault (stage 4)" |
| `group_stage_claimed` | `group-claim-stage` | `{ contentName: string, kind: 'dungeon'\|'raid', stageIndex: number, result: 'win'\|'loss', gold?: number, itemCount?: number }` | "Cleared Emberdeep Vault (stage 4) — +200 gold, 1 item" |
| `character_leveled` | `mission-claim`, `group-claim-stage` | `{ characterName: string, newLevel: number }` — **one row per character that leveled**, never batched into one event | "Sir Aldric reached level 12" |
| `character_recruited` | `recruit` | `{ characterName: string }` | "Recruited Lyra Swift" |
| `character_downed` | `infirmary-admit` | `{ characterName: string }` — gated on `current_hp === 0` at admission, same gate the `charactersDowned` lifetime stat uses (`infirmary-admit/index.ts`) | "Sir Aldric was downed" |
| `craft_started` | `craft-start` | `{ recipeName: string }` | "Started crafting Iron Band" |
| `item_crafted` | `craft-claim` | `{ itemName: string, rarity: string }` | "Crafted Iron Band (Uncommon)" |
| `item_upgraded` | `item-upgrade` | `{ count: number }` — total across the batch, `item-upgrade` already computes this for the `itemsUpgraded` lifetime stat | "Upgraded 3 items" |
| `gather_started` | `gather-start` | `{ resource: string, characterName: string }` | "Sent Lyra Swift to gather Copper" |
| `gather_collected` | `gather-collect` | `{ resource: string, amount: number }` — only logged when `amount > 0` or `stop === true`, skips no-op polls | "Gathered 45 Copper" |
| `skill_started` | `skill-start` | `{ skillName: string, characterName: string }` | "Sent Sir Aldric to train Religion" |
| `skill_collected` | `skill-collect` | `{ skillName: string, xpGained: number, stopped: boolean }` | "Trained Religion — +120 XP" |
| `blessing_chosen` | `blessing-choose` | `{ characterName: string, choiceLabel: string }` | "Sir Aldric chose a blessing: Cleave Mastery" |
| `blessing_respec` | `blessing-respec` | `{ characterName: string }` | "Respecced Sir Aldric's blessing tree" |
| `ascendant_purchased` | `ascendant-shop-purchase` | `{ nodeLabel: string }` — from `src/lib/ascendantShop.ts`'s registry, no new fetch needed | "Purchased Ascendant node: Power +1" |
| `echo_purchased` | `echo-shop-purchase` | `{ nodeLabel: string }` — from `src/lib/echoShop.ts`'s registry | "Purchased Echo Shop node: Mission Speed +2%" |
| `infirmary_upgraded` | `infirmary-upgrade` | `{ newLevel: number }` | "Upgraded the Infirmary to level 4" |
| `infirmary_discharged` | `infirmary-discharge` | `{ characterName: string, fullyHealed: boolean }` | "Sir Aldric left the infirmary, fully healed" / "...early, partially healed" |
| `player_reset` | `reset-player` | `{ echoesEarned?: number }` | "Reset — earned 340 Echoes" |
| `player_transcended` | `transcend-player` | `{ shardsEarned?: number }` | "Transcended — earned 12 Ascendant Shards" |

**Verification note for the implementation plan** (not a placeholder — an
explicit instruction, same discipline this session already applied to
TODO.md's other technical notes): mission/recipe/dungeon-raid display names
need a `name` field added to each site's existing Sanity GROQ query.
Confirmed possible for `mission-start` and `craft-start` by reading their
current source (both already fetch the relevant Sanity document by key for
duration/reagent validation and don't yet select `name` — adding it is a
one-line projection change, not a new fetch). `group-start-stage` almost
certainly follows the same shape but its exact GROQ query wasn't re-read
during this design session — confirm before writing that site's task.
Character/resource/skill names for the gather/skill start-sites and node
labels for the shop-purchase sites come from data already in scope or from
existing code registries (`RESOURCE_SOURCE`, `SKILL_DEFS`, `ascendantShop.ts`,
`echoShop.ts`) — no new fetch needed there. `blessing-choose`'s exact
`choiceLabel` source (likely the authored blessing content already fetched
for validation) also needs confirming against current source, not guessed.

## 5. Frontend

New `src/lib/events.ts` — the type registry, mirroring `lifetimeStats.ts`'s
module style:

```ts
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

// One case per type from the catalog in §4 — returns the exact rendered
// sentence documented there. Unknown/malformed payload fields fall back to
// a generic "(details unavailable)" fragment rather than throwing, since
// this reads player-controlled-shape JSONB and must never crash the page.
export function formatEvent(event: PlayerEvent): string { /* ... */ }
```

New `src/services/activity.ts` — `fetchActivity(): Promise<PlayerEvent[]>`,
a direct Supabase client `select` on `player_events` ordered
`created_at desc` (RLS-scoped, no Edge Function — same read pattern as
`fetchProfile` in `src/services/profile.ts`).

New `src/features/activity/` module (feature-module shape, not an
unmigrated `src/pages/` page — this is new work):
- `hooks.ts` — `useActivity()`, a thin `useQuery({ queryKey: ['activity'],
  queryFn: fetchActivity })`, mirroring `useProfile()`'s exact shape
  (`src/hooks/useProfile.ts`).
- `ActivityPage.tsx` — loading state, then a plain vertical list: one row per
  event, `formatEvent(event)` as the text plus a relative timestamp (reuse
  whatever relative-time helper `src/lib/time.ts` already exports — confirm
  the exact function name during planning). Empty state: "No activity yet —
  go play!" or similar, matching this codebase's existing empty-state tone.
- `index.ts` — barrel exporting `ActivityPage` (the only public export,
  per this repo's feature-module import rule).

Routing: `/activity` added to `App.tsx`'s `RequireAuth`-gated block (this is
private account data, unlike `/terms`/`/privacy`) and to `GameHeader.tsx`'s
`NAV` array, alongside `/statistics`/`/achievements`.

No pagination UI, no filters, no day-grouping, no icons — a plain scrollable
list of sentences in a `Panel`-style container, consistent with the rest of
the game's chrome but visually the simplest page in the app by design.

## 6. Error handling

Every `admin.rpc('log_event', ...)` call at every one of the 21 sites is
wrapped in `try/catch`, logs to `console.error` on failure, and never
rethrows or blocks the surrounding response. A lost activity-log row must
never cost a player their actual mission reward, level-up, or purchase.
Mirrors the existing pattern in `gather-collect`'s acquisition-candidate
lookup (`supabase/functions/gather-collect/index.ts`), which already treats
a non-critical side-effect failure as log-and-continue rather than
fail-the-request.

## 7. Testing

**Backend** (pgTAP, `supabase/tests/database/`, this session's established
migration-PR convention — `npx supabase test db` before merge):
- `log_event` inserts a row with the given type/payload.
- Inserting a 201st row for a player deletes the oldest one (cap enforced).
- A player can `select` only their own `player_events` rows (RLS).
- No `insert`/`update`/`delete` policy exists for `authenticated`/`anon` on
  `player_events` (client-write block, ADR-0003).
- `log_event`'s grants: `execute` revoked from `public`/`anon`/`authenticated`,
  granted to `service_role` only.

**Frontend** (Vitest): one test per `EventType` case in `formatEvent()`,
confirming each renders its documented sentence shape — mirrors
`statGroups.ts`'s existing test coverage pattern (a small, exhaustive,
per-registry-entry test rather than testing the page component, since the
page is a thin render of this function's output).

## 8. Documentation follow-through

Per this session's standing convention (raised explicitly during design,
not left implicit):
- A new numbered ADR in `docs/DECISIONS.md` recording the `log_event`-RPC
  approach and why raw inserts/triggers were rejected (§2) — same weight
  as ADR-0054/ADR-0058, since this establishes a new table + a reusable
  write pattern other future event-worthy actions will extend.
- A `TODO.md` entry with a `↳ context:` anchor once implementation lands,
  replacing today's "History / activity log component" bullet.
- Standard header doc-comments on the new migration, `src/lib/events.ts`,
  and `ActivityPage.tsx`, matching every other file in this codebase.
