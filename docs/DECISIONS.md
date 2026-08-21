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
| [0018](#adr-0018--wallet-display-currency-is-gold-header-reads-the-live-wallet-mission-resources-mine-only) | Wallet display: currency is `gold`, header reads the live wallet, mission resources mine-only | 2026-07-05 | Accepted |
| [0019](#adr-0019--gathering-loop-continuous-accrual-code-registry-mine-config-startcollect-rpcs) | Gathering loop: continuous accrual, code-registry mine config, start/collect RPCs | 2026-07-06 | Accepted |
| [0020](#adr-0020--genre-direction-idle--roguelike-hybrid-run-based-expeditions-as-the-retention-layer) | Genre direction: idle + roguelike hybrid (run-based "expeditions" as the retention layer) | 2026-07-07 | Accepted |
| [0021](#adr-0021--infirmary-v1-leveled-recovery-building-beds--hps-stabilize-phase-for-downed-characters) | Infirmary v1: leveled recovery building (beds + HP/s), stabilize phase for downed characters | 2026-07-08 | Accepted |
| [0022](#adr-0022--gear-equip-v1-14-slot-keys-atomic-swap-rpcs-busy-lock) | Gear equip v1: 14 slot keys, atomic swap RPCs, busy-lock | 2026-07-08 | Accepted |
| [0023](#adr-0023--two-tier-reset-system-reset-soft-prestige--transcendence-hard-wipe) | Two-tier reset system: Reset (soft prestige) + Transcendence (hard wipe) | 2026-07-09 | Accepted |

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

**Addendum (2026-07-08, implementation).** Built as `feature/infirmary`. Remaining first-pass constants
set (tune like ADR-0015): **stabilize = ceil(charLevel × 30s ÷ infirmaryLevel)**; **upgrade costs** are a
PROVISIONAL gold+resource table living in `src/lib/infirmary.ts` (L2 100g+50 Wood → L5 2000g+600 Wood+
400 Copper+250 Iron), to be retuned with the gather-economy pass. Implementation notes: admissions live in
`infirmary_admissions` (one row per admitted character, `admitted_at` + `hp_at_admission` only — HP is
derived); RPCs `admit_infirmary` / `discharge_infirmary` / `upgrade_infirmary`; `start_mission` and
`start_gather` gained an in-infirmary busy check; an upgrade atomically SETTLES active admissions
(healing chars bank derived HP; stabilizing chars keep their elapsed fraction of the shorter window).
The placeholder instant-heal `heal` Edge Function is removed.

---

## ADR-0022 — Gear equip v1: 14 slot keys, atomic swap RPCs, busy-lock
**Date:** 2026-07-08 · **Status:** Accepted (built on `feature/equip-gear`)

**Context.** Mission loot lands in `player_inventory` and nothing consumes it, even though the whole
downstream is gear-aware: the stat engine (`collectGearBonuses` + `RARITY_MULT` ×2/rarity step) already
feeds the combat sim, the roster's max HP and the infirmary's healing target from
`player_characters.equipped`. What was missing was the write boundary — how an item moves between an
inventory stack and a character's slot — and its rules.

**Decision.**
- **A. 14 slot keys, owned by `src/lib/equipment.ts`.** The equipped map's keys are the 8 unique gear
  slots from the Sanity `itemDef` schema (`head, shoulders, chest, hands, legs, feet, weapon, offhand`)
  used verbatim, plus `ring1..ring4` and `trinket1/trinket2`. Multi-slot keys map back to their base
  itemDef slot for compatibility (`itemSlotForSlotKey('ring3') === 'ring'`) — a ring item fits any ring
  slot. The module is pure/Deno-safe and imported by both the client and the Edge Functions (ADR-0016
  pattern), so there is exactly one slot list.
- **B. Two-layer validation.** Slot *compatibility* (does this item go in that slot?) needs the authored
  def, so it lives in the **Edge Function** (Sanity lookup). Ownership, stack existence, busy-state and
  structural slot-key validity live in the **RPC** (defense in depth). Two functions: `gear-equip`,
  `gear-unequip` → `equip_item` / `unequip_item` (SECURITY DEFINER, service_role-only, ADR-0003).
- **C. Atomic swap in one RPC.** Equip = decrement the source stack (delete at qty 1) → return any
  displaced item to inventory (upsert +1) → `jsonb_set` the slot, all under FOR UPDATE locks on the
  character + stack rows. Equipping into an occupied slot is therefore a swap with no intermediate
  state; equipping the same item+rarity over itself nets zero. Unequip is the inverse.
- **D. Gear locks while busy.** Equip/unequip are rejected while the character is on a mission,
  gathering, or in the infirmary. Rationale: the sim reads `equipped` at claim time, so re-gearing
  mid-mission would let one item be counted by several concurrent claims (unequip from A mid-run,
  equip on B, dispatch B — the item fights twice); and maxHp drift mid-heal would corrupt the
  infirmary's compute-on-read settlement. Idle characters swap freely.
- **E. No other restrictions.** No class/level/role gates (existing design: gear swappable). Rarity
  scales stats ×2/step now; **unique affixes on rare gear** (special effects beyond stats) are wanted
  but explicitly deferred — they need the affix design pass first.

**Alternatives considered.**
- *Client-side slot validation only* — rejected: ADR-0003; a tampered client could equip a chest into
  every ring slot.
- *Allow re-gearing while busy* — rejected for the double-count exploit above; a "loadout snapshot at
  dispatch" fix would cost more than the lock.
- *Per-instance items (unstack on equip)* — rejected: stacks by (def, rarity) are already the inventory
  model (upgrading consumes duplicates); fungibility keeps the swap math trivial.

**Consequences.**
- The core loop closes: mission → drop → equip → measurably stronger next mission. Loot has a purpose.
- The UI Item type's coin `value` has no authored source yet — inventory passes 0 and the tooltip hides
  the row; an itemDef `value` field is a later content pass.
- The CharacterCard's Stats tab still shows def baselines only; a per-stat gear/blessing breakdown via
  `effectiveStats` is a natural follow-up.
- Equipped keys are validated but not migrated: nothing ever wrote to `equipped` before this, so no
  backfill is needed.

## ADR-0023 — Two-tier reset system: Reset (soft prestige) + Transcendence (hard wipe)
**Date:** 2026-07-09 · **Status:** Accepted

**Context.** The original design sketched a single "transcendence" that kept characters but reset
their levels, with a flat `transcendenceCount × 10%` bonus applied to all rewards. This works as a
loop driver, but a single reset tier creates a flat prestige feel: every reset is identical, the only
asymptote is time. Two distinct tiers give the game a second gear and a clearer reason to go deep.

**Decision: two named reset modes with separate currencies and trees.**

**Reset (soft — "Prestige-class" in implementation):**
- Keeps all characters, their current levels, and all equipped and inventory items.
- Resets: the player's resource totals, gold wallet, and other accumulated progression (exact scope
  to be listed at build time; characters and their development are explicitly preserved).
- Awards a **Prestige currency** (name TBD) scaled to how much was achieved before resetting — richer
  play session = more currency. Formula TBD at implementation; the principle is "reward depth, not
  time spent idle."
- That currency unlocks a **Prestige tree**: permanent account-wide bonuses including XP gain rate,
  damage output, mission speed reduction, and similar quality-of-life multipliers. Tree authored in
  Sanity (same blessingNode schema or a dedicated tree schema — TBD at build).
- This is the mid-game loop driver: regular resets compound the Prestige tree, characters carry over
  so the player's roster investment is never lost.

**Transcendence (hard — complete wipe):**
- Full reset: all characters are removed (levels, gear, blessings gone), all resources and progress
  cleared. The player starts over from scratch.
- Awards a **Transcendence currency** (name TBD), significantly rarer and more powerful than Prestige
  currency — earned by going deep and then giving everything up.
- That currency unlocks a **Transcendence tree**: far more impactful multipliers than the Prestige
  tree. Rewards the extreme long-game commitment with disproportionate power spikes.
- Intended for players who want a complete fresh run with compounding advantages, not the
  character-preservation loop of Reset.

**Relationship to the old transcendence design (supersedes the note in ADR-preamble):**
The old design had a single "transcendence" that kept characters and reset their levels to 1,
with a flat `transcendenceCount × 10%` bonus. That is now the **Reset** tier. The new **Transcendence**
is harder and rarer. The `transcendenceCount × 10%` reward formula is provisional and will be
rebalanced against both trees at build time.

**What is NOT decided yet (open at build time):**
- The exact reset scope (which wallet fields, which mission progress states).
- Prestige/Transcendence currency names.
- Tree structure, node counts, and specific bonus values — authored in Sanity when built.
- The achievement formula that determines Prestige currency award at reset.
- Whether Transcendence unlocks unique content (cosmetics, exclusive missions) in addition to the tree.

**Alternatives considered.**
- *Single-tier prestige (original design)* — kept as the Reset tier; not discarded, just split.
- *No hard reset at all* — rejected; gives the game no "start over" option for players who want
  a fresh run with compounding power, which is core to roguelike-adjacent loops (ADR-0020).
- *Three tiers* — considered; rejected as scope-creep for a solo-dev project. Two tiers cover
  the "soft loop" and "hard reset" cases without fragmenting the player base.

**Consequences.**
- Introduces two new currencies and two Sanity-authored trees (build work deferred).
- The reward pipeline formula `final = base × marginBonus × levelBonus × partySizeBonus × transcendenceBonus`
  will need a `prestigeBonus` multiplicand inserted at build time.
- Character data (levels, gear, blessings) is an explicit keeper for Reset → the `player_characters`
  table must NOT be purged on a Reset, only on a Transcendence.
- The Paragon concept from earlier notes is retired; Transcendence fills the same role with a more
  defined mechanism.

## ADR-0024 — Enemy tier template v2: speed excluded from per-tier growth
**Date:** 2026-07-10 · **Status:** Accepted (first accepted change of the ADR-0015 tuning loop)

**Context.** ADR-0015 §G defined the enemy tier template as *every* stat × 1.4^(tier−1), including
speed. The balance harness (`scripts/balance/`, docs/BALANCE.md) measured what that does across
1.44M simulated fights: because action rate is linear in speed, scaling attack AND speed multiplies
effective enemy DPS by ~×1.96 per tier while party HP grows far slower. Result (see
`scripts/balance/reports/2026-07-10-baseline.md`): ~130 difficulty cliffs (win rate 100%→~0% in one
tier step), a near-empty 30–80% win band, bimodal margins (wins flawless, losses total) leaving
`marginBonus` inert, and high-tier fights compressed to sub-0.3s enemy action intervals where
crit/dodge variance averages away.

**Decision.** The tier template scales **HP, attack, and defense** by ×1.4^(tier−1); **speed stays
flat** at the tier-1 base (10). Speed variation is an *authoring* tool (a fast enemy is a designed
threat, not an automatic consequence of tier). Both currently authored enemies already conform
(Rotting Ghoul speed 10, Bone Colossus speed 12 despite ~tier-4-boss HP/atk).

**Evidence (before → after, same 1.44M-fight grid, `2026-07-10-speed-flat` report):**
- Difficulty cliffs: ~130 → ~78 flagged; a real middle band appears (38%/46%/48% win cells with
  mid-range margins) — `marginBonus` now has dynamic range.
- Healer inversions: 8 → 4 cells, and milder (worst gap 73pts → 27pts).
- New binding constraint exposed: timeouts jump 22 → 87 heavy cells — enemy HP ×1.4/tier against a
  flat 60s limit is now the wall (39 cells win ≥40pts more at 180s). **Next knob: per-tier time
  limits** (authoring guidance, e.g. scale `timeLimitSeconds` with tier), not further stat changes.
- Confirmed separately: per-action `healthRegen` + speed growth makes a L50 solo tank literally
  untouchable (100% win, margin 1.0, all tiers). Queued as its own tuning iteration (fixed-cadence
  regen), per the one-change-per-branch loop.

**Alternatives considered.** Gentle speed growth (×1.1/tier) — rejected for v2: reintroduces the
compounding DPS problem in diluted form and muddies the before/after measurement; can be revisited
once time limits are tuned. Softening HP growth instead — rejected: HP growth is what makes higher
tiers *feel* bigger; the clock is the cheaper, more surgical follow-up lever.

**Consequences.**
- `scripts/balance/enemies.ts` implements v2; ADR-0015 §G is superseded on the speed point only.
- Enemy authoring in Sanity: do not scale speed with tier by default; author fast enemies
  deliberately.
- Endgame note: L50 parties clear tier 8 at ~100% — the ladder needs tiers 9+ authored (or the
  sweep grid extended) for endgame content; that is content headroom, not a template flaw.

## ADR-0025 — Encounter time limit: 180s recommended (was 60s), flat across tiers
**Date:** 2026-07-10 · **Status:** Accepted (tuning loop iteration 2)

**Context.** After ADR-0024 the clock became the binding constraint: 87 cells >30% timeouts, and 39
cells flipped loss→win when the limit was raised 60s→180s. Analysis of the flipped cells showed the
timeout wall was NOT tier-dependent: legitimate slow wins (sustain comps — `duo-tank-heal` was 26 of
the 39 flips — grinding fights down) run 60–170s at EVERY tier, tier 1 included. A per-tier limit
formula was therefore the wrong shape; the 60s limit was punishing a play style, not preventing
stalls.

**Decision.** Recommended `timeLimitSeconds` for authored encounters = **180s, flat across tiers**
(`RECOMMENDED_TIME_LIMIT` in `scripts/balance/enemies.ts`). Both authored encounter drafts
(`graveyard-awakening`, `trial-of-ruin`) patched 60→180 in Sanity. Key insight: combat time is
VIRTUAL — the fight resolves instantly at claim, and real-world pacing lives in
`missionDef.durationSeconds` — so a generous limit costs nothing. The clock's only job (ADR-0014) is
to turn can't-ever-kill stalls into losses, which 180s still does.

**Evidence (`2026-07-10-limit-180` report, 180s primary + 300s probe, vs `speed-flat`):**
- Timeout-heavy cells: 87 → 35 (the rest are genuine kill-ceiling edges, not clock artifacts).
- **Healer inversions: 4 → 0.** The longer clock lets healer comps convert sustain into wins;
  the healer slot is no longer a downgrade anywhere in the grid.
- Clock-bound (180s→300s flips): 8 cells, ALL `duo-tank-heal` boss grinds — the extreme turtle duo
  still meets the clock at the top edge, exactly the ADR-0014 "unkillable must still beat the
  clock" intent. 180s is the plateau; 300s buys nothing structural.
- Difficulty cliffs persist (~70, wipe-driven) — that is the tier ×1.4 stat jump itself, next in
  the tuning queue via threat/healer-AI/regen iterations, not a clock issue.

**Alternatives considered.** Per-tier scaling (60×1.2^(tier−1) or +30s/tier) — rejected: duration
data is comp-dependent, not tier-dependent; scaling adds authoring complexity for nothing.
Unlimited time — rejected: removes the anti-stall guard and the ADR-0014 clock gate on pure-turtle
comps.

**Consequences.**
- Encounter authoring default: `timeLimitSeconds: 180`; deviate deliberately (a "race" mission can
  author lower, a siege higher).
- The sweep grid's time-limit dimension is now [180 primary, 300 probe].
- Client fight-replay UI (future) should expect fights up to ~3 virtual minutes; consider replay
  time compression regardless.

## ADR-0026 — Healer AI: heal threshold + hysteresis (healers attack when the party is healthy)
**Date:** 2026-07-10 · **Status:** Accepted (tuning loop iteration 3 — first engine change)

**Context.** The v1 sim healer healed whenever *any* ally was below 100% HP — so in practice a
healer never attacked after the first scratch, trading its entire damage contribution for overheal.
The baseline sweep flagged this as "healer inversion" (a second damage dealer beat the healer slot
in 8 cells). ADR-0025's longer clock fixed the inversions by letting sustain win anyway, but the
degenerate never-attacks behavior remained: wrong for fights (wasted actions), wrong for player
expectations (a Shaman with 300 spell power contributing zero damage), and wrong for future content
where healer damage stats are priced.

**Decision.** `COMBAT.HEALER_HEAL_THRESHOLD = 0.7` with hysteresis: a healer starts healing when a
living ally falls below 70% of max HP, keeps healing (most-hurt first) until the whole party is back
to full, then returns to attacking. Implemented in `simulateCombat` (a `healing` flag per unit +
`pickHealTarget(units, belowPct)`); pure engine change, no schema or API impact. The threshold was
chosen empirically but is ROBUST: sweeps at 0.5 / 0.7 / 0.9 were statistically indistinguishable on
aggregates (healer-advantage cells 10–11, inversions 0, safe-win margins 0.93–0.96), so 0.7 is a
sensible middle with hysteresis preserving end-of-fight margins.

**Evidence (`2026-07-10-healer-threshold` report vs `limit-180`, same grid):**
- Strictly targeted upside: only 4 cells move >15pts and ALL move up — healer damage converts
  sustain-edge timeouts into kills (`duo-tank-heal` L50 T7 boss 59%→99.5%, L10 T4 boss 16%→41%;
  `trio-no-tank` L5 T3 pack 69%→100%). No cell regresses.
- Timeout-heavy cells 35 → 29; clock-bound 8 → 6; threat-failure 102 → 96 (healer damage adds
  nothing to inversion risk — still 0 everywhere).
- Honest sizing: the effect is modest because ADR-0025 already rescued the healer's win rates;
  this ADR fixes the *behavior* (and the reward/pacing texture of healer fights) rather than
  rewriting outcomes.

**Alternatives considered.** Stateless threshold (heal only below 70%, no hysteresis) — rejected:
parks party HP at ~70% and eats `marginBonus` on wins, punishing healer comps in rewards. Healing
stance whenever damaged + damage sharing — out of scope for passive-stats v1 (ADR-0013).

**Consequences.**
- `mission-claim` picks the change up on its next deploy (it bundles `src/lib/combat.ts`);
  determinism is preserved per-deploy — same seed + same engine version = same result — but replays
  of runs resolved under the old engine would differ. No stored replays exist yet, so no migration.
- Healer characters' attack-side stats (Tyla's `spellPower`, etc.) now DO something — factor that
  into blessing-tree and itemDef authoring for healer characters.
- The dedicated `healingCrit` / `healingPower` vs damage trade-off becomes a real build decision.

## ADR-0027 — Tank threat: passive stat accrual (defense/HP × time), not damage alone
**Date:** 2026-07-10 · **Status:** Accepted (tuning loop iteration 4 — engine change)

**Context.** v1 threat was damage-only: `threat += damage × mult`, tank mult ×4 (ADR-0015 D).
That fails STRUCTURALLY, not numerically: action rate is linear in speed, so a speed-growth dps
generates threat per action and its threat *rate* outgrows the slow tank's as levels rise (at L50 a
Rogue attacks ~12× as often as the Warrior; the needed multiplier would be ~16 and still climbing).
Baseline flagged 67 threat-failure cells; after ADR-0024/25/26 it stood at 96 (worst: tank absorbing
21% of hits). ADR-0013 already named the intended fix: threat = "role weight + Defense/Health".

**Decision.** Tanks passively accrue threat with combat time, on top of damage threat:

```
effectiveThreat(t) = damageThreat + threatStatRate × t
threatStatRate     = (defense + maxHp/10) × TANK_THREAT_STAT_RATE   (tanks only, else 0)
TANK_THREAT_STAT_RATE = 3
```

Evaluated lazily in `pickThreatTarget(units, t)` — no per-tick mutation, determinism intact.
Damage threat + ×4 mult stay: a grossly over-geared dps can still rip aggro (intended risk), and
tank damage still contributes. The accrual is action-rate independent, so tanking no longer decays
with level. Defensive stats now generate threat — gearing a tank defensively IS gearing its aggro.

**Evidence (`2026-07-10-threat-stat` report vs `healer-threshold`):**
- Rate swept 1/3/5: 1 under-holds (40 fail cells), 3 and 5 identical (28) — plateau at 3; picked 3
  (smallest value at the plateau keeps damage threat relevant).
- Of the remaining sub-60% cells at rate 3, ALL but one sit in doomed fights (win rate <50%,
  avg 2.67 members downed) where the tank correctly dies first and survivors soak the rest — tank
  mortality, not aggro failure. In winnable fights: ONE marginal cell grid-wide.
- The threat-failure anomaly rule was refined accordingly (only cells with win rate ≥50% count);
  under it the flag is ZERO in the final 500-seed sweep. Avg tank absorption across tank comps:
  ~89%. Win rates and downed counts across tank comps unchanged (aggro was already mostly held in
  easy fights; this fixes the scaling edge).
- Regression test added: slow tank (speed 5) vs 6×-faster dps — enemy attacks land 100% on the
  tank; test FAILS at rate 0 (old behavior), passes at 3.

**Alternatives considered.** Raising `TANK_THREAT_MULT` — rejected: flat multiplier vs a
level-growing rate ratio is the wrong shape (needs ~8 at L20, ~16 at L50). Hard taunt (enemies
always prefer tanks) — rejected: deletes threat as a system and the overgear-rip risk with it.

**Consequences.**
- `mission-claim` picks this up on its next deploy (same note as ADR-0026 — no stored replays, no
  migration).
- Tank defense/health gear and blessing nodes double as aggro tools — price that into authoring.
- Multiple tanks split accrual naturally (both accrue; highest effective threat tanks).

## ADR-0028 — healthRegen is time-normalized (HP per BASE_INTERVAL, not per action)
**Date:** 2026-07-10 · **Status:** Accepted (tuning loop iteration 5 — engine change)

**Context.** v1 applied `healthRegen` in full on each of a unit's OWN actions — so effective regen
scaled linearly with speed. Combined with speed growth this was a confirmed hard degeneracy: a L50
Death Knight (speed 55 → an action every 0.55s) regenerated ~95 HP/s against ~20 HP/s incoming and
was literally untouchable — 100% win at margin 1.0 against every tier in the grid. Regen also
double-dipped with every future +speed/+haste source, poisoning stat pricing.

**Decision.** `healthRegen` = HP per `BASE_INTERVAL` (3s) of combat time. Applied on the unit's own
action, scaled by its interval: `regen = healthRegen × interval / BASE_INTERVAL`. Total regen over a
fight is now `healthRegen × t / 3` regardless of speed or haste. One-line engine change; slow units
are correctly buffed to the same normalized rate (they previously ticked less often than baseline).

**Evidence (`2026-07-10-regen-cadence` report vs `threat-stat`):**
- 23 cells move >15pts, in BOTH directions and all explainable: regen-carried overtier immortality
  collapses (`solo-tank` L20 T6 boss 100%→0%, L35 T8 boss 100%→12%, `trio-utility` L35 T6 boss
  100%→5% — no-healer comps that were riding per-action regen), while slow sustain comps get the
  correct normalization buff (`duo-tank-heal` L1 T4 solo 59%→99%).
- Regression test: a speed-30 unit with healthRegen 30 vs 15 dmg/s sustained — immortal under
  per-action regen, bleeds out time-normalized. Test fails on the old engine, passes on the new.
- Anomalies stable: healer inversions 0, threat failures 1 marginal cell, cliffs ~79 (the tier
  ×1.4 jump itself), timeouts 25→33 (former regen-stall wins now honestly time out).

**Discovered in passing — NEXT tuning target:** `solo-tank` (Mordrek) L50 still clears every tier
at ~100%, but the driver is no longer regen: his AUTHORED `dodge` growth (+1/level → 53% dodge at
L50) halves incoming damage. Dodge-from-growth stacking to 50%+ is an authoring/content problem
(possibly wanting an engine-side dodge cap) — queued, not addressed here.

**Alternatives considered.** Global fixed-cadence regen ticks (scheduler events every 3s for every
unit) — rejected: more sim machinery for the same math. Removing in-combat regen entirely —
rejected: it's an authored stat with build identity (Brewmaster/Death Knight flavor); ADR-0013's
no-OOC-regen rule already bounds it.

**Consequences.**
- `healthRegen`'s canonical meaning everywhere (authoring, tooltips, stat sheets): **HP per 3
  seconds of combat**. Sanity-authored values keep their magnitudes (baseline-speed units behave
  identically); only speed-outliers change.
- `mission-claim` picks this up on next deploy (no stored replays, no migration).
- +speed/+haste no longer buy extra regen — one less double-dip when pricing blessing/item stats.

## ADR-0029 — Party dodge capped at 25% + percent-stat runaway audit
**Date:** 2026-07-10 · **Status:** Accepted (tuning loop iteration 6 — engine change)

**Context.** After ADR-0028 removed regen immortality, solo Mordrek still swept the grid — driven
by his authored `dodge` growth (+1/level → 53% at L50; Vex reaches 59%). Dodge is FULL avoidance,
so it compounds multiplicatively with every other defensive layer, and any growth/gear/blessing
stacking runs away. Decision (Alex): cap it.

**Decision.** `COMBAT.DODGE_CAP = 25` — party units' dodge is clamped at 25% in the sim.
**Enemies are NOT capped**: their stats are hand-authored (no growth runaway), and an untouchable
ghost remains a legitimate encounter design tool (the timeout-loss test depends on it).

**Percent-stat audit (the rest of the family, measured):**
- **critChance** — previously UNPROBED (the only crit-growth character, Dace [WIP], was in no sweep
  comp). Added a `solo-crit` probe comp. Verdict: HEALTHY — 57% crit at L50 produces big damage but
  a clean difficulty gradient (margins fall 0.95→0.17 across tiers, win rates collapse at T8), no
  immortality. Crit is offense: it bounds fight LENGTH, not survival. No cap now; re-audit when
  `critDamage` gear/blessings exist (nobody authors critDamage today).
- **block** — Mordrek 62% / Brom 58% at L50. Same runaway *shape* as dodge but bounded impact:
  a proc removes only `BLOCK_FACTOR` (50%) of one hit, so worst case asymptotes at −50% damage,
  not invulnerability. Left uncapped for now; flagged for authoring guidance (block growth should
  stay modest) and a possible later cap if gear stacking pushes it past ~60%.
- **defense/resistance** — self-limiting by the DR curve (`def/(def+100)` is hyperbolic;
  even def 400 = 80%). No action.
- **armorPen** — self-limiting (`max(0, mitigation − pen)` can at most zero the target's
  mitigation). No action.
- **healthRegen** — fixed by ADR-0028. **healingPower/healingCrit** — bounded by the heal-target
  cap and threshold AI. No action.
- **speed (and haste)** — THE remaining runaway, now cleanly isolated: action rate is linear in
  speed with no cap, and it multiplies damage, threat, and (pre-0028) regen. Mordrek's 100% grid
  sweep survives the dodge cap because his authored +1 speed/level makes him a 580-DPS tank at L50
  (11× Brom's action rate); Dace/Lyra reach speed 110. This is NOT capped here — speed is a core
  reward-flagged stat and the fix is a design decision: authored-growth guidelines (speed growth
  rare/fractional) vs. engine diminishing returns on action rate. Escalated to Alex; queued.

**Evidence (`2026-07-10-dodge-cap` report vs `regen-cadence`, 500 seeds):**
- 18 pre-existing cells move >15pts, ALL downward and all dodge-stacked comps at overtier edges
  (`solo-dps` L50 T7 pack 83%→19%, T6 boss 89%→34%) — the cap bites exactly where dodge was
  carrying fights beyond the intended band.
- Party-wide anomalies stable: healer inversions 0, threat failure 1 marginal cell, cliffs ~82.
- Regression test: an 80-dodge party unit avoids ~25% of a long swing series (fails uncapped).

**Alternatives considered.** Diminishing-returns curve on dodge (WoW-style) — rejected for v1:
a hard cap is transparent to players and trivially explainable in the stat sheet; DR curves can
replace it later without schema changes. Capping enemies too — rejected (kills authored gimmicks).

**Consequences.**
- Stat-sheet UI should surface the cap (e.g. "Dodge 53% (capped 25%)") when it lands.
- Authoring: dodge growth/gear beyond ~25 total is wasted — rebalance Mordrek/Vex/Dace dodge
  growth in a content pass, or leave as flavor knowing the cap absorbs it.
- `mission-claim` picks this up on next deploy (no stored replays, no migration).

## ADR-0030 — Diminishing returns on speed above baseline (haste folds in pre-curve)
**Date:** 2026-07-10 · **Status:** Accepted (tuning loop iteration 7 — engine change; decided by Alex)

**Context.** Action rate was linear in speed with no ceiling — the last uncapped runaway channel.
Authored growth reaches speed 55–110 at L50 (5.5–11× baseline actions), multiplying damage and
threat; any future +speed/+haste gear or blessing node would stack on top linearly. Alex approved
engine-side diminishing returns over authoring guidelines (content-proof beats convention).

**Decision.** Effective speed saturates above the baseline; at or below baseline nothing changes:

```
raw = max(1, speed) × (1 + haste/100)      — haste folds in BEFORE the curve
eff = raw                                   (raw ≤ REF_SPEED)
eff = REF_SPEED + (raw − REF_SPEED) × K / (raw − REF_SPEED + K)   (raw > REF_SPEED)
COMBAT.SPEED_DR_K = 30                      — action rate asymptote = 4× baseline
```

Anchoring at `REF_SPEED` (10) means every enemy (template speed 10) and every slow unit keeps
exact v1 behavior — zero rebalance below baseline. K swept 20/30/50: grid metrics nearly identical
(mean win rate 0.581–0.590), so K=30 is chosen as the middle. At K=30: speed 55 → eff 28 (2.8×),
speed 110 → eff 33 (3.3×), asymptote 40 (4×). Speed stays a strong reward stat, just sublinear.

**Evidence + an honest correction (`2026-07-10-speed-dr` report vs `dodge-cap`):**
- The global effect is the intended gentle compression: grid mean win rate 0.607 → 0.585, no comp
  breaks, anomalies stable (healer inversions 0, threat 1 marginal cell).
- **Speed DR does NOT break Mordrek's L50 solo sweep (still ~100% all tiers)** — the earlier claim
  that speed carried it was incomplete. Even at 2.4× actions his kill speed (~250 DPS) beats T8 in
  ~35s while the full authored mitigation stack (53% armor DR + 25% capped dodge + 62% block +
  17 HP/s regen + 670 HP) drains only ~13 HP/s. No single engine knob is responsible anymore: the
  cause is AUTHORED STAT BREADTH — Mordrek uniquely has every defensive growth at once (9 growth
  entries vs the roster's 4–5). The remaining fix is a content rebalance of Mordrek's def in
  Sanity, not another engine cap. The engine-side guards (regen, dodge, speed, threat) are now all
  principled and closed.

**Alternatives considered.** Authoring guideline only — rejected by decision (any future author or
gear system re-opens the channel). Sqrt curve — rejected: silently buffs every sub-baseline unit.
Hard speed cap — rejected: kills speed as a growth stat instead of bending it.

**Consequences.**
- Speed/haste blessing nodes and gear affixes are now safely priceable — the curve bounds their
  worst case (4× actions) no matter how much content stacks.
- Stat sheet should eventually display effective action rate (the curve makes raw speed unreadable).
- `mission-claim` picks this up on next deploy (no stored replays, no migration).
- Queued content work: Mordrek authored-stat rebalance (drafts) — narrow his defensive growth
  spread; re-run the sweep to confirm the solo sweep breaks.

## ADR-0031 — Character point-buy budget + character rarity
**Date:** 2026-07-10 · **Status:** Accepted (decided by Alex)

**Context.** The roster was authored before any budget rules existed. A priced audit showed growth
spend ranging 4.6–16.5 points/level (Mordrek 16.5, roster median 7.3) — characters were incomparable
by construction, and the probe confirmed it (L50 solo ceilings: Mordrek T8 vs a healthy T3–T5 band
for 17 of 19). Alex wants: easy future authoring, clear stronger/weaker-at-different-things
identity, more interesting level-ups, and character rarity.

**Decision: a priced point-buy budget, set by rarity, enforced at authoring time.**
1. **Prices** (`STAT_PRICE`, `src/lib/characterBudget.ts`): each stat costs budget points per +1 —
   health 0.15, reference scalars 1, speed/haste/critDamage 1.5, block/regen/healingCrit 2,
   critChance 2.5, dodge 3, non-combat economy stats 0.5. First-pass values; the harness calibrates.
2. **Rarity** (new `characterDef.rarity`): Common/Uncommon/Rare/Epic/Legendary → base budget
   80/85/90/95/100 (level-1 spread) and growth budget 8/8.5/9/9.5/10 (per level). Tight band on
   purpose: ~25% growth spread, meaningful but never dominant. Budgets anchored to the authored
   roster's median under the price table so re-costing was nudges, not rewrites.
3. **Milestones** cost `bonus × price` amortized over the 49 level-ups — pre-paid spikes, not
   free stats. Tolerance ±0.5 on each budget.
4. **Enforcement where the mistake happens:** Sanity studio validation on `characterDef` sums the
   priced spend against the rarity budgets; `auditCharacter()` is the code-side mirror.
5. **Fractional `perLevel` is encouraged** (2.5 strength/level legal). The "10 points distributed
   each level-up" display Alex described is achieved later in UI: per-level integer gains derived
   from the fractional weights via deterministic largest-remainder rounding — a presentation
   layer over compute-on-read, no engine change now (deferred with the level-up UI).
6. **Whole roster re-costed** (all 19 drafts patched in Sanity) to their assigned rarities:
   Common ×6 (Gort, Nira, Rowan, Elia, Torvin, Fenn), Uncommon ×7 (Callum, Mira, Yenna, Dara, Oku,
   Lyra, Aldric), Rare ×5 (Brom, Vex, Sera, Tyla, Dace), Epic ×1 (Mordrek), Legendary ×0
   (headroom). Assignments provisional — content call, freely reshuffled.

**Alternatives considered.** Flat unpriced 10 points/level — rejected: HP-heavy characters starve
while percent-stat characters break (1 dodge/level was this week's degeneracy). Per-level authored
tables (49 rows/char) — rejected: brutal authoring for what deterministic rounding gives free.
Budget by role instead of rarity — rejected: rarity was wanted anyway and role already shapes the
SPEND; two overlapping budget dimensions would fight.

**Consequences.**
- New characters = fill a shopping cart; recruit #20 cannot accidentally be the next Mordrek.
- The roster probe band (docs/BALANCE.md) becomes the acceptance test for content changes.
- `roster.ts` harness fixture re-snapshotted; sweep re-run as evidence.
- Blessing trees and gear will add power ON TOP of budgeted baselines — re-audit prices when those
  layers exist (a +5 agility node is priced against these budgets).
- Character rarity surfaces to players (roster UI + /game-stats guide); acquisition design
  (which rarities cost what to recruit) remains open ([[project-undecided]]).

## ADR-0032 — Item rarity multiplier flattened (×16 → ×2.25 Legendary) + party size law
**Date:** 2026-07-10 · **Status:** Accepted (decided by Alex)

**Context.** ADR-0017's provisional gear multiplier doubled per rarity step (Common 1 → Legendary
16). Against the ADR-0031 character budgets that is upside-down: one Legendary item would out-value
a character's entire 49-level growth ladder, and gear would drown character identity. Alex's
direction: every tier should matter, Legendary should feel best *by some margin* — not ×16.

**Decision.** `RARITY_MULT` (src/lib/stats.ts) becomes **1 / 1.2 / 1.45 / 1.75 / 2.25** — steady
steps with the largest jump into Legendary (+0.5 vs +0.2–0.3 for earlier steps). Item stacking
(5 → next tier, ADR upgrading) keeps its meaning at every tier without any tier being a whole new
game. Values provisional like all constants: once itemDefs exist, geared probe comps enter the
sweep and calibrate.

**Also recorded — party size is the law:** missions take a party of **at most 3**; sending 1–2 is
allowed and simply forgoes the party bonus (+10%/member beyond the first, ADR-0017). The balance
harness, encounter shapes, and dispatch UI all assume 3 as the hard ceiling. If a future mode ever
wants more (e.g. ADR-0020 expeditions), that mode gets its own balance pass first.

**Consequences.**
- `mission-claim` picks up the new multipliers on next deploy; the 4 draft items' effective power
  drops at high rarities (no player owns any above Common today — no live impact).
- `itemStats.ts` display helper shows fractional bonuses (e.g. +17.5) — round in UI when item
  authoring starts.
- Player guide gear entry updated ("twice as strong per step" → flattened wording).

## ADR-0033 — Elemental damage schools + per-school enemy resistances
**Date:** 2026-07-11 · **Status:** Accepted (design: docs/ELEMENTS.md; decided by Alex)

**Context.** Enemy resistance was a single generic stat authored at 0 everywhere — magic ignored
mitigation entirely, and dispatch had no "who should I send against WHAT" decision. Alex wants
squad composition against an enemy's element to be a real choice, surfacing mid/late game.

**Decision.**
- **Schools registry** (`src/lib/schools.ts`, registry-driven per ADR-0004): `physical`, `magic`
  (the NEUTRAL school — deliberately plain-named, not "arcane"), `fire`, `ice`, `earth`, `wind`,
  `holy`, `shadow`. Healing is schoolless.
- **Resolution (v1 asymmetry):** party attacks carry a school — physical routing is always
  `physical` (vs enemy Defense); magic routing uses the character's authored `damageSchool`
  (neutral `magic` when blank). Against enemies, named schools check the enemy's per-school
  `resistances` (same DR curve as armor, K=100) and FALL BACK to generic Resistance when unlisted.
  Enemy attacks on the party are unchanged (physical→Defense, else→Resistance); character-side
  school resists arrive later as gear affixes, not base stats (keeps the sheet readable and the
  ADR-0031 budgets intact).
- **A school costs no budget points** — matchup axis, not raw power.
- **Tier-gated appearance** (Alex: mid/late game): template gives tiers 1–2 nothing; tiers 3–5
  put an own-school resist (100) on caster/boss archetypes; tiers 6+ broaden (own 120 + adjacent
  40; bosses also `magic` 40; tanks/basics small). Resist DR is level-independent, so flat values
  hold at every tier. Guideline: strong 100–150, weakness = unlisted (generic 0 → full damage),
  immunity ≥1000 for gimmicks. Target: right-vs-wrong school ≈ 30–50% damage swing.
- **Content:** schools authored on the six casters (Callum fire, Mira shadow, Aldric holy, Tyla
  wind, Yenna earth, Fenn earth; Lyra/Elia/Torvin neutral); Bone Colossus (T5 boss) gets
  shadow 120 / earth 60 / ice 40 with holy as its weakness; Rotting Ghoul (T1) stays clean.
- **Engine details:** `CombatEvent` gains an optional `school` (replay tinting later); enemy
  `damageType` widened to the school union ('magic' remains valid — no content migration needed).

**Evidence (`2026-07-11-schools` report vs `budget-recost`, 500 seeds).** Discriminating tests:
fire caster deals 100 vs no resist, 50 vs fire-100, 100 vs ice-100; neutral magic mitigated by
generic Resistance. Grid: only 4 cells move >15pts — matchup texture, not upheaval. All explained,
one worth recording: **resists couple into damage-based threat** — trio-casters L50 T7 pack
flipped 0%→100% because the fire resist LOWERED Callum's damage → lowered his threat → enemies
spread hits instead of executing him. In tankless comps, an enemy's resist profile changes who
gets focused. Emergent, legitimate, and exactly the kind of texture the system wants.

**Alternatives considered.** Rock-paper-scissors advantage table — rejected: authored matchups
give content freedom without system dogma. Character base resist stats now — rejected (v2 as gear
affixes). "Arcane" as the neutral school's name — rejected by Alex: it's just "magic".

**Consequences.**
- `mission-claim` GROQ + combatant mapping updated; **deploy AFTER the PR chain merges** (the CLI
  bundles src/lib from the working tree — deploying early would ship unmerged engine changes).
- UI surfaces are the required follow-up (mission resist pips + weakness icon, roster school
  badges) — without them the system is invisible to players.
- Enemy authoring: set a school + resistances from tier 3 up; leave early-game enemies clean.
- Blessing/gear layers can later add school-specific power ("+15% fire damage") — price when built.

## ADR-0034 — World maps: stage progression + boss gating

**Date:** 2026-07-13 · **Status:** Accepted (Alex) · **PRs:** #51 (schema/backend), #52 (UI), Wave-1 content in Sanity drafts

**Context.** Missions were a flat, ungated list. Alex wants a world structure: 6–9 maps with
different focuses and loot, each 6 stages of rising difficulty plus a stage-7 BOSS that is harder
but pays better, a map toggle on the Missions page, and clear per-mission reward/resistance
indication (the ADR-0033 resist line already provides the latter).

**Decision.**
- **Content model:** new `mapDef` (name / mapKey / **order** / description); `missionDef` gains a
  required `map` reference + `stage` (1–7, 7 = boss by convention). `order` drives both the toggle
  order and the unlock chain.
- **Progression state:** `profiles.map_progress` JSONB `{ mapKey: highestStageCleared }`
  (registry-JSONB, ADR-0004 — adding a map needs no migration). No client write path.
- **Unlock rules, enforced server-side (ADR-0003), mirrored client-side for display only:**
  stage playable iff `stage ≤ cleared + 1`; map playable iff first in order OR previous map's
  stage 7 cleared. Cleared stages stay replayable (farming). `start_mission` gates atomically
  in-transaction; `claim_mission` advances progress on a win via `greatest()` (replays never
  regress). Legacy missions without a map skip gating entirely (nullable params).
- **Trust boundary:** the Edge Functions resolve map/stage/previous-map from Sanity — the client
  is never trusted for placement. `mission-start` finds the previous map with an order-based GROQ
  subquery.
- **Map identity (authoring law, Alex 2026-07-13):** each map has a DOMINANT damage school, not a
  monoculture — ~4 of 7 stages carry the dominant resist, ~2 carry an off-school resist or
  physical-with-Defense, 1 early stage is resist-free. The boss leads with the dominant school +
  a secondary resist + one clear weakness (the Bone Colossus pattern). One counter-school clears
  ~70% of a map comfortably; full-clearing rewards adapting the squad per stage. Full authoring
  guideline in `docs/MAPS.md`.
- **Boss = stage 7:** encounter uses the `boss` archetype at +1 tier over stage 6, with bigger
  baseXp/gold and extra/better-weighted loot lines. UI gives boss cards a red treatment.

**Alternatives considered.** Dedicated `map_progress` table — rejected (JSONB on profiles matches
the wallet pattern and the claim RPC already writes profiles). All-maps-open — rejected by Alex
(boss kills as milestones). Level-based map unlocks — rejected (adds a second gating currency).

**Consequences.**
- Deploy after #51 merges: apply the migration, then CLI-deploy `mission-start` + `mission-claim`.
- `database.types.ts` was hand-updated for `map_progress`; regenerate after the migration applies.
- Wave-1 content = 3 maps (Gravemarch absorbs existing undead content with Bone Colossus as boss;
  fire + ice maps new); remaining maps follow once itemDefs give each map real loot identity.
- Loot "focus" per map is resources/gold/XP bands until itemDefs are authored — revisit then.

## ADR-0035 — Character traits: conditional identity modifiers, rarity-scaled

**Date:** 2026-07-14 · **Status:** Accepted (Alex; docs/TRAITS.md as amended) · **PRs:** #55 (design), #56 (core), #57 (wiring), UI branch pending

**Context.** Alex's design: characters carry innate traits that raise/lower mission success odds;
count scales with rarity (Common 1 → Legendary 5) so rare characters are valuable beyond their
stat budget. Constraint discovered at design time: success chance is the *output* of the
deterministic sim (ADR-0012/0013) — a literal "+5% win chance" dial would flip losses post-hoc,
breaking margin/replay/estimator honesty.

**Decision.**
- **A trait is a conditional stat bonus on the sim's INPUTS** — `condition {always | map |
  enemyArchetype | enemySchool | resource} + effects [{stat, kind flat|pct, value}]` targeting
  the ordinary registry. The "+5% success" experience emerges visibly through the dispatch
  estimator (PR #54), which runs the real engine.
- **Rarity buys COUNT, never size** (1/2/3/4/5); traits sit **outside** the ADR-0031 point-buy
  budget because conditional effects don't raise the always-on floor. Guardrail: max one
  always-on combat trait per character (review rule; studio validates the count exactly).
- **Registry additions:** `goldFind`, `xpGain`, `recoverySpeed` (priced 0.5). The five dormant
  economy stats (`missionSpeedDecrease, gatherSpeed, gatherYield, magicFind, luck`) become
  CONSUMED for the first time — traits are their first source; gear/blessings can grant the
  same stats later through the identical pipe (`effectiveStats` gained `extraBonuses`).
- **Stacking rules:** mission duration = party SUM of missionSpeedDecrease capped 30%;
  goldFind/magicFind/luck = party AVERAGE; xpGain self-only (Alex); recoverySpeed/gather self.
  Loot: magicFind scales per-drop chance (cap 100%), luck = chance of +1 quantity.
- **Consumption sites:** mission-claim (combat context = map + enemy archetypes/schools, economy
  hooks), mission-start (duration), gather-collect (accrue speed/yield params), infirmary
  (healState recoverySpeedPct — heal rate only, stabilize untouched), client roster (always-on
  bonuses) + estimator (context-matched, follow-up branch).
- **v1 exclusions (docs/TRAITS.md §9 defaults):** no party auras, no negative traits, no
  in-fight dynamic conditions, recruit-screen reveal deferred.
- **Content:** 19 traitDefs authored (Mapborn/Slayer/Warded/Stoneguard/Pathfinder/Goldtouched/
  Fortunate/Scholar/Prospector-family/Quickhand/Ironblood) + all 19 characters assigned per the
  rarity table, themed to kit (drafts).

**Alternatives considered.** Post-sim win-chance modifier — rejected (breaks the resolution
model). Trait effects as bespoke code hooks — rejected (registry-JSONB, ADR-0004). Rarity
scaling magnitude (Slayer I/II/III) — deferred, count-only for now.

**Consequences.**
- Deploy after #56/#57 merge: mission-claim, mission-start, gather-collect, infirmary-discharge,
  infirmary-upgrade.
- Stats-tab per-source breakdown (ADR-0022) does not yet show a "traits" source — follow-up.
- Balance: sweep regression run with the trait-free harness fixture (engine change must be
  inert); trait-aware probes land when the harness fixture gains traits.
- The estimator makes trait value visible as success-% movement — roster/dispatch UI chips are
  the remaining surface (branch 3).

## ADR-0036 — Enemy tier template v3: growth rate ×1.4 → ×1.25 per tier

**Date:** 2026-07-14 · **Status:** Superseded by ADR-0037 (same day — Alex reversed direction:
wants missions harder, not smoother; the cliff-smoothing goal here was the wrong fix)

**Context.** Alex hit a live-account case in the dispatch estimator: a 1-character party showed
0% estimated success on a mission; adding one more character jumped it straight to 100%, no
middle ground. Confirmed via the sweep (`scripts/balance/reports/2026-07-13-traits-regression.md`)
this is the same "difficulty cliff" anomaly ADR-0024 identified and left open (~78 cells at the
time, drifted to 117 in the current grid) — the enemy tier template's ×1.4^(tier−1) HP/attack/
defense growth (ADR-0024) is the documented real-content authoring target (`docs/MAPS.md`
§"Difficulty ramp"), not just a synthetic harness abstraction: the one real enemy with checkable
numbers, the seeded Rotting Ghoul, matches the template's T1 base exactly. Root cause: the sim's
only RNG is per-hit crit/dodge/block, which averages out over a full fight (law of large
numbers), so outcome is close to deterministic per party+encounter — whatever nudges the
DPS-race threshold (a tier step, a party-size step) flips the whole 200-seed sample from
all-loss to all-win.

**Decision.** Reduce the tier template's per-tier growth rate from ×1.4 to **×1.25**
(`scripts/balance/enemies.ts` `TIER_GROWTH`). HP/attack/defense still compound per tier; speed
stays flat (ADR-0024, unchanged). Archetype mods and tier-gated resistances (ADR-0033) are
unaffected — the cliff reproduces on the plain `basic` archetype at zero-mod tiers, so the
per-tier exponent alone is the responsible constant.

**Evidence (before → after, `2026-07-14-pre-tier-curve` → `2026-07-14-tier-1.25`, same
633,600-fight grid; candidate ×1.3 also swept and rejected — see Alternatives):**
- Difficulty cliffs: 117 → 64 flagged cells.
- Healer inversions: 0 → 0 (the ×1.3 candidate introduced 2 marginal inversions at the edge of
  viability; ×1.25 stays clean).
- Threat failure / timeout-heavy / clock-bound: 1 / 1 / 1 in both — no new regressions.
- Frontier example (solo-tank, L1): T1 100% → T2 **0%** (baseline) vs. T1 100% → T2 **31%**
  (×1.25) — a real chance instead of a wall. Frontier example (solo-crit, L50): T7 100% → T8
  **4%** (baseline, near-impossible) vs. T7 100% → T8 **75%** (×1.25, a genuine risk/reward
  fight instead of a coin-flip-adjacent wipe).
- Off-frontier combos (a party far below a tier's intended level) get easier too — e.g. a level-10
  trio now clears tier 8 at ×1.25 where it couldn't at ×1.4. Not a regression in practice: the
  world-map system (ADR-0034) gates tier access by sequential stage/map unlock, so a level-10
  party can never actually stand in front of tier-8 content; an over-leveled party trivializing
  old content it has since outgrown is the intended "go back and farm an easier fight" behavior
  (`src/pages/gameStatsContent.ts`), not new. Full trio comps were already ~100% across every
  tier at L50 under the OLD ×1.4 template too (pre-existing "trio endgame dominance," a separate,
  out-of-scope anomaly from this cliff fix).

**Alternatives considered.**
- **×1.3** — swept: cliffs 117 → 83 (worse than ×1.25) and introduced 2 healer inversions.
  Rejected: strictly dominated by ×1.25 on both measured anomaly axes.
- **Add real combat variance** (wider crit/dodge dispersion, HP variance) to break the
  near-deterministic-outcome root cause directly — rejected for this pass: touches ADR-0013's
  sim shape, invalidates every prior tuning ADR's sweep evidence, needs a full re-sweep of
  everything. Bigger, riskier change; deferred.
- **Leave the sim alone, fix the UI signal instead** — rejected: doesn't address that a
  legitimately-geared solo character gets zero real chance at content one tier above them; the
  UI already shows the true number faithfully (WinChanceEstimate), the number itself was wrong.

**Consequences.**
- `scripts/balance/enemies.ts` `TIER_GROWTH = 1.25`; `docs/MAPS.md` §"Difficulty ramp" updated
  to match. ADR-0015 §G / ADR-0024 are superseded on the growth-rate value only (speed-flat and
  archetype mods stand).
- **Scope boundary (deliberate):** this changes the code-side template — the *authoring
  guideline* and the harness that validates it — not the already-authored `enemyDef` documents
  for the three live maps (Gravemarch/Embercrag/Frosthollow, 21 missions) in hosted Sanity.
  Those were hand-authored against the old ×1.4 guideline and are not retroactively edited here.
  Retuning them to ×1.25 is an explicit follow-up task.
- `src/lib/combat.ts` (the real combat engine mission-claim executes) is untouched — this is an
  enemy-content-curve change, not a combat-math change.

## ADR-0037 — Enemy tier template v4: growth rate ×1.25 → ×1.8 per tier (reverses ADR-0036)

**Date:** 2026-07-14 · **Status:** Accepted (Alex)

**Context.** Same day as ADR-0036: after seeing the smoothed curve, Alex reversed direction —
wants missions **harder**, not smoother. The cliff Alex originally reported was a real bug
(0% for a solo party, no risk/reward gradient), but the fix Alex actually wants is a difficulty
increase, with one hard constraint: the first mission must always be clearable by any level-1
character, solo.

**Decision.** Raise `TIER_GROWTH` (`scripts/balance/enemies.ts`) from 1.25 to **1.8** — steeper
than the original ADR-0024 value (1.4), a deliberate net difficulty increase over both prior
templates. Cliffs above tier 1 are back and larger than the original baseline; that is the
intended tradeoff, not a defect (contrast with ADR-0036, where cliffs were the problem being
solved).

**The tier-1 guarantee.** The template's scale factor is `TIER_GROWTH ** (tier − 1)`, so **tier 1
is always exactly the base stats (120 HP / 12 atk / 5 def) regardless of the growth rate** —
this constraint holds automatically for any `TIER_GROWTH` value, including 1.8. Verified beyond
the algebra: ran all 19 roster characters solo (`scripts/balance/roster.ts`, level 1, 200 seeds
each) against a tier-1 `basic` enemy. 16 of 19 win 100%. **Three do not, and never did — this is
pre-existing and unrelated to tier growth**: Yenna Stonecall, Aldric Faithward, and Tyla
Windcarrier (0% each) — all three are pure-healer specs (high healingPower, minimal attack) whose
solo damage output is too low to kill a tier-1 enemy before it kills them, a healer-role gap in
`src/lib/combat.ts`'s solo damage math, not a tier-content problem. **Flagged for Alex, not fixed
here** — out of scope for a tier-curve change; if these three are reachable as a player's only
level-1 character (e.g. a future starter pick), this needs its own fix (healer base attack,
solo AI behavior, or excluding them from starter eligibility).

**Evidence (`2026-07-14-tier-1.25` → `2026-07-14-tier-1.8`, same 633,600-fight grid):**
- Difficulty cliffs: 64 → 156 flagged cells (higher than the original ADR-0024 baseline of 117 —
  expected and intended, since 1.8 > 1.4 > 1.25).
- Healer inversions: 0 → 1 (mild, one marginal cell).
- Threat failure / timeout-heavy / clock-bound: 1 / 1 / 1, unchanged.
- Endgame note: at L50, tier 8 drops to ~0% win rate for nearly every comp including full trios
  (naked baseline — no gear/blessings, which aren't modeled in this sweep). Under the old 1.4
  template, L50 trios cleared tier 8 at ~100% (ADR-0024's own "content headroom" note). At 1.8,
  tier 8 is no longer cleared by anyone in the naked-stat sweep — real players will have gear and
  blessings closing some of that gap, but this is a meaningfully harder ceiling than either prior
  template and worth watching once itemization is authored.

**Consequences.**
- `scripts/balance/enemies.ts` `TIER_GROWTH = 1.8`; `docs/MAPS.md` §"Difficulty ramp" updated to
  match, plus an explicit note that tier 1 is invariant to this constant by construction.
  ADR-0036 is superseded (same day, never shipped past this branch).
- Same scope boundary as ADR-0036: this is the code-side template/guideline only. The 21 live
  missions' already-authored Sanity `enemyDef` content (against the old ×1.4 guideline) is not
  retroactively edited — still an explicit follow-up.
- **Follow-up completed same day:** queried all 15 `enemyDef`s the 21 live missions reference
  (`production` dataset, drafts perspective) — 14 of 15 matched the old ×1.4 formula almost
  exactly (confirming `docs/MAPS.md`'s authoring checklist was actually followed), so recomputing
  health/attack/defense from each enemy's existing `tier` + `archetype` under ×1.8 was mechanical.
  Patched via `patch_documents` (drafts only, nothing published) — Rotting Ghoul and Bone Swarm
  (tier 1) untouched by construction; the other 13 updated. One judgment call: Bone Colossus's
  defense was hand-tuned to 10 against the old formula's 7 — reset to the new formula's clean
  value (9) rather than preserving the old +3 offset (Alex's call, easily bumped back up in
  Sanity if the boss should stay tankier than template). Speed/damageType/resistances/block/etc.
  on every enemy are untouched — only the three tier-driven fields moved.
- **New follow-up surfaced:** the 3 pure-healer characters that can't solo-clear tier 1 at all.
  Needs a decision from Alex on whether/how to fix (see above) before onboarding depends on it.
- `src/lib/combat.ts` untouched — still a content-curve change, not a combat-math change.

## ADR-0038 — Per-fight stat rolls: combat outcomes become probabilistic in the contested band

**Date:** 2026-07-14 · **Status:** Accepted (Alex)

**Context.** Alex wants real 60/40 moments — fights where the player weighs pushing a risky
stage against farming the previous one — and "some competition… so that the user needs to make
some tactical changes". The sim couldn't produce them: its only randomness is per-HIT crit/
dodge/block, which averages out over a fight's hundreds of hits, so a given party vs a given
encounter resolves to ~0% or ~100% with a razor-thin transition. The tier-curve work
(ADR-0036/0037) moved WHERE the cliff sits but structurally could not turn a cliff into a
slope — that needs fight-level variance, which no curve constant provides.

**Decision.** Each fight draws per-unit rolls from the existing seeded rng before the timeline
starts (`src/lib/combat.ts` `simulateCombat`): every party member's attack power rolls uniformly
within ±`PARTY_POWER_ROLL` (10%), every enemy's max HP and attack roll independently within
±`ENEMY_STAT_ROLL` (12%). Alex explicitly wanted the player side rolled too ("the attack value
is a span instead of a set value") — and chose to SHOW it: attack-type stats (attack,
spellPower) render as their per-fight range (e.g. "45–55") via `src/lib/powerSpan.ts` in the
stat sheet (`CharacterStats`), with the roll noted in the breakdown tooltip. Healing power does
not roll; party HP never rolls (it's persistent, carried between missions); enemy HP re-rolls
freshly each run (enemies are ephemeral).

Determinism is preserved: rolls come from the run-seed rng in fixed unit order, so the same
seed still replays identically, and the dispatch estimator — which runs this same function over
200 seeds — surfaces the resulting distribution automatically, with zero estimator changes.

**Evidence** (`2026-07-14-tier-1.8` → `2026-07-14-variance-rolls`, 633,600-fight grid, new
"middle band" metric = cells with 10–90% win at 180s):
- Middle band: 29 → 51 cells; difficulty cliffs 156 → 134. Grid granularity (6 level samples)
  understates the effect — per continuous level the transition now spans several levels, e.g.
  trio-core T4 solo reads L1 0% / L5 52% / L10 100% instead of snapping 0→100.
- Discriminating regression test: a marginal fight (kill time ≈ time limit) over 100 seeds must
  produce BOTH outcomes; verified 22/100 wins with rolls, 0/100 with rolls zeroed.
- Three engine tests that pinned exact hit damage were converted to ratio/band assertions
  (mitigation ratios are roll-invariant under a shared seed); the traits Mapborn pair became a
  win-rate comparison (on-map must beat off-map by >25pts over 200 seeds).

**Alternatives considered.** Widening per-hit variance (bigger/rarer crits): converges anyway
over long fights, weaker effect per point of swing, and reshapes the crit stat's value — kept
as a possible later knob. Per-run rolls on ALL stats: defense/speed feed DR curves and interval
math, adding noise without widening the band much; attack+HP are the two levers that decide
races. Estimator-side fuzzing only (fake a band in the UI): dishonest — the shown probability
must be the real one.

**Consequences.** `mission-claim` must be redeployed for the hosted sim to roll (until then,
client estimates include rolls the server doesn't make — deploy immediately after merge). The
±12% enemy roll means authored enemy stats are now bands in practice; MAPS.md authoring numbers
stay the roll midpoints. Player guide ("How Combat Works") updated. Constants are sweep-tunable
(`COMBAT.PARTY_POWER_ROLL` / `COMBAT.ENEMY_STAT_ROLL`) — future span changes are re-sweep +
constant bumps, and the UI span display follows automatically.

## ADR-0039 — Boss spike attacks: periodic threat-ignoring heavy hits

**Date:** 2026-07-14 · **Status:** Accepted (Alex)

**Context.** Same session as ADR-0038. With threat working (ADR-0027), a tank + sustain party
reduces most boss fights to a DPS race against the clock — the boss's damage all lands on the
tank, so party composition barely matters once the tank holds. Bosses need a mechanic that asks
a comp question the tank alone can't answer, and turtle comps that stall fights out (flagged
timeout-heavy in every sweep since the baseline) need pressure that scales with fight length.

**Decision.** New authored enemy capability: `spikeEverySeconds` + `spikeMultiplier` (both
required to arm). Every `spikeEverySeconds` of combat time, the enemy's next action becomes a
spike — `attack × spikeMultiplier` aimed at a **uniformly random living party member**,
ignoring threat entirely. Dodge, crit, armor DR, and block all still apply (defensive stats are
the counterplay), the first spike lands one full period in (no opening one-shots before threat
exists), and a slow actor can't bank multiple missed spikes. Logged as a distinct `'spike'`
event type so replay UIs and the sweep's tank-absorption metric (which counts only
'attack'/'dodge') tell them apart — absorption correctly measures threat-respecting hits only.

Boss standard: **every 20s, ×2.5** — set in the harness template (`scripts/balance/enemies.ts`
boss archetype) and patched onto the 3 live boss drafts (Bone Colossus, The Ember Tyrant, The
Frost Monarch). Plumbed end-to-end: enemyDef schema (studio) → mission-claim GROQ/mapping →
services/missions.ts → winChance estimator, so the dispatch estimate prices spikes in.

**Evidence** (`2026-07-14-variance-rolls` → `2026-07-14-variance-full`):
- Timeout-heavy cells 20 → 4: spikes end turtle stalls — sustained fights now accumulate real
  damage pressure instead of stabilizing forever. The survivors are duo-tank-heal boss grinds,
  much reduced.
- Middle band 51 → 54 (boss shape 23 → 26); cliffs 134 → 130.
- One new healer inversion (L50 T5 boss: trio-core 84% vs trio-double-dps 100%): overleveled
  double-dps kills the boss before enough spikes land — "kill it fast" is a legitimate spike
  answer, accepted as exactly the comp-choice texture this mechanic exists to create. Watch it
  doesn't spread to on-level cells in future sweeps.
- Engine tests: spikes outdamage the same boss's normal hits, land on non-tank members, respect
  the period count, and never fire when unauthored.

**Consequences.** Boss fights now have failure variance even for tank comps — margins (and
infirmary load) on boss stages are spikier by design, which feeds the 60/40 push-or-farm
decision on stage 7. Authored bosses should carry the standard 20s/×2.5 unless deliberately
tuned (MAPS.md law follows in the rhythm-law branch). The estimator needs no changes; hosted
parity again requires the mission-claim redeploy. Swarm/caster archetypes stay spike-free —
spikes are the BOSS comp-counter (swarm = race, caster = armor bypass).

## ADR-0040 — Harness power tiers + the per-map power budget

**Date:** 2026-07-14 · **Status:** Accepted (Alex)

**Context.** Every sweep to date ran the roster NAKED — level-derived stats only, no gear, no
traits, no blessings — so every endgame conclusion (e.g. "T8 at L50 is ~0% for all comps") was
measured against a party no real player will field. With 7+ maps planned (ADR-0034 says 6–9) and
Alex's explicit direction that the last map SHOULD demand a full farm and good blessings, the
harness needed to answer: does the ×1.8 tier curve (ADR-0037) actually hold once the player has
the bonus layers — and if not, what multiplier must those layers deliver?

**Decision.** The sweep grid gains a **power-tier axis**: party stats × naked 1.0 / geared 1.35 /
full-build 1.9, every stat except speed (a speed multiplier would compound with the attack
multiplier through the action-rate channel and overstate the tier). The multipliers are declared
PROXIES for unauthored content, to be re-derived from real itemDefs/blessing trees when those
exist. Comparability is protected: matrices, anomaly rules, and the middle-band metric read the
naked slice only, and the seed formula excludes the power key, so the naked numbers are
byte-comparable with every prior report (verified: 54 middle-band / 130 cliffs, identical to
`variance-full`). The report gains a "Power tiers" section (trio-core × boss shape, the gating
fight) + a one-line verdict; `docs/BALANCE.md` gains the **power budget per map** table.

**Evidence** (`2026-07-14-power-tiers`, 1.9M fights). Highest boss tier at ≥70% win by L50:
naked T5, geared T5, full-build **T6**. Full-build L50 vs T7 boss = 11%, vs T8 = 0%. Each tier
step costs ×1.8 of party stats, so ×1.35 buys about half a step and ×1.9 almost exactly one.
Read against the map chain (map m's boss = tier m+1): maps 1–5 work on levels + the proxy
multipliers; **map 6's boss needs ~×3.4 combined gear+blessings over naked, map 7's needs ~×6.**

**Consequences.** The authoring budget is now a recorded requirement, not a guess: itemDef stat
budgets + blessing trees should be authored toward a combined ~×5–6 at the level cap (Alex's
stated intent — the last map demands everything), with the fallbacks named in BALANCE.md if that
proves too steep in play (taper tier growth above T6, or gate maps 6–7 behind transcendence).
No engine or constant changes in this branch — instrument + reference table only. Grid is 3×
bigger (~16s at 200 seeds); doc runtime figures updated. Re-run the reality-check column after
real gear/blessing content exists.

## ADR-0041 — First-clear bonus: ×1.5 XP/gold/resources the first time a stage is beaten

**Date:** 2026-07-14 · **Status:** Accepted (Alex — multiplier chosen ×1.5 over ×2/×3)

**Context.** The tension loop (ADR-0038/0039 + the MAPS.md rhythm law) asks the player to choose
between pushing a risky new stage and farming cleared ones. Farming already has clear payoffs
(loot, XP, safe margins); pushing needed its own — otherwise the rational move at a 60% boss is
always "farm until it's 95%", which flattens the decision the whole package exists to create.

**Decision.** The first time a player clears a map stage, the win's XP, gold, and resource
payouts are multiplied ×1.5 (`FIRST_CLEAR_MULT`, mission-claim). Loot drop chances/quantities
are untouched — item farming stays a repeat-clear activity by design. Detection is a pre-claim
read of `profiles.map_progress` in the Edge Function (`stage > best cleared` on a win); the
`claim_mission` RPC is unchanged — its `greatest()` write stays the atomic authority and the
double-claim guard already blocks re-claiming the same run. (Two concurrent claims of two
DIFFERENT runs of the same not-yet-cleared stage could in principle both price as first clears —
a benign, vanishingly rare double-bonus, consciously accepted over widening the RPC.) The claim
response gains `firstClear: boolean`; the ClaimReward "how it was calculated" trail shows it as
a +50% line, and the /game-stats Rewards section documents it.

**Consequences.** Pushing new content is rewarded once per stage per player; walls become "get
better items or levels" moments rather than pure stat checks (the farm loop and the push loop
pay differently, matching Alex's framing). Legacy missions without map/stage are unaffected
(flag is always false). `mission-claim` redeploy required. If transcendence later resets
`map_progress`, first-clear bonuses come back with it — price that into the transcendence design
when it lands.

## ADR-0042 — Combat trait wave 2: archetype counters + future-school wards (content only)

**Date:** 2026-07-14 · **Status:** Accepted (Alex — part of the combat-tension queue)

**Context.** The trait system (ADR-0035) already ships `enemySchool`/`enemyArchetype` conditions
fully wired through the engine, mission-claim, the estimator, and the dispatch chips — no code
was needed for combat traits, only content. Wave 1 leaned economy; the combat-conditional set
had gaps that the new mechanics made visible: Flamewalker (fire resist) existed but was assigned
to NOBODY (dead content on the live fire map), no trait countered the tank archetype (the
MAPS.md clock-check), nothing answered boss spikes defensively (ADR-0039), healers had no
boss-fight identity, and the three future map schools (earth/wind/holy, waves 2+) had no wards.

**Decision.** Six new traitDefs (drafts only), priced to the wave-1 scale (±12–15% pct / flat 40
resist / flat 25 armorPen ≈ the flat-40-resist power band):
- **Wallbreaker** — vs tank archetype: +25 armorPen (the clock-check counter).
- **Bulwark** — vs boss: +12% defense & +12% resistance (the spike counter, tank identity).
- **Vigilkeeper** — vs boss: +15% healingPower (healer boss identity).
- **Earthward / Galeward / Lightward** — flat 40 resistance vs earth/wind/holy (inert until
  wave-2+ maps; authored now so map authoring won't need a trait session).

Seven assignment swaps, keeping every character exactly at their ADR-0035 rarity cap (C1/U2/R3/
E4) and every wave-1 trait with at least one holder: Dara swarmbane→flamewalker · Tyla
ironblood+scholar→flamewalker+vigilkeeper (full combat-healer identity) · Aldric
ironblood→vigilkeeper · Vex goldtouched→wallbreaker · Sera pathfinder→wallbreaker · Brom
giantslayer→bulwark (defensive tank, giantslayer stays on Mordrek/Vex) · Mordrek
spellbreaker→bulwark (spellbreaker stays on Callum).

**Coverage after the wave (per live map, "active trait chips on dispatch"):** Gravemarch —
shadowward ×4, gravehand ×3, stoneguard ×2, bulwark ×2, giantslayer ×2, vigilkeeper ×2.
Embercrag — flamewalker ×2 (was 0), cragborn ×2, spellbreaker ×1, plus the boss set. Frosthollow
— frostblood ×2, rimeborn ×2, plus the boss set. Tank-archetype stages (Grave Warden, Magma
Brute, Glacier Golem) — wallbreaker ×2, a counter that didn't exist.

**Consequences.** Pure Sanity-drafts content — no code, no deploys (mission-claim and the
estimator resolve traits per claim/estimate from the drafts). Dispatch chips light up per
mission automatically. Economy traits lost in the swaps (scholar/ironblood/goldtouched/
pathfinder instances) were deliberate: combat-role characters trade utility for combat identity;
each of those traits still exists on economy-leaning characters. Rebalance freely in Studio —
these are drafts, and trait swaps carry no schema or budget migration.

## ADR-0043 — Item level-requirement gate: rarity-scaled equip gating

**Date:** 2026-07-15 · **Status:** Accepted (Alex — added while scoping the itemDef content wave)

**Context.** Gear equip (ADR-0022) enforces ownership/busy/stack/slot-compatibility but nothing
about the character's level — a level-1 character could equip a Legendary the moment one entered
inventory. With the itemDef wave about to introduce Epic/Legendary drops for the first time
(previously dead tiers — nothing had ever rolled above Rare), this stopped being theoretical:
Alex asked for a level floor "so that really low level characters cant just equip legendaries."

**Decision.** Each itemDef authors an optional `minLevel` — the level required to equip it at
**Common** rarity (absent/0 = no restriction, keeping pre-wave items backward compatible). A
rarer roll of the same item adds a flat step on top, via a new shared, framework-agnostic helper
(`src/lib/equipment.ts`, imported by both the client picker and the gear-equip Edge Function —
same "one function, both sides" precedent as `effectiveStats`):

```
LEVEL_REQ_STEP_BY_RARITY = { Common: 0, Uncommon: 2, Rare: 5, Epic: 9, Legendary: 14 }
requiredLevelForRarity(minLevel, rarity) = minLevel + LEVEL_REQ_STEP_BY_RARITY[rarity]
```

Flat, not proportional to `RARITY_MULT` (1/1.2/1.45/1.75/2.25) — a proportional ladder would let
an early map's Legendary roll gate *higher* than a later map's Common item once `minLevel` grows
across maps; the flat step keeps the ladder well-behaved (worked check across the 3 live maps'
`minLevel` anchors ≈1/6/12: Gravemarch Legendary → 15, Embercrag → 20, Frosthollow → 26, strictly
increasing).

The check is split exactly like the existing slot-compatibility check (ADR-0022): the
Sanity-dependent half (reading `minLevel`, computing `requiredLevel`) lives in the `gear-equip`
Edge Function; the structural half (comparing against the character's actual `level`) is
enforced **inside** the `equip_item` RPC's existing row-locked transaction (migration
`20260715120000_item_level_requirement.sql` — the RPC gained a `p_required_level` parameter and
now selects `level` alongside `equipped`, raising `'equip_item: character level too low'` if it's
short). Doing the numeric comparison inside the same lock the ownership check already takes
closes any TOCTOU gap between "check" and "equip." The client (`SlotPickerModal`) computes the
same number to greet the player with a disabled tile + "Req. Lvl X" instead of a round-trip 409,
but the server check is the actual authority (ADR-0003).

**Consequences.** Epic/Legendary drops are no longer usable the instant they drop for an
under-leveled character — they become a "grow into it" reward instead of an instant power spike.
`unequip_item` is untouched (removing gear never needs a level check). One accepted edge case,
not solved now: transcendence resets a character's level to 1 but keeps the character (and its
`equipped` JSONB) — a freshly-transcended character keeps whatever was equipped pre-reset, since
the gate only fires at equip time, not retroactively. This matches how prestige systems usually
work (you keep gear, you regrind levels) and transcendence itself isn't built yet; revisit if it
proves wrong once it is. Migration drops and recreates `equip_item` (adding a parameter changes
the signature) — `gear-equip` Edge Function redeploy required alongside it.

## ADR-0044 — ItemDef content wave 1: 23 items closing the slot gap on the 3 live maps

**Date:** 2026-07-15 · **Status:** Accepted (Alex — requested level-gating, map flavor, and a
replicable methodology doc alongside the content ask)

**Context.** Only 4 itemDefs existed (PR #21 test fixtures), covering 4 of 10 slot types — head,
shoulders, hands, legs, feet, and offhand had zero items, so those equip slots were dead on every
character sheet. All 21 live missions looted only those same 4 items, and rarity never rolled
above Rare anywhere, leaving `RARITY_MULT`'s Epic/Legendary tiers wired but unused. ADR-0040
named map 3 (Frosthollow, T4 boss) "the first real gear check," expecting the harness's `geared
×1.35` proxy — a number this wave needed to actually deliver via real content, not a guess.

**Decision.** 19 new itemDefs (+ the 4 existing, backfilled with `minLevel: 1` = 23 total):
- **Universal fill (6 items, Gravemarch-tagged):** one item per empty slot type (head/shoulders/
  hands/legs/feet/offhand), health-primary, `minLevel` 1–4.
- **Per-map build-defining sets:** Gravemarch +3 (weapon/ring/trinket), Embercrag +5 (adds
  offhand + chest), Frosthollow +5 — each map's weapon/offhand/chest/ring/trinket sized to that
  map's expected level band (docs/BALANCE.md), with a consistent slot-to-stat lane (weapon =
  attack, offhand = defense, chest = health + small defense, the other 5 armor slots = health
  only, ring = light offense/defense utility, trinket = spellPower/healingPower `pct`) so the
  same stat doesn't get re-stacked across many slots.
- **Rarity ceiling extended:** Gravemarch's boss (Bone Colossus) now reaches Epic (low weight),
  Embercrag's (Ember Tyrant) reaches Epic (moderate weight), and Frosthollow's (Frost Monarch)
  introduces the game's **first Legendary drops** (frostplate-hauberk, glacial-greatsword) —
  matching its framing as the current endgame's reward.
- **Verified, not guessed:** a throwaway calc script (`effectiveStats`/`collectGearBonuses` from
  `src/lib/stats.ts` directly — the real engine, not a reimplementation) checked a full 14-slot
  Rare-average loadout against real L20 characters. Result: physical DPS (Vex) +32.2% attack,
  tank (Brom) +42.6% defense, caster (Mira) +23.2% spellPower, healer (Tyla) +23.2%
  healingPower — landing near the +30–40% target for physical/tank; casters/healers land lower
  because wave 1's `weapon` lane is attack-only (no dedicated magic-implement slot yet) and their
  only itemization is the trinket lane. Accepted as a scoped v1 limitation, not silently missed —
  logged as a TODO ("caster/healer weapon-equivalent itemization").
- An early draft put a small `defense` bonus on nearly every armor slot; because a character
  wears 14 slots at once, this compounded to +105% defense for the tank before the calc script
  caught it. Fixed by concentrating defense into two lanes (offhand primary, chest secondary)
  instead of spreading it thin across six. Documented in docs/ITEMS.md as the wave's main lesson.
- **Level-cap ceiling identified (not yet binding):** with the ADR-0043 flat +14 Legendary step
  and a level cap of 50, any future itemDef's `minLevel` must stay ≤36 or its Legendary roll
  becomes permanently unequippable. Wave 1's anchors (1–15) are safely clear of this; recorded in
  docs/ITEMS.md so map 5+ authoring doesn't walk into it blind.
- **`docs/ITEMS.md`** (new) captures the full methodology — slot system, the level-requirement
  formula, the universal-fill/per-map pattern, the stat-lane table, the sizing/verification
  method, the loot-wiring weak-reference gotcha, and a checklist for the next map's item wave —
  so this is replicable without re-deriving it from scratch.

**Consequences.** Every one of the 14 equip slots now has at least one real item; the 21 live
missions' loot tables were rewired to introduce them (existing `dropChance`/`rarityWeights`
pacing preserved, only `itemKey` targets and rarity ceilings changed). Two follow-up TODOs
recorded rather than solved here: an `itemBudget.ts` power-budget validator (analogous to
`characterBudget.ts` — items are still authored free-form, no cap) and item flavor text (every
`description` field ships blank this wave). Maps 4–7 extend the same pattern per docs/ITEMS.md,
not from scratch.

## ADR-0045 — Blessing tree redesign: 4-row/2-choice + earned capstone

**Date:** 2026-07-15 · **Status:** Accepted (Alex — replaces the earlier WoW-Classic-style design)

**Context.** The blessing system was scaffolded (Sanity `blessingNode`/`nodeEffect`, DB
`player_characters.blessings jsonb`, `stats.ts`'s `collectBlessingBonuses`) for a 7-row WoW-Classic
tree: variable nodes per row, ranks 1–5, tier-unlock via 5-points-spent-above, prerequisite arrows.
`BlessingsPage.tsx` was a full interactive mock of that shape with no backend — like Team/Crafting/
Mines before they were wired up. No Edge Function ever wrote to `blessings`; the read/compute side
(`effectiveStats`, the Team page's stat-breakdown tooltip) was live but always saw zero allocations.

Alex redesigned the mechanic before wiring it up: **4 rows, 2 mutually-exclusive choices per row,
one capstone at the end** — simpler than the 7-row/ranked/prereq-web original, and a better fit
for "trees must change how a character plays" (the still-open TODO item this closes): a strict
either/or fork per row is a real playstyle decision in a way a multi-rank point-spend isn't.

**Decision.**
- **Structure.** Exactly 4 rows per character, exactly 2 choices per row, pick one, **permanent**
  (no respec in v1 — logged as a TODO, not built now). Row *N* unlocks at character level *N*×10
  (10/20/30/40) **and** only after row *N*-1 is already picked — enforced server-side (not just a
  UI convention) by a new `choose_blessing` RPC that mirrors `equip_item`'s row-lock/busy-check/
  raise pattern (`supabase/migrations/20260715130000_blessing_choose.sql`,
  `supabase/functions/blessing-choose/`): lock the character row, check level, check the previous
  row is already set, check this row ISN'T already set (the immutability guard — permanence must
  be a server rule, ADR-0003, not a client-only nicety), check busy state (mission/gather/
  infirmary — the same exploit gear-locking already prevents: picking mid-mission could otherwise
  buff an in-flight claim), write, return. **Unlike gear, this RPC needs no Sanity fetch at all** —
  row/choice validity and the level ladder are fixed engine constants (`src/lib/blessings.ts`
  `BLESSING_ROW_LEVELS`), not authored content, so they're hardcoded in SQL exactly like gear's own
  slot-key enum already is.
- **Capstone is computed, never written.** Earning it needs no player choice and no RPC call: it's
  fully determined by `level >= 50 AND row4 already picked` (`capstoneEarned`,
  `src/lib/blessings.ts`) — both already-durable facts. Per ADR-0002 (compute-on-read), this
  removes an entire write path, the "how do we stop double-granting it" question, and the "one RPC
  or two" ambiguity that a naive "5th pickable row" design would have introduced.
- **Three capstone flavors, all schema-supported now:** flat stat bonus, conditional stat bonus
  (reuses `traits.ts`'s `TraitCondition`/`traitActive` verbatim — a capstone is evaluated as a
  one-element trait list, `resolveCapstoneBonuses`), and a scripted combat ability. The first two
  resolve entirely in `stats.ts`/`traits.ts` before `combat.ts` ever runs — a real architectural
  seam, not a scoping convenience — so they ship in this branch. The **ability** flavor needs new
  `combat.ts` engine surface (a small fixed vocabulary — `surviveFatal`, `partyBuffOnStart` — same
  hardcoded-mechanic precedent as the boss spike attack, not a generic event system) and ships in
  a follow-up branch; a character authored with `kind: 'ability'` grants no stat bonus until then
  (`resolveCapstoneBonuses` returns `{}` for that kind on purpose).
- **Pricing stays flat across rarity.** Both choices in a row must cost the same under
  `characterBudget.ts`'s `STAT_PRICE` (a new `flatEffectsCost` helper + a studio-time validator on
  `blessingRow` enforce this for `flat`-kind effects; a `pct` effect can't be priced the same way —
  it scales with the character's own baseline — so a row using one relies on the Phase C
  calc-script check instead, same as the itemDef wave's verification method). This closes the
  standing TODO question ("decide tree budget size when authoring the first tree"): unlike traits
  (rarity scales *count*, 1→5) or base stats (rarity scales *budget size*, 80→100), blessing row
  *count* is fixed at 4 for every character — the only remaining lever would be per-row magnitude,
  and keeping that flat matches ADR-0040's single flat "~×5–6 combined gear+blessings at the level
  cap" target rather than a rarity-keyed one.
- **Schema rework**, all inline objects nested on `characterDef` (no shared registry — a blessing
  tree stays bespoke per character, ADR-0001, unlike traits which reference a shared `traitDef`
  document): `blessingChoice` (`choiceId`, `title`, `description` — authored now, unlike items'
  deferred flavor text, since bespoke identity is the whole point here), `blessingRow` (`row`,
  exactly 2 `choices`), `capstoneBlessing` (`kind` + `effects`/`condition` per flavor). `nodeEffect`
  loses its rank concept (`perRank` → `value` — a pick is always rank 0 or 1, never stacked) but
  keeps its `{stat, kind, value}` shape unchanged, so `collectBlessingBonuses` needed no logic
  change, only the rename. `traitDef`'s inline `condition` field was extracted into a shared
  `conditionTrigger` object type so the capstone's conditional flavor reuses the exact same
  cross-field validation instead of duplicating it.
- **Content cleanup.** Querying live content turned up 19 of 19 characters carrying old-shape
  `blessingTree` data (not just Mordrek Graveborn's documented 5-node example) — cleared to `[]`
  across the board as part of this branch. Safe: with no write path ever having existed, every
  character's blessing allocation has always been `{}`, so this content was inert (zero bonus
  regardless of its shape) from the day it was authored.

**Consequences.** `player_characters.blessings`'s shape changes from `{ nodeId: ranks }` to
`{ row1..row4: 'a'|'b' }` (column comment updated; no migration needed, jsonb is schemaless) — every
reader (`useRoster`, `TeamPage`, `WinChanceEstimate`, `mission-claim`, `charMaxHp`) now runs picks
through `resolveBlessingAllocations` before calling `effectiveStats`, and both Sanity-querying Edge
Functions (`mission-claim`, `charMaxHp`) flatten their own independently-fetched `blessingTree` via
the shared `flattenBlessingTree` so the `row<N>-<choice>` nodeId format can't drift between the
client and either server path. `CharacterCard`'s Talents tab now shows a real read-only summary of
a character's picks (extracted to its own `TalentsTab.tsx` organism, replacing a second, unrelated
mock — a 6×3 Death-Knight-flavored grid — that would otherwise have sat next to now-real numbers on
the same character sheet) and links out to the real `/blessings` page for the actual picker; no
respec control exists anywhere yet. Phase B (the ability capstone flavor) and Phase C (authoring
real 4-row+capstone trees for all 19 characters, `docs/BLESSINGS.md`, the sizing calc-script) are
follow-up branches, not this one.

**Phase B addendum (2026-07-15) — the ability capstone flavor ships.** `src/lib/combat.ts` gains
`Combatant.ability`, a small fixed union (same hardcoded-mechanic precedent as the ADR-0039 boss
spike, not a generic scripting system):
- **`surviveFatal`** — a hit that would take the unit to ≤0 HP instead clamps it to 1 HP, once per
  fight (`Unit.fatalSaveUsed`). Implemented as a branch right at the existing damage-application
  line; logs a new `'fatal-save'` `CombatEvent` so replay UIs can show it.
- **`partyBuffOnStart`** — a flat/pct stat buff applied to every party `Unit` once, in a new pass
  run right after the ADR-0038 per-fight power roll and before the main loop. Restricted to a fixed
  `AbilityStat` allowlist (`defense`, `resistance`, `critChance`, `critDamage`, `dodge`, `block`,
  `healthRegen`) — the same fields `Unit` exposes directly; `attack`/`spellPower`/`healingPower`
  are pre-routed into a single `power`/`healPower` field by `partyUnit()` and aren't separately
  addressable after construction, so they're not offered. **A dodge buff is re-clamped to
  `COMBAT.DODGE_CAP` immediately after applying** — the buff pass runs after `partyUnit()`'s own
  dodge-cap clamp, so an unclamped add would silently reopen the exact dodge runaway ADR-0029
  fixed once already.

`src/lib/blessings.ts` gains `resolveCapstoneAbility(capstone, earned)`, mirroring
`resolveCapstoneBonuses`'s shape but returning a `CombatAbility | undefined` instead of a stat-bonus
map — the two are mutually exclusive per capstone (an `ability`-kind capstone grants zero stat
bonus; a `stat`/`conditional` one grants zero `CombatAbility`). Every place that already resolves a
character's earned capstone into stats now also resolves it into an ability, threaded through
unchanged: `mission-claim` attaches it per combatant before calling `simulateCombat`; `useRoster`
resolves it once (it isn't trait-context-dependent like the conditional stat flavor, so — unlike
`statInputs.capstone` — it needs no per-mission recompute) and carries it on `RosterMember.ability`
through `DispatchChar` into `WinChanceEstimate`'s 200-run estimate, so a dispatched party's success
% already reflects an earned ability the same way it already reflected traits. `capstoneBlessing.ts`
gains `abilityKind` (radio: `surviveFatal` | `partyBuffOnStart`) and `abilityParams` (`stat`
restricted to the `AbilityStat` allowlist, `kind`, `value`), both hidden/validated conditionally on
`kind`/`abilityKind` so authoring a flat or conditional capstone never shows them. No player-facing
UI changes: `CapstoneCard`/`TalentsTab` already rendered `title`/`kind`/`effects` generically and
degrade gracefully for a kind with no `effects` (ability capstones still show title + "Ability").

## ADR-0046 — Blessing tree content wave 1: per-role fork templates for all 19 characters

**Date:** 2026-07-15 · **Status:** Accepted (Alex)

**Context.** ADR-0045 (+ Phase B) shipped the full blessing mechanism, but every one of the 19
characterDefs still carries `blessingTree: []` and no `capstone` — blessings are wired up end to
end but grant nothing yet (`project_pitfalls.md`'s "blessings are live but do nothing" risk). This
ADR is the content wave that closes it, per docs/BLESSINGS.md's methodology.

**Decision.**
- **Per-role fork templates**, each a genuine build-defining choice, not just a bigger number:
  Damage (7 chars) forks offense vs bulk on 3 rows + an armorPen-vs-crit "finishing move" row;
  Tank (2) forks pure-wall vs off-tank on all 4 rows; Healer (3) forks burst-vs-sustain healing on
  2 rows + a NEW tankiness (health/defense vs more healPower) fork on the other 2 — Alex's explicit
  ask, so a healer can be built survivable, not just a healbot; Utility (4) forks throughput
  (missionSpeedDecrease) vs economy (goldFind/magicFind/luck); Gatherer (3) forks resource-flavored
  gatherSpeed/Yield on 2 rows + a NEW hybrid-combat (keep-gathering vs attack/damage) fork on the
  other 2 — also Alex's explicit ask, so a gatherer can meaningfully dps if specced that way.
- **Auras are capstone-only, confirmed explicitly** (no row-level party buffs) — but Alex wants
  them to actually exist this wave, not just be theoretically supported by the Phase B engine: 4
  characters (Brom, Aldric, Lyra, Gort) get `partyBuffOnStart` capstones, 2 (Mordrek, Vex) get
  `surviveFatal` — a real spread across roles, not clustered on one. Remaining 13 split
  stat/conditional (roughly 6 ability / 6 conditional / 7 stat overall across all 19).
- **Row-conditional schema gap, resolved.** `blessingChoice` has no `condition` field (only
  `capstoneBlessing` does) — a literal "+yield only while gathering Wood" row pick isn't buildable
  without new engine work. Chose the zero-engine-work path: gatherer rows are unconditional,
  flavored toward the signature resource (mirrors the existing `Quickhand` trait's `always`-
  condition pattern). True row-level conditions are a possible future engine PR, not this wave.
- **Budget: 20 `STAT_PRICE` points per row, 30 for a stat/conditional capstone, flat across
  rarity** (matches ADR-0045's existing flat-pricing decision — blessing magnitude is the one
  lever that isn't rarity-scaled). `ability` capstones aren't priced; a `partyBuffOnStart` is
  discounted to ~40% of an equivalent solo `stat` grant since it hits the whole party at once. This
  is a single adjustable constant translating ADR-0040's "~×3.4–6 combined gear+blessings at L50"
  target into blessings' smaller, secondary share (gear does the larger climb) — nothing else
  depends on its exact value.
- **Studio validators don't run for MCP-authored content** (they're Sanity Studio client-side rules
  only) — `patch_documents` skips the equal-cost/shape checks entirely, so a scratchpad calc-script
  must manually replicate them before writing, and content gets read back and re-verified after.
- **Piloted first**: Mordrek Graveborn (tank, `surviveFatal` — first real content to exercise the
  Phase B ability engine, and closes the loop ADR-0045's content-cleanup opened when it wiped his
  old 5-node data), Tyla Windcarrier (healer, both NEW sub-axes at once, conditional capstone
  extending her existing `Vigilkeeper` precedent), Gort Deepvein (gatherer, both NEW sub-axes at
  once, `partyBuffOnStart` capstone, forces the pct/calc-script workflow). Damage/Utility deferred
  to the full wave as the lowest-risk, plain-flat-fork shapes.

**Consequences.** The "blessings live but do nothing" pitfall closes for every authored character.
Still open, not this ADR: a dedicated `blessingBudget.ts` validator script (mirrors the still-open
`itemBudget.ts` TODO from ADR-0044), re-deriving the balance harness's power-tier proxy from real
blessing content (ADR-0040's own ask), gather `BonusTag` UI wiring for blessing-sourced gather
bonuses, the Option-B row-level-conditions engine work if ever wanted, and respec (unchanged,
still permanent-in-v1 per ADR-0045).

## ADR-0047 — Blessing respec: gold-cost, all-or-nothing tree wipe via a dedicated page

**Date:** 2026-07-15 · **Status:** Accepted (Alex)

**Context.** ADR-0045 made blessing picks permanent by explicit design and deferred respec as an
open TODO ("cost/mechanism TBD" — `TODO.md`, `docs/BLESSINGS.md`). ADR-0046's consequences section
still listed it as "unchanged, still permanent-in-v1." Alex asked for it to be built: a new
dedicated page where you pick a character from the roster and press a button (enabled once
selected) to respec them.

**Decision.**
- **Costs gold** — a flat `RESPEC_COST` constant (`src/lib/blessings.ts`), not free or
  cooldown-gated. Chosen specifically because it doubles as an intentional resource sink
  (`project_pitfalls.md`'s "no resource sink" risk) — a second sink alongside infirmary upgrades.
  Resolved **server-side only**: the `blessing-respec` Edge Function imports `RESPEC_COST` directly
  and passes it to the RPC; the client's request body only ever carries `characterId`, mirroring
  how `infirmary-upgrade` resolves `UPGRADE_COSTS` itself rather than trusting a client-supplied
  price (ADR-0003).
- **All-or-nothing wipe, not per-row.** Rows 2–4 structurally require the previous row already
  picked (`choose_blessing` enforces this server-side) — a partial respec (e.g. clearing only row3)
  would leave the tree in an invalid state unless it also cascaded. `respec_blessings` resets
  `blessings` to `'{}'::jsonb` in a single transaction instead.
- **New `respec_blessings` RPC** (`20260715140000_blessing_respec.sql`), mirroring
  `choose_blessing`'s lock/ownership/busy-check idiom (blocked while on a mission/gathering/in the
  infirmary — respeccing mid-activity is nonsensical) plus `upgrade_infirmary`'s lock-profile/
  verify-balance/deduct idiom, collapsed to a single scalar gold check (no currencies-map — the
  project has exactly one currency today). Also rejects a no-op respec (`blessings = '{}'`) so
  gold isn't charged for nothing.
- **New dedicated `/respec` page**, not folded into `/blessings` — reuses `BlessingsPage`'s
  roster-rail + detail-panel visual idiom (a small local `CharacterRow`, not the mismatched
  `PartyRoster` organism or a cross-feature import of `BlessingsPage`'s internals, per ADR-0010).
  No confirmation modal — pressing the button is the whole interaction, by explicit request.

**Consequences.** Supersedes ADR-0046's closing note ("respec... still permanent-in-v1"); the
`TODO.md` "Blessing respec" line is now done. `RESPEC_COST = 500` is a first-pass, adjustable
constant (same provisional status as `UPGRADE_COSTS`) — revisit once playtesting shows real gold
income rates. No change to the blessing schema, content, or combat engine.

## ADR-0048 — Character acquisition economy: varied unlock sources + blind-surprise recruit screen

**Date:** 2026-08-20 · **Status:** Accepted (Alex)

**Context.** `recruit` (the Edge Function) had **zero acquisition gate** — any signed-in player
could recruit any authored character for free, once (only `UNIQUE(player_id, character_def_id)`
stopped duplicates), and there was no recruit UI anywhere in the app (`useRecruit()` existed but
was called from nowhere). TODO.md's "Character acquisition economy" line (`project-undecided`,
ADR-0031) had been open since character rarity shipped. Design worked out in
`docs/superpowers/specs/2026-08-20-character-acquisition-design.md` (PR #81); this ADR records
the decision that spec's implementation (this branch, PR #82) actually shipped.

**Decision.**
- **Varied, thematic unlock sources, not one gold-purchase model.** Six condition types
  (`characterLevel`, `statThreshold`, `resourceTotal`, `goldTotal`, `missionTimeTotal`,
  `mapCompletion`), plus `lootDrop` authored on a mission's loot table rather than the character
  (symmetric with how items work). Every character always carries a `goldCost` regardless of
  type — a condition gates *eligibility*, it never replaces the price.
- **Full blind surprise, not silhouette-and-count.** The client never queries "which characters
  exist that I haven't unlocked" — `fetchRecruitCandidates` (`src/services/recruits.ts`) only ever
  fetches `characterDef`s already named in the player's own `unlocked_characters`. A locked
  character's name, condition, or progress is never sent to the client before it unlocks.
- **Unlocking is permanent and non-blocking.** Once a condition fires, the character sits in
  `unlocked_characters` (new `profiles` JSONB column, ADR-0004 registry pattern) forever — not
  time-limited, not lost if the player can't afford it yet. Declining to buy right now costs
  nothing; the Hire button just stays disabled, never hidden.
- **All discovery is a byproduct of `mission-claim`/`gather-collect`, never a background job or
  client poll** (ADR-0003 consistency): both Edge Functions evaluate not-yet-unlocked conditions
  against the player's just-updated state in the same transaction as the reward, write newly-met
  keys into `unlocked_characters`, and return them as `newlyUnlocked` so the claim/collect UI can
  fire the reveal moment in context. A new `profiles.lifetime_stats` JSONB column (same registry
  pattern, `src/lib/lifetimeStats.ts`) backs the three condition types with no prior tracking
  (`goldEarned`, `missionSecondsSent`, `resourceGathered.<key>`), incremented in the same RPCs
  that already grant those rewards.
- **New atomic `recruit_character` RPC**, shaped like `start_mission`/`claim_mission`: re-validates
  `unlocked_characters` contains the charKey (or the character is gold-only with no condition) and
  `currencies.gold >= goldCost` server-side — never trusts the client — deducts gold and inserts
  the `player_characters` row in one transaction. Row-locked on the gold check
  (`03cdc0f`) to close a concurrent-double-recruit race; `unlocked_characters` writes are
  idempotent so two near-simultaneous claims can't both fire the same reveal twice.
- **New `/recruits` route**, first-ever recruit screen: lists only what's unlocked, Hire button
  disabled+tooltipped (never hidden) when gold is short. Nothing about locked characters renders —
  an empty list just encourages more play, no count or hint.
- **Wave-1 content**: all 19 characters authored — 7 named-condition unlocks (Nira/Rowan
  `resourceTotal` wood, Gort `resourceTotal` copper, Brom `missionTimeTotal`, Vex `statThreshold`
  attack, Aldric `characterLevel`, Lyra `goldTotal`), Mordrek Graveborn via `mapCompletion`
  (Gravemarch stage 7), Callum Emberveil via `characterLootDrop` (3% off the Embercrag boss), the
  remaining 11 gold-only. `goldCost` scales by rarity (Common 200 → Uncommon 500 → Rare 1000 →
  Epic 2500); the empty Legendary tier stays an open question (ADR-0031), not resolved here.

**Consequences.** Closes the TODO.md "Character acquisition economy" line (`project-undecided`
dropped). Deferred to follow-up, tracked as open gaps rather than silently skipped:
- **No test coverage for the `recruit_character` RPC/Edge Function path itself** — this repo has
  no pgTAP/Deno test infra for SQL or Edge Functions at all, so RPC-level coverage needs that infra
  built first, not invented ad hoc for this feature. (The client-side wrapper `recruitCharacter`
  and the blind-surprise-critical `fetchRecruitCandidates` filter, `src/services/recruit.ts` and
  `recruits.ts`, are now covered — `recruit.test.ts`, `recruits.test.ts`.)
- **`database.types.ts` needs a full `supabase gen types` regen** once a DB connection is
  available — it was hand-patched for the two new `profiles` columns only; `recruit_character`'s
  signature and the extended `claim_mission`/`collect_gather` signatures aren't reflected.
- **Wave 2** (`elementalMastery`, `comebackMoment` conditions) needs new signal capture inside
  `combat.ts`'s sim and is gated behind the combat-change playbook (`docs/BALANCE.md`) — its own
  branch, ADR, and balance-sweep evidence, not folded into this one.
- No change to the blessing, item, or combat systems.
