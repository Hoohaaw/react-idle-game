# Achievements — design spec

## 1. Problem

`TODO.md` flags an open item: an achievements/badge system, distinct from the reward-granting
Ascendant Milestones (which pay out Shards). The Transcendence spec (2026-09-12) explicitly
scoped a full achievement gallery UI as a non-goal, deferring it to its own design. Today:

- `profiles.ascendant_milestones` and `check_ascendant_milestones` exist, but that system's whole
  purpose is currency award (Ascendant Shards) — it isn't a badge/accomplishment record meant to
  be browsed by the player.
- `/statistics` is a routed page (`src/pages/StatisticsPage.tsx`) but is an empty
  `PagePlaceholder` — reserved for the separate "lifetime stats page" TODO item, not this one.
- `lifetime_stats` already tracks `goldEarned`, `missionsCleared`, `dungeonsCleared`,
  `raidsCleared`, and `resourceGathered.<resource>` for all 9 resources — permanent, cumulative,
  confirmed to survive both `reset_player` and `transcend_player` (required, since Ascendant
  Milestones accumulate across resets).
- `unlocked_characters` also survives `transcend_player` (confirmed by that RPC's own comment:
  "their rows and unlocked_characters entries survive").
- Nothing tracks: legendary-item-equip events, blessing-capstone-earned events, a character
  reaching the level cap, or player login/session activity.

This spec designs the achievements system: its data model, its registry, the concrete badge
list, and the UI surface.

## 2. Goals

- Achievements are **purely cosmetic** — a badge/title record, no currency or stat payout. This
  is a deliberate scope cut from Ascendant Milestones, not an oversight: it means the SQL side
  needs no double-award-race protection (setting a claimed-flag twice via a race is harmless —
  idempotent, no reward to duplicate), unlike `check_ascendant_milestones`, which pays out Shards
  and required exactly that protection (twice, per ADR-0054's incident notes).
- Architecturally mirrors the Ascendant Milestone pattern anyway (a shared, generic SQL check
  function; a registry; a permanent claimed-map) — chosen over a cheaper client-only design for
  consistency with the codebase's one existing badge-like system, and so a future achievement
  that *does* want a payout doesn't need a rewrite.
- Covers three kinds of achievement, all permanent (survive Reset and Transcend):
  - **Threshold ladders over existing `lifetime_stats` counters** — free, no new tracking.
  - **One-off "moment" achievements** for events `lifetime_stats` doesn't cover today (equip a
    Legendary item, earn a blessing capstone, reach the level cap) — each gets exactly one new
    counter/flag, incremented at the single existing RPC that can trigger it.
  - **Login/playtime** — the one category needing genuinely new infrastructure (nothing today
    tracks sessions). Scoped to a single `daysPlayed` counter, not full streak tracking, to keep
    this proportionate to a cosmetic feature.
- A new `/achievements` page: a badge grid grouped by category, earned and locked states, a
  progress bar for locked threshold badges.

## 3. Non-goals (this spec)

- **Any reward/payout for achievements.** If that's wanted later, it's a new spec — this one is
  cosmetic-only by design (see Goals).
- **The lifetime-stats page** (`/statistics`) — a separate TODO item, a separate page, showing
  raw cumulative numbers rather than a badge gallery. Not touched here.
- **Full login-streak logic** (consecutive-day tracking, timezone-aware streak breaks). Only a
  flat `daysPlayed` total is in scope; streaks are a possible future ladder on top of the same
  counter, not required to ship this.
- **Balance/threshold tuning.** Thresholds for new ladders (Legendary Collector, Shard Hoarder,
  Days Played, etc.) are first-pass provisional numbers, same treatment as every other registry
  in this codebase — shape is final, numbers are tuned later.
- **Retroactive crediting.** A player who already has 500,000 Wood gathered before this ships
  gets every threshold below that credited the moment `check_achievements` first runs for them
  (same behavior `check_ascendant_milestones` already has) — not a special backfill migration.

## 4. Design

### 4a. Data model

- New column: `profiles.achievements jsonb not null default '{}'::jsonb` — a claimed-map,
  `Record<string, boolean>`, identical shape to `profiles.ascendant_milestones`.
- New counters, added where needed (see 4e) rather than reusing `lifetime_stats` for things that
  aren't really "lifetime stats" in that column's existing sense:
  - `profiles.ascendant_shards_earned_total integer not null default 0` — cumulative Shards ever
    earned, distinct from `ascendant_shards` (the spendable balance, which decreases on
    purchases). Needed because "Shard Hoarder" must not un-claim itself after a player spends.
  - `profiles.days_played integer not null default 0` and `profiles.last_login_date date` (to
    make the once-per-UTC-day bump idempotent server-side, not just client-throttled).
  - Three new one-off counters, one each for Legendary-equip events, capstones earned, and
    characters that reached the level cap — exact column vs. JSONB-field decision is an
    implementation detail for the plan, not this spec (either works; `lifetime_stats`-style JSONB
    keys keep `ADR-0004`'s "adding one is a one-line change" property, so that's the likely
    choice).

### 4b. `check_achievements` SQL function

Mirrors `check_ascendant_milestones`'s shape and calling convention exactly:

```
check_achievements(lifetime_stats jsonb, unlocked_character_count integer,
                    shards_earned_total integer, days_played integer,
                    one_off_counters jsonb, claimed jsonb)
  returns jsonb  -- { newly_claimed_keys: text[] }
```

Generic over the registry (`ACHIEVEMENT_DEFS`, mirroring `ASCENDANT_MILESTONES`'s shape) — adding
an achievement never means touching this function, same extensibility promise as the Milestone
system (see 4g).

**No `for update` locking on the achievements read/write**, unlike `check_ascendant_milestones`.
CLAUDE.md's row-locking rule exists specifically for award/credit logic that could double-grant a
reward under a race; achievements grant nothing, so two concurrent calls both setting the same
key `true` is a no-op collision, not a bug. This is a deliberate, documented deviation from the
otherwise-identical Milestone pattern — called out explicitly so it doesn't read as a copy-paste
omission during review.

Called from inside every RPC that can move a tracked value: `claim_mission`, `collect_gather`,
`claim_group_stage`, `transcend_player`, `equip_item`, `choose_blessing`, and one new RPC,
`record_login` (4c).

### 4c. `record_login` RPC

The one genuinely new write path. Called once per session from the client (throttled client-side,
but made idempotent server-side via `last_login_date`): if `last_login_date < today (UTC)`,
increments `days_played` and updates `last_login_date`, then runs `check_achievements`. A
no-op (still returns cleanly) if already recorded today — safe to call more than once per day.

### 4d. Registry — `src/lib/achievements.ts`

Mirrors `src/lib/ascendantMilestones.ts`'s shape and its documented relationship: a
**client-preview-only mirror** (`checkAchievements()`), never authoritative — the SQL function in
4b is the only thing that actually claims an achievement, same split `ascendantMilestones.ts`'s
own header comment documents for Milestones (§4b there explains why the split is load-bearing).

```ts
export type AchievementLadder = {
  metricKey: string
  category: 'combat' | 'economy' | 'collection' | 'prestige' | 'dedication'
  label: string
  thresholds: number[]      // one badge tier per threshold, same shape as MilestoneLadder
}
```

One-off achievements are ladders with a single threshold of `1` — no special-cased type needed,
same simplification `ASCENDANT_MILESTONES` already uses for `transcendCount`-style single-purpose
metrics elsewhere in the registry.

### 4e. The achievement list

**Combat** — free, straight off existing `lifetime_stats` counters, reusing
`ASCENDANT_MILESTONES`'s own thresholds for consistency:
- Missions Cleared: 50 / 500 / 5,000
- Dungeons Cleared: 10 / 100 / 1,000
- Raids Cleared: 5 / 50 / 500

**Economy** — free, one ladder per resource (dropped the earlier combined-total idea in favor of
per-resource granularity), reusing `ASCENDANT_MILESTONES`'s per-resource thresholds:
- Gold Earned: 1,000 / 10,000 / 100,000 / 1,000,000 / 10,000,000
- One ladder per resource (Wood, Copper, Stone, Coal, Iron, Silver, Bronze, Gold, Platinum),
  each: 500 / 5,000 / 50,000 / 500,000

**Collection**:
- "Full Roster" — unlock all 19 characters. **Free** — `unlocked_characters` survives Transcend
  (confirmed, 4a), so this is a plain threshold on its live count, no new counter needed. (This
  corrects an earlier assumption during brainstorming that it would need a one-off flag.)
- "Legendary Collector" — equip a Legendary-rarity item. One-off, new counter in `equip_item`.
  Counts equip *events*, not distinct legendary item defs — a deliberate simplification; a
  "distinct legendaries equipped" version would need a set, not a counter, for a badge that
  doesn't need that precision.
- "Blessed" — earn a character's capstone (level 50 + row 4 picked). One-off, new counter in
  `choose_blessing` — the only RPC that can flip this true.

**Prestige**:
- "Echoes of the Past" — first Reset. Free — `reset_count >= 1`, already stored, permanent.
- "Ascendant" — first Transcend. Free — `transcend_count >= 1`, already stored, permanent.
- "Shard Hoarder": 50 / 500 / 5,000 total Shards ever earned. New `ascendant_shards_earned_total`
  counter (4a), bumped alongside the existing `ascendant_shards = ascendant_shards + v_awarded`
  line already present at all four of `check_ascendant_milestones`'s call sites — no new call
  sites needed, since those are exactly the sites that already compute `v_awarded`.

**Dedication**:
- "Days Played": 1 / 7 / 30 / 100. New `record_login` RPC + `days_played` counter (4c).
- "Max Level" — one character reaches `LEVEL_CAP` (50). One-off, new counter set alongside the
  existing `applyXp` roll-up inside `claim_mission`/`claim_group_stage`.

### 4f. UI — `/achievements`

New route + nav entry, kept separate from `/statistics` (that page is the raw-numbers lifetime
stats view, a different TODO item and a different visual language). Badge grid grouped by the
five categories above:
- Earned badges: icon (`IconSlot`, per the no-emoji-icons rule), name, description, earned state.
- Locked threshold badges: same, plus a progress bar (current value / next threshold) — reuses
  the same live data `MilestoneProgressList` already renders this way.
- Locked one-off badges: same, but a plain locked state, no progress bar (nothing partial to
  show for a boolean).

Data: `useProfile()` for `lifetimeStats`/`achievements`/`ascendantShardsEarnedTotal`/
`daysPlayed`, plus `unlockedCharacters.length` for "Full Roster".

### 4g. Extensibility pattern

Same fixed recipe `ascendantMilestones.ts`'s header already documents for Milestones, restated
for Achievements: (1) if the achievement needs a new counter, add it to `profiles` and increment
it at its one trigger site; (2) add the ladder to `ACHIEVEMENT_DEFS`; (3) nothing else —
`check_achievements` is generic over the registry and never special-cases a metric by name.

## 5. Testing

Same standing constraint as the rest of this codebase (`TODO.md`'s own tracked gap): no pgTAP or
Deno Edge-Function test infrastructure exists anywhere in this repo. This feature follows the
same pattern Transcendence did — Vitest coverage for the pure TS registry/preview logic
(`src/lib/achievements.ts`), manual verification (byte-diff deploy checks, live RPC calls) for
the SQL/Edge Function side. Not a gap introduced by this feature; an existing, accepted one.

## 6. Open questions

None blocking. Exact new-counter storage shape (dedicated columns vs. JSONB fields, 4a) is left
for the implementation plan to decide — either satisfies this spec's requirements.
