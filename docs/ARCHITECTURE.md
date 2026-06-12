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
├─ src/                      # React SPA (atomic design)
│  ├─ components/
│  │  ├─ atoms/              # smallest UI units (Button, CoinDisplay, ResourceChip, RoleBadge, …)
│  │  ├─ molecules/          # small compositions (MissionCard, ItemTile, MineCard, …)
│  │  ├─ organisms/          # feature blocks (CharacterCard, MissionDispatch, CraftingCircle, GameHeader, Modal, …)
│  │  └─ templates/          # page scaffolds (GameLayout, PagePlaceholder)
│  ├─ pages/                 # routed pages (Missions, Mines, Team, Blessings, Crafting, Shop, … + DesignPage)
│  ├─ lib/                   # framework-agnostic logic & registries (see §6)
│  ├─ services/              # Planned — typed data-access layer (Supabase + Sanity calls)
│  ├─ types/                 # shared TS types (item, loot, recipe)
│  └─ sanity.types.ts        # GENERATED from the Sanity schema (typegen)
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

**Atomic design** (atoms → molecules → organisms → templates → pages) is the component convention.
Presentation and logic are kept separate: components render; `src/lib` holds the rules; the (planned)
`src/services` layer owns data access. Components target ~200 lines.

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
so adding a stat needs no Sanity schema change. **Role is derived in code** from `charClass`
(`src/lib/roles.ts`), never stored.

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
`statBonus` = 0.1% per point of **offensive + defensive** stats (the `misc` category does not feed it).
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
