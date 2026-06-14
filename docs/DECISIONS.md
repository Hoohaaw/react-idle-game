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
