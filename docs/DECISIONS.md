# Decisions — The Idle Game

A running log of the **notable decisions** made while building this game, so we can come back
and see *what* we chose and *why* (including the options we rejected). This is the human-facing,
version-controlled record — distinct from in-code comments (the "how") and `TODO.md` (the "what's left").

**Format:** lightweight [ADR](https://adr.github.io/) entries. Each is numbered, dated, and has a
*status*. New decisions are appended at the bottom with the next number. When a later decision
overrides an earlier one, the old entry is marked **Superseded by ADR-NNNN** rather than deleted —
the history is the point.

**Status values:** `Accepted` · `Superseded` · `Proposed` (leaning a way but not locked) ·
`Open` (deliberately undecided — see also `TODO.md` and the design notes).

> This is a **work in progress**. Decisions here are the current best call for an evolving game,
> not permanent law. Revisiting one is fine — record the change as a new entry.

---

## Index
| # | Decision | Date | Status |
|---|---|---|---|
| [0001](#adr-0001--definitioninstance-split-sanity-for-content-supabase-for-runtime) | Definition/instance split: Sanity for content, Supabase for runtime | 2026-06-12 | Accepted |
| [0002](#adr-0002--compute-on-read-character-stats) | Compute-on-read character stats (anti-tamper) | 2026-06-12 | Accepted |
| [0003](#adr-0003--server-authoritative-writes-clients-never-mutate-game-state) | Server-authoritative writes; clients never mutate game state | 2026-06-12 | Accepted |
| [0004](#adr-0004--extensible-currencies--resources-via-registry-driven-jsonb) | Extensible currencies & resources via registry-driven JSONB | 2026-06-13 | Accepted |
| [0005](#adr-0005--profile-creation-db-trigger-safety-net--edge-function-for-onboarding) | Profile creation: DB trigger safety-net + Edge Function for onboarding | 2026-06-13 | Accepted |
| [0006](#adr-0006--character-growth-flat-per-level--additive-milestones) | Character growth: flat per-level + additive milestones (per character) | 2026-06-13 | Accepted |
| [0007](#adr-0007--decouple-reward-eligibility-from-stat-category) | Decouple reward-eligibility from stat category (expanded stat registry) | 2026-06-13 | Accepted |
| [0008](#adr-0008--character-role-authored-per-character-class-provides-the-default) | Character role authored per character (class provides the default) | 2026-06-14 | Accepted |
| [0009](#adr-0009--stat-vocabulary-expansion--wow-style-routing) | Stat vocabulary expansion + WoW-style routing | 2026-06-14 | Accepted |
| [0010](#adr-0010--feature-based-modules-alongside-atomic-design--branch-per-task-workflow) | Feature-based modules alongside atomic design + branch-per-task workflow | 2026-06-15 | Accepted |
| [0011](#adr-0011--leveling-gentlesteep-xp-curve-pure-helper-no-client-facing-endpoint) | Leveling: gentle→steep XP curve, pure helper, no client-facing endpoint | 2026-06-30 | Accepted |
| [0012](#adr-0012--combat-resolution--reward-model-auto-battle-sim-at-claim-win-gates-margin-scales) | Combat resolution & reward model: auto-battle sim at claim, win-gates/margin-scales | 2026-06-30 | Accepted |
| [0013](#adr-0013--combat-sim-v1--seeded-action-timeline-auto-battle-passive-stats-only) | Combat sim v1: seeded action-timeline auto-battle, passive stats only | 2026-07-04 | Accepted |
| [0014](#adr-0014--capped-level-power-bonus-unkillable-comps-intended-utility-built-now) | Capped level power bonus, unkillable comps intended, Utility built now | 2026-07-04 | Accepted |
| [0015](#adr-0015--combat-math-v1--formulas--first-pass-constants) | Combat math v1: formulas + first-pass constants | 2026-07-05 | Accepted |
| [0016](#adr-0016--mission-claim-wiring-shared-pure-engine--atomic-claim_mission-rpc) | Mission-claim wiring: shared pure engine + atomic claim_mission RPC | 2026-07-05 | Accepted |
| [0017](#adr-0017--mission-claim-v1-gear-in-the-sim-survivor-xp-item-rarity-scaling-mission-start) | Mission-claim v1: gear in the sim, survivor XP, item rarity scaling, mission-start | 2026-07-05 | Accepted |

---

## ADR-0001 — Definition/instance split: Sanity for content, Supabase for runtime
**Date:** 2026-06-12 · **Status:** Accepted

**Context.** The game has a large amount of hand-authored content (characters, a bespoke blessing
tree per character, missions, items, loot tables, recipes) that is identical for every player, plus
per-player progress that changes constantly. Mixing the two in one database makes authoring,
rebalancing, and anti-cheat all harder.

**Decision.** Split by nature of the data:
- **Definitions** (authored, read-only to players) live in **Sanity** (headless CMS), queried with GROQ.
- **Instances** (per-player runtime state) live in **Supabase / Postgres**.
- **Game logic** lives in **Supabase Edge Functions**, which fetch the relevant definitions from Sanity
  (cached) to validate every write.
- The two are linked by a stable string key (`charKey`), never Sanity's internal `_id`.

**Alternatives considered.**
- *Everything in Postgres* (the old prototype's model) — rejected: authoring bespoke content in SQL
  rows is painful and couples content edits to player-data migrations.
- *Everything in Sanity* — rejected: Sanity isn't built for high-write per-player runtime state or
  transactional integrity.

**Consequences.**
- Adding/rebalancing content touches only Sanity; player progress is never affected.
- Adds Sanity as a stack dependency (also a deliberate learning exercise).
- Validation reads defs from Sanity at runtime (cached). Escalation path if that gets heavy: mirror
  defs into a thin Postgres table via a publish webhook. Deferred until needed.

---

## ADR-0002 — Compute-on-read character stats
**Date:** 2026-06-12 · **Status:** Accepted

**Context.** A player's effective stats are derived from level + growth tables + blessings + gear.
Any stored, mutable stat value is a target for tampering.

**Decision.** Store only **intent** on the player row — `level`, `xp`, the blessing allocation map,
and equipped-item refs. Never store computed stat values. Baselines and effective stats are
**computed on read** (server-side) from `level` + the immutable Sanity definition:
`baseline(stat, L) = base + perLevel×(L−1) + Σ(milestones for level ≤ L)`.

**Alternatives considered.**
- *Store baseline stats on the row, update on level-up* — rejected: larger tamper surface and a
  denormalized value that can drift from the definition.

**Consequences.**
- The smallest possible trusted mutable surface; a tampered row can at most desync level/xp, which
  is cap-checked and recomputable. There is no stored stat to inflate.
- Recompute cost is trivial (a fold over ≤50 levels + a few dozen nodes/items) and defs are cached.

---

## ADR-0003 — Server-authoritative writes; clients never mutate game state
**Date:** 2026-06-12 · **Status:** Accepted

**Context.** This is a progression game where currencies, levels, and loot have value. If a browser
can write its own balances or levels, the economy is meaningless.

**Decision.** Every gameplay table has **Row Level Security** allowing an authenticated player to
**read their own rows only**, with **no client INSERT/UPDATE/DELETE policy**. All mutations go through
**Edge Functions** using the service role (which bypasses RLS) after validating against the Sanity
definition. Postgres GRANTs are set per table (`authenticated`→SELECT, `service_role`→full DML,
`anon`→nothing) — note the new Supabase default does *not* auto-expose tables, so GRANTs are required
in addition to RLS.

**Consequences.**
- Clients can never write game state directly — the anti-cheat enforcement point is the Edge Function.
- Every new gameplay table must follow this pattern (RLS owner-read + explicit GRANTs + no client write).
- The service-role key is used **only inside Edge Functions**, never shipped to the client bundle.

---

## ADR-0004 — Extensible currencies & resources via registry-driven JSONB
**Date:** 2026-06-13 · **Status:** Accepted

**Context.** The game starts with coins and ~9 gathered resources, but this is a work in progress —
more currencies (e.g. a premium gem, event tokens) and resources are expected. We don't want a schema
migration every time the economy grows.

**Decision.** The player's `profiles` row holds two **JSONB maps** — `currencies` and `resources` —
keyed by a **code-side registry** (`src/lib/currencies.ts`, `src/lib/resources.ts`). An absent key
means a zero balance. Adding a currency or resource is a **one-line code change with no migration**.
Currencies and resources are kept as **two separate maps** (distinct concepts, distinct UI, and "Gold"
the ore would otherwise collide with coins). This mirrors the existing stat registry (ADR-0002 territory).

**Alternatives considered.**
- *Fixed columns per currency/resource* (`coins int`, `wood int`, …) — rejected: every new economy
  item needs a migration; locks us in.
- *One unified `balances` map* — rejected: currencies and resources are conceptually different and the
  `Gold` (ore) vs `coins` distinction is cleaner with separate namespaces.

**Consequences.**
- The database is agnostic to *which* currencies/resources exist; the code registry is the source of truth.
- Reads must treat a missing key as 0.
- Balance changes still go through Edge Functions (per ADR-0003).

---

## ADR-0005 — Profile creation: DB trigger safety-net + Edge Function for onboarding
**Date:** 2026-06-13 · **Status:** Accepted

**Context.** Every authenticated user needs exactly one `profiles` row (their wallet). The question is
*who creates it*: a database trigger on signup, or explicit application/Edge-Function code. Onboarding
will eventually need real logic (grant a starting currency, assign the chosen 1-of-3 starter character).

**Decision.** Use **both, with clear roles**:
- A **`SECURITY DEFINER` trigger** (`on_auth_user_created` on `auth.users`) creates a **bare** profile
  (empty wallet) the instant a user signs up. Its only job is the invariant "every user has a profile" —
  it is kept trivially simple so it can never fail and block signups.
- A future **onboarding Edge Function** does the **rich** new-player flow by *updating* the
  already-existing row (starter character, starting coins, "onboarded" flag).

**Alternatives considered.**
- *Trigger only, with rich logic inside it* — rejected: complex logic in a signup trigger is hard to
  test, can't easily call external services, and if it throws it blocks signups entirely.
- *Edge Function only (no trigger)* — rejected for the base row: leaves a window where a user exists
  with no profile (orphan risk), and every signup path (OAuth, admin-created, seed users) would have to
  remember to call it. Good for onboarding, not for the guaranteed base row.

**Consequences.**
- No "user without a profile" orphan state, ever — for free, including seed/test users.
- The trigger must stay minimal; all gameplay/onboarding richness lives in the Edge Function.
- The trigger couples to the Supabase-managed `auth.users` schema (an accepted, supported hook).

---

## ADR-0006 — Character growth: flat per-level + additive milestones
**Date:** 2026-06-13 · **Status:** Accepted

**Context.** Per-character progression is a headline pillar — different characters should gain different
amounts per level and have their own spikes (the original example: a Death Knight gains +3 strength per
level plus a one-off +8 at level 10, while a mage barely gains strength but stacks intelligence). There is
**no shared class growth template.** We need a model expressive enough for that, light to author across a
whole roster, that feeds the compute-on-read baseline ([ADR-0002](#adr-0002--compute-on-read-character-stats)).

**Decision.** Growth is authored **per character, per stat** in the Sanity `characterDef` as
`{ perLevel, milestones: [{ level, bonus }] }`:

```
baseline(stat, L) = base + perLevel × (L − 1) + Σ(milestone.bonus where milestone.level ≤ L)
```

Milestones are **additive** — a milestone at level 10 adds to that level's normal gain (level 10 →
`perLevel + bonus`), it does not replace it. Across characters, base / perLevel / milestones are all
independent.

**Alternatives considered.**
- *Shared class-based growth template* — rejected: per-character bespoke growth is a core pillar.
- *Replace-style milestones* (the milestone _sets_ the level's gain) — rejected in favour of additive
  (cleaner; the milestone reads as a bonus on top of the normal gain).
- *An explicit per-level table* (a hand-picked value for every level, per stat) — rejected for now:
  maximally expressive but verbose to author and store across a roster.

**Consequences.**
- Per-character uniqueness from just a couple of numbers per stat plus the occasional spike.
- A **single** character's curve is a flat `perLevel` slope with additive bumps at milestone levels — it
  is **not** a freely hand-drawn value at every level. To deviate at one level, add a milestone there; to
  hand-author *every* level, switch that stat to an explicit table (the deferred escalation path above).
- Implemented in `src/lib/stats.ts` (`baselineForStat` / `computeBaselines`), unit-tested.

---

## ADR-0007 — Decouple reward-eligibility from stat category
**Date:** 2026-06-13 · **Status:** Accepted

**Context.** The stat registry started lean (10 stats). Expanding it for combat depth (crit, dodge,
penetration, regen, a healer's healing power, luck, …) exposed a coupling: the reward multiplier counted
*every* `offensive`/`defensive` stat at 0.1%/point, excluding only `misc`. Under that rule, adding
combat-depth stats would silently inflate loot — and a crit stat would "double-dip" (boost both damage
and rewards).

**Decision.** Split the two concerns on each `StatDef`:
- `category` (`offensive` / `defensive` / `support` / `misc`) = grouping + intent, for UI.
- `reward: boolean` = whether the stat feeds the 0.1%/point reward multiplier.

`statRewardBonus` now sums only `reward:true` stats. The curated reward set is the original seven core
power stats (attack / strength / agility / speed / intelligence / health / defense); all newly added
depth and economy stats are `reward:false`. Flipping a stat's reward-eligibility is a one-field change.

The registry expanded 10 → 20 stats and gained a `support` category (home for `healingPower`, the
previously missing healer stat). Per-stat *combat effects* remain deferred to the combat model — only
the stat vocabulary + reward eligibility are defined now.

**Alternatives considered.**
- *Keep category driving rewards; file depth stats under `misc`* — rejected: `misc` means "non-combat
  economy/time"; putting crit/dodge there is semantically wrong and pollutes UI grouping.
- *Let all offensive/defensive stats count* — rejected: inflates the economy with every new stat and
  causes double-dipping.

**Consequences.**
- Adding combat depth is balance-neutral for the economy by default; reward-eligibility is an explicit,
  per-stat decision.
- `category` is now purely semantic/UI — nothing should infer reward behavior from it.
- The broader reward-vs-real-time-combat reconciliation stays **Open** (see `TODO.md` / design notes);
  this ADR only decouples eligibility, it does not decide combat's role in rewards.
- Implemented in `src/lib/statDefinitions.ts` (`+reward` flag) and `src/lib/stats.ts` (filter on the
  flag); unit-tested (a `reward:false` offensive stat contributes 0 to the reward bonus).

---

## ADR-0008 — Character role authored per character (class provides the default)
**Date:** 2026-06-14 · **Status:** Accepted

**Context.** Role (tank / damage / healer / utility / gatherer) was derived *purely* from class
(`roleForClass` over the `CLASS_ROLE` map). But we want a single class to be able to fill different
roles — e.g. a Mage that **heals** vs a Mage that **deals damage** — which is also what makes the
healer-specific stats (Healing Power, Healing Crit) meaningful. With a fixed, hand-authored, no-dupes
roster, the natural way to express that is as **distinct recruits**, not a runtime spec toggle.

**Decision.** Role is **authored per character** on the Sanity `characterDef` via an **optional `role`
field**:
- **Blank → the class default** (`CLASS_ROLE` / `roleForClass`).
- **Set → an explicit override** (e.g. a Mage authored as Healer).

`resolveRole(charClass, authoredRole?)` applies the precedence (`authoredRole ?? roleForClass(...)`).
This makes per-role stat routing concrete: a character authored as a Healer routes Intelligence →
Healing Power, one authored as Damage routes it → Spell Power (the routing itself lands with the
combat model — [ADR-0009](#adr-0009--stat-vocabulary-expansion--wow-style-routing)).

**Alternatives considered.**
- *Keep role fixed-by-class* — rejected: blocks the Mage-healer vs Mage-DPS distinction entirely.
- *Player-chosen, switchable spec (WoW dual-spec)* — deferred: needs per-player role storage, a
  spec-select UI, a respec mechanism, and forces a "one blessing tree or one-per-spec" decision; it
  also leans on the (still-Open) combat model. Authoring role per character delivers the variety now
  and fits the fixed-roster design, with the switchable-spec version available as a later escalation.

**Consequences.**
- `characterDef` gains an optional `role` dropdown (the 5 roles); the studio dropdown is generated
  from `ROLE_STYLES`. A character with no `role` is unchanged (resolves to the class default).
- `resolveRole` is additive; existing `roleForClass` UI callers keep working until the Sanity client
  is wired, at which point they pass the authored role through `resolveRole`.
- Supersedes the earlier *informal* "role is fixed by class" approach (which was never its own ADR).

---

## ADR-0009 — Stat vocabulary expansion + WoW-style routing
**Date:** 2026-06-14 · **Status:** Accepted

**Context.** We surveyed how MMORPGs/ARPGs/idle games turn stats into mechanics (WoW role-routed
primaries + secondary stats; PoE attribute-gating; Diablo Magic Find; Melvor's combat skills). We chose
**WoW's model** (simplest, matches intent) and found the lean registry needed a few more stats to
express casters, healers, and item-finding. Builds on [ADR-0007](#adr-0007--decouple-reward-eligibility-from-stat-category).

**Decision.**
- **Routing (intent).** Primaries are the "main stat"; what they *do* is **routed by role**:
  Strength/Agility → **Attack** (physical), Intelligence → **Spell Power** (damage) **or** **Healing
  Power** (healer), Health = the HP pool.
- **Defensive model = mitigate, not avoid.** Defense/Resistance *reduce* physical/magic damage; **Dodge**
  fully avoids a hit; **Block** partly blunts one. (Rejected Melvor's "Defense = evasion".)
- **Registry change: 20 → 23 stats.** Added **Spell Power**, **Haste**, **Healing Crit**, **Magic
  Find**; **removed Accuracy / Hit Rating** (modern WoW dropped hit/expertise — Dodge needs no
  counter-stat); **redefined Luck**.
- **Item-finding split.** **Magic Find = the RATE** of finding items; **Luck = the AMOUNT** found.
  (Deliberately diverges from Diablo, where Magic Find governs *quality* — rate/amount is more intuitive
  for an idle loop.)
- **Reward eligibility** (per ADR-0007's decouple). **Spell Power** and **Haste** are `reward:true`
  (parity with Attack; and Speed already counts, so both tempo stats count by explicit call). All other
  additions are `reward:false`. **9 reward-eligible stats** total.
- **No diminishing returns for now** — %-stats scale linearly. Flagged to revisit as numbers grow.

**Alternatives considered.**
- *PoE attribute-gating* (attributes unlock gear/skills) — rejected: more complex than wanted.
- *Defense-as-avoidance* (Melvor) — rejected in favour of mitigate + a separate Dodge.
- *Diminishing returns now* — deferred (idle numbers grow forever, so this WILL return).
- *A separate Healing Crit Damage* — deferred; one Healing Crit (chance) stat for now.

**Consequences.**
- Per-stat **combat effects/formulas remain deferred** to the combat model — only the stat vocabulary,
  reward eligibility, and routing *intent* are fixed here.
- The Sanity stat dropdowns (statValue/statGrowth/nodeEffect) auto-update from `STAT_DEFS`; `REWARD_STAT_KEYS`
  auto-derives — no schema migration. Removing Accuracy is safe (no content referenced it).
- Implemented in `src/lib/statDefinitions.ts`; unit-tested (spellPower/haste count, healingCrit/magicFind
  do not).

---

## ADR-0010 — Feature-based modules alongside atomic design + branch-per-task workflow
**Date:** 2026-06-15 · **Status:** Accepted

**Context.** The project is growing (a dozen routed pages, dozens of components) and headed for a
large amount of code. Atomic design alone groups by *technical kind* (atom/molecule/organism), which
scatters a single game domain — Missions has a page, organisms, and molecules in three different
folders — making a domain hard to find, change, and reason about. We also want a safer contribution
flow now that more structure is needed.

**Decision.** Two complementary changes.

1. **Feature modules alongside atomic design.** Keep `src/components/` (atoms→molecules→organisms→
   templates) as the **shared, domain-agnostic UI kit**, and add **`src/features/<feature>/`** for
   everything owned by a single game domain (its page, feature-specific components/hooks/data/types,
   later its store slice + data access). The boundary rule: **used by one feature → lives inside it;
   needed by a second → promote to the shared layer.** Each feature exposes a **public barrel
   (`index.ts`)** and outsiders import only that — never a feature's internals, and features don't
   depend on each other's internals (dependencies stay one-directional, shared via `@/lib`/`@/types`/
   a store). A **`@/` path alias** (`@`→`src`) keeps cross-module imports clean.

2. **Branch-per-task git workflow.** One short-lived branch per task
   (`feature/` · `fix/` · `refactor/` · `chore/` · `docs/`) off `master`, one logical change each,
   merged back via PR with CI (lint) green; no direct pushes to `master`. A **Lint GitHub Action**
   runs ESLint on every push/PR.

**Migration is incremental, not big-bang.** **Missions** is migrated as the reference exemplar; the
remaining domains migrate one-per-branch as each is next touched. Unmigrated pages stay in
`src/pages/`. The conventions live in [`CLAUDE.md`](../CLAUDE.md) and
[`src/features/README.md`](../src/features/README.md).

**Alternatives considered.**
- *Pure atomic design (status quo)* — rejected: domain logic scatters across kind-folders as the app grows.
- *Replace atomic design entirely with features* — rejected: genuinely shared UI (Button, Modal, badges)
  still wants a kind-organized kit; the two layers are complementary.
- *Big-bang migrate every page at once* — rejected: touches nearly every import in one diff, high risk,
  hard to review. Incremental per-feature migration fits the new one-branch-one-task workflow and keeps
  each change safe and reviewable.

**Consequences.**
- New domain code goes in `src/features/<feature>/`; promote shared pieces up rather than importing
  across features. The `@/` alias is the preferred import style going forward (relative paths still work).
- A transitional period where some domains live in `features/` and others in `pages/` — expected and fine.
- Slightly more ceremony per change (a branch + PR), bought back in reviewability, CI safety, and a
  clean history.

---

## ADR-0011 — Leveling: gentle→steep XP curve, pure helper, no client-facing endpoint
**Date:** 2026-06-30 · **Status:** Accepted

**Context.** Characters level from XP earned by completing successful missions (cap 50). We needed a
concrete XP curve and a place for the leveling logic. The old prototype (TECHNICAL.md, now LEGACY)
used a linear `maxExperience = level × 200` and mutated stored stats on each level-up
(`attack += 3; maxHealth += 25`). Two things make that unsuitable here: (1) the design calls for a
**gentle-early / steep-late** curve so L50 is a long-term goal, not linear difficulty; (2) under
compute-on-read (ADR-0002) stats are **derived** from `level` + the def's growth curve, so storing
stat deltas on level-up is wrong — bumping `level` is all that's needed.

**Decision.**
1. **XP curve:** `xpToNext(L) = round(50 × L^1.5)` — XP to advance from L to L+1 (1→2 = 50, 10→11 ≈
   1581, 25→26 = 6250, 49→50 ≈ 17150). At the cap `xpToNext` returns `Infinity` (UI shows "MAX");
   XP earned at the cap is discarded.
2. **Pure helper, not an Edge Function:** the logic lives in `src/lib/leveling.ts` (`LEVEL_CAP`,
   `xpToNext`, `applyXp`). `applyXp(level, xp, gained)` adds XP and rolls over as many levels as it
   covers, capping at 50. It writes nothing and touches no stats.
3. **No client-facing level-up endpoint.** XP must originate server-side from a verified source. The
   mission-claim Edge Function (the server-authoritative XP source, ADR-0003) will call `applyXp` and
   persist the new `level`/`xp`. A client-callable function that accepted an XP amount would let the
   client mint levels — rejected.

**Alternatives considered.**
- *Linear `level × 200` (old prototype)* — rejected: flat difficulty, contradicts the gentle→steep goal.
- *Standalone client-facing `level-up` Edge Function* — rejected: no legitimate client XP source; it
  would be an exploit surface. Leveling is a side-effect of mission completion, computed server-side.
- *Store stat values on level-up* — rejected: violates compute-on-read (ADR-0002); stats derive from level.

**Consequences.**
- Mission claim (when built, pending the reward-model-vs-combat decision) imports `applyXp`; no rework.
- Level-up is pure bookkeeping — fully unit-testable with no DB, and stat growth stays authored in the
  Sanity def. Curve tuning is a one-line change in `leveling.ts`.

---

## ADR-0012 — Combat resolution & reward model: auto-battle sim at claim, win-gates/margin-scales
**Date:** 2026-06-30 · **Status:** Accepted

**Context.** Two earlier directions were on a collision course. ADR-era design set a **reward pipeline**
that assumed missions always succeed — `final = base × (1 + statBonus) × (1 + partySizeBonus) ×
(1 + transcendenceBonus)`, where `statBonus` = every reward-eligible stat point × 0.1%. Separately, the
combat design (project memory: combat) declared missions are **real-time fights that can fail**, where
**all stats matter**, **roles do distinct jobs** (tank soaks, healer sustains), and **damage persists
between missions** (recovered via infirmary or an in-combat healer). These can't both stand as-is:
- A reward bonus that just counts stat points double-dips once stats *also* decide the win.
- "Damage persists" and "the healer kept the tank alive" are only expressible if combat produces a
  **per-character ending HP** — a flat "power ≥ difficulty → win" check cannot.

This was the foundational open question blocking the mission-claim Edge Function.

**Decision.**
1. **Combat resolves as a deterministic auto-battle simulation, run server-side in the mission-claim
   Edge Function** (the existing `started_at → ends_at → claim` timer is the wait; the claim runs the
   fight). The sim is a fast tick-based HP/damage exchange computed from each character's *effective*
   stats (ADR-0002 compute-on-read) vs. the mission's authored encounter. It is **deterministic** given
   its inputs, so it is authoritative on the server and the client may *replay* it as the visualized
   "real-time fight" without being trusted for the outcome.
2. **The sim outputs: win/lose + each character's ending HP** (and a margin/clear metric). Ending HP is
   persisted, realizing **persistent damage**; roles, healing, mitigation, dodge, crit and every other
   stat get a place to act in the tick math.
3. **Rewards are gated on a win.** A loss grants nothing (and leaves the party damaged). On a win the
   pipeline becomes:
   `final = base × (1 + marginBonus) × (1 + partySizeBonus) × (1 + transcendenceBonus)`.
4. **The flat 0.1%/pt `statBonus` is replaced by `marginBonus`** — a bonus that scales with *how
   decisively* you won (e.g. surplus power / clear speed / surviving HP), derived from the combat result
   rather than from re-summing stat points. So "more stats = more reward" survives, but only as a payoff
   for over-powering a fight, not a flat tax that double-dips with winning it.
5. **`partySizeBonus` `(partySize−1)×10%` and `transcendenceBonus` are unchanged** — they are scarcity
   and prestige levers, orthogonal to combat power.

**Alternatives considered.**
- *Power-vs-difficulty threshold* (sum party power, compare to a difficulty number) — rejected as the
  resolution model: simple, but produces no ending HP, so persistent damage, in-combat healing, and
  distinct role jobs would all need bolt-on systems. It contradicts "all stats matter."
- *Win-probability roll* (power ratio → P(win), rolled at claim) — rejected: RNG losses feel unfair in
  an idle game, the odds are opaque, and it still yields no per-character ending HP.
- *Keep 0.1%/pt and just gate the whole payout behind a win* — rejected as the reward model: smallest
  change, but stats double-dip (decide the win **and** multiply the reward), letting over-leveling
  trivialize the economy.
- *Fixed per-mission reward, retire the multiplier entirely* — viable and simplest, but discards the
  stat-reward lever the economy was designed around; margin-scaling keeps that lever while making combat
  primary.

**Consequences.**
- The **mission-claim Edge Function is now the combat resolver**: validate `now ≥ ends_at` → run the sim
  → on win, roll loot + apply rewards (margin × party × transcendence) + `applyXp` (ADR-0011) → persist
  ending HP for all participants → free the party, atomically. On loss, persist damage + free the party,
  grant nothing.
- New **persistent-HP state** is required on `player_characters` (an HP/damage field). The **infirmary**
  becomes the recovery sink. Both were already flagged open; this confirms they're needed.
- **Mission encounters must be authored** (enemy stats / difficulty) in Sanity alongside the loot table.
- The combat **tick formulas** (how each stat maps to damage/mitigation/healing/dodge/crit) and the
  **margin formula** (which metric, what rate) are deliberately left as tuning — see `TODO.md` /
  project-undecided. This ADR fixes the *model*, not the numbers.
- The `reward:true` flag / reward-eligible stat set (ADR-0007/0009) loses its role as a per-point reward
  multiplier; whether it survives in any form under outcome-derived margin is a follow-up question.

---

## ADR-0013 — Combat sim v1: seeded action-timeline auto-battle, passive stats only
**Date:** 2026-07-04 · **Status:** Accepted

**Context.** ADR-0012 fixed *that* mission claim resolves via a deterministic auto-battle sim and *how
rewards attach to it*, but left the sim's internals as tuning. Before writing the resolver we needed the
sim's **shape** pinned — the parts that change how it's built, as opposed to coefficients we can rebalance
later. A shrinking constraint: **active abilities are deferred** (project-character-development), so v1 is
a *passive-stat* auto-battle — roles express through stat routing + simple built-in behaviors, not skill
kits.

**Decision (the architectural forks).**
1. **Seeded RNG, not expected-value.** Real rolls (crit/dodge/block), seeded by the `mission_run` id →
   deterministic & auditable on the server, but with genuine variance so a near-threshold mission is a
   real gamble (and can upset). Rejected pure expected-value: it makes combat a solved calculator with no
   tension. Preview win-% (when built) = a quick Monte-Carlo of the seeded sim.
2. **Action-timeline (ATB-style) tick model.** Each combatant's next action fires at
   `interval / (speed · haste)`, so **speed and haste are first-class** (both are `reward:true` core
   stats). Extends cleanly to cooldowns when abilities land. Rejected fixed-rounds (speed/haste matter
   less).
3. **Simplified enemy stat block, encounter = 1–N enemies.** Enemies do NOT mirror the 23-stat character
   registry; they get a lean block (HP, attack, defense, resistance, attack-speed, damage-type). Authored
   per-tier template + per-mission overrides to cap authoring cost. (Exact enemy stat list = its own TODO.)
4. **Threat-lite targeting — the Tank actually tanks.** Enemies prefer the highest-threat target; Tanks
   generate more threat (role weight + Defense/Health). Without this the Tank role is inert. Cheapest thing
   that makes an entire role function.
5. **Armor / DR-curve damage formula.** `DR% = def/(def + K)`, `dmg = power × (1 − DR)`; same family for
   magic via Resistance; ArmorPen lowers effective def. Rejected subtractive (`power − defense`) — breaks
   at idle scale. (The curve constant `K` and coefficients = TODO/tuning.)
6. **Role behaviors in a passive v1:** Tank → threat + HP + DR; Damage → deals; Healer → auto-heals the
   lowest-HP ally each action (HealingPower/HealingCrit). **Utility's passive expression is deliberately
   left OPEN** (its identity is buffs/debuffs = abilities; leaning toward one authored party aura, but not
   decided). **Shields, status effects, buffs/debuffs beyond a static aura → deferred to v2.** The sim
   skeleton builds without Utility resolved.
7. **Margin metric = surviving party HP%** — `Σ ending HP ÷ Σ max HP` across the party (a death drags it
   down naturally). Falls straight out of the sim and ties reward to the persistent-damage loop. Rejected
   clear-speed and surplus-power (both need extra bookkeeping; survival is free and thematically aligned).
8. **Fight termination = max round/time cap; hitting it is a LOSS.** Guarantees the loop exits (two tanky
   sides can't stalemate forever); a party that can't secure the kill in the allotted fight fails, same as
   a wipe.

**Persistence.** Store **absolute `current_hp`** on `player_characters` (nullable = full), clamped to
`[0, maxHp]` on read (robust when gear/level shifts max HP — a stored fraction or "damage taken" gets weird
on a gear swap). **0 HP = "downed": cannot be dispatched until healed** → the failure consequence + the
infirmary sink. **No out-of-combat regen** (HealthRegen is in-combat only; recovery = infirmary or an
in-combat healer). Characters **carry their damage into the next fight**.

**Consequences.**
- **The `reward:true` flag is now fully vestigial for missions.** With margin = surviving-HP%, reward sums
  stat points *nowhere* (`win → base × marginHP% × party × transcendence`). The 9-stat reward set
  (ADR-0007/0009) has no economic job left; retire or repurpose it when next touched.
- Mission-claim's build order is now unblocked and mechanical: (a) `player_characters.current_hp` migration,
  (b) enemy/encounter schema in Sanity, (c) the sim module (pure, seeded, unit-testable) + the tuning
  coefficients, then (d) wire it into the claim Edge Function alongside loot + `applyXp` + HP persistence.
- Still open (tracked in project-undecided): Utility's passive expression (fork 6), and all tuning —
  the DR constant `K`, stat→power coefficients, crit/dodge/block base values, heal coefficients, the
  margin%→bonus curve, and the concrete enemy stat list.

> **Refined by ADR-0014:** a capped level-based power bonus is added to the reward pipeline (the
> `reward:true` flag stays retired, not "vestigial pending repurpose"); unkillable comps are confirmed an
> intended build under timeout=loss; Utility characters are built now with combat function deferred (fork 6).

---

## ADR-0014 — Capped level power bonus, unkillable comps intended, Utility built now
**Date:** 2026-07-04 · **Status:** Accepted

**Context.** Pinning the sim (ADR-0013) surfaced three follow-ups. (1) ADR-0012 had retired the flat
per-point `statBonus` in favor of margin-only reward — but we want *some* payoff for fielding powerful
characters, without reopening the runaway-economy risk that killed the flat model. (2) Should
"unkillable" party comps be possible under `timeout = loss`? (3) Utility's passive expression was left
open in ADR-0013 (fork 6) — what's its near-term status?

**Decision.**
1. **Add a capped, level-based power bonus to the reward pipeline** (win-gated, participating characters
   only):
   `final = base × (1 + marginHP%) × (1 + levelBonus) × (1 + partySizeBonus) × (1 + transcendenceBonus)`.
   `levelBonus` is derived from participating characters' **levels**, leaning **average party level**
   (not sum — sum would double-count the party-size axis that `partySizeBonus` already covers). Because
   level is **hard-capped at 50**, the bonus has a fixed ceiling and **cannot run away with gear
   inflation** — which is exactly why it's safe where the old stat-sum term wasn't. This *refines*
   ADR-0012 (margin was the only stat-derived scaler) and **confirms the `reward:true` flag stays
   retired**: we read level, never summed stats. It also gives leveling (ADR-0011) a direct economic
   payoff beyond unlocking content, reinforcing the core loop. Rate + avg-vs-sum = tuning.
   - *Rejected:* reviving the `reward:true` flag / summed-stat term (includes gear → uncapped →
     reintroduces the ADR-0012 runaway risk); and margin-only (drops the progression payoff we want).
2. **Unkillable comps are an intended, permitted build.** `timeout = loss` (ADR-0013) stands, so an
   unkillable-but-low-DPS comp **times out → loss** (no reward, ~no injury) — not an auto-win.
   "Unkillable" (sustain ≥ incoming; the DR curve asymptotes toward but never reaches 100%, so it
   requires heal/mitigation *throughput*, not just armor) is a legitimate build whose payoff is
   **zero-injury safe farming** — but it only pays out when paired with enough DPS to beat the clock. It
   doesn't break difficulty gating because defensive investment costs DPS. This is a **tuning constraint**
   (enemy HP/damage scaling must keep the DPS/timer check meaningful), not a rule change.
3. **Utility characters are built now; their combat function is determined later.** Fork 6 stays open by
   choice: Utility heroes are authored/recruitable, but in sim v1 they fight as **generic combatants**
   (their stats apply; no distinct role behavior) until their passive/active kit is designed. Not a build
   blocker.

**Consequences.**
- Reward pipeline gains one **bounded** multiplier; leveling now has a direct economic payoff (synergy
  with ADR-0011).
- The `reward:true` flag / 9-stat reward set stays retired for missions (level replaces the intent);
  revisit only if a non-mission use appears.
- Combat tuning carries a hard constraint: preserve the DPS/timer check so unkillable ≠ auto-win.
- New tuning knobs: the `levelBonus` rate and avg-vs-sum choice (tracked with the other combat numbers).
- Utility remains a known gap in the sim until its kit is designed — recruitable, but mechanically plain.

---

## ADR-0015 — Combat math v1: formulas + first-pass constants
**Date:** 2026-07-05 · **Status:** Accepted

**Context.** ADR-0013 fixed the sim's *shape* (seeded action-timeline auto-battle) and ADR-0014 refined
rewards, but both left the *numbers* — how each stat maps to damage/mitigation/healing, the timeline
cadence, the reward curves, the enemy tier template — as open tuning. Those can't be truly *balanced*
until the sim exists to run fights against, but the sim can't be *written* without the formula shapes.
So this ADR records **Combat Math v1**: the formula shapes plus deliberate **first-pass constants** —
enough to build the sim. Every constant is expected to be refined by simulating; this is the current
model, recorded so we can revisit rather than re-derive. **Not final balance.**

**Decision.** Constants live at the top of the (pending) pure module `src/lib/combat.ts`; "tuning" later
= editing them.

**A. Power routing (stats → combat numbers).** The registry has `attack`/`strength`/`agility` as separate
stats, and ADR-0009 routes primaries to Attack; so:
- Physical power `pAtk = attack + strength + agility`; Magic power `mAtk = spellPower + intelligence`;
  Heal power `hPow = healingPower + intelligence` (all coefficients 1.0 first-pass).
- **Behavior rule** (the one genuine model choice, not just a number): a **Healer** heals; **everyone
  else attacks with `max(pAtk, mAtk)`**, damage type = physical if `pAtk ≥ mAtk` else magic. → attack
  type is *emergent* from stats (a warrior swings physical, a mage casts) with no per-character authoring.

**B. Hit pipeline** — one attack resolves in order `dodge → crit → armor DR (minus pen) → block`:
- Dodge: `dodge%` chance → fully avoided (0 dmg).
- Crit: `critChance%` chance → damage × `(1.5 + critDamage/100)` (base +50%, the stat adds).
- Armor DR curve: `DR = effDef / (effDef + K)`, **`K = 100`**; `effDef = max(0, defense − armorPen)`.
  Magic hits use `resistance` in place of `defense`.
- Block: `block%` chance → that hit × `0.5`.

**C. Timeline.** `attackInterval = BASE_INTERVAL × REF_SPEED / (speed × (1 + haste/100))`, with
**`BASE_INTERVAL = 3s`, `REF_SPEED = 10`** (speed 10 / no haste → acts every 3s).

**D. Healing.** A heal action restores `hPow` to the **lowest-HP% ally** (incl. self) below full;
`healingCrit%` chance → ×2. If all allies are full, the healer attacks instead (no dead turns).

**E. Threat (makes the Tank tank).** `threat += damageDealt × roleMult`, **Tank ×4, everyone else ×1**;
enemies target the **highest-threat** living member.

**F. Reward margin + level bonus** (feeding the ADR-0012/0014 pipeline):
- **`marginBonus = survivingHP% × 0.5`** (`Σ endHP ÷ Σ maxHP`) → up to +50% for a flawless clear,
  ~0 for a bloody one.
- **`levelBonus = avgPartyLevel × 0.004`** (average, not sum; +20% at avg L50; hard-capped by the L50 ceiling).

**G. Enemy tier template** (generates enemy stats from `tier` + `archetype` — the ADR-0013 template hook):
- Tier-1 base (= the seeded Rotting Ghoul): HP 120 · atk 12 · def 5 · speed 10.
- Per-tier growth: every stat × **1.4^(tier−1)**.
- Archetype mods: **tank** ×2 HP / ×1.5 def / ×0.6 atk · **caster** magic-dmg / ×1.2 atk / ×0.8 HP ·
  **swarm** ×0.4 HP / ×0.7 atk · **boss** ×5 HP / ×1.5 atk.

**Alternatives considered.**
- *Subtractive damage / evasion-as-defense* — already rejected in ADR-0009/0013; kept the DR curve.
- *Per-character authored attack type* — rejected in A: `max(pAtk, mAtk)` makes it emergent, less to author.
- *Sum party levels for the level bonus* — rejected: double-counts the party-size axis (ADR-0014).
- *Balancing the numbers now* — deferred: not meaningful without the sim; these are first-pass.

**Consequences.**
- The sim module `src/lib/combat.ts` is now buildable: a pure, seeded, unit-tested function taking party
  effective stats + an encounter → `{ outcome, endingHP[], survivingHPpct }`. Constants are a header block.
- Balance is expected to move — treat every number here as provisional and revise this ADR (or supersede)
  once fights can be simulated. The *shapes* (A–G) are the stable part; the constants are the soft part.
- Depth stats (crit/dodge/block/armorPen/regen/healingCrit) now all have a concrete effect, closing the
  ADR-0009 "effects deferred" gap for v1.

## ADR-0016 — Mission-claim wiring: shared pure engine + atomic `claim_mission` RPC
**Date:** 2026-07-05 · **Status:** Accepted

**Context.** Every piece the mission-claim resolver needs now exists on `master`: the seeded sim
(`src/lib/combat.ts`, ADR-0013/0015), the reward helpers `marginBonus`/`levelRewardBonus`, the stat
engine (`src/lib/stats.ts`, ADR-0002), leveling (`src/lib/leveling.ts`, ADR-0011), `player_characters.
current_hp` persistence (ADR-0013), and the authored content layer (`missionDef`/`itemDef`/`lootDrop`).
The claim is the **assembly** of all of it — the single server-authoritative write that resolves a
mission (ADR-0003, ADR-0012). Before writing it, two structural questions had no answer:
1. **How does the Deno Edge Function consume the pure engine?** It lives in `src/lib` (app/Vite land);
   Edge Functions are Deno and until now hand-rolled everything in `supabase/functions/_shared/`.
2. **How do we keep the claim atomic?** It performs 4+ writes (loot inserts, currency/resource bumps,
   level/xp/HP updates, delete the run). `supabase-js` issues these as separate statements — a mid-way
   failure would half-pay a reward or double-grant on retry.

**Decision.**

**A. Share the pure engine by importing `src/lib` directly — no copy, no move.** The combat/stats/
leveling cluster (`combat.ts` → `stats.ts` → `statDefinitions.ts`, plus `leveling.ts`) is already a
**self-contained, dependency-free** set of pure functions (no React/Vite/node/browser imports). The claim
function imports them across the repo boundary by relative path (`../../../src/lib/combat.ts`); Deno
bundles them at deploy. **Single source of truth** — the sim the client may replay and the sim the server
resolves with are the *same code*. **Standing constraint:** these four modules MUST stay Deno-safe (no
node/browser/`@/` imports); a violation breaks the deploy. (Verify the cross-boundary bundle works on the
first `supabase functions deploy` — if the CLI balks at paths outside `supabase/`, fall back to a
tsconfig/deno path alias, NOT to copying.)

**B. Compute in TypeScript, then apply through one atomic `claim_mission` Postgres RPC.** The sim is TS
and cannot run in SQL, so the split is: the **Edge Function computes**, a **single RPC writes**.
- *Edge Function* (service role): authenticate → load the `mission_runs` row (owner check, `now() >=
  ends_at`) → fetch the `missionDef` + `encounterDef` + each party member's `characterDef` from Sanity →
  compute each character's **effective stats** (compute-on-read, incl. blessings/equipped) → run
  `simulateCombat({ party, encounter, seed: <mission_run id> })` → on a win, roll the loot table
  (independent per-item, ADR loot model) and compute `finalReward(base × marginBonus × levelBonus × party
  × transcendence)`, per-character `applyXp`, and per-character ending HP. This yields a plain **result
  payload**.
- *`claim_mission` RPC* (`SECURITY DEFINER`, owned by the service role; NOT granted to `authenticated` —
  clients can't call it): takes `(run_id, payload)` and does **all writes in one transaction**. The
  **double-claim guard lives here**: `DELETE FROM mission_runs WHERE id = run_id AND now() >= ends_at`
  and check the row count — 0 rows ⇒ already claimed or not ready ⇒ raise/abort the whole tx. Then insert
  loot rows, bump `profiles` currencies/resources, and update each `player_characters` level/xp/current_hp.
  Commit atomically.
- **Trust boundary:** the Edge Function is trusted (service role, ADR-0003), so the RPC *applies* the
  computed numbers rather than re-deriving them; the one invariant the RPC must own itself is
  **concurrency** — the atomic delete-with-rowcount is what makes a double-claim (two inflight requests,
  or a retry) impossible.

**Alternatives considered.**
- *Copy the engine into `_shared`* — rejected: two copies of the sim drift; the client-replay/server-resolve
  determinism guarantee (ADR-0013) dies the moment they diverge.
- *Move the engine to a neutral `packages/engine`* — rejected for now: churns every `@/lib/...` import site
  in the app for no functional gain; revisit only if `src/lib` ever needs a non-Deno-safe dependency.
- *Sequential `supabase-js` writes with compensation logic* — rejected: not atomic; a failure between
  writes half-pays, and hand-rolled rollback is exactly what a transaction gives for free.
- *Do everything (including the fight) in SQL/plpgsql* — rejected: the sim is non-trivial seeded TS; porting
  it to plpgsql duplicates ADR-0015 in a second language and forfeits the shared-code determinism of (A).

**Consequences.**
- Unblocks building the `mission-claim` Edge Function + the `claim_mission` migration as the next task.
- Establishes a reusable pattern: **pure logic in `src/lib` (Deno-safe) is imported by both the app and Edge
  Functions; multi-write mutations go through a `SECURITY DEFINER` RPC that owns the concurrency guard.**
- Adds a maintenance rule: the `src/lib` engine modules are now a shared contract — keep them pure. A lint
  guard or a comment banner on those files is worth adding so a future `@/`-style import doesn't silently
  break the function deploy.
- The loss path is symmetric and cheap: on a loss the same RPC persists damage (`current_hp`) and frees the
  party by deleting the run, granting nothing — no loot/currency/xp writes.

## ADR-0017 — Mission-claim v1: gear in the sim, survivor XP, item rarity scaling, mission-start
**Date:** 2026-07-05 · **Status:** Accepted

**Context.** Building the mission-claim resolver (ADR-0016 wiring) forced several gameplay decisions that
weren't written down anywhere. Recorded here with the first-pass numbers (tunable, like the combat
constants). Depends on ADR-0016 (shared engine + `claim_mission`/`start_mission` RPCs).

**Decision.**

**A. Effective stats include EQUIPPED GEAR (v1).** The sim consumes `effectiveStats = level baselines +
blessing bonuses + equipped-item bonuses`, all stacked with the existing `{flat, pct}` rule
(`src/lib/stats.ts`). Gear is not deferred — a character fights with what they wield.

**B. Item rarity scaling = STEEP ×2 per step (first-pass).** `itemDef.statBonuses` are the **base
(Common)** values; the equipped rarity multiplies EACH bonus (flat and pct) by
`Common 1 · Uncommon 2 · Rare 4 · Epic 8 · Legendary 16` (`RARITY_MULT`). So a base +10 attack item gives
+10 / +20 / +40 / +80 / +160. Provisional; tune alongside the combat constants and loot odds.

**C. XP goes to SURVIVORS only, full `baseXp` each.** On a win, every party member with **ending HP > 0**
gains the mission's **full `baseXp`** (not split across the party), then scaled by the reward pipeline.
A character downed mid-fight (ending HP = 0) earns NO XP even though the party won — surviving matters.
Coins/resources/loot are player-wallet rewards and don't depend on individual survival.

**D. Reward pipeline wiring.** `finalReward = base × (1+marginBonus) × (1+levelBonus) × (1+partyBonus) ×
(1+transcendenceBonus)` (ADR-0012/0014), applied to coins, resources, AND per-survivor XP. Concrete
rates used: `marginBonus = survivingHP% × 0.5`, `levelBonus = avgPartyLevel × 0.004`,
`partyBonus = (partySize−1) × 0.10`, `transcendenceBonus = transcendence_count × 0.10`. Loot is rolled
independently per item (own dropChance + own weighted rarity roll), seeded off the run id — NOT scaled by
the multipliers.

**E. Persistence + loss path.** Each character's ending HP is written to `player_characters.current_hp`
on EVERY claim (win or loss). A loss grants nothing (no XP/coins/loot) but still persists damage and frees
the party (deletes the run). Characters enter the fight at their carried-in `current_hp` (null = full).

**F. Scope: also built mission-start.** `mission-start` (dispatch) is a sibling Edge Function + the
`start_mission` RPC: it validates the party (owned / not-downed / not-busy across missions+gathering /
size 1–3) under a row lock and sets `ends_at = now + missionDef.durationSeconds` (the client is not
trusted for duration). Party composition / role-slot entry requirements remain deferred.

**Security + deployment notes (learned building this).**
- **SECURITY DEFINER lockdown.** Supabase's default privileges auto-grant `EXECUTE` on new `public`
  functions to `anon` + `authenticated`, so `REVOKE ... FROM public` is NOT enough — a signed-in user
  could otherwise call `claim_mission` via `/rest/v1/rpc` with an arbitrary `p_player` and mint state.
  Both RPCs `REVOKE ... FROM public, anon, authenticated` and `GRANT EXECUTE ... TO service_role` only.
  Verified: a client call returns `403 permission denied` (advisors clean).
- **Cross-boundary bundling (confirms ADR-0016 A).** An Edge Function importing `../../../src/lib/*.ts`
  deploys via the **Supabase CLI** (`supabase functions deploy`), which bundles the import graph from disk
  (it uploaded `combat/stats/statDefinitions/leveling/roles.ts` alongside the function). The MCP
  `deploy_edge_function` takes an explicit file list and does NOT walk cross-dir imports — use the CLI for
  these. The shared `src/lib` cluster must stay Deno-safe (uses `.ts` import extensions; no browser/node
  deps).

**Alternatives considered.**
- *Defer gear to v2* — rejected: chosen to include gear now (the item schema + stacking shape already exist).
- *Split baseXp across the party / reward downed characters* — rejected per the decisions above (full XP,
  survivors only).
- *Gentle/linear rarity curve* — rejected for a steep ×2 (bigger chase incentive); revisit during balance.

**Consequences.**
- Verified end-to-end on hosted: dispatch → wait → claim resolved a real fight (win, 20s, survivingHP 53%),
  granting scaled gold/resources + a loot roll + survivor XP + persisted HP, all through the atomic RPC;
  the double-claim guard and the RPC lockdown both hold.
- Establishes the reusable pattern: pure `src/lib` logic imported by app + Edge Functions; multi-write
  mutations behind a `SECURITY DEFINER` RPC that owns concurrency; deploy engine-consuming functions via CLI.
- All first-pass numbers (rarity ×2, the four reward rates) are provisional — revise here (or supersede)
  once balance work begins.

---

## ADR-0018 — Wallet display: currency is `gold`, header reads the live wallet, mission resources mine-only
**Date:** 2026-07-06 · **Status:** Accepted

**Context.** The claim path already credits `profiles.currencies` / `profiles.resources` atomically
(ADR-0016/0017), but nothing on the client read the wallet: `GameHeader` showed hardcoded mock chips
(`142 Cu`, `1420` coins, …). Auditing the two authored missions surfaced code/registry mismatches that
would make credited balances *invisible*: both rewarded a currency coded `gold` while the registry key
was `coins`, and Crypt Clearing rewarded a `bone` resource absent from the resource registry (which is
the 9 mine materials, Wood…Platinum).

**Decision.**

**A. The primary currency is `gold`.** Renamed the currency registry key `coins → gold` (label `Gold`),
matching what the authored missions already used, and relabelled user-facing currency text to "gold".
Internal identifiers were renamed to match (`baseCoins→baseGold`, `finalCoins→finalGold`,
`coinSteps→goldSteps`, `MissionCard` prop `coins→gold`); the generic `CoinDisplay` atom keeps its name
(it renders a gold-coin icon + amount). Note the intentional namespace overlap: the
currency key `gold` (in `profiles.currencies`) is distinct from the ore resource `Gold` (in
`profiles.resources`) — different JSONB columns, no data collision.

**B. The header reads the live wallet.** New `src/services/profile.ts` (`fetchProfile`, SELECT-only on
`profiles` — RLS owner-read) + `src/hooks/useProfile.ts` (query key `['profile']`, already invalidated by
`useClaimMission`). `GameHeader` now renders the player's real `gold` and resource balances; no client
write path (ADR-0003 intact).

**C. Header shows only non-zero resources.** Gold is always shown; a `ResourceChip` appears per resource
the player owns (`balance > 0`), iterated in registry order (`Object.keys(RESOURCE_COLOR)`). Scales as the
registry grows; an empty early-game wallet shows just gold. Unknown wallet keys (e.g. a legacy `bone`
balance) are simply not displayed.

**D. Missions grant mine resources only (for now).** Rewritten Crypt Clearing's `bone` reward as `Iron`
(a registry material, fits the crypt/rusted-blade theme). Non-mine "monster material" resources are
deferred until a materials system is designed; until then mission resource rewards must use a resource
registry key.

**Consequences.**
- The header is now account-accurate and refreshes on claim. Adding a currency/resource remains a
  one-line registry change (JSONB wallet, no migration).
- Missions actually surface resource flow to the player (Crypt Clearing → Iron → header chip).
- Deferred: short-form resource labels (currently full names), a dedicated wallet/inventory currency panel
  beyond the header, and the monster-materials resource category.

---

## ADR-0019 — Gathering loop: continuous accrual, code-registry mine config, start/collect RPCs
**Date:** 2026-07-07 · **Status:** Accepted

**Context.** The Mines were the game's main resource *faucet* but entirely mock (`src/pages/MinesPage.tsx`
was local state over hardcoded data). The `gather_assignments` table already existed
(20260612180001_activities.sql) and its comment specified the model: a character continuously gathers a
resource; an Edge Function credits `floor((now − last_collected_at)/interval) × yield_per_tick` on
collect/stop and advances `last_collected_at` by the consumed ticks (remainder carries over). This ADR wires
that end to end, reusing the mission server pattern (ADR-0016/0017).

**Decision.**

**A. Mine config lives in code (`src/lib/gather.ts`), not Sanity.** A pure, Deno-safe registry (`MINE_DEFS`
= 9 mines with `intervalSec`/`yieldPerTick`, seeded from the carried GATHER_CONFIG values; `resourceKey` =
full resource-registry names so credited wallet keys line up) + a pure `accrue(elapsedMs, interval, yield)
→ { gained, consumedSec }`. Imported by BOTH the client (display) and the Edge Functions (accrual) — single
source of truth, like `combat.ts`. Chosen over a Sanity `mineDef` schema: less machinery, pairs with the
resource registry, and these are balance constants that tune in one tested file.

**B. Continuous, uncapped, offline-safe accrual.** Only whole ticks pay out; the sub-tick remainder is
preserved by advancing `last_collected_at` by exactly `consumedSec` (a value derived from the OLD timestamp,
never `now()` → no read/apply race). A mine left running while the player is away banks the whole elapsed
time on next collect. No offline cap in v1.

**C. Two `SECURITY DEFINER` RPCs (service-role only), mirroring the mission RPCs.** `start_gather` validates
the character (owned / not-downed / not on a mission / not already gathering / **one gatherer per resource
node** — v1, matches the UI) under a row lock and inserts. `collect_gather` credits `p_gained` into
`profiles.resources[resource]`, sets `last_collected_at = p_new_last_collected_at`, and (if `p_stop`) deletes
the assignment to free the character — atomic. The accrual math runs in TS (`gather.ts`) and is passed in;
the RPC owns atomicity, not the game rule. Two Edge Functions (`gather-start`, `gather-collect`) provide the
auth shell + accrual; neither needs Sanity (config is code); deployed via the Supabase CLI (bundles
`src/lib/gather.ts`).

**D. Client: migrated Mines to `src/features/gather/`** (ADR-0010 "migrate when next touched") — `GatherPage`
composes the shared `MineCard`/`ActiveGatherCard` molecules against real `gather_assignments` + `useRoster`.
Added an optional `onCollect` to `MineCard` (a Collect button that banks without stopping; Stop = collect +
free). Cards key on `last_collected_at` so the banked-since-collect display resets on collect.

**E. Promoted `useRoster` (+ its sub-hooks) to `@/hooks/useRoster`.** Three consumers now (missions,
infirmary, gather) — features share it from `@/hooks` rather than reaching through the missions barrel.

**Verification (hosted, end-to-end).** Throwaway user + character: `gather-start` created an assignment;
a second assign returned "already gathering"; a direct client `rpc('start_gather')` returned **403**
(lockdown holds). Backdated 100s → `gather-collect` banked exactly 5 Wood ticks (**+20**, wallet `{Wood:20}`),
advanced `last_collected_at` keeping the remainder, assignment persisted; `stop:true` banked the remainder
(**+8 → 28**) and deleted the assignment (character freed). Advisors clean.

**Consequences.**
- Resources now flow from BOTH missions and mines into the wallet the header displays.
- Adding a mine/resource stays a one-line code change (registry + JSONB wallet, no migration).
- Deferred (unchanged): gather **specialization** (blessing speed/yield bonuses, resource specialists — the
  ⚡ BonusTag stays visual), offline caps, multiple gatherers per node, and rebalancing the interval/yield
  values for the continuous model.

---

## ADR-0020 — Genre direction: idle + roguelike hybrid (run-based "expeditions" as the retention layer)
**Date:** 2026-07-07 · **Status:** Accepted (direction; implementation deferred)

**Context.** The game to date is a pure idle/incremental RPG. Pure idle has a known retention weakness:
between prestige resets the mid-game flattens into a progress line with no session-level goal, and in this
genre retention *is* distribution (community word-of-mouth is the only channel an indie has). The market's
current answer is the **roguelike-idle hybrid** — run-based variance for session engagement layered on idle
accumulation for return visits (Capybara Go: $100M in <3 months; The Tower; Legend of Mushroom; the
run-based-incremental wave on Steam). Meanwhile this codebase has, without aiming at it, already built the
hard prerequisites: a **seeded, deterministic auto-battle sim** (ADR-0013/0015 — a run seed is a mission_run
seed), **missions can fail + HP persists + downed-at-0** (run stakes exist), and **transcendence** as
macro-prestige with room below it for run-scoped micro-progression.

**Decision. The game's genre goal is an idle/incremental RPG WITH a roguelike run layer.** Recorded now,
ahead of implementation, so intermediate systems are shaped for it rather than refactored into it.

- **A. The idle loop stays the spine.** Missions, gathering, leveling, blessings, transcendence remain the
  core contract: low-attention, always-progressing. The roguelike layer is an **opt-in session mode**, never
  a gate on core progression — the audience chose an idle game because it respects their attention.
- **B. The run shape (design target, not yet built): "expeditions".** Pick a party → chain N seeded
  encounters → between encounters choose 1-of-3 **run-scoped boons** (temporary buffs/relics; they never
  touch permanent progression, so no conflict with compute-on-read or the blessing trees) → **push-your-luck
  depth**: deeper = better loot, but damage persists (`current_hp`) and a downed character is a real cost —
  this is what finally gives the open infirmary question a job.
- **C. Standing constraint on the combat/claim stack (the actionable part today):** the resolver is shaped
  around **an encounter, not a mission** — a mission = 1 encounter resolved at claim; an expedition = N
  encounters with choices between them. Server-authoritative choice points are Edge Function round-trips
  (discrete, low-frequency — fine under ADR-0003); the seeded sim permits client-side preview with server
  verify. Boons/relics are authored content → Sanity, same definition/instance split as everything else.
- **D. Sequencing:** design on paper now; **build only after the core idle loop is shipped and playable**.
  Content variety (the boon pool) is the real scope cost for a solo dev, not the code.

**Alternatives considered.**
- *Stay pure idle* — rejected: retention-limited at exactly the mid-game point where word-of-mouth is won or
  lost; the hybrid is also the clearest differentiator vs. Melvor-style skilling loops.
- *Full roguelike pivot* — rejected: breaks the low-attention contract with the idle audience; wrong game.
- *Mobile gacha-idle live-ops model (the Capybara Go business)* — rejected: demands UA budget + live-ops
  teams a solo dev doesn't have; we borrow its retention mechanic, not its monetization machine.

**Consequences.**
- The genre goal is now on record: **idle + roguelike**. Memory and docs state it even though no roguelike
  feature exists yet; new-system design should check itself against B/C (e.g. the claim resolver's
  encounter-vs-mission shape) before building.
- New open questions join the undecided list: boon/relic design + pool size, run length & entry cost,
  expedition reward model vs. the mission pipeline (margin/level bonuses per encounter or per run?), and how
  infirmary economics price a failed deep run.
- No implementation work is scheduled by this ADR; the mission-claim/core-loop roadmap is unchanged.

---

## ADR-0021 — Infirmary v1: leveled recovery building (beds + HP/s), stabilize phase for downed characters
**Date:** 2026-07-07 · **Status:** Accepted (design; implementation after the core claim loop)

**Context.** HP persists between missions and there is no out-of-combat regen (ADR-0013); a character at
0 HP is downed. That design deliberately created stakes but left the recovery mechanism as an open question
("infirmary mechanics"). Separately, the economy has a known resource-sink gap: gathered resources (ADR-0019)
flow in with nothing to spend them on. ADR-0020 also gave the infirmary a future job: pricing failed deep
expedition runs.

**Decision. The infirmary is a player-level building that heals admitted characters over real time.**

- **A. Leveling.** The infirmary has a level, **max level 5**. Each level grants more **beds** (concurrent
  admission slots) and a higher **HP/s regen rate per bed** (flat per bed, not shared). Level-ups cost
  **gold + gathered resources** — this is the first real resource sink. First-pass curve (beds = level):

  | Level | Beds | HP/s per bed |
  |---|---|---|
  | 1 | 1 | 10 |
  | 2 | 2 | 25 |
  | 3 | 3 | 50 |
  | 4 | 4 | 75 |
  | 5 | 5 | 100 |

  Upgrade **costs are deliberately not set yet** (need the gather-economy values first).
- **B. Healing is compute-on-read (ADR-0002), settled server-side (ADR-0003).** Admission stores
  `admitted_at` + HP at admission; current HP = `min(maxHp, hpAtAdmission + regenRate × elapsed)`. No tick
  loop or cron. The client renders the projection live; the authoritative value is written only when an
  **Edge Function** settles it (discharge, or any action that needs real HP). Admit / discharge / upgrade
  are all Edge Function writes; beds cap enforced server-side.
- **C. Downed characters stabilize first.** A character admitted at 0 HP enters a **stabilize phase**
  (no regen) before healing begins. Stabilize duration **scales with the character's level** and is
  **reduced by infirmary level** — death stays meaningful at endgame and upgrading visibly helps. After
  stabilize, regen runs normally from 0 (no free HP chunk; full recovery = stabilize time + full heal time).
- **D. Admission is exclusive.** An admitted character is unavailable — a new **In Infirmary** state in the
  shared roster availability model (alongside Available / On Mission / Gathering). Early discharge is
  allowed (partial heal, settled at discharge).
- **E. UI contract.** The infirmary page shows the **entire roster** with current HP; per character a
  projection of what admission gives ("full in 14m", downed → "stabilize 8m, then heal 22m"); occupied
  beds with live progress; and an **upgrade panel** showing current → next level (beds, HP/s, stabilize
  reduction) with the resource cost, greyed until affordable.

**Alternatives considered.**
- *Slow passive regen everywhere* — rejected: erases the stakes ADR-0013 built; healing becomes waiting, not
  a system.
- *Consumable healing items as the primary mechanism* — rejected for v1: crafting isn't built, and
  consumable pressure punishes exactly the failed-run moment. Possible later complement (crafted salves
  speeding infirmary time).
- *Pay-gold instant heal* — rejected: undermines the time cost that makes failure matter; revisit only if
  wait times test as hostile.

**Consequences.**
- Gathered resources gain their first sink; infirmary economics become a knob for pricing failed
  expeditions later (ADR-0020).
- Needs (implementation, not scheduled by this ADR): an `infirmary_level` on the player row, admission
  state (columns or a small table), and three Edge Function actions. Beds/HP-per-level are set above
  (first-pass, tune like ADR-0015); still to define: the **stabilize formula** and **upgrade costs**.
- Open questions list shrinks: infirmary mechanics → RESOLVED; remaining tuning (stabilize formula,
  upgrade cost table) joins the constants-balancing bucket.
