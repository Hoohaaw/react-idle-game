# Activity log — design spec

Date: 2026-09-24
Status: approved, ready for implementation plan
TODO source item: "History / activity log component" (`TODO.md`, Decisions queue section)

## Motivation

Right now the game has zero event history. `mission_runs`/`gather_assignments` (the only
tables with "activity" in the name) are DELETED on claim — they represent *in-progress* timers,
not a record of what happened. `/statistics` (ADR built 2026-09-16) shows cumulative lifetime
totals, but a player can't see "what happened, when" — no feed of individual past events.

## Two versions considered

- **Version A — full replayable events.** One row per claim with rich detail: party, enemies,
  exact loot rolled, gold/XP breakdown. Reads like a real combat log entry
  ("Beat Gravemarch Stage 3 with [party], won 342 gold + Rusted Blade (Rare), 14:32"). Requires
  every claim RPC to serialize much richer payloads. Genuinely interesting, but not something
  the game needs right now — **noted here as a future idea, not built.** If ever picked up,
  it likely wants its own `event_detail jsonb` column or a separate richer table, not a retrofit
  of the ledger below.
- **Version B — lightweight ledger (this spec).** Reuses the `p_lifetime_stats jsonb` delta
  shape every stat-writing RPC already passes in. One row per RPC call, holding whatever deltas
  it produced ("+342 gold, +50 XP — Mission Cleared, 14:32"). Cheap: one shared SQL insert
  point, no new Edge Function payloads, no new client-supplied data.

**Decision: build version B.** Revisit version A only if the player-facing want for full replay
detail becomes concrete.

## Data model

```sql
create table public.activity_log (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references auth.users(id) on delete cascade,
  source       text not null,        -- literal per call site, e.g. 'mission-claim'
  deltas       jsonb not null,       -- same shape as p_lifetime_stats
  character_id uuid references public.player_characters(id) on delete set null,
  party        uuid[],               -- no FK, same convention as mission_runs.party
  map_key      text,                 -- Sanity content key (map, or dungeon/raid def) — nullable
  created_at   timestamptz not null default now()
);
```

- `character_id` is `on delete set null`, **not cascade** — a Transcend/Reset wipe of
  `player_characters` must not blow away the player's history; it just orphans the reference
  (the UI falls back to showing nothing/"a character" for that row).
- `party` has no FK, matching `mission_runs.party`'s existing convention (an array can't
  cleanly reference a table; a dangling id is tolerated and simply fails to resolve a name
  client-side).
- `map_key` doubles for both real map keys (missions) and dungeon/raid def keys
  (`group-claim-stage`) — one nullable text column, no separate content-type column. Good
  enough; split later if it ever needs disambiguating.
- RLS: owner-read only (`player_id = (select auth.uid())`), no client write — same ADR-0003
  pattern as every other gameplay table. `grant select to authenticated`;
  `grant select, insert, update, delete to service_role`.
- A `before insert` (or `after insert`) trigger trims each player back to their newest 200 rows:

```sql
create function public.trim_activity_log() returns trigger language plpgsql as $$
begin
  delete from public.activity_log
   where player_id = new.player_id
     and id not in (
       select id from public.activity_log
        where player_id = new.player_id
        order by created_at desc
        limit 200
     );
  return null;
end;
$$;

create trigger trim_activity_log_after_insert
  after insert on public.activity_log
  for each row execute function public.trim_activity_log();
```

## Shared function: `apply_lifetime_stats`

The `p_lifetime_stats` update loop is currently duplicated verbatim across 7 RPCs
(`recruit_character`, `claim_craft`, `upgrade_items`, `admit_infirmary`, `claim_mission`,
`collect_gather`, `claim_group_stage`) — copy-pasted each time a new lifetime-stat RPC was
added (see `migration-policy.test.ts`'s existing complaint about this exact drift risk). This
spec extracts it into one shared function that ALSO writes the activity log row, so logging
piggybacks on a refactor that was already overdue:

```sql
create function public.apply_lifetime_stats(
  p_player       uuid,
  p_deltas       jsonb,
  p_source       text,
  p_character_id uuid default null,
  p_party        uuid[] default null,
  p_map_key      text default null
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_key    text;
  v_val    numeric;
  v_logged boolean := false;
begin
  for v_key, v_val in select key, value::numeric from jsonb_each_text(coalesce(p_deltas, '{}'::jsonb))
  loop
    update public.profiles
       set lifetime_stats = jsonb_set(lifetime_stats, array[v_key],
             to_jsonb(coalesce((lifetime_stats->>v_key)::numeric, 0) + v_val))
     where player_id = p_player;
    v_logged := true;
  end loop;

  if v_logged then
    insert into public.activity_log (player_id, source, deltas, character_id, party, map_key)
    values (p_player, p_source, p_deltas, p_character_id, p_party, p_map_key);
  end if;
end;
$$;

revoke all on function public.apply_lifetime_stats(uuid, jsonb, text, uuid, uuid[], text) from public, anon, authenticated;
grant execute on function public.apply_lifetime_stats(uuid, jsonb, text, uuid, uuid[], text) to service_role;
```

`security invoker` (not `security definer`) — this function is only ever called from inside
another already-`security definer` RPC in the same transaction, so it inherits that RPC's
already-elevated context; it is never called directly from a client. The explicit
revoke/grant still applies for defense in depth, matching every other RPC in this codebase.

Skipping the insert when `v_logged` stays `false` means a call with `p_deltas = '{}'::jsonb`
(e.g. `admit_infirmary` admitting a wounded-not-downed character) produces no log row — no
noise entries for "nothing happened."

### Call sites (7 RPC migrations, each drops the inline loop for one function call)

| RPC | `p_source` | `character_id` | `party` | `map_key` |
|---|---|---|---|---|
| `recruit_character` | `'recruit'` | newly-inserted char's id (`v_row.id`) | — | — |
| `claim_craft` | `'craft-claim'` | — | — | — |
| `upgrade_items` | `'item-upgrade'` | — | — | — |
| `admit_infirmary` | `'infirmary-admit'` | `p_char` | — | — |
| `claim_mission` | `'mission-claim'` | — | ids extracted from `p_char_updates` | `p_map_key` |
| `collect_gather` | `'gather-collect'` | the assignment's `player_character_id` | — | — |
| `claim_group_stage` | `'group-claim-stage'` | — | party | dungeon/raid def key |

Each of these 7 RPCs is a drop+recreate migration (same pattern every prior lifetime-stats
migration in this repo already used), preserving every other line of the existing function
body verbatim — only the inline loop is replaced by a single `apply_lifetime_stats(...)` call.
No RPC signature changes (all still take the same `p_lifetime_stats jsonb` param they already
do today) — Edge Functions are **unchanged**, since the new `p_source`/`p_character_id`/
`p_party`/`p_map_key` values are literals or values the RPC already has on hand internally, not
new inputs from the caller.

## Frontend

New feature module `src/features/activity/` (shape matches `missions/`, the reference
exemplar):

```
src/features/activity/
├─ HistoryPage.tsx        # routed page
├─ hooks.ts                # useActivityLog() — TanStack Query
├─ data.ts                 # select * from activity_log where player_id = auth.uid()
│                          #   order by created_at desc  (no pagination — capped at 200 rows)
├─ components/             # row/list presentation
└─ index.ts                # public barrel
```

- Nav entry: **"History"**, routed at `/history`, same tier as Statistics/Achievements in
  `App.tsx`.
- A single fetch of up to 200 rows is enough — the server-side trigger already caps storage,
  so no "load more" / offset pagination is needed.
- Formatting registry `src/lib/activityLog.ts` (same shape as `ROLE_STYLES`/`SCHOOL_DEFS`
  elsewhere in this codebase): `source → title`, e.g. `'mission-claim'` → "Mission Cleared" —
  except when the row's `deltas` contains `missionsFailed` instead of `missionsCleared`, in
  which case the title becomes "Mission Failed" (source alone doesn't fully disambiguate
  win/loss for `mission-claim`/`group-claim-stage`; the presence of the `*Failed`/`partyWipes`
  key does).
- Each row's `deltas` renders as chips reusing `LIFETIME_STAT_DEFS`'s existing labels
  (`src/lib/lifetimeStats.ts`) — "Gold Earned +342" text is already defined there for
  `/statistics`, not reinvented here.
- `character_id`/`party` resolve to display names via the roster already fetched by
  `useRoster()` — no new data fetch, no new Sanity query.
- `map_key` renders as a title-cased raw string for v1 (no map-label registry exists in code
  today — maps are purely Sanity-authored content). Acceptable for v1; revisit if it reads
  oddly in practice (e.g. `'gravemarch'` → "Gravemarch" via simple capitalize, not a real
  display-name lookup).
- No emoji icons (design rule) — any icon slot uses `IconSlot`, per this repo's existing
  convention.

## Testing

- `npx supabase test db` gains new pgTAP assertions (same infra ADR-0058 built): 
  - `apply_lifetime_stats` still updates `profiles.lifetime_stats` correctly (parity with the
    old inline loop's behavior).
  - Empty `p_deltas` produces zero `activity_log` rows.
  - The 200-row trim trigger actually caps a player's row count after the 201st insert.
  - Each of the 7 refactored RPCs still passes its EXISTING pgTAP suite unchanged (locking,
    busy-checks, double-claim guards, etc. — the refactor must not touch that behavior at all).
- Vitest covers the new `src/lib/activityLog.ts` formatting registry (source → title,
  win/loss disambiguation) and `HistoryPage`'s empty-state.

## Migration / rollout order

1. `activity_log` table + RLS + trim trigger (one migration).
2. `apply_lifetime_stats` function (one migration).
3. The 7 RPC drop+recreate migrations, each calling the new function (can be one migration or
   split — no cross-dependency between them beyond both depending on step 2's function
   existing first).
4. `npx supabase test db` full run (existing + new assertions) before any PR merges.
5. Frontend: `src/features/activity/` + nav entry, on its own `feature/activity-log` branch
   per this repo's one-branch-one-task convention (separate from the backend migration
   branch(es), consistent with how `missions/` and `statistics/` were built).
6. Hosted deploy follows this repo's existing pattern: apply migrations via Supabase MCP,
   `get_advisors` after, byte-verify, manual browser exercise (do at least one of each of the
   7 event types and confirm a `/history` row appears).

## Out of scope (this spec)

- Version A (full replayable events) — noted above, not built.
- Any RPC that does NOT currently accept `p_lifetime_stats` (`choose_blessing`,
  `respec_blessings`, `reset_player`, `transcend_player`, `purchase_echo_shop_node`,
  `purchase_ascendant_shop_node`, `equip_item`/`unequip_item`) — these produce no activity log
  rows under this design. A natural follow-up wave if wanted later, each one its own small
  addition once `apply_lifetime_stats` exists as a precedent to extend to (some would need a
  `p_lifetime_stats`-shaped param added first, since they don't have one today).
