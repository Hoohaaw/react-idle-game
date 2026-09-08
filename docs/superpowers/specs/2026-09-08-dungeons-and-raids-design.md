# Dungeons & raids — design spec

Date: 2026-09-08. New mission-type subsystem alongside world maps (ADR-0034). This spec covers
**mechanics only** — the multi-stage encounter engine, party-size scaling, schema, and loot/theme
wiring — proven out with one reference dungeon and one reference raid. Bulk content authoring
(more dungeons/raids, the full item-set each needs) is an explicit follow-up wave, the same way
map-engine work (ADR-0034) shipped separately from the 23-item authoring pass (ADR-0043/0044).

## 1. Problem

Missions today are a single shape: one `missionDef` = one `encounterDef` = one fight, dispatched
once, claimed once, capped at a 3-character party (`MAX_PARTY`,
`src/features/missions/components/MissionDispatch.tsx:21` — enforced client-side only, nothing
server-side checks party size today). There's no bigger-party, multi-fight, high-stakes content
above what the 3 live maps offer, and no path to Legendary-weighted loot beyond whatever any
individual map boss happens to author.

## 2. Goals

- **Dungeon**: up to 5 characters, 3 bosses of escalating difficulty, each preceded by 2 easy
  "item-grab" trash packs. Trash ≈5min real-world wait each; each boss 1h, the 3rd (final) boss
  1.5h. Daily lockout once fully cleared (resets 00:00 UTC).
- **Raid**: up to 10 characters, 3 trash packs then one very hard boss. Total run ≈24h. Weekly
  lockout once cleared (resets Sunday 00:00 UTC).
- Losing a stage costs time, not progress — retry the same stage, keep everything already cleared
  in that run.
- Dungeon and raid loot is **themed** to the content's damage school (fire dungeon → fire-flavored
  named gear); the school also governs what the enemies inside actually deal, so bringing a
  matching-school character is the in-fight payoff.
- Raids get a real (if small on the low end) chance at Legendary drops; dungeon final bosses get a
  smaller chance at the same. Both stay inside the existing 5-rarity system — Legendary already
  exists end-to-end (`src/lib/rarity.ts`), nothing new to build there.
- Entry is gated by clearing the paired map, and difficulty stays inside that map's existing enemy
  tier (`docs/BALANCE.md`'s T1–8 template) rather than inventing a new tier band.

## 3. Non-goals (this spec)

- **Bulk content authoring** — more than one dungeon and one raid, and the full themed item sets
  they'd need. Follow-up wave, same split as ADR-0034 vs ADR-0043/0044.
- **Per-school character resist affixes** — `docs/ELEMENTS.md` explicitly deferred this ("character
  per-school resistances arrive with gear affixes later") and it stays deferred. Themed gear here
  boosts existing stats (attack, spellPower, etc.) with school flavor; it does not grant new
  defensive resist stats. `combat.ts`'s mitigation engine is untouched.
- **Fixing `mission-start`'s missing server-side party-size check.** That's a pre-existing gap in
  unrelated code. The new `group-start-stage` function enforces its own cap correctly from day one;
  retrofitting the old mission path is a separate, unrelated fix if wanted later.
- **A weekly-raid-style social/group-invite system.** Every run here is solo-player, same as
  missions today — "raid" describes the encounter shape (10-cap, long, hard), not multiplayer.

## 4. Data model

### 4a. Shared stage object (`groupStage`, new Sanity object type)

```
groupStage: {
  kind: 'trash' | 'boss'
  encounter: reference -> encounterDef   // same auto-battle sim as missions (ADR-0013)
  durationSeconds: number                // real-world wait, same meaning as missionDef's field
  loot: lootDrop[]                        // REUSES the existing lootDrop object as-is
}
```

No new drop mechanism — `lootDrop`'s independent per-item roll + rarityWeights (already built,
`studio/schemaTypes/objects/lootDrop.ts`) is exactly what "boss = extra + better weights" and a
"small Legendary weight on this line" both need. Trash stages just author cheap, high-dropChance,
low-rarity-ceiling lines; boss stages author richer lines, same convention maps already use.

### 4b. `dungeonDef` (new Sanity document type)

```
dungeonDef: {
  name: string
  dungeonKey: string             // stable id, lowercase-hyphen, same convention as mapKey/missionKey
  theme: School                  // reference into src/lib/schools.ts's SCHOOL_KEYS
  mapGate: reference -> mapDef   // clearing this map's stage 7 unlocks the dungeon
  stages: groupStage[9]          // exactly 3x (trash, trash, boss), boss tiers escalating
  description: text
}
```

### 4c. `raidDef` (new Sanity document type)

```
raidDef: {
  name: string
  raidKey: string
  theme: School
  mapGate: reference -> mapDef
  stages: groupStage[4]          // exactly (trash, trash, trash, boss)
  description: text
}
```

Two separate document types, not one `groupDef` with a `mode` discriminator — dungeon and raid
have different fixed stage-count invariants (9 vs 4), and Sanity validation for "must be exactly
9 stages in a 3×(trash,trash,boss) pattern" vs "exactly 4 in (trash,trash,trash,boss)" is cleaner
as two schemas than one conditional one. They share the `groupStage` object and (see §5) one
runtime engine — the duplication is in authoring-time shape only, not logic.

### 4d. Mode-level constants (code, not authored per-def)

`src/lib/groupContent.ts`:

```ts
export const GROUP_PARTY_CAP = { dungeon: 5, raid: 10 } as const
export const GROUP_LOCKOUT = { dungeon: 'daily', raid: 'weekly' } as const
```

Party cap and lockout cadence are rules of the *type* (every dungeon behaves the same way), not a
per-dungeon authoring choice — matches how `MAX_PARTY = 3` is a single constant today, not authored
per map.

### 4e. `group_runs` (new migration)

```sql
create table public.group_runs (
  player_id uuid not null references auth.users(id),
  kind text not null check (kind in ('dungeon', 'raid')),
  def_key text not null,                    -- dungeonKey or raidKey
  current_stage_index int not null default 0,
  status text not null default 'in_progress' check (status in ('in_progress', 'complete')),
  party jsonb not null default '[]'::jsonb, -- character ids dispatched for the CURRENT stage
  stage_started_at timestamptz,
  stage_ends_at timestamptz,
  last_cleared_at timestamptz,              -- set on final-stage win; drives the lockout check
  primary key (player_id, kind, def_key)
);
-- RLS: owner-read only, no client write (ADR-0003) — all writes via the two Edge Functions below.
```

One row per player per dungeon/raid (not per run-attempt) — a fresh clear overwrites
`current_stage_index` back to 0 and updates `last_cleared_at`; there's no history table, matching
how `mission_runs`/`map_progress` don't keep a clear history either.

## 5. Runtime flow

Two new Edge Functions, shaped like `mission-start`/`mission-claim`:

**`group-start-stage`** (`{ kind, defKey, party: characterId[] }`):
1. Fetch the def from Sanity (`dungeonDef` or `raidDef` by key), resolve `mapGate` and confirm the
   player's `map_progress` clears it (same check style as ADR-0034's map-unlock gate).
2. Validate `party.length <= GROUP_PARTY_CAP[kind]` and every character belongs to the player and
   isn't already dispatched elsewhere — server-side, real validation (the gap `mission-start` has
   today isn't repeated here).
3. Load (or create) the `group_runs` row. If `status = 'complete'`: check the lockout boundary
   (next UTC-midnight for dungeon, next Sunday-UTC-midnight for raid) against `last_cleared_at` —
   if still inside the lockout window, reject; otherwise reset `current_stage_index` to 0 and
   `status` to `'in_progress'`, starting a fresh run.
4. Reject if a stage is already in flight (`stage_ends_at` in the future).
5. Write `party`, `stage_started_at = now()`, `stage_ends_at = now() + stages[current_stage_index].durationSeconds`
   (no speed-modifier multiplier for v1 — dungeons/raids are long by design; traits'
   `missionSpeedDecrease` staying mission-only is a deliberate scope line, not an oversight).

**`group-claim-stage`** (`{ kind, defKey }`):
1. Guard `now() >= stage_ends_at`, same "not finished yet" rejection `mission-claim` already uses.
2. Resolve the current stage's `encounter` via `simulateCombat` — same engine call, same RNG
   conventions as `mission-claim`. Factoring the shared fight-resolution + loot-roll code out of
   `mission-claim` into a common helper (rather than copy-pasting it) is an implementation detail
   for the plan, not a design decision.
3. **On loss**: clear `stage_started_at`/`stage_ends_at`, leave `current_stage_index` unchanged,
   `status` stays `'in_progress'`. Player can immediately call `group-start-stage` again for the
   same stage with a reshuffled party.
4. **On win, not the last stage**: roll that stage's `loot[]` (identical mechanism to
   `mission-claim`'s loot loop), pay it out, advance `current_stage_index += 1`, clear
   `stage_ends_at` so the next `group-start-stage` call can begin.
5. **On win, last stage**: same loot payout, then set `status = 'complete'`,
   `last_cleared_at = now()`. The player can immediately see "come back after \<reset\>" — no
   further stage to dispatch until the lockout clears.

## 6. Loot & theme wiring

- `theme` (a `School` key) governs the stage's authored `enemyDef`s' `damageSchool` — this is the
  existing ELEMENTS.md mechanism (ADR-0033), just applied to a new content type. A fire dungeon's
  enemies are authored `damageSchool: 'fire'`; a character with a matching `damageSchool` (e.g.
  Callum) gets the existing offense-side mitigation payoff. No engine change.
- Items dropped here get no new schema field tying them to a school — they're themed in `name`/
  `description` only (existing `docs/ITEMS.md` flavor-text convention), carrying ordinary stat
  bonuses sized by `itemBudget.ts`'s existing per-slot rate bands. A "fire dungeon" boss dropping
  "Emberfang Gauntlets" is a naming/flavor decision made at authoring time, not a schema feature.
- Legendary weighting: dungeon boss loot lines normally cap at Epic; **only the 3rd (final) boss's
  line** carries a small non-zero Legendary weight. The raid boss's line carries the largest
  Legendary weight in the game. Exact weight values are an authoring/balance decision made when the
  reference content is built, not fixed by this spec.

## 7. Difficulty placement

Each dungeon/raid's `mapGate` also anchors its difficulty: enemies are drawn from the **same tier
band** as that map's own boss (not a tier above), matching `docs/BALANCE.md`'s already-modeled
T1–8 template. The harder feel comes from the format itself — attrition across up to 9 sequential
fights, bigger required party, tighter boss tuning — not from inventing tier 9+. Because this is a
real stat-budget/shape deviation from template defaults, it needs a sweep
(`node scripts/balance/sweep.ts`) before the reference dungeon/raid ships, per `docs/BALANCE.md`'s
own rule for material deviations.

## 8. UI

New feature module (`src/features/groupContent/` — one module, since the engine is shared) with:
- A party picker distinct from `MissionDispatch`'s 3-slot one, supporting up to 5 or 10 slots
  depending on `kind`.
- A per-run progress view: current stage (trash/boss, which number), a countdown for the in-flight
  stage (`src/lib/time.ts`'s existing `formatRemaining`), and what's next once claimed.
- A lockout state once `status = 'complete'`: countdown to the next daily/weekly reset boundary,
  no dispatch UI available until then.
- Entry point gated the same way locked maps already communicate a gate — visible but inert until
  `mapGate` is cleared.

## 9. Error handling / edge cases

- **Party validation failures** (too many characters, a character already busy elsewhere, a
  character not owned by the caller) — rejected server-side in `group-start-stage`, same posture
  as every other write path (ADR-0003).
- **Double-claim race**: two near-simultaneous `group-claim-stage` calls for the same run — guard
  identically to `mission-claim`'s `ends_at` check; the second call sees `stage_ends_at` already
  cleared (or the stage already advanced) and gets a "nothing to claim" rejection, not a double
  payout.
- **Lockout boundary edge**: a player mid-stage when a daily/weekly reset boundary passes keeps
  playing that run uninterrupted — the lockout only gates *starting a new run after a completed
  one*, never an in-progress one.
- **Losing the final boss of a run that's never been cleared**: no lockout applies (lockout is only
  set on `status = 'complete'`) — retry the boss stage immediately, same as any other loss.

## 10. Testing

- `src/lib/groupContent.ts` (party-cap constants, lockout-boundary math, stage-sequence helpers)
  gets real unit tests — `test-writer` territory, one case per lockout boundary edge (just before /
  just after UTC midnight and Sunday UTC midnight).
- `group-start-stage` / `group-claim-stage` get **no automated test coverage**, same accepted gap
  `recruit_character` already has — this repo has no pgTAP/Deno test infra yet (TODO.md,
  ADR-0048's consequences). Not silently skipped, just not newly invented here.
- The reference dungeon and raid content need a before/after balance sweep per §7, evidence
  committed under `scripts/balance/reports/` per `docs/BALANCE.md`'s own process.

## 11. Follow-ups (not this spec)

- **Content-authoring wave**: more dungeons, more raids, the full themed item sets each needs —
  once this engine + one reference dungeon + one reference raid prove the pattern, this becomes its
  own checklist (`docs/MAPS.md`-style) rather than a one-off.
- **Per-school character resist affixes** (ELEMENTS.md v2) — still deferred, unblocked by nothing
  in this spec, but a dungeon/raid gear line is the natural place to eventually introduce it.
- **Retrofitting server-side party-size enforcement onto `mission-start`** — unrelated pre-existing
  gap, not fixed here.
