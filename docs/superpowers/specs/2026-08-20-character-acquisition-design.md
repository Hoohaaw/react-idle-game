# Character acquisition — design spec

Date: 2026-08-20. Companion to the still-open TODO.md item "Character acquisition economy"
(tagged `project-undecided`). Supersedes that line once this ships.

## 1. Problem

`recruit` (the Edge Function) currently has **zero acquisition gate** — any signed-in player can
recruit any authored character for free, once (the `UNIQUE(player_id, character_def_id)`
constraint only stops duplicates). There is also **no recruit UI at all**: `useRecruit()` exists
but is called from nowhere in the app. This spec designs both the acquisition economy and the
first-ever recruit screen.

## 2. Goals

- Characters come from **varied, thematic sources** — not one gold-purchase-only model. A
  gatherer-class character is earned by gathering; other characters are earned by playing the
  systems they represent.
- Unlocking is a **surprise**, not a checklist. The player never sees a locked character's name,
  condition, or progress beforehand — the reveal itself is the moment. (Full blind surprise,
  confirmed over "silhouette + count.")
- Once unlocked, a character is **never time-limited or lost** — it sits in a persistent "available
  to hire" pool the player can visit anytime and buy when they have the gold. Deciding not to buy
  right now costs nothing.
- A dedicated menu screen (new — doesn't exist yet) is where the player spends gold on
  already-unlocked characters.

## 3. Non-goals (this spec)

- **Elemental mastery** and **comeback-moment** unlock sources — deferred to a follow-up ("wave 2"),
  because both need new signal capture inside `combat.ts`'s sim (which damage school landed a
  killing blow; lowest party HP reached mid-fight). That's core combat-sim surgery, which this
  repo's CLAUDE.md gates behind its own process (one change per branch, before/after balance-sweep
  evidence, a discriminating regression test, an ADR, a player-guide update) — a different, heavier
  kind of change than the rest of this spec.
- Deciding the empty Legendary tier's launch character — orthogonal question, not blocked by this.
- Migrating existing owned characters retroactively — this only gates *future* recruits; anyone who
  already owns a character (there is no acquisition gate today, so early players/testers may own
  everything) keeps them.

## 4. Condition types (wave 1)

| Type | Checked against | New tracking needed? |
|---|---|---|
| `gold` | flat gold cost, no precondition | none — every character always has this as a baseline price |
| `characterLevel` | any owned character reaches level N | none — `player_characters.level` already live |
| `statThreshold` | any owned character's computed stat reaches N | none — `effectiveStats()` already compute-on-read |
| `resourceTotal` | lifetime amount of a resource ever gathered ≥ N | **yes** — new lifetime ledger (§5) |
| `goldTotal` | lifetime gold ever earned ≥ N | **yes** — new lifetime ledger (§5) |
| `missionTimeTotal` | lifetime seconds spent on completed missions ≥ N | **yes** — new lifetime ledger (§5) |
| `mapCompletion` | a map's `highestStageCleared` ≥ N (N=7 for "boss killed", N=7 for "map cleared" — same field) | **no** — `profiles.map_progress` already tracks this (ADR-0034), updated by the existing `claim_mission` RPC on every win |
| `lootDrop` | a rare roll on a mission's loot table names this character | **partial** — reuses the existing `lootDrop`/`rarityWeights` wiring already built for items; needs a new loot-line shape that names a character instead of an item (§6) |

Every character always carries a `goldCost` (rarity-scaled default) regardless of type — a
non-`gold` condition gates *eligibility*, it does not replace the price (confirmed: "still costs
gold after unlocking").

## 5. Data model

### 5a. `characterDef.acquisition` (Sanity)

New field on `characterDef`, mirroring the existing `itemStat`/`statValue` object-array authoring
style:

```
acquisition: {
  goldCost: number              // always required, rarity-scaled default
  condition?: {                 // absent = gold-only, no precondition
    type: 'characterLevel' | 'statThreshold' | 'resourceTotal' | 'goldTotal' | 'missionTimeTotal' | 'mapCompletion'
    // type-specific params, validated by type like conditionTrigger.ts does today:
    level?: number              // characterLevel
    stat?: string                // statThreshold — key from STAT_DEFS
    threshold?: number           // statThreshold / resourceTotal / goldTotal / missionTimeTotal
    resource?: string            // resourceTotal — key from RESOURCE_SOURCE
    map?: string                 // mapCompletion — mapKey
    stage?: number                // mapCompletion — stage to require cleared (7 = boss/full map; general so a future author could gate on an earlier stage)
  }
}
```

`lootDrop` is NOT authored on the character — it's authored on the *mission's* loot table (§6),
symmetric with how items work (an item doesn't know which missions drop it either).

### 5b. `profiles.lifetime_stats` (new migration)

```sql
alter table public.profiles
  add column lifetime_stats jsonb not null default '{}'::jsonb;
```

Registry-JSONB (ADR-0004 pattern, mirrors `currencies`/`resources`/`map_progress`): increments-only,
never decremented by spending. New `src/lib/lifetimeStats.ts` registry file (same shape as
`currencies.ts`) defining the tracked keys: `goldEarned`, `missionSecondsSent`, and
`resourceGathered.<resourceKey>` (one key per resource, dynamic — no migration needed to add a
resource later, same as `resources` already works).

Incremented inside the existing RPCs that already grant these rewards, in the same transaction:
- `claim_mission` — `goldEarned` += gold reward, `missionSecondsSent` += mission duration (both
  already computed by the calling Edge Function, just also folded into `lifetime_stats`).
- `gather-collect`'s RPC — `resourceGathered.<key>` += yield collected.

### 5c. `profiles.unlocked_characters` (new migration, same JSONB pattern)

```sql
alter table public.profiles
  add column unlocked_characters jsonb not null default '{}'::jsonb;
```

`{ "<charKey>": "<ISO timestamp unlocked>" }`. This is the canonical "is this character available
to hire yet" record — checked by the Recruits screen and by `recruit_character`. A missing key
means still locked (and, per the blind-surprise rule, the client never queries *which* characters
are missing — only the player's own `unlocked_characters` map, which is by definition only the
ones already revealed).

## 6. Condition evaluation — when and where

Passive conditions (`characterLevel`, `statThreshold`, `resourceTotal`, `goldTotal`,
`missionTimeTotal`, `mapCompletion`) are evaluated **after** the mutation that could satisfy them,
inside the same Edge Function call, not on a schedule or on page load:

- After `claim_mission` returns (level/xp/current_hp updated, lifetime_stats and map_progress
  advanced), `mission-claim` fetches every `characterDef` with a `condition` whose type could have
  just changed (`characterLevel`/`statThreshold` against the party that just leveled;
  `goldTotal`/`missionTimeTotal`/`mapCompletion` against the player's updated totals), skips any
  already in `unlocked_characters`, and for each newly-satisfied one, writes it into
  `unlocked_characters` and includes it in the claim response (`{ ..., newlyUnlocked: CharacterDef[] }`)
  so the client can fire the surprise-reveal moment immediately, in context (right after the mission
  that triggered it).
- After `gather-collect`'s equivalent, same pattern for `resourceTotal`.
- `lootDrop` is rolled inside `mission-claim` alongside item loot: a new `characterLootDrop[]` array
  on `missionDef` (parallel to `loot[]`, `{ character: reference, dropChance, rarityWeights? }` —
  rarityWeights likely unused since a character isn't rarity-rolled, so probably just
  `{ character: reference, dropChance }`), rolled once per claim, and a hit writes directly into
  `unlocked_characters` the same way a condition-met does, surfaced in the same `newlyUnlocked`
  response field.

This means **all discovery is a byproduct of `mission-claim`/`gather-collect`, never a background
job or a client-side poll** — consistent with the server-authoritative rule (ADR-0003) and cheap
(the check only runs against characters not yet unlocked, which shrinks over time per player).

## 7. Recruit flow

New atomic RPC `recruit_character`, shaped like `start_mission`/`claim_mission`:

1. Edge Function receives `characterDefId`, fetches the character's `acquisition.goldCost` from
   Sanity.
2. Calls `recruit_character(p_player, p_character_def_id, p_gold_cost)`, which in one transaction:
   - Re-validates `unlocked_characters` contains this `charKey` (or the character has no
     `condition` at all, i.e. gold-only) — server-side, not trusting the client.
   - Re-validates `currencies.gold >= p_gold_cost`.
   - Deducts gold, inserts the `player_characters` row (relying on the existing
     `UNIQUE(player_id, character_def_id)` for the no-dupes guarantee).
   - Returns the new row.
3. Same `409`-style error shape as today for "already recruited"; new `403`s for "not unlocked yet"
   and "insufficient gold."

## 8. UI

**New `/recruits` route** (doesn't exist today — first-ever recruit screen):
- Lists everything in `unlocked_characters`, each as a card: name, role, rarity, gold cost, a Hire
  button (disabled + tooltipped if the player can't afford it — never hidden, since "acquire later"
  must always be possible).
- **Nothing about locked characters is shown** — no count, no silhouette, no hint. An empty list
  (nothing unlocked yet) just says something like "Keep playing — recruits show up as you go."
- Surprise-reveal moment: when a mission-claim or gather-collect response includes
  `newlyUnlocked`, the claim/collect UI shows a distinct "New recruit available!" toast/banner
  per character (name + role, not the full unlock condition — the condition itself stays
  unexplained, it already served its purpose), linking to `/recruits`.

## 9. Wave-1 content (proposed pairing, adjustable during authoring — not a spec blocker)

| Character | Role | Condition |
|---|---|---|
| Nira Barkholm | Gatherer (Forester) | `resourceTotal` wood |
| Rowan Thicket | Gatherer (Forester) | `resourceTotal` wood, higher threshold |
| Gort Deepvein | Gatherer (Miner) | `resourceTotal` copper (or stone) |
| Brom Ironwall | Tank | `missionTimeTotal` |
| Vex Nightcut | Damage | `statThreshold` (e.g. attack) |
| Aldric Faithward | Healer | `characterLevel` |
| Lyra Brightnote | Utility | `goldTotal` |
| 1–2 more characters (picked at authoring time) | any | `mapCompletion` and `lootDrop` — at least one character apiece, so both new source types are demonstrated in wave 1 |

All other characters: `gold`-only at the rarity-scaled default price, no condition.

## 10. Error handling / edge cases

- **Race**: two `mission-claim` calls landing near-simultaneously for the same player can't both
  unlock+respond for the same character twice — the `unlocked_characters` write is
  `jsonb_set`-idempotent (same pattern as `map_progress`'s `greatest()`), and the Edge Function
  only includes a character in `newlyUnlocked` if this specific call's write actually changed the
  key from absent to present (checked via the RPC's return value, not re-queried after).
- **Already-unlocked-but-never-bought** characters must never re-fire the surprise toast — the
  `unlocked_characters` presence check already handles this (only genuinely-new keys go in
  `newlyUnlocked`).
- **Condition met by a different mechanism than expected** (e.g. a player who already owns high
  level characters before this ships) — first mission-claim after deploy naturally catches up and
  unlocks everything already earned; not a special case.
- **Insufficient gold after unlock**: not an error — the character stays in `unlocked_characters`
  indefinitely, Hire button just stays disabled. This is the explicitly-designed "acquire later"
  path, not a failure state.

## 11. Testing

- `src/lib/lifetimeStats.ts` — unit tests for the registry shape (mirrors `currencies.test.ts` if
  one exists, else a new one following `characterBudget.test.ts`'s style).
- Condition-evaluation logic (wherever it lives — likely a new `src/lib/acquisition.ts` pure
  function `evaluateConditions(character, playerState) => boolean`, called from both
  `mission-claim` and `gather-collect`, and unit-testable without a live database) gets a real test
  file, one case per condition type plus the "already unlocked, don't re-fire" case.
- `recruit_character` RPC — integration-style test via the existing Edge Function test patterns
  (`services/*.test.ts`) covering: locked+enough gold (rejected), unlocked+insufficient gold
  (rejected), unlocked+enough gold (succeeds, gold deducted), already-owned (409).

## 12. Follow-ups (not this spec)

- **Wave 2**: `elementalMastery`, `comebackMoment` — needs combat-sim signal capture, its own ADR
  and balance-sweep evidence per the combat-change playbook.
- **Transcendence** — separate design (full reset, token currency, prestige shop), brainstormed
  next, tagged `project-undecided` alongside this item.
- **Legendary launch character** — still an open question, not resolved by this spec.
