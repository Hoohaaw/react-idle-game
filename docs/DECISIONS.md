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
