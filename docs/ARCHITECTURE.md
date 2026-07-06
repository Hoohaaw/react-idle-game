# The Idle Game — Architecture & Developer Guide

The technical orientation for the **current** project. If you're new to the codebase, read this first:
it explains what we're building, how the pieces fit together, the core engineering rules, and how to
run it locally.

- **Why** a given choice was made (and the alternatives we rejected) → [`DECISIONS.md`](./DECISIONS.md) (ADR log).
- **What's left to build** → [`../TODO.md`](../TODO.md).
- **Legacy prototype** (Express/Mongo/EJS — different stack, kept only for carried-over game values) →
  [`../TECHNICAL.md`](../TECHNICAL.md). Do not treat it as current.

> This is a **work in progress**. Sections marked _Planned_ aren't built yet; sections marked _Open_
> are deliberately undecided. Keep this doc honest — update it as reality changes.

---

## 1. What we're building

A browser-based **idle / incremental RPG**. The player builds a roster of hand-authored characters and
progresses them through:

- **Missions** — send a party on timed runs. Core loop is **real-time combat where all stats matter**,
  and **missions can fail** (combat damage persists between runs). _(Combat model is partly Open — see §7.)_
- **Gathering** — assign characters to resource nodes (mines) that accrue materials over time.
- **Gear** — 14 equip slots (8 gear + 4 ring + 2 trinket), freely swappable.
- **Crafting** — recipe-based "crafting circle" (infuse + create); locked recipes are hidden until discovered.
- **Upgrading** — combine duplicate items (5 same item+rarity → 1 of the next rarity).
- **Blessings** — a **bespoke, hand-authored talent tree per character** (WoW-classic style, 7 rows).
- **Transcendence** — prestige: keep characters, reset levels to 1 for a permanent reward multiplier.

This is a **rewrite** of an earlier prototype and is **fundamentally different** from it (see the legacy
note above). Mobile is desired but **desktop-first** for now.

---

## 2. Tech stack

| Concern | Choice |
|---|---|
| UI | **React 19** + **Vite** + **TypeScript** (strict) |
| Routing | **react-router-dom v7** |
| Local state / stores | **Zustand** (minimal global state) |
| Server state / data fetching | **TanStack Query** |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) + a bespoke design-system layer in `index.css` |
| Animation | **Framer Motion** (UI transitions) + CSS sprite sheets (WebP) for character states |
| Player backend | **Supabase** — Postgres, Auth, Edge Functions, Storage; local-first via the Supabase CLI (Docker) |
| Authored content | **Sanity** (headless CMS) — Studio lives in-repo at `studio/` |
| Testing | **Vitest** + React Testing Library; **Playwright** for e2e; local Supabase for backend tests |

---

## 3. The big picture: definition / instance / logic split

The single most important architectural idea (see [ADR-0001](./DECISIONS.md#adr-0001--definitioninstance-split-sanity-for-content-supabase-for-runtime)).
Data is split by its nature:

```
        AUTHORED CONTENT                 PER-PLAYER RUNTIME              GAME LOGIC
        (read-only to players)           (mutated only by server)       (server-authoritative)

   ┌────────────────────────┐      ┌────────────────────────┐    ┌────────────────────────┐
   │        Sanity          │      │   Supabase / Postgres  │    │  Supabase Edge Funcs   │
   │  characterDef, blessing│      │  profiles,             │    │  recruit, level-up,    │
   │  trees, (planned:      │◀─────│  player_characters,    │◀───│  claim, blessing-spend,│
   │  missions/items/loot/  │ read │  player_inventory,     │    │  transcend, …          │
   │  recipes)              │ defs │  mission_runs,         │    │  (validate vs Sanity,  │
   │                        │      │  gather_assignments    │    │   then write via       │
   └────────────────────────┘      └────────────────────────┘    │   service role)        │
        linked by `charKey`              owns integrity:          └────────────────────────┘
        (stable string, not _id)         FKs, RLS, constraints
```

- **Definitions** (identical for every player) live in **Sanity**. Adding/rebalancing content never
  touches player data.
- **Instances** (per-player progress) live in **Supabase**.
- **Logic** lives in **Edge Functions**, which fetch the relevant Sanity def (cached) to validate every
  write. _(Edge Functions are **Planned** — none exist yet.)_
- The two systems are linked by a stable string key (`charKey`), never Sanity's internal `_id`.

---

## 4. Repository layout

```
the-idle-game/
├─ CLAUDE.md                 # working agreement: git workflow + structure conventions (read first)
├─ src/                      # React SPA (feature modules + atomic-design shared kit — see ADR-0010)
│  ├─ features/              # per-domain modules; `missions/` is the exemplar (see src/features/README.md)
│  │  └─ <feature>/          #   components/ + <Feature>Page.tsx + index.ts (public barrel)
│  ├─ components/            # shared, domain-agnostic UI kit
│  │  ├─ atoms/              # smallest UI units (Button, CoinDisplay, ResourceChip, RoleBadge, …)
│  │  ├─ molecules/          # small compositions (ItemTile, MineCard, SectionLabel, …)
│  │  ├─ organisms/          # shared blocks (CharacterCard, CraftingCircle, GameHeader, Modal, …)
│  │  └─ templates/          # page scaffolds (GameLayout, PagePlaceholder)
│  ├─ pages/                 # routed pages NOT yet migrated to features/ (Mines, Team, Crafting, … + DesignPage)
│  ├─ lib/                   # framework-agnostic logic & registries (see §6)
│  ├─ services/              # Planned — typed data-access layer (Supabase + Sanity calls)
│  ├─ types/                 # shared TS types (item, loot, recipe)
│  └─ sanity.types.ts        # GENERATED from the Sanity schema (typegen)
├─ .github/workflows/        # CI — lint.yml (ESLint on every push & PR)
├─ studio/                   # Sanity Studio — standalone package, schema-as-code
│  └─ schemaTypes/           # characterDef + objects/{blessingNode,nodeEffect,statValue,statGrowth}
├─ supabase/
│  ├─ migrations/            # SQL migrations (player_characters, player_inventory, activities, profiles)
│  ├─ functions/             # Planned — Edge Functions (Deno)
│  └─ config.toml
├─ docs/                     # ARCHITECTURE.md (this file) + DECISIONS.md
├─ TODO.md                   # roadmap
├─ TECHNICAL.md              # LEGACY (old prototype reference)
└─ todo-reviews/             # local-only (gitignored) advisory TODO reviews
```

**Two layers sit side by side** ([ADR-0010](./DECISIONS.md#adr-0010--feature-based-modules-alongside-atomic-design--branch-per-task-workflow)):
**atomic design** (atoms → molecules → organisms → templates) is the **shared UI kit** in
`src/components/`, and **feature modules** in `src/features/<feature>/` own each game domain (its page,
feature-specific components, and later hooks/data/types/store). The rule: code used by one feature lives
inside it; the moment a second feature needs it, promote it up to the shared layer. Features expose a
**public barrel (`index.ts`)** and never reach into each other's internals; the **`@/` alias** (`@`→`src`)
keeps imports clean. Migration is **incremental** — `missions/` is the exemplar, other domains still live
in `src/pages/` until migrated (one feature per branch). Presentation and logic stay separate: components
render; `src/lib` holds the rules; the (planned) `src/services` layer owns data access. Components target
~200 lines. **Contribution flow and conventions live in [`../CLAUDE.md`](../CLAUDE.md).**

---

## 5. Data model

### 5.1 Sanity (authored content) — **Built**

Project `Idle-Game` (`q6f4y8es`), dataset `production` (**public** ACL → token-free reads).
Schema is managed from the in-repo Studio and deployed with `npm --prefix ./studio run schema:deploy`.
Types are generated to `src/sanity.types.ts` (config in `studio/sanity-typegen.json`); both the app and
Edge Functions import from there.

- **`characterDef`** — `name`, `charKey` (stable lowercase-hyphen link key), `charClass` (one of 16),
  `baseStats` (`[{stat, value}]`), `growth` (`[{stat, perLevel, milestones:[{level,bonus}]}]`), and
  `blessingTree` (a nested **array of `blessingNode`** — the whole tree on one document).
- **`blessingNode`** — `nodeId`, `title`, `description`, `row` (1–7), `col`, `maxRank`, `isUltimate`,
  `effects` (`[{stat, kind: flat|pct, perRank}]`), `requires` (`nodeId[]` — prereq arrows within the tree).
- _Planned:_ `missionDef`, `itemDef`, `lootTable`, `recipe` schemas.

The `stat` field everywhere is constrained to the **shared code registry** (`src/lib/statDefinitions.ts`),
so adding a stat needs no Sanity schema change. **Role defaults from `charClass`** but can be **overridden
per character** via an optional `role` field ([ADR-0008](./DECISIONS.md#adr-0008--character-role-authored-per-character-class-provides-the-default)); `resolveRole()` in `src/lib/roles.ts` applies the precedence.

### 5.2 Supabase (player runtime) — **Built (local)**

Local stack via `npx supabase start` (Docker). Ports: API `54321`, DB `54322`, Studio `54323`,
Mailpit `54324`. No hosted cloud project yet (created at deploy time).

Every table follows the same security shape (see §6): **RLS owner-read only, no client writes, explicit
GRANTs.** `*_def_id` columns are Sanity/config keys (loose refs validated server-side).

| Table | Shape (key columns) | Notes |
|---|---|---|
| **`profiles`** | `player_id` (PK→auth.users), `currencies` jsonb, `resources` jsonb, `transcendence_count` int, `created_at` | 1:1 with the user. The "wallet". Auto-created by a signup trigger ([ADR-0005](./DECISIONS.md#adr-0005--profile-creation-db-trigger-safety-net--edge-function-for-onboarding)). Balances are registry-keyed JSONB ([ADR-0004](./DECISIONS.md#adr-0004--extensible-currencies--resources-via-registry-driven-jsonb)). |
| **`player_characters`** | `id`, `player_id`, `character_def_id` (=charKey), `level` (1–50), `xp`, `blessings` jsonb `{nodeId:ranks}`, `equipped` jsonb `{slot:{itemDefId,rarity}}`, `acquired_at` | Stores only **intent** — no stat values ([ADR-0002](./DECISIONS.md#adr-0002--compute-on-read-character-stats)). `UNIQUE(player_id, character_def_id)` = one of each character, ever. |
| **`player_inventory`** | `id`, `player_id`, `item_def_id`, `rarity` (Common…Legendary), `quantity` (>0), `acquired_at` | Bagged stacks keyed `(player, item_def_id, rarity)`. Feeds duplicate-upgrade. Equipped gear lives on `player_characters.equipped`, not here. |
| **`mission_runs`** | `id`, `player_id`, `mission_def_id`, `party` uuid[] (1–3), `started_at`, `ends_at` | One-shot. Claim = validate `now ≥ ends_at`, grant rewards, delete. |
| **`gather_assignments`** | `id`, `player_id`, `player_character_id`, `resource_id`, `started_at`, `last_collected_at` | Continuous accrual. `UNIQUE(player_character_id)`. |

A character is in **at most one** activity at a time — enforced in Edge Functions (gather also has a
per-table UNIQUE).

> **Update (2026-07-05):** the backend is now **hosted** (project `nqaitmbwmuwpnpqatsfs`), not just local.
> `player_characters` gained **`current_hp`** (int, nullable = full, `0` = downed; clamped `[0, maxHp]`
> on read — [ADR-0013](./DECISIONS.md#adr-0013--combat-sim-v1--seeded-action-timeline-auto-battle-passive-stats-only)).

---

## 5.3 The mission → combat → claim → heal loop — **Built & verified (hosted)**

The full gameplay cycle works end-to-end (verified in-browser 2026-07-05). ADRs
[0012](./DECISIONS.md#adr-0012--combat-resolution--reward-model-auto-battle-sim-at-claim-win-gates-margin-scales)–[0017](./DECISIONS.md#adr-0017--mission-claim-v1-gear-in-the-sim-survivor-xp-item-rarity-scaling-mission-start).

**The loop:** dispatch a party → real-world wait timer → **claim** (a seeded auto-battle sim resolves
the fight) → on a win: scaled coins/resources + independent loot rolls + survivor XP; win or lose:
per-character ending HP persists → damaged/**downed** characters recover at the **infirmary** → repeat.

**Pieces:**
- **Combat sim** — `src/lib/combat.ts`: pure, seeded (by `mission_run` id), action-timeline auto-battle
  → `{ outcome, endingHp[], survivingHpPct }`. Deterministic, so the client can replay it. Constants in
  a `COMBAT` header block (ADR-0015, first-pass). Unit-tested (`combat.test.ts`).
- **Stat engine** — `src/lib/stats.ts`: `effectiveStats()` = level baselines + blessings + **gear**
  (`RARITY_MULT` ×2/step, ADR-0017); `finalReward` = `base × (1+margin)(1+level)(1+party)(1+transcendence)`.
- **RPCs** (`supabase/migrations/…_mission_rpcs.sql`, SECURITY DEFINER, service-role only):
  `start_mission` (validate party owned/not-downed/not-busy/size, row-locked → insert run) and
  `claim_mission` (apply the resolved outcome in one transaction; the **double-claim guard** = atomic
  conditional `DELETE … WHERE now() ≥ ends_at` lives inside it).
- **Edge Functions** (server-authoritative, ADR-0003):
  - `mission-start` — resolves the authored duration from Sanity → `start_mission`.
  - `mission-claim` — the resolver: fetch defs → effective stats (w/ gear) → run the sim → survivor XP +
    scaled rewards + loot rolls → `claim_mission`. **Imports the pure `src/lib` engine directly** (ADR-0016);
    deploy via the **Supabase CLI** (bundles cross-dir imports from disk — the MCP deploy won't).
  - `heal` — infirmary: sets `current_hp = null` (= full). First-pass: instant + free.
- **Content (Sanity)** — `missionDef` (encounter ref + `durationSeconds` + `baseXp` + `rewards[]` +
  `loot[]`), `itemDef` (equip slot + base stat bonuses), `enemyDef`/`encounterDef`, `characterDef`.
  All **drafts** for now ([content drafts-only]).
- **App** — `src/services/{missions,items,heal,recruit,playerCharacters,characters}.ts`;
  `src/features/missions/hooks.ts` (`useMissions`/`useMissionRuns`/`useRoster` + start/claim mutations);
  pages `features/missions/MissionsPage` (dispatch + active runs + claim) and
  `features/infirmary/InfirmaryPage` (heal). `/design` keeps unauthed mock prototypes; the live loop is
  behind `RequireAuth` on `/missions` + `/infirmary`.

**Reward specifics (ADR-0017):** XP → **survivors only, full `baseXp` each**, then scaled. Rates:
`margin = survHP%×0.5`, `level = avgPartyLvl×0.004`, `party = (size−1)×0.10`, `transcendence = count×0.10`.
Item rarity scaling **×2/step** (Common…Legendary = 1/2/4/8/16). All **first-pass, tunable**.

**Failure path:** a lost fight (`party-wiped` / `timeout`) is fully surfaced — `ClaimReward` renders a
**Defeat** variant (no rewards, reason line, per-character `DOWNED` HP bars, "heal at the infirmary"
prompt); its footer button closes the modal via `onDone`. Both variants preview on `/design`. A character
can also fall on a **win** (party wins with a member at 0 HP → Victory header, `DOWNED` bar). To exercise
the loss path there's a deliberately brutal **test mission "Trial of Ruin"** (Sanity draft: `mission.trial-of-ruin`
→ `enemy.bone-colossus`, HP 2000 / atk 45, 3s wait) — a guaranteed party-wipe for a low-level party
(verified 200/200 seeds). Kept as a permanent testing aid, not shipping content.

**First-pass / deferred:** infirmary heal-rate/cost/capacity (currently instant+free); `transcendence_count`
not yet fed to dispatch/claim (passing `0` — needs a profile hook); no gather/transcendence loops yet;
combat constants + loot odds unbalanced; character sprite art (avatars are placeholders); foregrounding a
death on a *win* (currently only a small `DOWNED` bar under the Victory header).

---

## 6. Core engineering principles

These are the rules every new feature must respect.

### Compute-on-read stats (anti-tamper) — [ADR-0002](./DECISIONS.md#adr-0002--compute-on-read-character-stats); growth model [ADR-0006](./DECISIONS.md#adr-0006--character-growth-flat-per-level--additive-milestones)
Never store derived stat values. The player row holds only `level`, `xp`, the blessing map, and equipped
refs. Effective stats are computed server-side from `level` + the immutable Sanity def:

```
baseline(stat, L) = base + perLevel×(L − 1) + Σ(milestones where level ≤ L)   # growth is ADDITIVE
effective(stat)   = baseline + Σ(flat bonuses) + baseline × (Σ(pct bonuses) / 100)
```

### Reward pipeline
```
final = base × (1 + statBonus) × (1 + partySizeBonus) × (1 + transcendenceBonus)
```
`statBonus` = 0.1% per point of every **reward-flagged** stat ([ADR-0007](./DECISIONS.md#adr-0007--decouple-reward-eligibility-from-stat-category)) — a curated set of 9 core power stats (attack, strength, agility, speed, intelligence, spell power, haste, health, defense — [ADR-0009](./DECISIONS.md#adr-0009--stat-vocabulary-expansion--wow-style-routing)). Combat-depth stats (crit, dodge, …) and economy stats (magic find, luck, …) carry a gameplay effect but are `reward:false`, so they never inflate loot.
_(How real-time combat interacts with this is **Open** — see §7.)_

### Server-authoritative writes — [ADR-0003](./DECISIONS.md#adr-0003--server-authoritative-writes-clients-never-mutate-game-state)
Clients **read their own rows only** (RLS); **no client INSERT/UPDATE/DELETE** anywhere. All mutations go
through Edge Functions (service role, bypasses RLS) after validating against Sanity. Per-table GRANTs are
required **in addition to** RLS (the new Supabase default does not auto-expose tables):
`authenticated`→SELECT, `service_role`→full DML, `anon`→nothing. The service-role key is used **only inside
Edge Functions**, never in the client bundle.

### Registry-driven extensibility — [ADR-0004](./DECISIONS.md#adr-0004--extensible-currencies--resources-via-registry-driven-jsonb)
Open-ended sets are defined once in code and stored as JSONB keyed by those keys, so growing them needs no
migration:

| Registry | File | Backs |
|---|---|---|
| Stats | `src/lib/statDefinitions.ts` | Sanity `baseStats`/`growth`/`effects`; computed stats |
| Currencies | `src/lib/currencies.ts` | `profiles.currencies` |
| Resources | `src/lib/resources.ts` | `profiles.resources`; gathering |

Adding a stat / currency / resource = **one entry, no DB or Sanity schema change.** An absent JSONB key
means a zero balance.

### Other `src/lib` helpers
`stats.ts` (the **stat engine** — baselines, stacking, blessing bonuses, reward pipeline; unit-tested),
`roles.ts` (class→role map + the 5 roles), `rarity.ts` (rarity palette/logic), `time.ts`, `upgrade.ts`,
plus `mockInventory.ts` / `mockRecipes.ts` (placeholder data to be replaced by real reads).

---

## 7. Open questions that affect architecture

Don't assume answers to these — they're tracked in design notes and `TODO.md`:

- **Reward model vs real-time combat** (foundational): do stats drive the _outcome_ (win/lose/speed/
  survival) or a flat reward %? Resolve before building the reward half of the stat engine and combat.
- **Transcendence reset scope**: besides levels, does it reset blessings? gear? recruitment? And how does
  the Paragon endgame layer work?
- **Mission-failure consequences + infirmary**, **resource sinks**, **loot-odds scaling / drop caps**,
  **item rarity stat-scaling**, **recipe discovery methods** — all Open.

---

## 8. Local development

**Prerequisites:** Node 20+ (Sanity v3 / upcoming v4), Docker (for the Supabase stack).

```bash
# 1. App
npm install
npm run dev                         # Vite dev server (http://localhost:5173)

# 2. Supabase (player backend) — needs Docker running
npx supabase start                  # boots Postgres/Auth/REST/Studio in Docker
npx supabase migration up           # apply pending SQL migrations to local DB
#  Studio: http://127.0.0.1:54323  ·  API: http://127.0.0.1:54321

# 3. Sanity Studio (authored content)
npm --prefix ./studio run dev       # author content locally
npm --prefix ./studio run schema:deploy   # push schema changes
npm --prefix ./studio run typegen         # regenerate src/sanity.types.ts
```

**Environment** (`.env.local`, gitignored; see `.env.example`):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (the publishable `sb_publishable_…` key). Vars are typed in
`src/vite-env.d.ts`.

**Migrations:** plain SQL in `supabase/migrations/`, timestamp-prefixed. Match the existing files'
conventions (lowercase SQL, `comment on table`, RLS + owner-select policy, explicit GRANTs). Apply with
`supabase migration up`; `supabase db reset` re-runs everything from scratch.

**Known gaps:** typed DB types are **deferred** — `supabase gen types` in the current CLI demands a login
even for `--local`. After `npx supabase login`, generate to `src/types/database.types.ts` and switch the
client to `createClient<Database>`.

---

## 9. Conventions

- **Decisions** go in [`DECISIONS.md`](./DECISIONS.md) as numbered ADR entries — append a new one whenever
  a notable choice is made; mark superseded entries rather than deleting them.
- **Roadmap** is [`../TODO.md`](../TODO.md); each item carries a `↳ context:` anchor.
- **Design system:** a bespoke dark-red/gold fantasy theme with a 5-layer `.atom-heavy` shadow language,
  purple XP, a rarity palette, and a portal-tooltip rule (overlays portal to `document.body` so ancestors
  can't clip them). Prototyped live on the `/design` page before extraction into atoms.
- **Status:** see §5 / `TODO.md`. Built: design system + component library, Sanity schema (deployed),
  the five Supabase tables (RLS + grants), the Supabase client + env wiring, the currency registry, and the **stat engine** (`src/lib/stats.ts`, unit-tested).
  Planned next: DB types, then the first Edge Functions and real data reads.
